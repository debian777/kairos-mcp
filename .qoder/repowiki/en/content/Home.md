<p align="center">
  <img src="kairos-mcp.svg" alt="KAIROS MCP" width="120">
</p>

<h1 align="center">KAIROS MCP</h1>

KAIROS MCP is a Model Context Protocol server for persistent memory and deterministic adapter execution.

It stores workflows as linked adapters whose layers can carry proof-of-work challenges. Agents execute an adapter run by calling **activate** (semantic match), then **forward** for each layer's contract (loop until `next_action` directs to **reward**), then **reward** to finalize the run.

## Sections

- **[[Project Overview]]** — Getting started, architecture, installation
- **[[Architecture & Design]]** — Core services, MCP protocol, deployment
- **[[Core Services]]** — Authentication, memory management, embedding services
- **[[MCP Protocol Tools]]** — Documentation for each MCP tool (activate, forward, reward, etc.)
- **[[User Interfaces]]** — CLI and web application documentation
- **[[Security Considerations]]** — Security best practices
- **[[Testing Strategy]]** — Testing approaches and guidelines
- **[[Deployment & Operations]]** — Production deployment guide
- **[[Monitoring & Observability]]** — Monitoring setup and alerts
- **[[Contributing & Development]]** — Developer guidelines
- **[[Troubleshooting & FAQ]]** — Common issues and solutions

## Protocol Execution Model

```text
activate → forward (loop per layer) → reward
```

Discovery and adapter lifecycle tools (`spaces`, `train`, `tune`, `export`, `delete`) operate independently of the run order.

## Contributing to this Wiki

1. Edit files under `.qoder/repowiki/en/content/` in the main repository
2. Create a PR with your changes
3. Merge to `main`
4. GitHub Action automatically publishes to this wiki

Do not edit the GitHub Wiki directly — it is overwritten on each sync.
