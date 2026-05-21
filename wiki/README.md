# GitHub Wiki Source

This directory contains the source markdown files for the [GitHub Wiki](https://github.com/debian777/kairos-mcp/wiki).

## Structure

The wiki is organized into the following sections:

- **Project Overview** - Getting started, architecture, installation
- **Architecture & Design** - Core services, MCP protocol, deployment
- **Core Services** - Authentication, memory management, embedding services
- **MCP Protocol Tools** - Documentation for each MCP tool (activate, forward, reward, etc.)
- **User Interfaces** - CLI and web application documentation
- **Security Considerations** - Security best practices
- **Testing Strategy** - Testing approaches and guidelines
- **Deployment & Operations** - Production deployment guide
- **Monitoring & Observability** - Monitoring setup and alerts
- **Contributing & Development** - Developer guidelines
- **Troubleshooting & FAQ** - Common issues and solutions

## Updating the Wiki

### Option 1: Manual Sync

Run the sync script to push wiki changes to GitHub:

```bash
./scripts/sync-wiki.sh
```

This will:
1. Clone/update the wiki repository
2. Copy content from `wiki/` to the wiki repo
3. Commit and push to GitHub

### Option 2: Edit Directly

You can also edit wiki pages directly on GitHub at https://github.com/debian777/kairos-mcp/wiki

## Source of Truth

- **This directory** (`wiki/`) is the source of truth for wiki content
- Wiki content is versioned alongside the code
- Changes to wiki should go through PR review like code changes
- The sync script pushes approved changes to GitHub Wiki

## Auto-generated Content

The `.qoder/repowiki/` directory contains auto-generated documentation from Qoder IDE. This is IDE cache and should not be committed. Reviewed content from `.qoder/repowiki/` can be copied to `wiki/` when appropriate.
