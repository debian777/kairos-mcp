# Example: Comment challenge

Short protocol with one step. Requires a verification comment or summary of at least 50 characters. Ready to mint with `kairos_mint`.

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
