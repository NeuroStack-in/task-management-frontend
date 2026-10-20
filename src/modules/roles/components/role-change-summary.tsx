"use client";

/**
 * The body of every role-change confirmation (UX audit PEOPLE-09): what the person gains, what they
 * lose, and whether the data they can see widens — sensitive permissions named one by one with the
 * reason they are sensitive, everything else counted and folded away.
 *
 * Shared by the two places a role is changed — the Roles page member list and the employee profile —
 * so both say the same thing about the same move.
 */
import { ArrowRight, ShieldAlert } from "lucide-react";
import { SENSITIVITY_LABEL, helpFor } from "../lib/permission-help";
import { scopeLabel, type RoleChange } from "../lib/role-change";

export function RoleChangeSummary({
  change,
  labelOf,
  fromName,
}: {
  change: RoleChange;
  /** id → the catalog's label; falls back to the id when the catalog couldn't be read. */
  labelOf: (id: string) => string;
  /** The role they hold now, for "Same permissions as …". */
  fromName: string;
}) {
  if (change.same) {
    return (
      <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        Same permissions and data scope as {fromName}, so nothing they can do changes.
      </p>
    );
  }
  return (
    // Capped as a backstop only — the lists below fold, so this rarely scrolls. (A scrolling box
    // here opened scrolled to its first focusable control, hiding the top of the summary.)
    <div className="max-h-[60dvh] space-y-3 overflow-y-auto rounded-md border p-3 text-sm">
      {change.fromUnknown ? (
        <p className="text-xs text-muted-foreground">
          Their current role couldn&apos;t be read, so this lists everything the new role grants.
        </p>
      ) : null}
      {change.scope ? (
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Data they can see
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            {scopeLabel(change.scope.from)}
            <ArrowRight className="size-3.5 text-muted-foreground" aria-label="becomes" />
            <span className="font-medium">{scopeLabel(change.scope.to)}</span>
          </p>
        </div>
      ) : null}
      <PermissionGroup
        title={change.fromUnknown ? "They get" : "They gain"}
        ids={change.added}
        sensitive={change.sensitiveAdded}
        labelOf={labelOf}
        showReason
      />
      <PermissionGroup
        title="They lose"
        ids={change.removed}
        sensitive={change.sensitiveRemoved}
        labelOf={labelOf}
      />
    </div>
  );
}

function PermissionGroup({
  title,
  ids,
  sensitive,
  labelOf,
  showReason = false,
}: {
  title: string;
  ids: string[];
  sensitive: string[];
  labelOf: (id: string) => string;
  /** The sensitivity reasons are written for a grant ("Sees everyone's screenshots"). */
  showReason?: boolean;
}) {
  if (ids.length === 0) return null;
  // The first few sensitive ones in full; any more, and everything else, folded — a move to Admin
  // grants a dozen sensitive permissions, and a list that long pushed the buttons off the dialog.
  const named = sensitive.slice(0, NAMED_MAX);
  const moreSensitive = sensitive.slice(NAMED_MAX);
  const rest = ids.filter((id) => !sensitive.includes(id));
  const folded = moreSensitive.length + rest.length;
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title} {ids.length} {ids.length === 1 ? "permission" : "permissions"}
        {sensitive.length ? ` · ${sensitive.length} sensitive` : ""}
      </p>
      {named.length ? (
        <ul className="mt-1.5 space-y-1.5">
          {named.map((id) => (
            <SensitiveItem key={id} id={id} labelOf={labelOf} showReason={showReason} />
          ))}
        </ul>
      ) : null}
      {folded ? (
        // Folded: the named ones are the decision; the rest is detail for whoever wants it.
        <details className="mt-1.5 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">
            {named.length
              ? `and ${folded} more${moreSensitive.length ? ` (${moreSensitive.length} sensitive)` : ""}`
              : `Show ${folded === 1 ? "it" : `all ${folded}`}`}
          </summary>
          {moreSensitive.length ? (
            <ul className="mt-1.5 space-y-1.5 text-sm text-foreground">
              {moreSensitive.map((id) => (
                <SensitiveItem key={id} id={id} labelOf={labelOf} showReason={showReason} />
              ))}
            </ul>
          ) : null}
          {rest.length ? <p className="mt-1 leading-relaxed">{rest.map(labelOf).join(" · ")}</p> : null}
        </details>
      ) : null}
    </div>
  );
}

/** Sensitive permissions named in full before the rest are folded away. */
const NAMED_MAX = 4;

function SensitiveItem({
  id,
  labelOf,
  showReason,
}: {
  id: string;
  labelOf: (id: string) => string;
  showReason: boolean;
}) {
  const s = helpFor(id)?.sensitive;
  return (
    <li className="flex items-start gap-2">
      <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
      <span className="min-w-0">
        <span className="font-medium">{labelOf(id)}</span>
        {s ? (
          <span className="ml-1.5 rounded-full bg-warning/12 px-1.5 py-px text-[10px] font-medium text-warning">
            {SENSITIVITY_LABEL[s.kind]}
          </span>
        ) : null}
        {s && showReason ? (
          <span className="block text-xs text-muted-foreground">{s.reason}.</span>
        ) : null}
      </span>
    </li>
  );
}
