# Contributing to KAIROS MCP

Thank you for your interest in contributing to KAIROS MCP! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/kairos-mcp.git`
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
# Deploy and test
npm run dev:deploy && npm run dev:test

# Or for QA environment
npm run qa:deploy && npm run qa:test
```

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

When reporting issues, please include:

- Description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (Node.js version, OS, etc.)
- Relevant logs or error messages

## Feature Requests

Feature requests are welcome! Please open an issue with:

- Clear description of the feature
- Use case and motivation
- Proposed implementation (if you have ideas)

## Questions?

Feel free to open an issue for questions or discussions.

Thank you for contributing to KAIROS MCP!

