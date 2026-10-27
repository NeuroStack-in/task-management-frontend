"use client";

/**
 * The pieces both assistants are made of — the transcript, the message box and the footnote.
 *
 * The floating assistant had a live region, a "replying" status, source chips and an "AI can be
 * wrong" line (UX audit 2026-10-16, MON-17). The Help Center's assistant — the only one employees
 * get — had none of them, because it was a second copy of the same markup that never caught up
 * (AI audit 2026-10-22, AI-34). One set of components, used by both, so a fix lands in both.
 */
import {
  useCallback,
  useId,
  type MutableRefObject,
  type ReactNode,
  type Ref,
} from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/shared/markdown";
import { navItemForPath } from "@/constants/navigation";
import { cn } from "@/lib/utils";
import { ASSISTANT_MESSAGE_MAX } from "@/modules/communication/services/assistant.service";
import {
  counterText,
  type ChatMessage,
} from "@/modules/communication/lib/assistant-chat";

/**
 * The assistant's one name, on both entry points (AI audit AI-58). It had two — "WorkPulse
 * Assistant" on the floating panel and "Ask WorkPulse" in the Help Center — which read as two
 * different AIs, one of which "can't look up your data" even for an owner whose other one could.
 */
export const ASSISTANT_NAME = "WorkPulse Assistant";

/** Is this rooted path one of the app's pages? Only those become links in a reply (AI-59). */
export function isAppPath(path: string): boolean {
  return navItemForPath(path.split(/[?#]/)[0]) !== null;
}

/**
 * The conversation, as a log a screen reader follows: each new message — the reply above all — is
 * announced as it arrives, and a "replying" status is read while one is on its way. The opening
 * greeting is there before the region is, so it isn't read out.
 */
export function AssistantTranscript({
  messages,
  pending,
  suggestions,
  onSuggestion,
}: {
  messages: readonly ChatMessage[];
  pending: boolean;
  /** Starter questions, offered only while the transcript is just the greeting. */
  suggestions?: readonly string[];
  onSuggestion?: (question: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation with the assistant"
        className="flex flex-col gap-3"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            data-role={m.role}
            className={cn(
              "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
              m.role === "user"
                ? "bg-primary text-primary-foreground self-end"
                : "bg-muted text-foreground self-start",
            )}
          >
            {/* Only the assistant writes Markdown. A user's message is rendered as the literal
                text they typed — running it through a renderer would silently reformat their own
                words back at them. Links in a reply go only to the app's own pages (AI-21). */}
            {m.role === "user" ? (
              m.text
            ) : (
              <Markdown links="same-origin" isAppPath={isAppPath}>
                {m.text}
              </Markdown>
            )}
            {/* What it read. Deliberately quiet — a footnote a reader checks when a figure
                surprises them. The most likely wrong answer left is one that is right about the
                wrong day, and this is what makes that visible. */}
            {m.sources?.length ? (
              <div data-sources="" className="mt-2 flex flex-wrap gap-1 border-t pt-1.5">
                {/* Read before the chips, so they aren't bare fragments to a screen reader. */}
                <span className="sr-only">Sources: </span>
                {m.sources.map((src, i) => (
                  <span
                    key={i}
                    className="bg-background/60 text-muted-foreground rounded px-1.5 py-0.5 text-[0.7rem] leading-tight"
                  >
                    {[src.label, src.date, src.scope].filter(Boolean).join(" · ")}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {pending ? (
          <div className="bg-muted text-muted-foreground self-start rounded-lg px-3 py-2 text-sm">
            <span className="sr-only">The assistant is replying…</span>
            <span className="inline-flex gap-1" aria-hidden="true">
              <span className="bg-muted-foreground size-1.5 animate-bounce rounded-full [animation-delay:-0.2s]" />
              <span className="bg-muted-foreground size-1.5 animate-bounce rounded-full [animation-delay:-0.1s]" />
              <span className="bg-muted-foreground size-1.5 animate-bounce rounded-full" />
            </span>
          </div>
        ) : null}
      </div>

      {suggestions?.length && messages.length <= 1 ? (
        <div
          role="group"
          aria-label="Suggested questions"
          className="flex flex-wrap gap-2 pt-1"
        >
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggestion?.(s)}
              disabled={pending}
              className="border-border bg-card text-muted-foreground hover:border-primary hover:text-primary rounded-md border px-3 py-1 text-xs transition-colors disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The message box: capped at the server's 4,000 characters, with a counter once the cap is near
 * (contract 4). Without the cap a pasted 5,000-character question was refused, and the panel told
 * the person it "couldn't reach the assistant", so they resent it forever (AI-25).
 */
export function AssistantComposer({
  value,
  onChange,
  onSubmit,
  pending,
  placeholder,
  inputRef,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  placeholder: string;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}) {
  const counterId = useId();
  const counter = counterText(value.length);
  const atLimit = value.length >= ASSISTANT_MESSAGE_MAX;
  // `inputRef` reaches the <input> through the form, not as a `ref` on `Input`: that component is a
  // plain function (no `forwardRef`), so the ref only arrives where `ref` is an ordinary prop (React
  // 19, which the App Router runs) and is dropped with a warning under React 18. This works in both.
  const formRef = useCallback(
    (form: HTMLFormElement | null) => {
      const el =
        form?.querySelector<HTMLInputElement>('input[aria-label="Message"]') ?? null;
      if (typeof inputRef === "function") inputRef(el);
      else if (inputRef)
        (inputRef as MutableRefObject<HTMLInputElement | null>).current = el;
    },
    [inputRef],
  );
  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className={cn("shrink-0 border-t p-3", className)}
    >
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={ASSISTANT_MESSAGE_MAX}
          className="h-10 rounded-md"
          aria-label="Message"
          aria-describedby={counter ? counterId : undefined}
        />
        <Button
          type="submit"
          size="icon"
          className="size-10 shrink-0 rounded-md"
          disabled={!value.trim() || pending}
          aria-label="Send message"
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>
      {counter ? (
        <p
          id={counterId}
          className={cn(
            "mt-1 text-right text-xs tabular-nums",
            atLimit ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {counter}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Said once, always visible: answers are a model's, and models get things wrong (MON-17 / XC-08).
 * And the conversation lives only in this page — nothing keeps it (AI-60), so say that too rather
 * than let a reload silently empty it.
 */
export function AssistantFootnote({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-muted-foreground px-3 pb-2.5 text-xs", className)}>
      {children}
    </p>
  );
}
