# Example: User input challenge

Short protocol: one real step plus a final verification step. Requires human confirmation before advancing. Ready to mint with `kairos_mint`.

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

## Step 2 — Run complete

Only reachable after Step 1 is solved. Show the output from Step 1 to the user (the user's confirmation or response). No additional challenge.
