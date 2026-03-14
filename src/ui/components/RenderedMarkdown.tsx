/**
 * Read-only markdown renderer. Renders markdown as formatted content so the user
 * never sees raw markdown. Uses react-markdown (no raw HTML by default — safe).
 */

import ReactMarkdown from "react-markdown";

const contentClass =
  "text-sm leading-6 text-[var(--color-text)] [&_p]:mt-0 [&_p:first-child]:mt-0 [&_p+p]:mt-3 " +
  "[&_ul]:my-3 [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:pl-6 [&_li]:my-0.5 " +
  "[&_strong]:font-semibold [&_strong]:text-[var(--color-text-heading)] " +
  "[&_code]:rounded [&_code]:bg-[var(--color-surface-elevated)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono " +
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-[var(--radius-md)] [&_pre]:bg-[var(--color-surface-elevated)] [&_pre]:p-3 [&_pre]:text-sm [&_pre]:font-mono [&_pre]:whitespace-pre-wrap " +
  "[&_a]:text-[var(--color-primary)] [&_a]:underline [&_a:hover]:no-underline [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-[var(--color-focus-ring)] [&_a:focus-visible]:outline-offset-2 " +
  "[&_blockquote]:border-l-4 [&_blockquote]:border-[var(--color-border)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--color-text-muted)] " +
  "[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-[var(--color-text-heading)] [&_h1]:mt-4 [&_h1]:mb-2 " +
  "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[var(--color-text-heading)] [&_h2]:mt-4 [&_h2]:mb-2 " +
  "[&_h3]:text-base [&_h3]:font-medium [&_h3]:text-[var(--color-text-heading)] [&_h3]:mt-3 [&_h3]:mb-1";

export interface RenderedMarkdownProps {
  content: string;
  className?: string;
}

export function RenderedMarkdown({ content, className = "" }: RenderedMarkdownProps) {
  if (!content.trim()) return null;
  return (
    <div className={`${contentClass} ${className}`.trim()}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
