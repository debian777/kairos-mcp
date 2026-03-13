import { describe, it, expect } from "vitest";
import { parseProtocolMarkdown } from "@/hooks/useProtocol";

describe("parseProtocolMarkdown", () => {
  it("returns default title and empty steps for empty input", () => {
    const result = parseProtocolMarkdown("");
    expect(result.title).toBe("Protocol");
    expect(result.steps).toEqual([]);
    expect(result.triggers).toBe("");
    expect(result.completion).toBe("");
  });

  it("extracts H1 as title", () => {
    const result = parseProtocolMarkdown("# My Protocol Title\n\n");
    expect(result.title).toBe("My Protocol Title");
    expect(result.steps).toEqual([]);
  });

  it("parses Natural language triggers section", () => {
    const md = `# P

## Natural language triggers

deploy and test
`;
    const result = parseProtocolMarkdown(md);
    expect(result.triggers).toBe("deploy and test");
  });

  it("parses Completion rule section", () => {
    const md = `# P

## Completion rule

When all steps are done.
`;
    const result = parseProtocolMarkdown(md);
    expect(result.completion).toBe("When all steps are done.");
  });

  it("parses step with shell challenge type", () => {
    const md = `# P

## Step 1

Run the command.

\`\`\`json
{"challenge": {"type": "shell", "shell": {"cmd": "npm test"}}}
\`\`\`
`;
    const result = parseProtocolMarkdown(md);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({
      label: "Step 1",
      type: "shell",
      summary: "Shell: npm test",
    });
    expect(result.steps[0]!.body).toContain("```json");
  });

  it("parses step with mcp challenge type", () => {
    const md = `# P

## Step 2

Call the tool.

\`\`\`json
{"challenge": {"type": "mcp", "mcp": {"tool_name": "kairos_search"}}}
\`\`\`
`;
    const result = parseProtocolMarkdown(md);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({
      label: "Step 2",
      type: "mcp",
      summary: "MCP: kairos_search",
    });
  });

  it("parses step with user_input challenge type", () => {
    const md = `# P

## Confirm

Please confirm.

\`\`\`json
{"challenge": {"type": "user_input", "user_input": {"prompt": "Proceed?"}}}
\`\`\`
`;
    const result = parseProtocolMarkdown(md);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({
      label: "Confirm",
      type: "user_input",
      summary: "User input: Proceed?",
    });
  });

  it("parses step with comment challenge type", () => {
    const md = `# P

## Comment step

Write a comment.

\`\`\`json
{"challenge": {"type": "comment", "comment": {"min_length": 10}}}
\`\`\`
`;
    const result = parseProtocolMarkdown(md);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({
      label: "Comment step",
      type: "comment",
      summary: "Comment: min 10 chars",
    });
  });

  it("handles malformed JSON in code block", () => {
    const md = `# P

## Step

\`\`\`json
{ invalid json
\`\`\`
`;
    const result = parseProtocolMarkdown(md);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({
      label: "Step",
      type: "comment",
      summary: "Comment",
    });
  });

  it("strips json code blocks from triggers and completion", () => {
    const md = `# P

## Natural language triggers

Some text
\`\`\`json
{"x": 1}
\`\`\`
more text

## Completion rule

Done.
`;
    const result = parseProtocolMarkdown(md);
    expect(result.triggers).not.toContain("```");
    expect(result.triggers).toContain("Some text");
    expect(result.triggers).toContain("more text");
    expect(result.completion).toBe("Done.");
  });

  it("parses multiple steps in order", () => {
    const md = `# Multi

## Step A

\`\`\`json
{"challenge": {"type": "comment"}}
\`\`\`

## Step B

\`\`\`json
{"challenge": {"type": "shell", "shell": {"cmd": "echo ok"}}}
\`\`\`
`;
    const result = parseProtocolMarkdown(md);
    expect(result.title).toBe("Multi");
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]!.label).toBe("Step A");
    expect(result.steps[1]!.label).toBe("Step B");
    expect(result.steps[1]!.summary).toBe("Shell: echo ok");
  });
});
