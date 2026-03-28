import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createRichTextEditorExtensions } from "../../src/ui/utils/rich-text-editor-extensions";

describe("createRichTextEditorExtensions markdown parse", () => {
  let el: HTMLDivElement;

  beforeEach(() => {
    el = document.createElement("div");
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  it("does not leave ** delimiters in plain text for bold", () => {
    const editor = new Editor({
      element: el,
      extensions: createRichTextEditorExtensions(),
      content: "Route to **Standardize Project**.",
      contentType: "markdown",
    });
    try {
      expect(editor.getText()).not.toContain("*");
    } finally {
      editor.destroy();
    }
  });

  it("does not leave backticks in plain text for inline code", () => {
    const editor = new Editor({
      element: el,
      extensions: createRichTextEditorExtensions(),
      content: "Use `package.json` here.",
      contentType: "markdown",
    });
    try {
      expect(editor.getText()).not.toContain("`");
    } finally {
      editor.destroy();
    }
  });

  it("parses a GFM table without pipe characters in paragraph text", () => {
    const md = `| A | B |
|---|---|
| 1 | 2 |
`;
    const editor = new Editor({
      element: el,
      extensions: createRichTextEditorExtensions(),
      content: md,
      contentType: "markdown",
    });
    try {
      const json = editor.getJSON();
      const hasTable = JSON.stringify(json).includes('"type":"table"');
      expect(hasTable).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it("parses markdown headings into heading nodes", () => {
    const editor = new Editor({
      element: el,
      extensions: createRichTextEditorExtensions(),
      content: "## Section heading\n\nContent",
      contentType: "markdown",
    });
    try {
      const json = editor.getJSON();
      const hasHeading = JSON.stringify(json).includes('"type":"heading"');
      expect(hasHeading).toBe(true);
      expect(editor.getText()).toContain("Section heading");
    } finally {
      editor.destroy();
    }
  });
});
