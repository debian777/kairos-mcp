# Pre-Push Checklist

Before pushing documentation changes, verify completeness for all three audiences.

---

## For New Repositories

### Essential Files
- [ ] `README.md` exists
- [ ] `README.md` has one-sentence description
- [ ] `README.md` has installation instructions
- [ ] `README.md` has quick start example
- [ ] `LICENSE` file exists
- [ ] `.gitignore` appropriate for tech stack

### User Documentation
- [ ] Installation instructions for all platforms
- [ ] Quick start works (tested)
- [ ] Link to detailed user docs (if applicable)
- [ ] Troubleshooting section

### Developer Documentation
- [ ] `CONTRIBUTING.md` exists (if accepting contributions)
- [ ] Development setup instructions
- [ ] How to run tests
- [ ] Coding conventions documented
- [ ] `CHANGELOG.md` exists (if versioned)

### AI Documentation
- [ ] `CLAUDE.md` exists (if using AI assistants)
- [ ] Architecture overview in CLAUDE.md
- [ ] MUST ALWAYS / MUST NEVER lists
- [ ] No forbidden words (consider, should, might, etc.)
- [ ] Examples provided

---

## For Existing Repositories

### README
- [ ] Reflects current state (not outdated)
- [ ] Installation instructions work
- [ ] Quick start example works
- [ ] Links to detailed docs are valid

### User Docs
- [ ] Installation instructions tested on fresh machine
- [ ] Screenshots are current (if using them)
- [ ] Examples work
- [ ] Troubleshooting covers common issues

### Developer Docs
- [ ] `CONTRIBUTING.md` is current
- [ ] Setup instructions work on fresh machine
- [ ] All tests pass on main branch
- [ ] Architecture docs reflect current design
- [ ] ADRs created for recent major decisions

### AI Docs
- [ ] `CLAUDE.md` reflects current architecture
- [ ] Coding conventions are current
- [ ] MUST ALWAYS/MUST NEVER lists are complete
- [ ] Workflows documented

### Changelog
- [ ] `CHANGELOG.md` updated (if user-facing changes)
- [ ] Version number updated
- [ ] Changes categorized (Added, Changed, Fixed, etc.)
- [ ] Breaking changes clearly marked

---

## Documentation Quality Checks

### Completeness
- [ ] Each audience has documentation
- [ ] No "TODO" or "Coming soon" sections
- [ ] All links work (no 404s)
- [ ] All code examples tested

### Clarity
- [ ] One-sentence description is clear
- [ ] Installation instructions are specific
- [ ] No jargon without definitions
- [ ] Examples are concrete

### Accuracy
- [ ] Documentation matches current code
- [ ] Version numbers are correct
- [ ] Screenshots are current
- [ ] Commands actually work

### Maintainability
- [ ] Owner assigned (if applicable)
- [ ] Last updated date visible
- [ ] Review schedule set
- [ ] Documentation in repo (not external)

---

## The Three-Audience Test

### End User Test (30 seconds)
- [ ] Can unfamiliar person tell what this does?
- [ ] Can they figure out how to install it?
- [ ] Do they know where to get help?

### Developer Test (5 minutes)
- [ ] Can new contributor set up dev environment?
- [ ] Do they know how to run tests?
- [ ] Do they know contribution process?
- [ ] Do they understand architecture?

### AI Test (Zero ambiguity)
- [ ] All instructions explicit (no "configure appropriately")?
- [ ] Rules stated as MUST ALWAYS/MUST NEVER?
- [ ] Examples provided?
- [ ] No forbidden words?

---

## Before Major Release

- [ ] CHANGELOG.md updated
- [ ] Version bumped (semver)
- [ ] Breaking changes documented
- [ ] Migration guide (if breaking changes)
- [ ] All docs reflect new version
- [ ] Examples tested

---

## Final Check

- [ ] Ran link checker (no broken links)
- [ ] Tested instructions on fresh machine
- [ ] Spell-checked documentation
- [ ] Reviewed by team member
- [ ] All TODOs resolved

---

**Push with confidence.**

---

**Next**: [Sources and Further Reading →](10-sources.md)
