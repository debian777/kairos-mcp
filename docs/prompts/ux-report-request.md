# Prompt: Request a UX report for a workflow

Copy-paste this into another chat to get a UX report of a tool/workflow run.

---

**Please produce a UX report for this workflow run.**

1. **Capture** every request and response (full raw JSON). If responses are large, put each call’s request and response in separate JSON files in a subfolder under `reports/`, with **number prefixes** so the flow reads in order (e.g. `01-search-request.json`, `02-search-response.json`, …).

2. **Write** a markdown report in `reports/` that includes:
   - Short summary of the flow and outcome
   - A table linking to each request/response file
   - One short section per step (intent, what was sent, what was returned, UX notes)
   - A short “UX conclusions” table
   - **Honest answer:** For any step where you did not follow the documented or returned `next_action` literally (e.g. you inferred an extra call or a different order), add a clear “Why I did X” note: what the response said, what you did instead, and that it was an interpretation/guess.

3. **Do not** omit or soften deviations; call them out so the report is useful for improving the UX or the agent’s instructions.
