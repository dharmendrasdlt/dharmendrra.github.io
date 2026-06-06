The Model Context Protocol (MCP) is the closest thing the LLM world has to a USB port: a standard way for any model — Claude Desktop, Cursor, a custom agent — to discover and call external tools. This post is about a small, general-purpose MCP server in Go that turns a **MongoDB database** into five CRUD tools that any MCP client can use.

The key design choice: the server is **not** hardcoded to a schema. The tools operate on any collection and any document shape. The collections in the database are just example data — swap in your own and the same tools keep working.

## The flow

MCP over SSE is a short, well-defined handshake:

```text
Client → GET /sse              (open SSE stream)
Server → event: endpoint       (data: /message?sessionId=xxx)
Client → POST /message         initialize
Server → serverInfo + capabilities
Client → POST /message         tools/list
Server → [list_collections, query_documents, insert_document,
          update_document, delete_document]
   ... LLM picks a tool ...
Client → POST /message         tools/call {"name":"query_documents", ...}
Server → db.Collection(...).Find(filter) → CallToolResult (JSON)
```

The client opens an SSE stream, the server hands back a message endpoint, and from there it's request/response. The important part is `tools/list`: the client **discovers** what's available at runtime. Nothing about the toolset is baked into the client.

## Five tools, any collection

| Tool | Description | Required inputs |
|---|---|---|
| `list_collections` | List all collections with document counts | — |
| `query_documents` | Query with an optional filter | `collection` |
| `insert_document` | Insert a new document | `collection`, `document` |
| `update_document` | Update matching documents | `collection`, `filter`, `update` |
| `delete_document` | Delete matching documents | `collection`, `filter` |

That's a complete CRUD surface in five tools. Because each takes the collection name as an argument, one server covers every collection you'll ever add:

```jsonc
// query_documents
{"collection": "job_portals", "filter": {"Category": "Free"}, "limit": 10}

// insert_document
{"collection": "learning_todo", "document": {"Name": "Study MCP", "Status": "To Do"}}

// update_document
{"collection": "learning_todo", "filter": {"Name": "Study MCP"}, "update": {"Status": "Done"}}
```

## Why "general-purpose" is the whole point

It's tempting to write a tool per use case — `add_todo`, `complete_todo`, `list_jobs`. Don't. That couples the server to today's schema and forces a redeploy every time the data evolves. Five generic verbs over arbitrary collections means the *data* can change freely while the *interface* stays frozen. The LLM figures out the mapping from intent to `collection + filter` at call time.

This is the same lesson that shows up everywhere in platform work: **a small, stable, general interface beats a large, specific one.**

## Connecting clients

Because it speaks standard MCP over SSE — no custom headers, no auth — wiring up a client is a few lines of JSON.

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "agentic-mcps": { "url": "http://localhost:8083/sse" }
  }
}
```

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "agentic-mcps": { "url": "http://localhost:8083/sse" }
  }
}
```

Any MCP-compatible client just needs the SSE endpoint: `http://localhost:8083/sse`.

## Running it

```bash
mongosh --eval "db.adminCommand({ping:1})"   # Mongo up?
cd mcp
go run .
# [MCP] Server starting on http://localhost:8083
# [MCP] SSE endpoint: http://localhost:8083/sse
```

Config is two lines:

```json
{ "MONGO_URI": "mongodb://localhost:27017", "PORT": "8083" }
```

## What works, and what to take away

- **Discovery over hardcoding.** `tools/list` lets the client learn the toolset at runtime — the server stays the single source of truth.
- **Generic verbs, arbitrary data.** Five CRUD tools over any collection means new data never means new code.
- **Standard protocol, zero glue.** Speaking plain MCP-over-SSE means Claude Desktop, Cursor, and custom agents all connect with a few lines of JSON and no adapters.

If you want an LLM to actually *act* on your data — not just talk about it — a thin, general MCP server in front of your database is a surprisingly small amount of code for a surprisingly large amount of capability.
