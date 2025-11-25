# PROTOCOL: ELITE AI CODING STANDARDS

**MISSION**: Execute coding tasks with surgical precision. Zero regression. Maximum velocity.

**THE RULES OF ENGAGEMENT:**

## 1. ISOLATION IS SURVIVAL (Git Branching)
*   **CRITIQUE**: Working on `main` is for amateurs and hallucinations. You break `main`, you die.
*   **MANDATE**: Create a feature branch immediately.
    *   **Naming**: `feat/` or `fix/` + concise descriptor.
    *   **No exceptions.**
*   Proof of work: `git rev-parse --abbrev-ref HEAD | grep -v main`

## 2. INTELLIGENCE AUGMENTATION (Kairos & Context7)
*   **CRITIQUE**: Guessing is inefficiency. Hallucination is failure.
*   **MANDATE**:
    *   **KAIROS**: Engage KAIROS protocol. Verify memory state. Don't drift.
    *   **CONTEXT7**: Pull authoritative docs. If you don't know the library version, you don't know the code.
*   Proof of work: `kairos status | grep -i "ACTIVE" && context7 status | grep -i "READY"`

## 3. BASELINE TRUTH (Pre-flight Testing)
*   **CRITIQUE**: You cannot fix what you haven't measured. Coding without a baseline is flying blind.
*   **MANDATE**: Run existing tests *before* touching a single line of code.
    *   Capture the state.
    *   If it's already broken, document it. Don't own someone else's failure.
*   Proof of work: `test -f cache/tests/baseline.log`

## 4. TEST-DRIVEN DOMINANCE (New Features)
*   **CRITIQUE**: Code without tests is legacy code the moment it's written.
*   **MANDATE**: Write the test *first* or immediately alongside the feature.
    *   If the test doesn't fail first, you're faking it.
*   Proof of work: `test -f cache/tests/new-feature-tests.log`

## 5. IMMUTABILITY OF LEGACY (Regression Prevention)
*   **CRITIQUE**: Changing old tests to make new code pass is lying.
*   **MANDATE**: Update existing tests **ONLY** if the business logic has fundamentally changed.
    *   Otherwise, your code is wrong. Fix your code, not the test.
*   Proof of work: `test -f cache/tests/legacy-approval.log`

## 6. THE FEEDBACK LOOP (Iterative Execution)
*   **CRITIQUE**: Big bang deployments are suicide.
*   **MANDATE**: Code -> Deploy/Build -> Test. Repeat.
    *   Short cycles.
    *   Fail fast, fix faster.
*   Proof of work: `test -f cache/build/feedback-cycle.log`

## 7. ATOMICITY (Git Commits)
*   **CRITIQUE**: "WIP" commits are garbage. Giant commits are unreviewable.
*   **MANDATE**: Commit often. Commit atomic units of work.
    *   Messages must be descriptive and follow conventional commits.
*   Proof of work: `git log -1 --pretty=%s | grep -E '^(feat|fix|chore|docs|refactor|test|build|ci|perf|style)(\(.+\))?!?:'`

## 8. PROOF OF WORK (The Handoff)
*   **CRITIQUE**: "It works on my machine" is irrelevant.
*   **MANDATE**: Final report must include:
    *   Git commit hash.
    *   Logs showing **ALL** tests passing.
    *   No ambiguity.
*   Proof of work: `test -f cache/proof/handoff.log`

**EXECUTE OR TERMINATE.**
