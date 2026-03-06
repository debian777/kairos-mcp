# {Protocol title}

{One-sentence description of what this protocol does and when to run it.}

## Natural Language Triggers

**Run this protocol when the user says ANY of:**

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

- "{phrase that activates}" → run this protocol
- "{phrase that activates}" → run this protocol

**Bad trigger examples:**

- "{phrase that must not activate}" → {what to do instead}
- "{phrase that must not activate}" → {what to do instead}

## Step 1: {Step label}

{What the agent must do in this step.}

```json
{
  "challenge": {
    "type": "shell",
    "shell": { "cmd": "{command}", "timeout_seconds": 60 },
    "required": true
  }
}
```

## Step 2: {Step label}

{What the agent must do in this step.}

```json
{
  "challenge": {
    "type": "comment",
    "comment": { "min_length": 50 },
    "required": true
  }
}
```

## Completion rule

Only reachable after all prior steps are solved. Show the outputs from
all prior steps to the user. No additional challenge.
