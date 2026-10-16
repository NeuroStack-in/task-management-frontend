"use client";

/**
 * "How a task gets done" — the three steps of the board, in one strip above it.
 *
 * A first-time viewer could not tell what finishes a task: the columns read like a free-form
 * status list, and the sign-off lived behind a hover-only star (owner feedback, 2026-10-16). The
 * rule is short enough to state: do the work, move it to In review, and the project's lead or
 * manager signs it off into Done — the only way in.
 *
 * Dismissible, and remembered per browser — once you know the board this is noise. Storage can be
 * unavailable (private windows, blocked site data), so the strip simply shows again then.
 */
import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";

const DISMISSED_KEY = "wp.projects.taskFlowGuide.dismissed";

const STEPS = [
  { n: 1, title: "Do the work", body: "Move the task from To do to In progress." },
  { n: 2, title: "Send it for review", body: "Finished? Move it to In review." },
  {
    n: 3,
    title: "Lead or manager signs off",
    body: "They rate it and it moves to Done — or they send it back.",
  },
] as const;

export function TaskFlowGuide() {
  // Hidden until storage has been read, so a dismissed guide doesn't flash on every visit.
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem(DISMISSED_KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Not remembered — it shows again next visit, which is harmless.
    }
  };

  return (
    <section
      aria-label="How a task gets done"
      className="bg-card relative rounded-2xl border px-4 py-3 pr-10"
    >
      <p className="text-muted-foreground mb-2 text-[0.6875rem] font-semibold tracking-wide uppercase">
        How a task gets done
      </p>
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-1">
        {STEPS.map((s, i) => (
          <li key={s.n} className="flex min-w-0 flex-1 items-start gap-2">
            <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
              {s.n}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{s.title}</span>
              <span className="text-muted-foreground block text-xs">{s.body}</span>
            </span>
            {i < STEPS.length - 1 ? (
              <ChevronRight
                className="text-muted-foreground/60 mt-1 hidden size-4 shrink-0 sm:block"
                aria-hidden="true"
              />
            ) : null}
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide this guide"
        className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-2 right-2 flex size-7 items-center justify-center rounded-md"
      >
        <X className="size-4" />
      </button>
    </section>
  );
}
