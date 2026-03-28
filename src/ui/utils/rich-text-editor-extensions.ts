import type { Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";

/** TipTap extensions for protocol step body (single source for editor + tests). */
export function createRichTextEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      link: false,
      // Keep headings in schema so markdown parse does not degrade when fragments include ## / ###.
      heading: { levels: [2, 3, 4] },
    }),
    Link.configure({ openOnClick: false, autolink: false }),
    Table.configure({ resizable: false }),
    TableRow,
    TableCell,
    TableHeader,
    Markdown.configure({
      markedOptions: {
        gfm: true,
        breaks: false,
      },
    }),
  ];
}
