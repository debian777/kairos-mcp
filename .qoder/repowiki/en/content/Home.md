# KAIROS MCP

**KAIROS MCP** is a Model Context Protocol server for persistent memory and deterministic adapter execution. It stores workflows as linked adapters whose layers can carry proof-of-work challenges.

## Quick Links

- [[Getting Started]] - Install and configure KAIROS
- [[Project Overview]] - Understand core concepts and architecture
- [[MCP Protocol Tools]] - Learn about activate, forward, reward, and more
- [[Contributing & Development]] - Development workflows and guidelines
- [[Troubleshooting & FAQ]] - Common issues and solutions

## Key Features

- **Persistent Memory** - Store and retrieve adapter workflows across sessions
- **Deterministic Execution** - Execute adapters through activate → forward → reward chain
- **Vector Search** - Semantic matching powered by Qdrant
- **Multi-Interface Access** - MCP endpoint, REST API, CLI, and Web UI
- **Extensible Protocols** - Train and tune custom adapters for team-specific workflows

## Architecture

KAIROS MCP is built with TypeScript (Node.js 24+), Qdrant (vector DB), Redis (state/caching), and optional Keycloak (OIDC auth).

```
activate → forward (loop per layer) → reward
```

## Documentation Sections

### Core Understanding
- [[Project Overview]] - What is KAIROS MCP?
- [[Core Services]] - Memory, embedding, and authentication services
- [[Architecture & Design]] - System design and deployment infrastructure

### Working with KAIROS
- [[Getting Started]] - Quick start guides and installation
- [[MCP Protocol Tools]] - Complete tool reference
- [[Skills & Protocols]] - Adapter patterns and usage

### Operations
- [[Deployment & Operations]] - Docker Compose and Kubernetes deployment
- [[Testing Strategy]] - Test architecture and workflows
- [[Monitoring & Observability]] - Metrics and health checks
- [[Security Considerations]] - Security architecture and best practices

### Development
- [[Contributing & Development]] - Code standards and PR process
- [[Development Tools]] - Build system and tooling
- [[User Interfaces]] - CLI and web application documentation

## Resources

- **GitHub Repository**: [debian777/kairos-mcp](https://github.com/debian777/kairos-mcp)
- **Installation Guide**: [docs/install/README.md](https://github.com/debian777/kairos-mcp/blob/main/docs/install/README.md)
- **Contributing**: [CONTRIBUTING.md](https://github.com/debian777/kairos-mcp/blob/main/CONTRIBUTING.md)

---

*This wiki is automatically synchronized from the repository source. Last updated: 2026-05-23*
