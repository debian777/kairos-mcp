# Example: Shell challenge

Short protocol with one step. Run a command to prove completion. Ready to mint with `kairos_mint`.

## Step 1 — Run the test suite

Execute the project test suite. Success means the command exits with code 0.

```json
{
  "challenge": {
    "type": "shell",
    "shell": {
      "cmd": "npm test",
      "timeout_seconds": 60
    },
    "required": true
  }
}
```
