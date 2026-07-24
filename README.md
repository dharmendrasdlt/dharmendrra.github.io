# Dharmendra Yadav — Engineer & Builder

**Distributed Systems · AI Engineering · Reliability**

This is my portfolio, live at **[dharmendrra.github.io](https://dharmendrra.github.io/)**.

I build large-scale distributed messaging platforms — and, hands-on, AI agents and RAG systems with LLMs, agentic loops (Reasoning + Acting), MCP, and vector databases.

## What's inside

- **About & Experience** — engineering leadership and platform work at Brevo (formerly Sendinblue), Incise Infotech, and Intecons Software Lab.
- **Highlights** — re-architecting email at scale, contact-level Kafka fan-out, AI-native engineering, and team leadership.
- **Skills** — Golang, Python, Kafka, Kubernetes, and an AI engineering stack spanning Agentic AI, RAG, LangChain/LangGraph, MCP, and vector DBs.
- **Projects**
  - [Agentic AI (Python)](https://dharmendrra.github.io/agentic-ai-py/) — FastAPI agent/retrieval/MCP services with conversational memory, PDF retrieval over Pinecone, and live web search with citations.
  - [Omni-RAG](https://dharmendrra.github.io/Omni-RAG/) — multi-backend RAG across ChromaDB, Qdrant, and Pinecone with keyword-sensitive filtering and semantic fallback.
  - [Agentic AI (Go)](https://dharmendrra.github.io/agentic-ai/) — a Go agent using a Reasoning + Acting loop, tool-calling, and MCP, backed by Tavily search and Ollama-served local models.
  - [Rejected.AI](https://dharmendrra.github.io/rejected.ai/) — a living lab for early-stage AI ideas and experiments.
- **[Writing](https://dharmendrra.github.io/blog/)** — posts on building RAG pipelines (ChromaDB, Qdrant, Pinecone, MongoDB), an MCP server for MongoDB, and a Reasoning + Acting agent in Go.

## How it's built

A deliberately simple, no-build static site:

- Hand-written HTML, CSS, and vanilla JavaScript — no framework, no bundler.
- Blog posts are Markdown files in `blog/posts/`, rendered client-side and indexed by `posts.json`.
- `scripts/stamp-assets.sh` content-hashes CSS/JS into `?v=<hash>` query strings for cache busting (wired into a pre-commit hook).
- Hosted on GitHub Pages (`.nojekyll`, no build step).

Run it locally by serving the repo root with any static server, e.g. `python3 -m http.server`.

## Get in touch

- 📧 [dharmendra.4real@gmail.com](mailto:dharmendra.4real@gmail.com)
- 💼 [LinkedIn](https://linkedin.com/in/dharmendra-yadav-20b9a017)
- 🐙 [GitHub](https://github.com/dharmendrasdlt)
