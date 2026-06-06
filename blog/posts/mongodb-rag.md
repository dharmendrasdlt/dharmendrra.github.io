Before you stand up a dedicated vector database, here's a question worth asking: do you actually need one yet? For a first RAG pipeline — a prototype, a demo, an internal tool — you can ship something that works with just **MongoDB, Ollama embeddings, and a two-service split.** This module is that starting point: the simplest useful RAG, with a clean enough shape that you can graduate to Chroma, Qdrant, or Pinecone later without rethinking everything.

## MongoDB as the vector *and* knowledge store

The simplification here is deliberate: MongoDB plays both roles. It holds the raw knowledge documents **and** their embeddings, so there's no second datastore to run, sync, or reason about. One database, one connection string, fewer moving parts.

That's the right trade-off when you're starting out. A dedicated vector DB buys you speed and scale at the cost of another service to operate. When your corpus is small and your traffic is low, MongoDB's own querying is more than enough — and you've removed an entire category of "why are these two stores out of sync?" bugs.

## Two services, cleanly split

Even at its simplest, the pipeline keeps ingestion and retrieval apart:

```text
mongo-rag/
├── ingest/
│   └── main.go     # embeds & stores knowledge documents
└── retrieve/
    ├── main.go     # query embedding, DB lookup, LLM prompting
    └── static/     # search-engine UI
```

This split is worth keeping even in a toy project. Ingestion is a batch job you run when data changes; retrieval is a long-lived server. Tangling them means you can't re-ingest without bouncing the web server, and you can't reason about their very different performance profiles. The two-service shape is the one habit from "real" RAG that's worth adopting on day one.

## How a query flows

1. **Ingest** — load raw knowledge context, embed each document with Ollama (`nomic-embed-text`), and store text + vector together in MongoDB.
2. **Retrieve** — embed the incoming query, look up the closest documents, build an augmented prompt, and generate an answer.
3. **Generate** — Claude if `ANTHROPIC_API_KEY` is set; otherwise it falls back automatically to a local Ollama `llama3`.

That automatic fallback matters more than it looks. It means the project runs end-to-end on a laptop with **zero API keys and zero cost** — pull two Ollama models and you have a working RAG search engine offline. Add a key later and the same pipeline upgrades to Claude without a code change.

## Format-aware answers

The retrieval UI lets you choose the output shape — **Human Prose**, **Markdown Table**, or **Structured JSON** — and that choice is threaded into the prompt. Even the beginner version ships this, because it costs almost nothing and it's the feature that makes a RAG endpoint useful to *both* a person and a program.

## Running it

```bash
ollama pull nomic-embed-text
ollama pull llama3

cd mongo-rag
go run ingest/main.go     # MongoDB ← documents + embeddings
go run retrieve/main.go   # search UI on :8080
```

Open `localhost:8080`, ask `"What are the remote work rules?"`, pick a format, and you have answers grounded in your own documents — no cloud account required.

## What works, and when to graduate

This setup is genuinely good for: prototypes, internal tools, small/medium corpora, and learning how the pieces fit before you add infrastructure.

You've outgrown it when:

- **latency matters** and similarity search over a growing collection starts to drag — a purpose-built index (Chroma, Qdrant, Pinecone) is built for exactly this;
- **scale matters** and you want approximate nearest-neighbour, sharding, or namespaces;
- **query quality matters** and you need keyword-sensitive routing or payload filters that a dedicated vector store exposes natively.

The good news: because content and retrieval are already separated and the generation backend is already behind a fallback, graduating is a *swap*, not a rewrite. Point ingestion at a real vector index, keep MongoDB as your source of truth, and the rest of the shape carries over.

## What to take away

- **Don't add infrastructure you don't need yet.** MongoDB-as-vector-store is a legitimate first RAG, not a hack.
- **Keep ingestion and retrieval separate from day one** — it's the one "grown-up" habit that costs nothing and saves you later.
- **Default to local and free.** An automatic Ollama fallback means the whole thing runs offline; the cloud is an upgrade, not a requirement.

Start simple, ship something that works, and let real constraints — not architecture diagrams — tell you when it's time for a dedicated vector database.
