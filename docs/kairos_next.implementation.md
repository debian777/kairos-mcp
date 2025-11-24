**FINAL KAIROS_NEXT RESPONSE SCHEMA — NOVEMBER 21, 2025**  

```json
{
  "type": "object",
  "description": "Response from kairos_next — unified, clean, perfect format",
  "properties": {
    "must_obey": {
      "type": "boolean",
      "const": true,
      "description": "Agent MUST continue with kairos_next on next_step.uri"
    },
    "current_step": {
      "type": "object",
      "required": ["uri", "content", "mimeType"],
      "properties": {
        "uri": {
          "type": "string",
          "pattern": "^kairos://mem/[0-9a-f-]{36}$",
          "description": "Full URI of current memory step"
        },
        "content": {
          "type": "string",
          "description": "Clean, original markdown — NO HTML, NO HEADERS, NO FOOTERS"
        },
        "mimeType": {
          "type": "string",
          "const": "text/markdown"
        }
      },
      "additionalProperties": false
    },
    "next_step": {
      "oneOf": [
        {
          "type": "object",
          "required": ["uri", "position", "label"],
          "properties": {
            "uri": {
              "type": "string",
              "pattern": "^kairos://mem/[0-9a-f-]{36}$"
            },
            "position": {
              "type": "string",
              "pattern": "^\\d+/\\d+$",
              "example": "2/14"
            },
            "label": {
              "type": "string",
              "description": "Human-readable title of next step"
            }
          },
          "additionalProperties": false
        },
        {
          "type": "null",
          "description": "This is the final step — chain complete"
        }
      ]
    },
    "protocol_status": {
      "type": "string",
      "enum": ["continue", "completed"],
      "description": "'continue' = call kairos_next, 'completed' = protocol finished"
    }
  },
  "required": ["must_obey", "current_step", "next_step", "protocol_status"],
  "additionalProperties": false
}
```

### Two possible responses (exact examples)

**Continue (has next step):**
```json
{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/02a68d9c-63e2-43e6-aa36-bddadceb6e4f",
    "content": "# NATURAL LANGUAGE → KAIROS TRANSLATOR\n\nYou do not \"understand\" natural language...\n...",
    "mimeType": "text/markdown"
  },
  "next_step": {
    "uri": "kairos://mem/c71f15ae-4f4f-4b9b-addf-a0f6108b6955",
    "position": "2/14",
    "label": "Rule 1 — KAIROS FIRST, ALWAYS"
  },
  "protocol_status": "continue"
}
```

**Completed (last step):**
```json
{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8",
    "content": "# FINAL STEP\n\nProtocol complete. You may now respond.",
    "mimeType": "text/markdown"
  },
  "next_step": null,
  "protocol_status": "completed"
}
```

**This is the final, perfect, unbreakable schema.**

Deploy this.  
Never change it again.  
KAIROS is now complete.

**Done. Forever.**