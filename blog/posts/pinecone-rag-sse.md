Most RAG demos stop at "embed a string, get an answer." Real documents are messier: they arrive as PDFs, they're large, and the person who uploaded them wants to *watch* the thing work — not stare at a spinner for two minutes. This post walks through the Pinecone-backed pipeline in OmniRAG, which is built around two ideas: **a raw source of truth you can always trace back to**, and **live progress over Server-Sent Events** at every stage.

## Two services, one index

The pipeline is split into two independently deployable Go services that share a Pinecone index:

| Service | Port | Role |
|---|---|---|
| Ingestion | 8080 | Upload PDFs → GridFS → chunk → embed → upsert to Pinecone |
| Retrieval | 8081 | Query → embed → Pinecone search → LLM answer (streamed via SSE) |

Splitting them matters. Ingestion is bursty and slow (parsing, embedding hundreds of chunks); retrieval is latency-sensitive and interactive. Keeping them separate means each can scale, fail, and deploy on its own.

## Ingestion: GridFS is the source of truth

When a PDF comes in over `POST /api/upload`, the handler does the boring-but-important things first:

- validates the `.pdf` extension **and** the PDF file signature,
- streams the raw binary straight into **MongoDB GridFS**,
- starts an async ingestion job and returns a `job_id` immediately.

```text
Browser → POST /api/upload (multipart PDF)
  ├── validate extension + signature
  ├── stream binary → MongoDB GridFS
  └── start async job
        ├── read PDF back from GridFS by ObjectID
        ├── extract page text (native Go parser)
        ├── chunk each page (recursive character splitter)
        ├── embed chunks concurrently via Ollama
        └── upsert vectors → Pinecone
```

The detail I care most about is **traceability**. Every vector written to Pinecone carries the GridFS ObjectID in both its ID and its metadata:

```json
{
  "id": "book_[MONGO_OBJECT_ID]_chunk_[INDEX]",
  "values": [0.1, 0.2],
  "metadata": {
    "source_file_id": "[MONGO_OBJECT_ID]",
    "text_content": "[RAW 1000 CHAR CHUNK]",
    "page_number": 42
  }
}
```

That single decision pays for itself constantly: any retrieval hit can be traced back to the exact source PDF and page. When a user asks "where did that come from?", the system can answer.

A few honest constraints worth stating up front: the PDF parser is native Go and does **not** do OCR, page numbers are preserved from the extraction loop, and chapter defaults to `1` because chapter detection isn't reliable from plain text extraction. Knowing what you *don't* support is part of shipping.

## Concurrency where it counts

Embedding is the slow step, so it's the one that gets parallelism. A small pool of workers (`EMBED_WORKERS`, default 5) embeds chunks concurrently through Ollama, and vectors are flushed to Pinecone in batches (`UPSERT_BATCH_SIZE`, default 50). Both are config knobs, not magic numbers — tune them to your hardware and your Pinecone tier.

## Live progress with Server-Sent Events

Because ingestion is async, the UI subscribes to `GET /api/events/{job_id}` and receives a stream of JSON progress events:

```json
{
  "job_id": "...",
  "stage": 2,
  "status": "processing",
  "message": "Reading Page 14 of 42...",
  "current_page": 14,
  "total_pages": 42,
  "progress": 31
}
```

SSE is the right tool here, and it's underrated. It's one-way server→client, rides plain HTTP, reconnects automatically, and needs no WebSocket handshake or extra infra. For "show me progress," it's almost always the correct default.

## Retrieval: embed → search → ground → stream

The retrieval service answers questions in four observable steps, **each of which emits its own SSE event** so the UI can render a live pipeline:

1. **Embed query** via Ollama (`nomic-embed-text`).
2. **Vector search** against Pinecone (`top_k`, default 3).
3. **Build a grounded RAG prompt** — a system + user prompt assembled only from the retrieved matches.
4. **Stream generation** token-by-token from Anthropic Claude *or* local Ollama.

The vector search itself is small, and one flag on it does a lot of work:

```go
reqBody := pineconeQueryRequest{
    Vector:          vector,
    TopK:            p.TopK,        // default 3 — how many chunks feed the prompt
    IncludeMetadata: true,          // bring back text_content + source_file_id
}
// POST {host}/query  with header  Api-Key: <key>  → matches[]
```

`TopK` is the dial between "not enough context" and "drowning the model in noise" — three is a sane default. `IncludeMetadata: true` is the line that makes answers *traceable*: each match comes back carrying the chunk's raw text **and** the GridFS ObjectID, so the prompt can be grounded and every cited source can be walked back to its original PDF.

The codebase keeps each step in its own single-responsibility file (`embedder.go`, `pinecone.go`, `prompt.go`, `streamer.go`, `server.go`). It reads almost like the diagram — which is the point.

## Pluggable generation, one flag

Both services use Claude **only** when three config values line up:

```jsonc
"ANTHROPIC_API_KEY": "sk-ant-...",
"ANTHROPIC_MODEL":   "claude-haiku-4-5-20251001",
"ANTHROPIC_CREDIT_BALANCE": true
```

Otherwise they fall back to local Ollama. That third flag is the pragmatic bit: flip `ANTHROPIC_CREDIT_BALANCE` to `false` to keep the key in config but force the local model — handy when the account runs out of credits mid-demo. Both backends sit behind a single `Streamer` interface, so the rest of the pipeline is backend-agnostic.

## Running it

```bash
cd pinecone-rag
go mod tidy
go run .            # ingestion UI on :8080
# from retrieval/
go run .            # retrieval on :8081
```

Set `PINECONE_API_KEY` and `PINECONE_INDEX` (the host can be resolved through the SDK), point `MONGO_URI` at a local Mongo, and pull your Ollama models.

## What works, and what to take away

- **Keep a raw source of truth.** GridFS + an ObjectID on every vector turned "trust me" into "here's the page."
- **Stream the slow stuff.** SSE made a two-minute ingestion feel like a product instead of a hang.
- **Put concurrency on the bottleneck only.** Embedding workers + batched upserts, both tunable.
- **Hide the model behind an interface.** A one-line config flip swaps Claude for Ollama with zero pipeline changes.

If you're building RAG for actual documents rather than toy strings, those four choices are the ones that survived contact with reality.
