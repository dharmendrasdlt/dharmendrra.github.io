Here's a failure mode nobody warns you about: out-of-the-box RAG quietly breaks on **short queries**. Type "remote work" or a single product code, and pure cosine similarity often returns confident nonsense — because a two-token query embeds into a vague region of space that's near everything and specific to nothing. This Qdrant-backed module fixes that with a simple pairing: **a payload text filter for keyword-ish queries, and a semantic fallback when the filter is too strict.**

## The shape of the pipeline

Like the other OmniRAG backends, this one keeps the raw content and the vectors in separate stores: **MongoDB** holds the source documents, **Qdrant** holds the vectors and payloads, **Ollama** does embeddings and (optionally) generation, with **Claude** as the cloud option.

It runs in three phases:

1. **Seed** — load raw policy documents into MongoDB (`content_db.articles_v2`).
2. **Ingest** — read the source text, embed it with Ollama, create a Qdrant collection (`policies_v2`), **create a text index on the `content` payload field**, and upsert vectors with their payloads.
3. **Retrieve** — serve a dashboard, and on each query run the routing logic below.

That text index in step 2 is the unlock for step 3.

## Document-aware routing

When a query arrives, the retrieval server doesn't just blindly vector-search. It routes:

- Embed the query with Ollama `/api/embed`.
- Search Qdrant `policies_v2` via `points/search`.
- **For single-token keyword queries, add a Qdrant payload text filter against `content`.**
- **If the filtered search returns zero matches, retry with raw vector similarity.**
- Build an augmented prompt from the retrieved context and the requested format.
- Generate through Claude or local Ollama and return one JSON response.

Two lines do the heavy lifting. The first says: *if the user typed something that looks like a keyword, trust the keyword* — a payload filter on `content` will find the literal term far more reliably than fuzzy vector distance. The second is the safety net: *if that filter found nothing, don't return an empty answer — fall back to semantic search.*

> Filtered searches that return zero documents transparently retry as pure semantic vector search — no dead-ends, no empty answers.

That conditional fallback is the difference between a demo and something you'd let a real user touch.

## Why not just raise top_k?

A reasonable instinct on a bad query is "return more results and let the LLM sort it out." It doesn't help: if the query embedding is in a vague region, the top 20 are all *equally* irrelevant, and you've just handed the model more noise to hallucinate from. Routing on the *shape of the query* — keyword vs. abstract — addresses the cause, not the symptom.

## Format-aware output

The retrieval step also threads through a requested output format — **Prose**, **Markdown Table**, or **JSON** — into the augmented prompt. It's a small thing, but it means the same retrieval can serve a human reading an answer and a script consuming structured data, without a second pipeline.

## Running it

The dependencies are all containers or local installs:

```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
docker run -d -p 6333:6333 -p 6334:6334 --name qdrant qdrant/qdrant:latest
ollama pull nomic-embed-text
ollama pull gemma4:e2b
```

Then the three phases, in order:

```bash
go run seed/main.go      # MongoDB ← raw documents
go run ingest/main.go    # Qdrant ← vectors + payloads + text index
go run retrieve/main.go  # dashboard on :8080
```

Set `ANTHROPIC_API_KEY` first if you want Claude generation; otherwise it runs fully offline on Ollama `gemma4:e2b`.

## What works, and what to take away

- **Short queries are a category, not an edge case.** If your RAG only handles paragraph-length questions, it will disappoint real users on day one.
- **Route on query shape.** A payload text filter for keyword-y inputs plus semantic search for abstract ones beats one-size-fits-all cosine similarity.
- **Always have a fallback.** "Filtered → zero results → retry semantically" is three lines that eliminate empty answers.
- **Keep content and vectors separate.** MongoDB stays the source of truth; Qdrant is an additive index you can rebuild any time.

The fix here isn't a fancier model or a bigger index. It's noticing *how* people actually query and meeting them there.
