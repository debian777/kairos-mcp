# Atlassian MCP: Jira Tools Workflow


## AI-Friendly Instructions for Jira MCP Tools

### Prerequisites
- Always start with Context7 MCP library discovery for Jira workflows.
- Use KAIROS protocol for stepwise execution and memory management.
- Supply your current `llm_model_id` for every MCP call.

### Context7 MCP Setup (Jira)
1. **Resolve Jira MCP library**
   ```json
   {
     "method": "tools/call",
     "params": {
       "name": "resolve-library-id",
       "arguments": {
         "libraryName": "@sooperset/mcp-atlassian"
       }
     }
   }
   ```
2. **Get Jira MCP documentation**
   ```json
   {
     "method": "tools/call",
     "params": {
       "name": "get-library-docs",
       "arguments": {
         "context7CompatibleLibraryID": "/sooperset/mcp-atlassian",
         "topic": "jira operations"
       }
     }
   }
   ```

### Common Jira MCP Tools
- `jira_get_issue`: Retrieve details for a specific issue
- `jira_search`: Search issues using JQL
- `jira_create_issue`: Create new issues
- `jira_update_issue`: Update issue fields
- `jira_transition_issue`: Change issue status
- `jira_batch_create_issues`: Create multiple issues
- `jira_get_agile_boards`: List agile boards
- `jira_get_sprint_issues`: Get issues from a sprint
- ...and more (see Context7 docs)

### Example: Search Issues
```json
{
  "method": "tools/call",
  "params": {
    "name": "jira_search",
    "arguments": {
      "jql": "project = BIB AND text ~ 'rancher'",
      "limit": 10,
      "fields": "summary,status,assignee,priority,description"
    }
  }
}
```

### Best Practices
- Use minimal, actionable field lists
- Validate JQL before execution
- Handle errors with retries and alternate paths
- Reference authoritative workflow docs for output formats
- Use KAIROS for stepwise memory and protocol compliance

---
File: [`workflows/global/mcp/atlassian-jira.md`](workflows/global/mcp/atlassian-jira.md)
# Atlassian MCP: Confluence Tools Workflow

---
imported: true
source: KAIROS, Context7 MCP, Atlassian MCP docs
updated: 2025-11-21
---

## AI-Friendly Instructions for Confluence MCP Tools

### Prerequisites
- Always start with Context7 MCP library discovery for Confluence workflows.
- Use KAIROS protocol for stepwise execution and memory management.
- Supply your current `llm_model_id` for every MCP call.

### Context7 MCP Setup (Confluence)
1. **Resolve Confluence MCP library**
   ```json
   {
     "method": "tools/call",
     "params": {
       "name": "resolve-library-id",
       "arguments": {
         "libraryName": "@sooperset/mcp-atlassian"
       }
     }
   }
   ```
2. **Get Confluence MCP documentation**
   ```json
   {
     "method": "tools/call",
     "params": {
       "name": "get-library-docs",
       "arguments": {
         "context7CompatibleLibraryID": "/sooperset/mcp-atlassian",
         "topic": "confluence operations"
       }
     }
   }
   ```

### Common Confluence MCP Tools
- `confluence_search`: Search pages and content
- `confluence_get_page`: Retrieve page content
- `confluence_create_page`: Create new pages
- `confluence_update_page`: Update page content
- `confluence_add_label`: Add labels to pages
- `confluence_add_comment`: Add comments to pages
- ...and more (see Context7 docs)

### Example: Search Pages
```json
{
  "method": "tools/call",
  "params": {
    "name": "confluence_search",
    "arguments": {
      "query": "rancher upgrade path",
      "limit": 5,
      "spaces_filter": "PE,TEAM"
    }
  }
}
```

### Best Practices
- Use specific space filters for targeted results
- Validate queries before execution
- Handle errors with retries and alternate paths
- Reference authoritative workflow docs for output formats
- Use KAIROS for stepwise memory and protocol compliance

---
File: [`workflows/global/mcp/atlassian-confluence.md`](workflows/global/mcp/atlassian-confluence.md)
