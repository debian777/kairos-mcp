# UX Design Awards — Product + Concept rubric for KAIROS

This document defines the explicit rubric used to evaluate KAIROS UI for **UX Design Awards** (Product and Concept lanes). It is the source of acceptance criteria for each flow and for design-lint and QA.

## 1. Award benchmarks (what we're judged on)

### Product lane

- **Innovation**: Novel solution to a real problem; clear value for the user and the domain.
- **Usability**: Easy to learn and use; minimal cognitive load; predictable outcomes.
- **Visual design**: Coherent identity, hierarchy, and craft; supports comprehension and trust.
- **Impact**: Measurable benefit (efficiency, clarity, adoption, accessibility).

### Concept lane

- **Vision**: Forward-looking idea; demonstrates how the product could evolve.
- **Clarity**: The concept is understandable and well communicated.
- **Feasibility**: Shown to be implementable (prototype, flow, or evidence).

### Shared criteria (both lanes)

- **User-centred**: Decisions driven by user goals, not system structure.
- **Accessibility**: Inclusive design; WCAG 2.2 AA as baseline; keyboard and screen reader support.
- **Consistency**: Predictable patterns, language, and behaviour across the product.

---

## 2. KAIROS success criteria (translation to our product)


| Criterion            | Meaning for KAIROS                                                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Innovation**       | First-class guided run for protocols (human-in-the-loop, safe-by-default); protocol authoring that feels safe (preview, validation, templates).                                     |
| **Usability**        | Users find protocols quickly, understand why they matched, and know the next step (View / Refine / Create). Protocol detail is scannable; run flow is step-by-step and recoverable. |
| **Visual design**    | Consistent tokens, clear hierarchy, professional tone. No jargon in the UI; challenge types and roles translated to user language.                                                  |
| **Impact**           | Reduced time to find and run a protocol; fewer errors in authoring; accessible to keyboard and assistive tech users.                                                                |
| **Vision (Concept)** | Guided run as flagship experience; future: run history, templates, spaces.                                                                                                          |


---

## 3. Must-have screens (evaluation surface)


| Screen                     | Purpose                                         | Must demonstrate                                                                                                                                                     |
| -------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home / landing**         | Entry; what KAIROS is and primary actions.      | Clear value prop, primary CTA (e.g. Search/Browse), wayfinding.                                                                                                      |
| **Browse / Search**        | Find protocols by intent.                       | Labeled search, results with comprehension (why matched, preview/metadata), role-based actions (View, Refine, Create), empty and error states, loading (skeleton).   |
| **Protocol detail**        | Read and understand a protocol.                 | Title, metadata, structured steps (expand/collapse), human-readable challenge types, triggers, completion rule, in-product "How to run", Edit/Duplicate/Run actions. |
| **Protocol create / edit** | Author protocols safely.                        | Editor + live preview, templates, structural validation, save/cancel, clear errors.                                                                                  |
| **Guided run**             | Execute a protocol step-by-step (safe, manual). | Stepper, challenge rendering per type (shell/user_input/comment/mcp), solution input, attestation, summary; no automatic shell execution.                            |
| **Runs**                   | See and resume runs.                            | List of runs (UI state or server), resume/continue, clear empty state.                                                                                               |
| **Account**                | Identity and sign out.                          | User name/email, Log out, signed-out state with Sign in.                                                                                                             |
| **Error recovery**         | Every flow.                                     | Message, next_action or equivalent, retry/back/support where applicable.                                                                                             |


---

## 4. Evaluation checklist (per flow)

Use this checklist for design review and before release.

### 4.1 Browse / Search

- Search input has visible label and hint (no placeholder-only).
- Results show: title, why matched or role, score/metadata where available, clear primary action (View / Refine / Create).
- Empty state: message + Create/Refine actions.
- Loading: skeleton or explicit loading state (no blank flash).
- Error: message + retry and/or go back.
- Keyboard: tab order, focus visible, no trap.
- Screen reader: results count and updates announced (e.g. live region).

### 4.2 Protocol detail

- H1 = protocol title; metadata (e.g. URI) available but not dominant.
- Steps: list with labels; expand/collapse or inline human-readable challenge summary (shell = command, mcp = tool, etc.).
- Triggers and Completion rule sections present and readable.
- "How to run" / "How to use" in-product (not only external link).
- Actions: View (if applicable), Edit, Duplicate, Run (guided) — all reachable and labeled.
- Copy affordance for command or URI where useful.
- Semantic structure: sections, headings, list; aria-labelledby where needed.

### 4.3 Protocol create / edit

- Editor and live preview (split or toggle); preview reflects structure (steps, triggers, completion).
- At least one template (e.g. "Minimal protocol") insertable.
- Validation: H1 required; challenge block structure; errors inline with aria-invalid/aria-describedby.
- Save/Cancel; saving state (disabled + label); error on save shown clearly.
- No data loss on validation error (form retains input).

### 4.4 Guided run

- Entry from protocol detail ("Run (guided)" or equivalent).
- Stepper: current step, progress, next action clear.
- Challenge types: shell (show command; user pastes exit code, stdout, stderr), user_input (prompt + confirmation), comment (min length + text), mcp (tool name + manual result or configured).
- No automatic execution of shell commands in the browser.
- Submit solution → next step or attestation; errors with retry and fresh challenge.
- Attestation: outcome + message; then summary.
- Keyboard and focus: all inputs and buttons reachable; focus moved to new step/challenge where appropriate.
- Screen reader: step change and result announced.

### 4.5 Runs

- List of runs (or empty state with explanation).
- Resume/continue when run is in progress.
- Clear labeling (protocol, date, status).

### 4.6 Account

- Signed in: name/email, Log out.
- Signed out: message + Sign in (to IdP, not raw callback in copy).
- Focus and keyboard: all interactive elements reachable.

### 4.7 Global

- Skip link at start; visible on focus.
- Nav: 3–5 items; current page indicated (aria-current="page"); consistent.
- Focus visible on all interactive elements (2px outline, offset 2px).
- Touch targets ≥ 44×44px.
- Errors: text + icon or role; not colour alone.
- Language: user terms (protocol, steps, run); no unexplained jargon (URI, nonce, proof_hash) in primary UI.

---

## 5. Acceptance criteria (implementation-ready)

These map to the plan deliverables and QA.

### Browse / Search


| ID   | Criterion             | Pass condition                                                       |
| ---- | --------------------- | -------------------------------------------------------------------- |
| SR-1 | Labeled search        | Input has associated `<label>` and `aria-describedby` for hint.      |
| SR-2 | Results comprehension | Each result shows label, role or match reason, and primary action.   |
| SR-3 | Empty state           | When choices.length === 0: message + Refine/Create actions.          |
| SR-4 | Loading               | When isLoading: skeleton list or "Searching…" with no layout shift.  |
| SR-5 | Error                 | When isError: ErrorAlert or equivalent with message, retry, go back. |
| SR-6 | Keyboard              | Full flow operable by keyboard; focus visible.                       |


### Protocol detail


| ID   | Criterion   | Pass condition                                                                    |
| ---- | ----------- | --------------------------------------------------------------------------------- |
| PD-1 | Structure   | H1, metadata, steps list, triggers, completion, "How to run".                     |
| PD-2 | Steps       | Each step has label and human-readable type (e.g. "Shell command", "User input"). |
| PD-3 | Actions     | Edit, Duplicate, Run (guided) present and working.                                |
| PD-4 | Expand/copy | Steps expandable or with copy for command/URI.                                    |


### Create / edit


| ID   | Criterion  | Pass condition                                          |
| ---- | ---------- | ------------------------------------------------------- |
| CE-1 | Split view | Editor and preview both visible or toggled.             |
| CE-2 | Template   | At least one insertable template.                       |
| CE-3 | Validation | H1 + structure validated; errors shown inline.          |
| CE-4 | Save       | Save/Cancel; loading state; error displayed on failure. |


### Guided run


| ID   | Criterion                  | Pass condition                                                          |
| ---- | -------------------------- | ----------------------------------------------------------------------- |
| GR-1 | Stepper                    | Steps visible; current step and progress clear.                         |
| GR-2 | Shell                      | Command shown; user enters exit code, stdout, stderr (no auto-exec).    |
| GR-3 | user_input / comment / mcp | Rendered and solution collectible per type.                             |
| GR-4 | Attestation                | Outcome and message; then summary screen.                               |
| GR-5 | Errors                     | Server errors show message; retry with fresh challenge when applicable. |
| GR-6 | Keyboard / a11y            | Full flow keyboard-operable; focus and announcements.                   |


### Runs list


| ID   | Criterion     | Pass condition                                               |
| ---- | ------------- | ------------------------------------------------------------ |
| RL-1 | List or empty | Runs listed or empty state with copy.                        |
| RL-2 | Resume        | In-progress run can be resumed from list (or from protocol). |


### Account


| ID   | Criterion  | Pass condition          |
| ---- | ---------- | ----------------------- |
| AC-1 | Signed in  | Name/email, Log out.    |
| AC-2 | Signed out | Message + Sign in link. |


### Global / a11y


| ID  | Criterion   | Pass condition                                                     |
| --- | ----------- | ------------------------------------------------------------------ |
| G-1 | Skip link   | Present; visible on focus.                                         |
| G-2 | Nav         | Current page indicated; 3–5 items.                                 |
| G-3 | Focus       | All controls have visible focus (focus-visible).                   |
| G-4 | Touch       | Interactive elements ≥ 44×44px.                                    |
| G-5 | Design-lint | `docs/design/design-lint-report.md` has no outstanding violations. |


---

## 6. How to use this rubric

- **Design phase**: Use §3 and §4 to define and review mockups.
- **Implementation**: Use §5 as acceptance criteria in PRs and QA.
- **Before submission**: Run through §4 checklist and §5 pass conditions; fix any failures.
- **Design-lint**: Run the kairos-ui-designer skill §11 design-lint after UI changes; update `design-lint-report.md` and resolve violations.

