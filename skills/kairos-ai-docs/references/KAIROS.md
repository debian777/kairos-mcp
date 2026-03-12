---
version: "3.0.1"

title: Zero-Drift Minimal Template for AI Instructions
---

# Zero-Drift Minimal Template for AI Instructions

## Overview / Template Structure / Example: YAML Operations Manual / Key Components / Usage Guidelines / Benefits / Validation Checklist / Related

**Status:** Active  
**Purpose:** Standard template for embedding AI instructions in configuration files to maintain zero-drift between structure and output.

---

The zero-drift minimal template ensures AI assistants understand how to edit structured configuration files (YAML, JSON, etc.) while maintaining exact 1-to-1 mapping between the configuration structure and generated output.

---

```yaml
## ============================================================================
# AI INSTRUCTIONS - ZERO-DRIFT SECTION MAPPING (MANDATORY)
# ============================================================================
#
# MISSION: Edit this [FILE TYPE] file to populate [OUTPUT TYPE] content.
#          Maintain exact 1-to-1 mapping between [STRUCTURE] and [OUTPUT].
#
# STRUCTURE: [Describe the structure]
#   - [Key point 1]
#   - [Key point 2]
#   - [Key point 3]
#
# CONTENT TYPES:
#   - [Type 1]: [Description]
#   - [Type 2]: [Description]
#
# MUST ALWAYS:
#   - [Rule 1]
#   - [Rule 2]
#   - [Rule 3]
#
# MUST NEVER:
#   - [Prohibition 1]
#   - [Prohibition 2]
#   - [Prohibition 3]
#
# ============================================================================
# END AI INSTRUCTIONS
# ============================================================================
```

---

```yaml
# Operations Manual Configuration
# This YAML file generates markdown operations manuals
#
# ============================================================================
# AI INSTRUCTIONS - ZERO-DRIFT SECTION MAPPING (MANDATORY)
# ============================================================================
#
# MISSION: Edit this YAML file to populate operations manual content.
#          Maintain exact 1-to-1 mapping between YAML structure and
#          markdown output.
#
# STRUCTURE: Array-based for ordering (YAML maps don't maintain order)
#   - Top-level: sections: array
#   - Each section: map with key = markdown heading
#   - Content items: array of maps with keys: text, table
#   - Subsections: nested maps (keys become headings)
#
# CONTENT TYPES:
#   - text: All text content (paragraphs, diagrams, code) - rendered as
#           markdown
#   - table: Array of arrays [["Header"], ["Data"]] - rendered as
#           Confluence HTML
#   - Map keys: Become markdown headings (##, ###, ####)
#
# MUST ALWAYS:
#   - Use arrays to maintain order
#   - Use text: for all text content (paragraphs, mermaid diagrams, code blocks)
#   - Use table: for tables with array format
#   - Include header row as first element in table arrays
#   - Provide at least one data row per table
#
# MUST NEVER:
#   - Use maps for top-level sections (use arrays)
#   - Skip sections
#   - Change table format
#
# ============================================================================
# END AI INSTRUCTIONS
# ============================================================================
```

---

### 1. MISSION Statement

**Purpose:** Clearly define what the AI should do and the constraint (zero-drift mapping).

**Format:**
```
MISSION: Edit this [FILE_TYPE] file to populate [OUTPUT_TYPE] content.
         Maintain exact 1-to-1 mapping between [STRUCTURE] and [OUTPUT].
```

### 2. STRUCTURE Description

**Purpose:** Explain the data structure and how it maps to output.

**Should include:**
- Top-level structure
- Nested elements
- Key-value relationships
- Ordering requirements

### 3. CONTENT TYPES

**Purpose:** Define all valid content types and their rendering rules.

**Format:**
```
CONTENT TYPES:
  - type1: Description of how it's rendered
  - type2: Description of how it's rendered
```

### 4. MUST ALWAYS Rules

**Purpose:** Enumerate mandatory requirements for maintaining zero-drift.

**Should cover:**
- Structure requirements
- Content format requirements
- Ordering requirements
- Required fields

### 5. MUST NEVER Rules

**Purpose:** List prohibited actions that would break zero-drift mapping.

**Should cover:**
- Forbidden structures
- Prohibited modifications
- Invalid formats

---

### When to Use

- Configuration files that generate structured output (markdown, HTML, etc.)
- Files where structure must match output exactly
- Files edited by AI assistants that need strict constraints

### Where to Place

- At the top of the file, after initial comments
- Before the actual configuration data
- Clearly delimited with comment markers

### Format Requirements

- Use comment syntax appropriate for file type (`#` for YAML, `//` for JSON, etc.)
- Use clear delimiters (`===` lines)
- Keep instructions concise but complete
- Use consistent formatting

---

1. **Zero-Drift Guarantee:** AI understands exact mapping requirements
2. **Consistency:** All edits follow the same structure rules
3. **Maintainability:** Clear instructions reduce errors
4. **Automation:** Enables reliable AI-assisted editing

---

When creating or updating zero-drift templates:

- [ ] MISSION statement clearly defines zero-drift requirement
- [ ] STRUCTURE section explains data model completely
- [ ] CONTENT TYPES cover all valid content formats
- [ ] MUST ALWAYS rules are comprehensive
- [ ] MUST NEVER rules prevent common mistakes
- [ ] Template is clearly delimited
- [ ] Instructions are file-type appropriate
- [ ] Examples are provided if helpful

---

- Git Merge Request Policy
- Branch Naming Policy
- Commit Message Policy

---
