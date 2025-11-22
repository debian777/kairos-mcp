---
imported: true
source: KAIROS, AI Writing Standard, Context7 MCP docs
updated: 2025-11-18
---

# Context7 MCP — Quick Usage Guide

Purpose
- Fast, deterministic workflow for AI agents to discover libraries and fetch only the docs/snippets needed from Context7 MCP.
- Always supply your current real llm_model_id for each MCP call (store, update, rate).
- Never hardcode a model id; use the active model for each session.
- Avoid embedding full responses; extract only minimal, runnable code or config snippets.

Principles
1. Search broadly, then narrow to a library ID (/org/project).
2. Ask for a specific topic (installation, examples, api, config).
3. Request only minimal code/config snippets you will actually run.
4. Always update llm_model_id to match the active model for each KB/MCP call.

## Steps

1) Resolve library (discover)
Use resolve-library-id to find a Context7-compatible ID.

Example request:
```json
{
  "method": "tools/call",
  "params": {
    "name": "resolve-library-id",
    "arguments": {
      "libraryName": "sooperset mcp-atlassian"
    },
    "_meta": { "progressToken": 0 }
  }
}
```

What to extract from the response
- Best match library ID (e.g. /sooperset/mcp-atlassian)
- Short description, snippet count, reputation, benchmark score
Use these to decide whether to fetch docs.

2) Get focused docs (by topic)
Request only the topic you need (e.g. "installation", "create jira ticket", "api reference").

Example request:
```json
{
  "method": "tools/call",
  "params": {
    "name": "get-library-docs",
    "arguments": {
      "context7CompatibleLibraryID": "/sooperset/mcp-atlassian",
      "topic": "installation and quickstart"
    },
    "_meta": { "progressToken": 5 }
  }
}
```

How to read docs efficiently
- Look for section headings: Installation, Quickstart, Examples, API, Configuration.
- Copy only code/config snippets you will execute.
- Prefer minimal, stateless examples (one operation) for tests; expand to batch examples only if required.

Authentication / headers
- Context7 MCP in this project uses an Authorization header:
  Authorization: Bearer <CTX7_API_KEY>
- Ensure MCP client includes this header when calling the Context7 MCP endpoint.

Search tips
- Try variations: "mcp-atlassian", "sooperset mcp-atlassian", "atlassian mcp"
- If no results, broaden topic (e.g., "jira create" -> "jira")
- Use snippet_count and reputation to choose higher-quality libraries

Best practices
- Request a single focused topic per get-library-docs call.
- Always supply your current llm_model_id for every KB/MCP interaction.
- Cache responses for repeated questions (installation or API surface).
- When implementing, prefer the smallest working snippet; validate with a dry run.
- Use versioned library IDs if available: /org/project/version

Error handling
- If resolve-library-id returns no match: broaden search term and retry.
- If get-library-docs returns too large or irrelevant output: request a narrower topic.
- For auth errors: verify Authorization header and API key.

Example minimal workflow (AI pseudocode)
1. resolve-library-id("sooperset mcp-atlassian")
2. choose best match -> lib_id
3. get-library-docs(lib_id, topic="quickstart: create jira ticket")
4. extract minimal snippet and run in safe environment

References
- MCP endpoint: https://mcp.context7.com/mcp
- Use project MCP settings to confirm header and URL
- For implementation examples consult the library's GitHub when available (e.g. /sooperset/mcp-atlassian)

File: [`workflows/global/mcp/context7.md`](workflows/global/mcp/context7.md:1)