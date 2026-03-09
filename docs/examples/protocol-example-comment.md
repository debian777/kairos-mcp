# Example: Comment challenge

Short protocol: one real step plus a final verification step. Requires a verification comment or summary of at least 50 characters. Ready to mint with `kairos_mint`.

## Natural Language Triggers

Run when user says "example comment" or "comment challenge".

## Step 1 — Summarize changes

Provide a short summary of the changes made. Minimum 50 characters.

```json
{
  "challenge": {
    "type": "comment",
    "comment": {
      "min_length": 50
    },
    "required": true
  }
}
```

## Step 2 — Run complete

Only reachable after Step 1 is solved. Show the output from Step 1 to the user (the summary text that was submitted). No additional challenge.

## Completion Rule

Only reachable after all prior steps are solved.
