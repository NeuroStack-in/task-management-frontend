/**
 * Small presentational building blocks shared across the Projects views.
 * Composed from the shared UI primitives + the tone class maps in ../lib.
 */
import { ArrowDown, ArrowUp, Ban, Equal, type LucideIcon } from "lucide-react";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  toneBar,
  toneDot,
  toneSoft,
  toneText,
  type Tone,
  type UserMini,
} from "../lib";
import { TASK_PRIORITY_META, TASK_STATUS_META, type TaskPriority, type TaskStatus } from "../types";

/**
 * The statuses that carry an icon as well as a colour. Blocked, In review and Medium priority all
 * wore the same amber, so a stuck task read as one waiting for sign-off (UX audit PROJ-21): Blocked
 * is now red **and** marked with a stop sign wherever a status shows — badges, column headers, the
 * "Move to" menu, filter chips.
 */
export const TASK_STATUS_ICON: Partial<Record<TaskStatus, LucideIcon>> = {
  blocked: Ban,
};

/** Priority as a shape, not only a colour (PROJ-21): an arrow up, a level line, an arrow down. */
export const PRIORITY_ICON: Record<TaskPriority, LucideIcon> = {
  high: ArrowUp,
  medium: Equal,
  low: ArrowDown,
};

export function StatusBadge({
  tone,
  label,
  icon: Icon,
  className,
}: {
  tone: Tone;
  label: string;
  /** Drawn in place of the dot, for a status whose colour alone isn't enough (PROJ-21). */
  icon?: LucideIcon;
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
      {Icon ? (
        <Icon className="size-3 shrink-0" aria-hidden="true" />
      ) : (
        <span className={cn("size-1.5 rounded-full", toneDot[tone])} />
      )}
      {label}
    </span>
  );
}

/** A task's status badge — its colour, label and (for Blocked) icon from one place. */
export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = TASK_STATUS_META[status];
  // An unknown server value degrades to its raw name rather than crashing the row.
  if (!meta) return <StatusBadge tone="muted" label={String(status)} className={className} />;
  return (
    <StatusBadge
      tone={meta.tone}
      label={meta.label}
      icon={TASK_STATUS_ICON[status]}
      className={className}
    />
  );
}

/**
 * The marker beside a status name in a column header, a menu or a chip: a dot in its colour, or its
 * icon when it has one (PROJ-21).
 */
export function StatusMark({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = TASK_STATUS_META[status];
  const Icon = TASK_STATUS_ICON[status];
  if (Icon) {
    return (
      <Icon
        className={cn("size-3 shrink-0", toneText[meta?.tone ?? "muted"], className)}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className={cn("size-2 shrink-0 rounded-full", toneDot[meta?.tone ?? "muted"], className)}
      aria-hidden="true"
    />
  );
}

/** The priority arrow on its own — where a row has room for a mark but not a label. */
export function PriorityIcon({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  const meta = TASK_PRIORITY_META[priority] ?? TASK_PRIORITY_META.medium;
  const Icon = PRIORITY_ICON[priority] ?? Equal;
  return (
    <Icon
      className={cn("size-3.5 shrink-0", toneText[meta.tone], className)}
      role="img"
      aria-label={`${meta.label} priority`}
    >
      <title>{`${meta.label} priority`}</title>
    </Icon>
  );
}

/**
 * A task's priority as an outlined tag with an arrow — a different **shape** from the filled status
 * pill beside it, so Medium no longer reads as In review by colour alone (PROJ-21).
 */
export function PriorityBadge({
  priority,
  suffix,
  className,
}: {
  priority: TaskPriority;
  /** Appended to the label, e.g. " priority" where the word isn't obvious from the context. */
  suffix?: string;
  className?: string;
}) {
  const meta = TASK_PRIORITY_META[priority] ?? TASK_PRIORITY_META.medium;
  const Icon = PRIORITY_ICON[priority] ?? Equal;
  return (
    <span
      className={cn(
        "bg-background/60 inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium",
        toneText[meta.tone],
        PRIORITY_BORDER[meta.tone],
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      {meta.label}
      {suffix}
    </span>
  );
}

const PRIORITY_BORDER: Record<"muted" | "warning" | "negative", string> = {
  muted: "border-border",
  warning: "border-warning/40",
  negative: "border-destructive/35",
};

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
        <UserAvatar key={m.id} userId={m.id} name={m.name} size="sm" />
      ))}
      {extra > 0 ? (
        <AvatarGroupCount className="size-6 text-[0.65rem]">
          +{extra}
        </AvatarGroupCount>
      ) : null}
    </AvatarGroup>
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
  label,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Names the group for assistive tech, e.g. "Task view". */
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
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
            // The selected segment was told by styling alone (UX audit PROJ-18).
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              // 40 px tall on a touch screen, from about 30 (UX audit PROJ-24).
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors pointer-coarse:min-h-10",
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
