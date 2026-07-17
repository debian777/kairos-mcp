# Code Quality Tools and Linting

<cite>
**Referenced Files in This Document**
- [eslint.config.cjs](file://eslint.config.cjs)
- [eslint/flat-config.cjs](file://eslint/flat-config.cjs)
- [eslint/plugins/kairos-codeql-line-comments.cjs](file://eslint/plugins/kairos-codeql-line-comments.cjs)
- [eslint/plugins/kairos-forbidden-text.cjs](file://eslint/plugins/kairos-forbidden-text.cjs)
- [eslint/plugins/kairos-mcp-widget.cjs](file://eslint/plugins/kairos-mcp-widget.cjs)
- [eslint/rules/shared-snippets.cjs](file://eslint/rules/shared-snippets.cjs)
- [eslint/parsers/markdown-plain-text.cjs](file://eslint/parsers/markdown-plain-text.cjs)
- [tsconfig.json](file://tsconfig.json)
- [tsconfig.tests.json](file://tsconfig.tests.json)
- [tsconfig.ui.json](file://tsconfig.ui.json)
- [knip.config.ts](file://knip.config.ts)
- [.markdownlint.jsonc](file://.markdownlint.jsonc)
- [package.json](file://package.json)
- [scripts/lint-agent-skills.py](file://scripts/lint-agent-skills.py)
- [scripts/lint-verify-clean-source.mjs](file://scripts/lint-verify-clean-source.mjs)
- [scripts/ci-check-trivyignore-expiry.py](file://scripts/ci-check-trivyignore-expiry.py)
- [scripts/validate-mermaid.sh](file://scripts/validate-mermaid.sh)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document explains the code quality and linting setup used across the Kairos MCP repository. It covers ESLint configuration (including custom rules and plugins), TypeScript strict mode and type checking enforcement, Knip configuration for unused dependencies and dead code analysis, markdown linting and documentation quality checks, custom linting scripts for skills validation and consistency, IDE integration guidance, formatting standards, and quality gates including pre-commit hooks.

The goal is to help contributors understand how to maintain consistent, high-quality code and documentation across the monorepo-style workspace and to integrate their local development environments for real-time feedback.

## Project Structure
The code quality tooling is organized into dedicated directories and configuration files:
- ESLint flat config and custom plugins reside under eslint/.
- TypeScript configurations are defined at the root and per-project scopes.
- Knip configuration is centralized at the root.
- Markdown linting rules are configured via .markdownlint.jsonc.
- Custom linting and validation scripts live under scripts/.
- Package scripts orchestrate running these tools.

```mermaid
graph TB
A["Root Configs<br/>package.json, tsconfig.json"] --> B["ESLint Flat Config<br/>eslint.config.cjs"]
B --> C["Custom Plugins<br/>eslint/plugins/*"]
B --> D["Shared Rules<br/>eslint/rules/*"]
B --> E["Markdown Parser<br/>eslint/parsers/*"]
A --> F["TypeScript Configs<br/>tsconfig.*.json"]
A --> G["Knip Config<br/>knip.config.ts"]
A --> H["Markdown Lint Rules<br/>.markdownlint.jsonc"]
A --> I["Quality Scripts<br/>scripts/*"]
I --> J["Skills Validation<br/>lint-agent-skills.py"]
I --> K["Clean Source Check<br/>lint-verify-clean-source.mjs"]
I --> L["Mermaid Validation<br/>validate-mermaid.sh"]
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

## Core Components
- ESLint flat configuration and custom plugins enforce project-specific coding standards and domain rules.
- TypeScript strict mode and per-target configs ensure strong typing across CLI, server, UI, and tests.
- Knip identifies unused dependencies and dead code to keep the dependency graph lean.
- Markdown linting ensures documentation quality and consistency.
- Custom scripts validate skills, verify clean source state, and check Mermaid diagrams.
- Package scripts and CI workflows tie everything together as quality gates.

**Section sources**
- [eslint.config.cjs](file://eslint.config.cjs)
- [eslint/flat-config.cjs](file://eslint/flat-config.cjs)
- [eslint/plugins/kairos-codeql-line-comments.cjs](file://eslint/plugins/kairos-codeql-line-comments.cjs)
- [eslint/plugins/kairos-forbidden-text.cjs](file://eslint/plugins/kairos-forbidden-text.cjs)
- [eslint/plugins/kairos-mcp-widget.cjs](file://eslint/plugins/kairos-mcp-widget.cjs)
- [eslint/rules/shared-snippets.cjs](file://eslint/rules/shared-snippets.cjs)
- [eslint/parsers/markdown-plain-text.cjs](file://eslint/parsers/markdown-plain-text.cjs)
- [tsconfig.json](file://tsconfig.json)
- [tsconfig.tests.json](file://tsconfig.tests.json)
- [tsconfig.ui.json](file://tsconfig.ui.json)
- [knip.config.ts](file://knip.config.ts)
- [.markdownlint.jsonc](file://.markdownlint.jsonc)
- [package.json](file://package.json)
- [scripts/lint-agent-skills.py](file://scripts/lint-agent-skills.py)
- [scripts/lint-verify-clean-source.mjs](file://scripts/lint-verify-clean-source.mjs)
- [scripts/validate-mermaid.sh](file://scripts/validate-mermaid.sh)

## Architecture Overview
The quality pipeline integrates multiple layers:
- Static analysis (ESLint + TypeScript)
- Dependency and dead code analysis (Knip)
- Documentation linting (Markdown)
- Domain-specific validations (skills, mermaid diagrams)
- Pre-commit hooks and CI gates

```mermaid
sequenceDiagram
participant Dev as "Developer"
participant Hook as "Pre-commit Hook"
participant Lint as "ESLint + TS"
participant Knip as "Knip"
participant MD as "Markdown Lint"
participant Scripts as "Custom Scripts"
participant CI as "CI Pipeline"
Dev->>Hook : git commit
Hook->>Lint : Run ESLint and TypeScript checks
Hook->>MD : Run markdownlint
Hook->>Scripts : Run skills validation and other checks
Hook-->>Dev : Fail if any step fails
Dev->>CI : Push changes
CI->>Lint : Full ESLint + TS build
CI->>Knip : Analyze deps and dead code
CI->>MD : Validate docs
CI->>Scripts : Run full suite of validations
CI-->>Dev : Report results
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

## Detailed Component Analysis

### ESLint Configuration and Custom Rules
ESLint uses a flat configuration approach with custom plugins and shared rules tailored to the project’s needs. Key areas include:
- Flat config entrypoint and plugin registration
- Custom rule implementations for domain-specific checks
- Shared snippets for reuse across rules
- Specialized parsers for non-JS content (e.g., plain text within markdown)

```mermaid
classDiagram
class ESLintFlatConfig {
+plugins
+rules
+settings
+ignores
}
class Plugin_CodeQL_LineComments {
+createRule()
+meta
+schema
}
class Plugin_ForbiddenText {
+createRule()
+meta
+schema
}
class Plugin_MCP_Widget {
+createRule()
+meta
+schema
}
class SharedSnippets {
+helpers
+utils
}
class MarkdownPlainParser {
+parse(text)
+ast
}
ESLintFlatConfig --> Plugin_CodeQL_LineComments : "registers"
ESLintFlatConfig --> Plugin_ForbiddenText : "registers"
ESLintFlatConfig --> Plugin_MCP_Widget : "registers"
ESLintFlatConfig --> SharedSnippets : "uses"
ESLintFlatConfig --> MarkdownPlainParser : "uses"
```

**Diagram sources**
- [eslint/flat-config.cjs](file://eslint/flat-config.cjs)
- [eslint/plugins/kairos-codeql-line-comments.cjs](file://eslint/plugins/kairos-codeql-line-comments.cjs)
- [eslint/plugins/kairos-forbidden-text.cjs](file://eslint/plugins/kairos-forbidden-text.cjs)
- [eslint/plugins/kairos-mcp-widget.cjs](file://eslint/plugins/kairos-mcp-widget.cjs)
- [eslint/rules/shared-snippets.cjs](file://eslint/rules/shared-snippets.cjs)
- [eslint/parsers/markdown-plain-text.cjs](file://eslint/parsers/markdown-plain-text.cjs)

**Section sources**
- [eslint.config.cjs](file://eslint.config.cjs)
- [eslint/flat-config.cjs](file://eslint/flat-config.cjs)
- [eslint/plugins/kairos-codeql-line-comments.cjs](file://eslint/plugins/kairos-codeql-line-comments.cjs)
- [eslint/plugins/kairos-forbidden-text.cjs](file://eslint/plugins/kairos-forbidden-text.cjs)
- [eslint/plugins/kairos-mcp-widget.cjs](file://eslint/plugins/kairos-mcp-widget.cjs)
- [eslint/rules/shared-snippets.cjs](file://eslint/rules/shared-snippets.cjs)
- [eslint/parsers/markdown-plain-text.cjs](file://eslint/parsers/markdown-plain-text.cjs)

### TypeScript Strict Mode and Type Checking
TypeScript is configured with strict settings and multiple target configs to support different parts of the application:
- Root tsconfig.json defines shared compiler options and strictness.
- tsconfig.ui.json targets the UI build with appropriate module and JSX settings.
- tsconfig.tests.json tailors behavior for test execution.

Key aspects typically enforced by strict mode include:
- No implicit any
- Strict null checks
- Strict function types
- No unused variables or parameters
- Consistent module resolution

```mermaid
flowchart TD
Start(["TS Build Entry"]) --> LoadRoot["Load tsconfig.json"]
LoadRoot --> ApplyStrict["Apply strict flags"]
ApplyStrict --> TargetUI{"Target UI?"}
TargetUI --> |Yes| LoadUITsconfig["Load tsconfig.ui.json"]
TargetUI --> |No| TargetTests{"Target Tests?"}
TargetTests --> |Yes| LoadTestTsconfig["Load tsconfig.tests.json"]
TargetTests --> |No| Continue["Continue with defaults"]
LoadUITsconfig --> Compile["Compile with UI settings"]
LoadTestTsconfig --> Compile
Continue --> Compile
Compile --> End(["Type-checked artifacts"])
```

**Diagram sources**
- [tsconfig.json](file://tsconfig.json)
- [tsconfig.ui.json](file://tsconfig.ui.json)
- [tsconfig.tests.json](file://tsconfig.tests.json)

**Section sources**
- [tsconfig.json](file://tsconfig.json)
- [tsconfig.ui.json](file://tsconfig.ui.json)
- [tsconfig.tests.json](file://tsconfig.tests.json)

### Knip Configuration for Unused Dependencies and Dead Code
Knip is configured to analyze the repository for unused dependencies and dead code. Typical responsibilities include:
- Detecting unused imports and exports
- Identifying unreferenced files
- Validating package.json dependencies against usage
- Excluding generated or irrelevant paths

```mermaid
flowchart TD
Start(["Knip Entry"]) --> ReadConfig["Read knip.config.ts"]
ReadConfig --> ScanFiles["Scan source files"]
ScanFiles --> ResolveImports["Resolve imports and exports"]
ResolveImports --> FindUnusedDeps["Find unused dependencies"]
ResolveImports --> FindDeadCode["Find dead code"]
FindUnusedDeps --> Report["Report issues"]
FindDeadCode --> Report
Report --> Exit(["Exit with status"])
```

**Diagram sources**
- [knip.config.ts](file://knip.config.ts)

**Section sources**
- [knip.config.ts](file://knip.config.ts)

### Markdown Linting and Documentation Quality Checks
Documentation quality is enforced using markdownlint with a JSONC configuration file. The configuration typically includes:
- Rule enable/disable toggles
- Custom rule options
- Per-file overrides
- Exclusions for generated content

```mermaid
flowchart TD
Start(["Markdown Lint Entry"]) --> LoadRules[".markdownlint.jsonc"]
LoadRules --> ParseDocs["Parse markdown files"]
ParseDocs --> ApplyRules["Apply rules from config"]
ApplyRules --> ReportIssues["Report violations"]
ReportIssues --> Exit(["Exit with status"])
```

**Diagram sources**
- [.markdownlint.jsonc](file://.markdownlint.jsonc)

**Section sources**
- [.markdownlint.jsonc](file://.markdownlint.jsonc)

### Custom Linting Scripts for Skills Validation and Code Consistency
Custom scripts provide domain-specific validations beyond standard linters:
- Skills validation script checks agent skill definitions and metadata.
- Clean source verification ensures no unintended changes or artifacts remain.
- Additional utilities validate Mermaid diagrams and other assets.

```mermaid
sequenceDiagram
participant Dev as "Developer"
participant Script as "lint-agent-skills.py"
participant Verify as "lint-verify-clean-source.mjs"
participant Mermaid as "validate-mermaid.sh"
Dev->>Script : Run skills validation
Script-->>Dev : Return validation result
Dev->>Verify : Check clean source state
Verify-->>Dev : Return pass/fail
Dev->>Mermaid : Validate Mermaid diagrams
Mermaid-->>Dev : Return validation result
```

**Diagram sources**
- [scripts/lint-agent-skills.py](file://scripts/lint-agent-skills.py)
- [scripts/lint-verify-clean-source.mjs](file://scripts/lint-verify-clean-source.mjs)
- [scripts/validate-mermaid.sh](file://scripts/validate-mermaid.sh)

**Section sources**
- [scripts/lint-agent-skills.py](file://scripts/lint-agent-skills.py)
- [scripts/lint-verify-clean-source.mjs](file://scripts/lint-verify-clean-source.mjs)
- [scripts/validate-mermaid.sh](file://scripts/validate-mermaid.sh)

### Formatting Standards and Automated Formatting Tools
Formatting standards are typically enforced through:
- Prettier or similar formatter configuration
- Editor integrations for on-save formatting
- Consistent indentation, quote styles, and line endings
- Integration with ESLint to avoid conflicts

Guidance:
- Configure your editor to format on save using the project’s formatter.
- Ensure formatter rules align with ESLint rules to prevent conflicts.
- Use pre-commit hooks to enforce formatting before commits.

[No sources needed since this section provides general guidance]

### IDE Integration for Real-Time Feedback
To get real-time feedback in your IDE:
- Install ESLint and TypeScript language extensions.
- Enable “Format On Save” and “Run Linter On Save.”
- Configure the IDE to use the project’s ESLint flat config and TypeScript configs.
- For markdown linting, install a markdownlint extension and point it to .markdownlint.jsonc.
- Optionally, integrate Knip and custom scripts into your task runner or watch mode.

[No sources needed since this section provides general guidance]

### Quality Gates and Pre-commit Hooks
Quality gates ensure that only compliant code is committed and merged:
- Pre-commit hooks run ESLint, TypeScript checks, markdownlint, and custom scripts.
- CI pipelines re-run the same checks to guarantee consistency.
- Fail-fast strategy stops builds early when any gate fails.

```mermaid
flowchart TD
Commit["git commit"] --> Hook["Pre-commit Hook"]
Hook --> ESLint["ESLint"]
Hook --> TS["TypeScript Checks"]
Hook --> MD["Markdown Lint"]
Hook --> Scripts["Custom Scripts"]
ESLint --> Gate{"All Pass?"}
TS --> Gate
MD --> Gate
Scripts --> Gate
Gate --> |Yes| Allow["Allow commit"]
Gate --> |No| Block["Block commit"]
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

## Dependency Analysis
The following diagram illustrates how the quality tools depend on each other and on configuration files:

```mermaid
graph TB
Pkg["package.json"] --> ESLintCfg["eslint.config.cjs"]
ESLintCfg --> Plugins["eslint/plugins/*"]
ESLintCfg --> Rules["eslint/rules/*"]
ESLintCfg --> Parser["eslint/parsers/*"]
Pkg --> TSConf["tsconfig.json"]
Pkg --> KnipConf["knip.config.ts"]
Pkg --> MDLInt[".markdownlint.jsonc"]
Pkg --> Scripts["scripts/*"]
Scripts --> Skills["lint-agent-skills.py"]
Scripts --> Clean["lint-verify-clean-source.mjs"]
Scripts --> Mermaid["validate-mermaid.sh"]
```

**Diagram sources**
- [package.json](file://package.json)
- [eslint.config.cjs](file://eslint.config.cjs)
- [eslint/flat-config.cjs](file://eslint/flat-config.cjs)
- [eslint/plugins/kairos-codeql-line-comments.cjs](file://eslint/plugins/kairos-codeql-line-comments.cjs)
- [eslint/plugins/kairos-forbidden-text.cjs](file://eslint/plugins/kairos-forbidden-text.cjs)
- [eslint/plugins/kairos-mcp-widget.cjs](file://eslint/plugins/kairos-mcp-widget.cjs)
- [eslint/rules/shared-snippets.cjs](file://eslint/rules/shared-snippets.cjs)
- [eslint/parsers/markdown-plain-text.cjs](file://eslint/parsers/markdown-plain-text.cjs)
- [tsconfig.json](file://tsconfig.json)
- [knip.config.ts](file://knip.config.ts)
- [.markdownlint.jsonc](file://.markdownlint.jsonc)
- [scripts/lint-agent-skills.py](file://scripts/lint-agent-skills.py)
- [scripts/lint-verify-clean-source.mjs](file://scripts/lint-verify-clean-source.mjs)
- [scripts/validate-mermaid.sh](file://scripts/validate-mermaid.sh)

**Section sources**
- [package.json](file://package.json)
- [eslint.config.cjs](file://eslint.config.cjs)
- [eslint/flat-config.cjs](file://eslint/flat-config.cjs)
- [eslint/plugins/kairos-codeql-line-comments.cjs](file://eslint/plugins/kairos-codeql-line-comments.cjs)
- [eslint/plugins/kairos-forbidden-text.cjs](file://eslint/plugins/kairos-forbidden-text.cjs)
- [eslint/plugins/kairos-mcp-widget.cjs](file://eslint/plugins/kairos-mcp-widget.cjs)
- [eslint/rules/shared-snippets.cjs](file://eslint/rules/shared-snippets.cjs)
- [eslint/parsers/markdown-plain-text.cjs](file://eslint/parsers/markdown-plain-text.cjs)
- [tsconfig.json](file://tsconfig.json)
- [knip.config.ts](file://knip.config.ts)
- [.markdownlint.jsonc](file://.markdownlint.jsonc)
- [scripts/lint-agent-skills.py](file://scripts/lint-agent-skills.py)
- [scripts/lint-verify-clean-source.mjs](file://scripts/lint-verify-clean-source.mjs)
- [scripts/validate-mermaid.sh](file://scripts/validate-mermaid.sh)

## Performance Considerations
- Prefer incremental checks in IDEs to reduce latency.
- Exclude large generated directories from linting and type checking.
- Use parallelization where supported by tools.
- Cache results for expensive operations like Knip scans.
- Keep custom rules efficient; avoid heavy IO inside rule callbacks.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- ESLint errors due to custom rules: Review plugin implementations and ensure they match the expected rule schema.
- TypeScript strict mode failures: Address implicit any, nullability, and unused variable warnings.
- Knip false positives: Adjust exclusions in knip.config.ts for generated or special-case files.
- Markdown lint violations: Align headings, links, and lists with .markdownlint.jsonc rules.
- Pre-commit hook failures: Run individual steps locally to isolate failing checks.

**Section sources**
- [eslint/plugins/kairos-codeql-line-comments.cjs](file://eslint/plugins/kairos-codeql-line-comments.cjs)
- [eslint/plugins/kairos-forbidden-text.cjs](file://eslint/plugins/kairos-forbidden-text.cjs)
- [eslint/plugins/kairos-mcp-widget.cjs](file://eslint/plugins/kairos-mcp-widget.cjs)
- [tsconfig.json](file://tsconfig.json)
- [knip.config.ts](file://knip.config.ts)
- [.markdownlint.jsonc](file://.markdownlint.jsonc)

## Conclusion
Kairos MCP employs a robust, multi-layered quality system combining ESLint with custom plugins, strict TypeScript configuration, Knip for dependency hygiene, markdownlint for documentation quality, and custom scripts for domain-specific validations. Integrated via package scripts and pre-commit hooks, these tools enforce consistent standards and catch issues early, improving overall codebase health and developer productivity.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Quick Reference: Where to Look
- ESLint flat config and plugins: eslint.config.cjs, eslint/flat-config.cjs, eslint/plugins/*
- Shared rules and snippets: eslint/rules/*
- Markdown parser: eslint/parsers/*
- TypeScript configs: tsconfig.json, tsconfig.ui.json, tsconfig.tests.json
- Knip config: knip.config.ts
- Markdown lint rules: .markdownlint.jsonc
- Custom scripts: scripts/lint-agent-skills.py, scripts/lint-verify-clean-source.mjs, scripts/validate-mermaid.sh
- Orchestration: package.json

**Section sources**
- [eslint.config.cjs](file://eslint.config.cjs)
- [eslint/flat-config.cjs](file://eslint/flat-config.cjs)
- [eslint/plugins/kairos-codeql-line-comments.cjs](file://eslint/plugins/kairos-codeql-line-comments.cjs)
- [eslint/plugins/kairos-forbidden-text.cjs](file://eslint/plugins/kairos-forbidden-text.cjs)
- [eslint/plugins/kairos-mcp-widget.cjs](file://eslint/plugins/kairos-mcp-widget.cjs)
- [eslint/rules/shared-snippets.cjs](file://eslint/rules/shared-snippets.cjs)
- [eslint/parsers/markdown-plain-text.cjs](file://eslint/parsers/markdown-plain-text.cjs)
- [tsconfig.json](file://tsconfig.json)
- [tsconfig.ui.json](file://tsconfig.ui.json)
- [tsconfig.tests.json](file://tsconfig.tests.json)
- [knip.config.ts](file://knip.config.ts)
- [.markdownlint.jsonc](file://.markdownlint.jsonc)
- [scripts/lint-agent-skills.py](file://scripts/lint-agent-skills.py)
- [scripts/lint-verify-clean-source.mjs](file://scripts/lint-verify-clean-source.mjs)
- [scripts/validate-mermaid.sh](file://scripts/validate-mermaid.sh)
- [package.json](file://package.json)