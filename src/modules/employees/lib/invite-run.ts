/**
 * A local record of a bulk invite run, so a run cut short can be finished (UX audit PEOPLE-12).
 *
 * A bulk invite is one POST per address, four at a time, and writes are never retried (`lib/api`) —
 * so closing the tab part-way left the rest unsent, with nothing anywhere saying which. The dialog
 * now writes down, as it goes, which addresses are still to be sent; if the run doesn't finish, the
 * next time the admin opens Invite (or the Employees page) it says so and offers to send exactly the
 * remainder.
 *
 * **Kept in this browser only** (`localStorage`), tagged with the tenant and the admin, and cleared
 * when a run completes. An address whose request was in flight when the tab closed stays in the
 * remainder: it may or may not have been created, and resending it is safe — the server answers
 * "already invited" (`email_in_use`) rather than creating a second invite.
 *
 * No invite **codes** are written here. On the spreadsheet path the codes exist only in the run's
 * memory; putting them in `localStorage` would leave live join codes on disk after the sheet was
 * handed out. A cut-short spreadsheet run therefore loses the codes of the invites it did create —
 * the banner says so and points at the Invited list, where those can be re-sent or revoked.
 *
 * The `wp-` prefix puts it under `clearWorkPulseState()`, so signing out removes it.
 */

export const INVITE_RUN_KEY = "wp-invite-run";

/** The body one invite is created from — what a resume sends again. */
export interface InviteRunBody {
  email: string;
  role_id: string;
  department_id: string;
  team_id?: string;
  title: string;
}

export interface InviteRunRecord {
  v: 1;
  tenantId: string;
  userId: string;
  /** Epoch ms the run started. */
  startedAt: number;
  /** The run created invites without emailing them (the spreadsheet path). */
  withHandout: boolean;
  total: number;
  /** Not yet known to be created — what a resume sends. */
  remaining: InviteRunBody[];
  /** How many were created. */
  created: number;
  /** Refused, with the reason — not resent by a resume (they need fixing first). */
  failed: { email: string; reason: string }[];
}

export function newRun(
  bodies: InviteRunBody[],
  opts: { tenantId: string; userId: string; withHandout: boolean; now: number },
): InviteRunRecord {
  return {
    v: 1,
    tenantId: opts.tenantId,
    userId: opts.userId,
    startedAt: opts.now,
    withHandout: opts.withHandout,
    total: bodies.length,
    remaining: bodies,
    created: 0,
    failed: [],
  };
}

/** One address settled: created, or refused with a reason. Returns a new record. */
export function settle(
  run: InviteRunRecord,
  email: string,
  outcome: { ok: true } | { ok: false; reason: string },
): InviteRunRecord {
  const remaining = run.remaining.filter((b) => b.email !== email);
  if (remaining.length === run.remaining.length) return run; // not ours, or already settled
  return outcome.ok
    ? { ...run, remaining, created: run.created + 1 }
    : { ...run, remaining, failed: [...run.failed, { email, reason: outcome.reason }] };
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function saveRun(run: InviteRunRecord): void {
  try {
    storage()?.setItem(INVITE_RUN_KEY, JSON.stringify(run));
  } catch {
    /* storage full or blocked — the run still works, it just can't be resumed */
  }
}

export function clearRun(): void {
  try {
    storage()?.removeItem(INVITE_RUN_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * A run this admin left unfinished in this org, if any. Anything malformed, from another account,
 * or with nothing left to send is ignored.
 */
export function readInterruptedRun(tenantId: string, userId: string): InviteRunRecord | null {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(INVITE_RUN_KEY) ?? null;
  } catch {
    return null;
  }
  return parseRun(raw, tenantId, userId);
}

/** The pure half of {@link readInterruptedRun}, for tests. */
export function parseRun(
  raw: string | null,
  tenantId: string,
  userId: string,
): InviteRunRecord | null {
  if (!raw || !tenantId || !userId) return null;
  try {
    const r = JSON.parse(raw) as Partial<InviteRunRecord>;
    if (
      r?.v !== 1 ||
      r.tenantId !== tenantId ||
      r.userId !== userId ||
      !Array.isArray(r.remaining) ||
      r.remaining.length === 0 ||
      !r.remaining.every((b) => typeof b?.email === "string" && typeof b?.role_id === "string")
    ) {
      return null;
    }
    return {
      v: 1,
      tenantId,
      userId,
      startedAt: Number(r.startedAt) || 0,
      withHandout: Boolean(r.withHandout),
      total: Number(r.total) || r.remaining.length,
      remaining: r.remaining,
      created: Number(r.created) || 0,
      failed: Array.isArray(r.failed) ? r.failed : [],
    };
  } catch {
    return null;
  }
}
