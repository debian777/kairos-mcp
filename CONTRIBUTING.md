# Contributing to KAIROS MCP

Thank you for your interest in contributing to KAIROS MCP! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/kairos-mcp.git` (replace YOUR_USERNAME with your GitHub username)
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Install dependencies: `npm ci`
5. Make your changes
6. Test your changes: `npm run dev:deploy && npm run dev:test`
7. Commit your changes: `git commit -m "Add: your feature description"`
8. Push to your fork: `git push origin feature/your-feature-name`
9. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js >= 24.0.0
- Docker and Docker Compose
- Qdrant (vector database)
- Redis (caching)

### Environment Setup

1. Copy `env.example.txt` to `.env.dev` or `.env.qa`
2. Configure required environment variables (see `env.example.txt` for details)
3. Start infrastructure services: `npm run infra:start`
4. Start development server: `npm run dev:start`

### Running Tests

**Important:** Always deploy before testing. Tests run against a running server.

```bash
# Deploy and test (dev: PORT=3300)
npm run dev:deploy && npm run dev:test

# QA environment (PORT=3500, Docker): deploy then test
npm run qa:deploy && npm run qa:test

# Run a single test file (after dev:deploy or qa:deploy)
npm run dev:test -- tests/integration/kairos-dump.test.ts
npm run qa:test -- tests/integration/kairos-dump.test.ts
```

## MCP and API design

When contributing **MCP tools**, **agent-facing REST APIs**, or changes to tool
schemas and descriptions, follow the project’s agent-facing design principles
so the interface stays LLM-friendly and execution-oriented:

- **[Charter: agent-facing design principles](CHARTER.md#agent-facing-design-principles)**
  — Design for AI agents as primary users; keep frontend (names, descriptions,
  errors) clear and consistent; use the backend for orchestration (validation,
  retries, API calls); make errors teach and allow recovery rather than block
  execution.

Reviewers will expect new or changed tools/APIs to align with these principles (e.g. consistent naming, actionable `next_action`, two-phase error handling).

## Code Style

- Follow the existing code style
- Run the linter before committing: `npm run lint`
- Auto-fix linting issues: `npm run lint:fix`
- Use TypeScript for all new code
- Write tests for new features

## Commit Messages

Use clear, descriptive commit messages. We follow conventional commit format:

- `Add:` for new features
- `Fix:` for bug fixes
- `Update:` for updates to existing features
- `Refactor:` for code refactoring
- `Docs:` for documentation changes
- `Test:` for test additions or changes

## Pull Request Process

1. Ensure your code passes all tests
2. Update documentation if needed
3. Ensure your branch is up to date with `main`
4. Create a clear PR description explaining:
   - What changes were made
   - Why the changes were made
   - How to test the changes

## Reporting Issues

Include the following so we can reproduce and fix the issue:

- Description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (Node.js version, OS, etc.)
- Relevant logs or error messages

## Feature Requests

Open an issue with:

- Clear description of the feature
- Use case and motivation
- Proposed implementation (if you have ideas)

## Questions?

Open an issue for questions or discussions.

Thank you for contributing to KAIROS MCP!
