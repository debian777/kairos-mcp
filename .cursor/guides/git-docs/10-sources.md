# Sources and Further Reading

Documentation for git repositories draws from technical writing, open source best practices, and emerging AI-assisted development patterns.

---

## Core Standards

### Keep a Changelog
**URL:** https://keepachangelog.com/  
**What:** Standard format for changelogs  
**Why:** Consistency, automated tooling, user expectations  
**Essential reading**

### Semantic Versioning
**URL:** https://semver.org/  
**What:** Version numbering standard (MAJOR.MINOR.PATCH)  
**Why:** Clear communication of breaking vs. non-breaking changes  
**Essential reading**

### Conventional Commits
**URL:** https://www.conventionalcommits.org/  
**What:** Commit message standard  
**Why:** Enables automated changelog generation, clear commit history  
**Recommended reading**

---

## README Best Practices

### "Make a README"
**URL:** https://www.makeareadme.com/  
**What:** Simple guide to writing READMEs  
**Why:** Covers the basics well  
**For beginners**

### "Awesome README"
**URL:** https://github.com/matiassingers/awesome-readme  
**What:** Curated list of excellent READMEs  
**Why:** Learn by example from great projects  
**For inspiration**

### "Art of README"
**URL:** https://github.com/hackergrrl/art-of-readme  
**What:** Philosophy and best practices for READMEs  
**Why:** Deep dive into why READMEs matter  
**For understanding**

---

## Contributing Guides

### "Open Source Guide: How to Contribute"
**URL:** https://opensource.guide/how-to-contribute/  
**What:** Guide for contributors and maintainers  
**Why:** Best practices from GitHub  
**Comprehensive**

### Example CONTRIBUTING.md Files
- **Ruby on Rails:** https://github.com/rails/rails/blob/main/CONTRIBUTING.md
- **React:** https://github.com/facebook/react/blob/main/CONTRIBUTING.md
- **Rust:** https://github.com/rust-lang/rust/blob/master/CONTRIBUTING.md

---

## Architecture Decision Records (ADRs)

### "ADR GitHub Organization"
**URL:** https://adr.github.io/  
**What:** Tools, templates, and examples for ADRs  
**Why:** Standard format for documenting decisions  
**Essential reading**

### "Documenting Architecture Decisions" (Michael Nygard)
**URL:** https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions  
**What:** Original blog post introducing ADRs  
**Why:** Foundational text  
**Short, influential**

---

## AI Documentation

### Zero-Drift Template (KAIROS)
**What:** Template for unambiguous AI instructions  
**Why:** Prevents AI hallucination and drift  
**Source:** Referenced in this guide's [AI Agents chapter](04-ai-agents.md)

### Cursor Documentation
**URL:** https://docs.cursor.com/  
**What:** Official Cursor IDE documentation  
**Why:** Cursor-specific AI features and .cursor/rules/ usage

### Claude Documentation
**URL:** https://docs.anthropic.com/  
**What:** Official Claude documentation  
**Why:** Understanding Claude's capabilities and context handling

---

## Books

### "Docs Like Code" by Anne Gentle (2017)
**What:** Treating documentation as software  
**Why:** Version control, testing, CI/CD for docs  
**Essential for modern documentation**

### "Living Documentation" by Cyrille Martraire (2019)
**What:** Documentation that evolves with code  
**Why:** Strategies for keeping docs and code in sync  
**Advanced techniques**

### "Technical Writing for Software Developers" by Amanda Nolen (2021)
**What:** Practical guide to technical writing  
**Why:** Covers README, API docs, tutorials  
**Focused on developers**

---

## Style Guides

### Google Developer Documentation Style Guide
**URL:** https://developers.google.com/style  
**What:** Comprehensive technical writing style guide  
**Why:** Industry standard, well-maintained  
**Reference guide**

### Microsoft Writing Style Guide
**URL:** https://learn.microsoft.com/style-guide/  
**What:** Modern technical writing style  
**Why:** Conversational, accessible approach  
**Reference guide**

### GitLab Documentation Style Guide
**URL:** https://docs.gitlab.com/ee/development/documentation/styleguide/  
**What:** Opinionated, consistent style for large team  
**Why:** Example of scaling documentation  
**For teams**

---

## Tools

### Documentation Generators
- **MkDocs** — Static site generator for docs (Python-based)
- **Docusaurus** — React-based docs site (Meta)
- **VuePress** — Vue-based docs (Vue.js)
- **Sphinx** — Python documentation generator

### Linters and Checkers
- **markdownlint** — Markdown style checker
- **markdown-link-check** — Find broken links
- **vale** — Prose linter (enforce style guide)
- **write-good** — Suggests improvements

### Changelog Tools
- **conventional-changelog** — Generate changelog from commits
- **release-please** — Google's release automation
- **semantic-release** — Automated versioning and changelog

### Diagram Tools
- **Mermaid** — Text-to-diagram (widely supported)
- **draw.io** — Visual diagramming
- **PlantUML** — Text-based UML
- **Excalidraw** — Hand-drawn style

---

## Communities

### Write the Docs
**URL:** https://www.writethedocs.org/  
**What:** Global community of documentarians  
**Why:** Conferences, meetups, Slack, resources  
**Join the community**

### /r/technicalwriting (Reddit)
**URL:** https://reddit.com/r/technicalwriting  
**What:** Technical writing subreddit  
**Why:** Q&A, career advice, discussion

---

## Examples of Great Documentation

### Libraries
- **Stripe API:** https://stripe.com/docs/api
- **Twilio:** https://www.twilio.com/docs
- **Prisma:** https://www.prisma.io/docs

### Open Source Projects
- **Next.js:** https://nextjs.org/docs
- **Rust:** https://doc.rust-lang.org/
- **Vue.js:** https://vuejs.org/guide/

### Internal Documentation Examples
- **GitLab Handbook:** https://about.gitlab.com/handbook/

---

## Quick Reference

| Topic | Primary Source | Type |
|-------|---------------|------|
| Changelog format | keepachangelog.com | Standard |
| Versioning | semver.org | Standard |
| Commit messages | conventionalcommits.org | Standard |
| README basics | makeareadme.com | Guide |
| ADR format | adr.github.io | Standard |
| AI docs | This guide (04-ai-agents.md) | Guide |
| Style guide | Google Dev Docs Style | Reference |
| Tools | markdownlint, vale | Tools |

---

## What This Guide Doesn't Cover

- API documentation specifics (OpenAPI, GraphQL schemas)
- Documentation websites (deployment, hosting)
- Localization and internationalization
- Video documentation
- Interactive tutorials
- Documentation analytics

**For API docs:** See "Documenting APIs" by Tom Johnson (idratherbewriting.com)  
**For doc websites:** See Docusaurus, MkDocs documentation

---

**Back to:** [Index](INDEX.md)
