An agent is just a loop: let the model think, let it act, feed it the result, repeat until it's done. That pattern has a name — [ReAct](https://arxiv.org/abs/2210.03629), for *Reason + Act* — and this post is about a small Go implementation of it that reasons over three tools and runs on either a local or a cloud model with no code change.

## The loop

At its core the agent runs `Thought → Action → Observation` until the model emits a `Final Answer`:

```text
loop until Final Answer (max MAX_STEPS):
    LLM  ← system prompt + conversation
    LLM  → Thought + Action + Action Input
    Tool ← Execute(action, input)
    Tool → Observation
LLM → Final Answer
```

It has three tools:

- `search_pdf` — local PDF vector search ("use this FIRST for factual questions"),
- `web_search` — Tavily,
- `mcp` — a single bridge to an [MCP server](mongodb-mcp-server.html) whose database operations are discovered at runtime.

That third one is the interesting one, and I'll come back to it.

## A self-describing tool registry

The thing I'm most happy with isn't the loop — it's how tools describe themselves. Every tool owns its **complete** definition through a `Schema()` method that returns the standard JSON tool shape used by OpenAI, Anthropic, and MCP alike:

```go
func (t *PDFSearchTool) Schema() ToolSchema {
    return ToolSchema{
        Name:        "search_pdf",
        Description: "Search the user's PDF documents. Use this FIRST for any factual questions...",
        InputSchema: map[string]any{
            "type": "object",
            "properties": map[string]any{
                "query": map[string]any{"type": "string", "description": "..."},
            },
            "required": []string{"query"},
        },
    }
}
```

A `Manager` acts as the registry and prompt compiler:

- `Register(tool)` — adds a tool, preserving order,
- `Schemas()` — returns all schemas,
- `BuildPromptSection()` — compiles them into the system-prompt tool list.

The payoff: **a tool's description lives in exactly one place** — its own file — and is never copy-pasted into the prompt. Add a tool, register it, and it shows up in the model's instructions automatically. No drift between "what the prompt says the tool does" and "what the tool does."

## One tool to rule the database

The `mcp` tool is deliberately thin. Its schema describes only the *protocol* — an `action` field — not any specific database operation. At query time the agent calls `action: list_tools`, the MCP server reports its operations, and the agent calls them. The server stays the single source of truth for what the database can do; the agent doesn't hardcode any of it.

This keeps the two systems honest. The agent knows *how to talk* to the server; it doesn't pretend to know *what the server can do*. New server capabilities appear to the agent the moment they're registered — no agent redeploy.

## Pluggable backend, one flag

The LLM sits behind a tiny interface, so the loop doesn't care who's answering:

```go
type LLMCaller interface {
    Call(system, user string) (string, error)
    ModelName() string
}
```

There are two implementations — `OllamaCaller` and `AnthropicCaller` — and the agent uses Claude **only** when the key, the model, and an explicit `ANTHROPIC_CREDIT_BALANCE: true` are all present in config. Otherwise it falls back to local Ollama. That third flag means you can keep your key in config and still force the local model (for cost, privacy, or a flaky network) by flipping one boolean.

## Running it

```bash
cp config.example.json config.json   # fill in keys
go run .                             # default port 8082
```

On startup it prints the backend and the registered tools:

```text
[LLM] Backend: Ollama (gemma4:e4b)
[MCP] Registered MCP tool (LLM will discover resources dynamically)
[MAIN] Tool registry: 3 tools
Agent server listening on http://localhost:8082
```

Then it's one endpoint:

```json
POST /api/agent/query
{ "query": "What information do I have stored in my database?" }
→ { "answer": "..." }
```

The agent reasons over its tools — PDF first, then web, then the MCP database tools — and returns once the loop produces a `Final Answer`. A small web UI ships at `localhost:8082`.

## What works, and what to take away

- **The loop is trivial; the tooling is the product.** A self-describing registry that compiles its own prompt section is what keeps an agent maintainable as tools grow.
- **Describe the protocol, not the catalog.** The `mcp` tool exposes *how to ask*, and lets the server own *what's available* — runtime discovery beats a hardcoded list.
- **Hide the model behind an interface.** Ollama by default, Claude when configured, swappable with one flag and zero loop changes.

A good agent isn't a clever prompt — it's a clean boundary between reasoning, tools, and the model. Get those boundaries right and the loop almost writes itself.
