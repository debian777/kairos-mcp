# Changelogs and Versioning

> "A changelog is a promise to your users that you track what changes."

## The Problem

Users upgrade. Things break. They don't know what changed. You don't remember what changed. Nobody documented the changes.

**A changelog documents what changed, when, and why.**

---

## Keep a Changelog Format

Follow [https://keepachangelog.com/](https://keepachangelog.com/):

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Dark mode support
- Export to PDF feature

### Changed
- Improved performance of data processing

### Fixed
- CSV import crash on Windows

## [2.1.0] - 2026-03-05

### Added
- User authentication
- API rate limiting

### Changed
- Updated Node.js requirement to 20+

### Deprecated
- `/api/v1/legacy-endpoint` (use `/api/v2/endpoint` instead)

## [2.0.0] - 2026-02-15

### Added
- TypeScript rewrite
- GraphQL API

### Changed
- **BREAKING:** REST API moved from `/api/` to `/api/v1/`

### Removed
- Removed Python 2 support

## [1.0.0] - 2026-01-01

- Initial release
```

---

## Categories

### Added
New features.

### Changed
Changes to existing functionality.

### Deprecated
Features marked for removal.

### Removed
Removed features.

### Fixed
Bug fixes.

### Security
Security patches.

---

## Semantic Versioning

Follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

**MAJOR** (e.g., 1.0.0 → 2.0.0)
- Breaking changes
- Incompatible API changes
- Users must update their code

**MINOR** (e.g., 1.0.0 → 1.1.0)
- New features (backward compatible)
- New functionality
- Users don't need to change code

**PATCH** (e.g., 1.0.0 → 1.0.1)
- Bug fixes (backward compatible)
- No new features
- Users can safely upgrade

**Example:**
- `1.0.0` → `1.0.1`: Fixed CSV parsing bug
- `1.0.1` → `1.1.0`: Added export to PDF feature
- `1.1.0` → `2.0.0`: Changed API (breaking)

---

## Conventional Commits

Link commits to changelog with [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature (MINOR bump)
- `fix`: Bug fix (PATCH bump)
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Build process, dependencies

**Examples:**
```
feat(api): add user authentication
fix(csv): handle UTF-8 encoding correctly
docs: update installation guide
refactor: extract validation logic
```

**Breaking changes:**
```
feat(api)!: move endpoints to /api/v2

BREAKING CHANGE: All API endpoints now under /api/v2/
```

---

## Automated Changelog Generation

Generate changelogs from commits:

```bash
# Using conventional-changelog
npm install -g conventional-changelog-cli
conventional-changelog -p angular -i CHANGELOG.md -s
```

**Or use release automation:**
- [release-please](https://github.com/googleapis/release-please) (Google)
- [semantic-release](https://github.com/semantic-release/semantic-release)
- [standard-version](https://github.com/conventional-changelog/standard-version)

---

## What to Include

### For Users
- New features they can use
- Bug fixes that affect them
- Breaking changes they need to handle
- Deprecated features

### Not for Changelog
- Internal refactoring
- Dependency updates (unless user-visible)
- Code style changes
- Test changes

**Focus on user-visible changes.**

---

## Checklist

CHANGELOG.md must have:
- [ ] Follows Keep a Changelog format
- [ ] Uses Semantic Versioning
- [ ] Unreleased section at top
- [ ] Each release has date
- [ ] Categories: Added, Changed, Deprecated, Removed, Fixed, Security
- [ ] Breaking changes clearly marked
- [ ] Links to version tags (optional)

---

**Next**: [Anti-Patterns Gallery →](07-anti-patterns.md)
