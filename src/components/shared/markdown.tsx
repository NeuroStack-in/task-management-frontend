"use client";

/**
 * Renders the AI surfaces' Markdown.
 *
 * The models return Markdown — headings, **bold**, bullet lists, GFM tables — and every surface was
 * printing it as literal text, so an assistant answer arrived as a wall of `**` and `|` characters
 * with the table structure inlined into a paragraph. Four places had the same bug (the chat, the AI
 * report card, the dashboard narrative, the experimental reports), which is why this is one component
 * rather than a fix repeated four times.
 *
 * **No raw HTML, ever.** `react-markdown` disables it by default and there is no `rehype-raw` here on
 * purpose: this renders model output, and a prompt-injected `<img onerror=…>` should be inert text,
 * not markup. Everything below builds React elements — nothing is `dangerouslySetInnerHTML`.
 *
 * Styling is explicit per element rather than a `prose` class: these blocks live inside chat bubbles
 * and small cards where a typography plugin's default rhythm is far too generous, and the palette has
 * to come from the app's tokens so it follows the theme.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2 text-sm leading-relaxed break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="[&:not(:first-child)]:mt-2">{children}</p>,

          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,

          // Headings are flattened to two visual weights: a model asked for a short answer will
          // happily emit `###`, and honouring six levels inside a chat bubble looks broken.
          h1: ({ children }) => (
            <p className="mt-3 text-sm font-semibold text-foreground first:mt-0">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="mt-3 text-sm font-semibold text-foreground first:mt-0">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="mt-2 text-[13px] font-semibold text-foreground first:mt-0">{children}</p>
          ),

          ul: ({ children }) => (
            <ul className="ml-4 list-disc space-y-1 marker:text-muted-foreground">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="ml-4 list-decimal space-y-1 marker:text-muted-foreground">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-0.5">{children}</li>,

          // The visible failure in the bug report: a table arrived as pipes run together into prose.
          // `overflow-x-auto` keeps a wide table scrolling inside its own box instead of stretching
          // the chat panel (a repo convention — wide content scrolls, the page never does).
          table: ({ children }) => (
            <div className="my-2 max-w-full overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-left text-[13px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b px-2.5 py-1.5 font-medium whitespace-nowrap">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b px-2.5 py-1.5 align-top last:border-b-0">{children}</td>
          ),

          code: ({ className: cls, children }) => {
            // react-markdown marks fenced blocks with a `language-*` class; bare inline code has none.
            const fenced = /language-/.test(cls ?? "");
            return fenced ? (
              <code className="block overflow-x-auto rounded-lg bg-muted p-2.5 font-mono text-xs">
                {children}
              </code>
            ) : (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-2">{children}</pre>,

          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              // `noreferrer` alongside `noopener`: the destination is model-supplied, so it should
              // learn nothing about where the click came from.
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),

          blockquote: ({ children }) => (
            <blockquote className="border-l-2 pl-3 text-muted-foreground">{children}</blockquote>
          ),
          hr: () => <hr className="my-3" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
