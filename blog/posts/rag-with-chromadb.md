When people say "let's add RAG," they usually picture one box labeled *vector database*. The version that survives production looks different: the database your app already trusts stays the source of truth, and the vector index is a **separate, rebuildable** thing bolted on the side. This ChromaDB module is built exactly that way — **MongoDB for content, ChromaDB for vectors, Ollama or Claude for generation** — and it leans on document-aware retrieval to handle the queries that break naive setups.

## Decoupled by design

The architecture deliberately separates two concerns that beginners tend to merge:

| Component | Tech | Purpose |
|---|---|---|
| Content DB | MongoDB | Primary, transactional content storage |
| Vector DB | ChromaDB | High-dimensional similarity index |
| Embedder | Ollama `nomic-embed-text` | 768-dim local embeddings |
| Generation | Ollama `gemma4:e2b` / Claude | Offline fallback / cloud structuring |

Why bother keeping them apart? Because a vector index is a *derived* artifact. If you treat ChromaDB as your primary store, every schema change or reindex becomes a migration. If MongoDB stays the source of truth, you can drop and rebuild the entire vector index whenever you change embedding models or chunking strategy — your real data never moves.

## The three phases

The pipeline is three small Go services, run in order:

1. **Seed** — the content seeder loads raw, plain-text policy documents into MongoDB.
2. **Ingest** — the ingestion service reads those entries, sends each to Ollama's embeddings API for a 768-dimensional vector, and loads **both the raw text and the vector** into ChromaDB.
3. **Retrieve** — an HTTP server serves a dashboard at `localhost:8080`. On each query it embeds the text, runs a vector similarity search in ChromaDB, builds an augmented prompt, and streams a formatted answer back.

Storing the raw text *alongside* the vector in step 2 is what lets retrieval build a grounded prompt without a second round-trip to Mongo — the match carries its own context.

## Keyword-sensitive filtering

The retrieval step is where this stops being a textbook example. ChromaDB supports a `where_document` filter — a keyword constraint applied *during* the similarity search. Short, single-token queries route through that filter so a literal term is actually matched, instead of being smeared across the embedding space. Abstract, sentence-length queries go straight to dense semantic search. And when a filtered search comes back empty, it falls back to pure vector similarity rather than returning nothing.

The mechanics are a handful of lines. For a single-token query, constrain the similarity search with `where_document`; if that constraint matches nothing, drop it and rerun as pure vector search:

```go
reqPayload := map[string]any{
    "query_embeddings": [][]float32{queryVector},
    "n_results":        2,
}
// Single-token query → only consider docs that literally contain it.
if !strings.Contains(strings.TrimSpace(rawQuery), " ") {
    reqPayload["where_document"] = map[string]any{"$contains": rawQuery}
}

// ... POST /query ...

// Fallback safety: filter matched nothing → drop it and rerun semantically.
if len(result.Documents) == 0 || len(result.Documents[0]) == 0 {
    delete(reqPayload, "where_document")
    // ... rerun the query without the constraint ...
}
```

If that pattern sounds familiar, it's the same document-aware routing idea applied with Chroma's own primitive (`where_document`) instead of Qdrant's payload filter. The lesson generalizes across vector stores: **inspect the query, pick the right tool, keep a fallback.**

## Three output formats from one pipeline

The augmented prompt carries a requested format — **Human Prose**, **Markdown Table**, or **Structured JSON** — and the response is streamed back to the dashboard in that shape. One retrieval pipeline, three consumers: a person reading prose, an analyst scanning a table, a script parsing JSON.

## Running it

ChromaDB runs cleanly in Docker:

```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
docker run -d -p 8000:8000 --name chromadb chromadb/chroma:latest
ollama pull nomic-embed-text
ollama pull gemma4:e2b
```

Then:

```bash
go run seed/main.go      # MongoDB ← raw articles
go run ingest/main.go    # ChromaDB ← text + 768-dim vectors
go run retrieve/main.go  # dashboard on :8080  (export ANTHROPIC_API_KEY for Claude)
```

Open `localhost:8080`, try `"working remotely"` or `"health benefits"`, pick a format, and watch the augmented answer come back.

## What works, and what to take away

- **The vector index is derived, not primary.** Let your real database own the truth; treat the index as something you can rebuild on a whim.
- **Store text with the vector.** Carrying the raw chunk in the index removes a retrieval round-trip and makes grounding trivial.
- **Use the store's own filter primitive.** Chroma's `where_document` (like Qdrant's payload filter) is the right home for keyword-sensitive routing.
- **One pipeline, many formats.** Threading the output shape through the prompt is nearly free and doubles the number of consumers you can serve.

You don't need a heavyweight platform to do RAG well. You need a clear separation between content and index, and enough respect for real queries to route them properly.
