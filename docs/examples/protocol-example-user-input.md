# Example: User input challenge

Short protocol with one step. Requires human confirmation before advancing. Ready to mint with `kairos_mint`.

## Step 1 — Confirm deployment

Ask the user to approve deployment. The agent must obtain confirmation and send it in the solution.

```json
{
  "challenge": {
    "type": "user_input",
    "user_input": {
      "prompt": "Approve deployment to production?"
    },
    "required": true
  }
}
```
