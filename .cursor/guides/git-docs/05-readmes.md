# README Deep Dive

> "The README is the front door to your repository. Make it welcoming."

## The Anatomy of a Great README

A great README answers three questions in order:

1. **What is this?** (5 seconds)
2. **Why should I care?** (15 seconds)
3. **How do I use/contribute?** (5 minutes)

---

## The Template

```markdown
# Project Name

[One-sentence description]

[![Build Status](badge)](link)
[![License](badge)](link)

## What is [Project Name]?

[2-3 sentences explaining what it does and who it's for]

## Why [Project Name]?

- **Benefit 1** — [Specific advantage]
- **Benefit 2** — [Specific advantage]
- **Benefit 3** — [Specific advantage]

## Quick Start

```bash
# Installation
[command]

# Usage
[command]
```

[Simple example that works]

## Installation

**[Platform 1]:**
```bash
[command]
```

**[Platform 2]:**
```bash
[command]
```

## Documentation

- [User Guide](docs/user/index.md)
- [API Reference](docs/api.md)
- [Contributing](CONTRIBUTING.md)

## Examples

### [Example 1]
[Code example]

### [Example 2]
[Code example]

## Support

- [Documentation](link)
- [Issues](link)
- [Discussions](link)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[License name] - see [LICENSE](LICENSE) file.
```

---

## README Types by Repository

### Library/Package

**Focus:** API, installation, usage examples

```markdown
# MyLibrary

A fast, type-safe validation library for TypeScript.

## Installation

```bash
npm install mylibrary
```

## Usage

```typescript
import { validate } from 'mylibrary';

const schema = { name: 'string', age: 'number' };
const result = validate(data, schema);
```

## API Reference

[Link to full API docs]
```

### Application/Service

**Focus:** What it does, how to run it, how to deploy

```markdown
# MyApp

Process large datasets 10x faster than Excel.

## For Users

**Installation:** [Download](link)  
**Quick Start:** [Guide](docs/user/getting-started.md)

## For Developers

**Setup:** [Development Guide](docs/dev/setup.md)  
**Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md)
```

### CLI Tool

**Focus:** Installation, commands, examples

```markdown
# mytool

Command-line tool for [purpose].

## Installation

```bash
npm install -g mytool
```

## Usage

```bash
mytool [command] [options]
```

## Commands

- `mytool init` — Initialize
- `mytool build` — Build
- `mytool deploy` — Deploy

## Examples

[Common usage examples]
```

### Internal Tool

**Focus:** What it does, setup, team contact

```markdown
# Internal Analytics Service

Data processing service for the analytics team.

**This is not end-user software.** Documentation is for developers.

## Quick Start

```bash
git clone [repo]
cd [repo]
npm install
npm test  # should pass
npm run dev
```

## Team

Owner: @analytics-team  
Slack: #analytics
```

---

## What NOT to Put in README

### Don't: Version History

Use CHANGELOG.md instead.

### Don't: Detailed Architecture

Link to `docs/dev/architecture.md` instead.

### Don't: Full API Reference

Link to API docs instead.

### Don't: Everything

Keep README focused. Link to detailed docs.

**Target length: 200-500 lines**  
If longer, split into separate docs.

---

## Badges

Use badges for quick status info:

```markdown
[![Build](badge-url)](link)
[![Coverage](badge-url)](link)
[![License](badge-url)](link)
[![npm version](badge-url)](link)
```

**Don't overuse:** 3-5 badges max.

---

## Checklist

Great README has:
- [ ] One-sentence description
- [ ] What it does (2-3 sentences)
- [ ] Why someone would use it (benefits)
- [ ] Quick start (works in under 2 minutes)
- [ ] Installation instructions
- [ ] Examples
- [ ] Links to detailed docs
- [ ] How to get support
- [ ] License

---

**Next**: [Changelogs and Versioning →](06-changelogs.md)
