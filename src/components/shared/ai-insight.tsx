import Link from "next/link";
import { Sparkles, ShieldCheck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * AiInsight — the single, shared way AI shows up across WorkPulse. Styled to
 * match the dashboard AI Summary: a filled feature-colour surface with white
 * text and a translucent action pill.
 *
 * AI is allowed to be present only when it answers four questions, in order:
 *   1. what did it notice  (title)
 *   2. why does it matter  (detail / points)
 *   3. what can I do        (action)
 *   4. can I trust it       (basis — what the inference is grounded in)
 */

export interface AiInsightAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface AiInsightProps {
  /** What the AI noticed — the headline. */
  title: string;
  /** Why it matters — one or two plain sentences. */
  detail?: string;
  /** Optional discrete findings. */
  points?: string[];
  /** The suggested next action. */
  action?: AiInsightAction;
  /** Trust note — what the inference is grounded in (e.g. "142 entries this week"). */
  basis?: string;
  /** Eyebrow label. Defaults to "AI insight". */
  label?: string;
  icon?: LucideIcon;
  /** "card" = standalone surface; "banner" = flush strip atop a page. */
  variant?: "card" | "banner";
  className?: string;
}

export function AiInsight({
  title,
  detail,
  points,
  action,
  basis,
  label = "AI insight",
  icon: Icon = Sparkles,
  variant = "card",
  className,
}: AiInsightProps) {
  return (
    <div
      className={cn(
        "wp-enter flex gap-3 bg-feature p-4 text-sm text-feature-foreground shadow-none",
        variant === "card" ? "rounded-lg" : "rounded-md",
        className,
      )}
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-white">
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-feature-foreground/80">
          {label}
        </p>
        <p className="font-medium text-feature-foreground">{title}</p>

        {detail ? <p className="text-feature-foreground/85">{detail}</p> : null}

        {points?.length ? (
          <ul className="mt-1 space-y-1">
            {points.map((p, i) => (
              <li key={i} className="flex gap-2 text-feature-foreground/85">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-white/50" />
                <span className="min-w-0">{p}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {action || basis ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1.5">
            {action ? (
              action.href ? (
                <Button
                  size="sm"
                  className="border-0 bg-white/15 text-white hover:bg-white/25"
                  render={<Link href={action.href} />}
                  nativeButton={false}
                >
                  {action.label}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="border-0 bg-white/15 text-white hover:bg-white/25"
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              )
            ) : null}
            {basis ? (
              <span className="flex items-center gap-1 text-xs text-feature-foreground/80">
                <ShieldCheck className="size-3.5" />
                {basis}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
