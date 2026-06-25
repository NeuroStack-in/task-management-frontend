/**
 * Small presentational building blocks shared across the Projects views.
 * Composed from the shared UI primitives + the tone class maps in ../lib.
 */
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import {
  toneBar,
  toneDot,
  toneSoft,
  type Tone,
  type UserMini,
} from "../lib";

export function StatusBadge({
  tone,
  label,
  className,
}: {
  tone: Tone;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        toneSoft[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", toneDot[tone])} />
      {label}
    </span>
  );
}

export function ProgressTrack({
  value,
  tone = "primary",
  className,
}: {
  value: number;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      <div
        className={cn(
          "wp-meter-fill relative h-full overflow-hidden rounded-full",
          toneBar[tone],
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      >
        <span className="wp-meter-sheen pointer-events-none absolute inset-0" />
      </div>
    </div>
  );
}

export function MemberStack({
  members,
  max = 4,
}: {
  members: UserMini[];
  max?: number;
}) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <AvatarGroup>
      {shown.map((m) => (
        <Avatar key={m.id} size="sm">
          {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt={m.name} /> : null}
          <AvatarFallback>{initials(m.name)}</AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 ? (
        <AvatarGroupCount className="size-6 text-[0.65rem]">
          +{extra}
        </AvatarGroupCount>
      ) : null}
    </AvatarGroup>
  );
}

export function MetricTile({
  label,
  value,
  sub,
  subTone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  subTone?: Tone;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-lg leading-none font-semibold tabular-nums">
        {value}
      </p>
      {sub ? (
        <p
          className={cn(
            "mt-1.5 text-xs",
            subTone ? toneSoft[subTone].split(" ").pop() : "text-muted-foreground",
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl bg-muted p-1",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "shadow-soft bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "bg-background/70 text-muted-foreground",
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
