# {Adapter title}

{One sentence: what this adapter does and when to run it.}

## Activation Patterns

**Run this adapter when the user says ANY of:**

- "{trigger phrase 1}"
- "{trigger phrase 2}"
- "{trigger phrase 3}"

**Trigger verbs** + ({noun1} / {noun2} / {noun3}):

- **{verb1}** / **{verb2}** / **{verb3}**

**Must Never:**

- Trigger on "{phrase}" when the user means {different intent}
- Run without {required precondition}

**Must Always:**

- {Mandatory behaviour 1}
- {Mandatory behaviour 2}

**Good trigger examples:**

- "{phrase that activates}" → run this adapter
- "{phrase that activates}" → run this adapter

**Bad trigger examples:**

- "{phrase that must not activate}" → {what to do instead}
- "{phrase that must not activate}" → {what to do instead}

## Step 1: {Layer label}

{Instructions for the agent.}

```json
{
  "contract": {
    "type": "shell",
    "shell": { "cmd": "{command}", "timeout_seconds": 60 },
    "required": true
  }
}
```

## Step 2: {Layer label}

{Instructions for the agent.}

```json
{
  "contract": {
    "type": "comment",
    "comment": { "min_length": 50 },
    "required": true
  }
}
```

## Reward Signal

Only reachable after all prior layers are satisfied. Summarize outcomes for the user. No additional contract on this section unless you need a final optional check.
