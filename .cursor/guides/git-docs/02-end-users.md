# Writing for End Users

> "End users don't care how it works. They care what it does and how to use it."

## The Problem

Most repositories document for developers because developers wrote them. The README explains the tech stack, the build process, the architecture. The user just wanted to know "What does this do and how do I install it?"

**End users are not developers. They don't have your codebase checked out. They don't know your tech stack. They might not be technical at all.**

---

## Who End Users Are

- People installing and using your software
- Zero knowledge of your codebase
- May not know programming
- Task-focused: "I need to solve problem X"
- Impatient: "Show me it works in 30 seconds or I'm gone"

---

## What End Users Need

### 1. What Does This Do?

Answer in the first paragraph:
```markdown
# MyApp

MyApp processes CSV files and generates reports 10x faster than Excel.
```

Not:
```markdown
# MyApp

A Python-based data processing framework using pandas and asyncio.
```

**Tell them the benefit, not the implementation.**

### 2. Why Would I Use It?

What problem does it solve? Why is it better than alternatives?

```markdown
## Why MyApp?

- **10x faster** than Excel for large datasets
- **No coding required** — drag and drop interface
- **Works offline** — no cloud dependency
```

### 3. How Do I Install It?

Platform-specific, simple instructions:

```markdown
## Installation

**macOS:**
```bash
brew install myapp
```

**Windows:**
Download the installer: [myapp-installer.exe](link)

**Linux:**
```bash
snap install myapp
```
```

**Not:** "Clone the repo, install dependencies, build from source..."
(That's for developers, not users.)

### 4. How Do I Use It?

Quick start example:

```markdown
## Quick Start

1. Launch MyApp
2. Click "Import CSV"
3. Select your file
4. Click "Generate Report"

Your report is saved to `~/Documents/myapp-reports/`.
```

### 5. What Do I Do When It Breaks?

Troubleshooting section:

```markdown
## Troubleshooting

**"File not found" error:**
Make sure your CSV is UTF-8 encoded.

**App won't start:**
Try: `myapp --reset-config`

**Still stuck?**
Open an issue: [github.com/org/myapp/issues](link)
```

---

## README Structure for End Users

```markdown
# Project Name

[One sentence: What it does]

## Why [Project Name]?

[Bullet points: Benefits]

## Installation

[Platform-specific instructions]

## Quick Start

[Simple example that works]

## Documentation

[Link to full user guide]

## Troubleshooting

[Common issues]

## Support

[How to get help]

## License

[License name + link]
```

---

## User Documentation (docs/user/)

For more than a README can hold, create:

### docs/user/installation.md

- System requirements
- Installation for each platform
- Post-install verification
- Uninstall instructions

### docs/user/getting-started.md

- First launch
- Basic concepts
- Simple tutorial (5 minutes)
- Where to go next

### docs/user/user-guide.md

- Complete feature reference
- All functionality explained
- Screenshots where helpful
- Examples for each feature

### docs/user/troubleshooting.md

- Common errors and solutions
- Error message reference
- How to report bugs
- How to get support

### docs/user/faq.md

- Frequently asked questions
- Organized by category
- Link to detailed docs

---

## Writing Style for End Users

### Use Plain Language

| Technical | Plain |
|---|---|
| Execute the binary | Run the program |
| Initialize the configuration | Set up |
| Terminate the process | Stop the program |
| Instantiate an object | Create |

### Avoid Jargon

If you must use technical terms, define them:

```markdown
MyApp uses **idempotent** operations (operations that produce the same 
result no matter how many times you run them).
```

### Be Specific

**Vague:**
```
Configure the system settings appropriately.
```

**Specific:**
```
Open Settings → Security → Enable "Two-Factor Authentication"
```

### Show, Don't Just Tell

Use examples:

**Without example:**
```
MyApp accepts various date formats.
```

**With examples:**
```
MyApp accepts date formats like:
- 2026-03-05
- 03/05/2026
- March 5, 2026
```

---

## CHANGELOG for Users

Users care about what changed, not internal refactoring.

**Good (user-focused):**
```markdown
## [2.0.0] - 2026-03-05

### Added
- Dark mode support
- Export to PDF

### Changed
- Reports now generate 2x faster

### Fixed
- CSV import crash on Windows
```

**Bad (developer-focused):**
```markdown
## [2.0.0] - 2026-03-05

### Changed
- Refactored async queue implementation
- Migrated to TypeScript 5.0
- Updated all dependencies
```

Users don't care about internal refactoring. Tell them what they'll experience.

*See: [Changelogs and Versioning](06-changelogs.md)*

---

## Screenshots and Demos

### When to Use Screenshots

- Complex UI that's hard to describe
- Visual confirmation ("You should see this")
- Step-by-step tutorials

### When NOT to Use Screenshots

- Simple text commands (use code blocks)
- Things that change frequently (screenshots go stale)
- As the primary documentation (not searchable, not accessible)

### Screenshot Best Practices

- Annotate with arrows or highlights
- Keep them up to date (version or date them)
- Provide alt text: `![Settings dialog with "Enable API" checkbox](settings.png)`
- Don't rely solely on screenshots (provide text too)

### Video Demos

For complex workflows, consider:
- Short (under 3 minutes) video
- Hosted on YouTube or similar
- Linked from README

---

## Common Mistakes

### Mistake 1: Assuming Technical Knowledge

**Bad:**
```
To deploy, configure your ingress controller for TLS termination.
```

**Good:**
```
To deploy:
1. Open the admin panel
2. Click "Deploy to Server"
3. Enter your server address
```

### Mistake 2: Developer Install Instructions

**Bad:**
```
## Installation
git clone https://github.com/org/myapp
cd myapp
npm install
npm build
```

**Good:**
```
## Installation

**macOS:** `brew install myapp`
**Windows:** Download from [myapp.com/download](...)
```

### Mistake 3: No Examples

**Bad:**
```
MyApp supports multiple input formats.
```

**Good:**
```
MyApp supports:
- CSV files
- Excel (.xlsx)
- Google Sheets (paste URL)
```

### Mistake 4: No Troubleshooting

User hits an error. No troubleshooting section. They give up.

**Fix:** Always include troubleshooting section, even if brief.

---

## Checklist

End-user documentation must have:
- [ ] One-sentence description (what it does)
- [ ] Why users would choose this (benefits)
- [ ] Platform-specific installation instructions
- [ ] Quick start example that works
- [ ] Link to detailed user guide (if it exists)
- [ ] Troubleshooting section
- [ ] How to get support
- [ ] No jargon (or jargon is defined)
- [ ] No developer-specific info in user docs

---

**Next**: [Human Developers →](03-human-devs.md)
