"use client";

/**
 * The approval queue, joined into something the table can render, from the real backend.
 *
 * The queue rows carry only ids (`user_id`, `type_id`) — names live in other contexts. So this joins
 * side reads: the employees directory (`user_id → name`, department) and the leave-type catalog
 * (`type_id → name`). Both **degrade**: a forbidden or missing lookup falls back to the id, so the
 * queue still renders rather than blanking over a name it couldn't resolve.
 *
 * Fetches pending/approved/rejected/cancelled together so the status tabs can show real counts and
 * switching a tab is instant — four GSI2 queries on an admin screen, not a hot path. (Cancelled used
 * to be left out, so "All" was not all: a withdrawn request vanished from the approver's view.)
 *
 * **Balances (UX audit 2026-10-16, TIME-10).** Each pending row of the queue carries the
 * requester's balance and what approving charges it (`balances`), so any approver sees what a
 * request leaves the person with. Against an older server without them, and with `withBalances`, the
 * org ledger (`GET /v1/leave/balances?year=`, `leave:manage`) stands in — and an approver without
 * that bit sees "balance not available", never a guess.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { readRoster } from "@/modules/employees/services/employees.service";
import { UNKNOWN_TYPE } from "@/lib/format";
import {
  getOrgBalances,
  getTypes,
  type ApiLeaveAttachment,
  type ApiOrgBalances,
} from "@/modules/leave/services/leave.service";
import { workingDays, workingPortions, type WorkCalendar } from "@/modules/leave/lib/working-days";
import { useWorkCalendar } from "@/modules/leave/use-work-calendar";
import * as api from "./services/approvals.service";
import type { ApiApprovalRow, DecideInput } from "./services/approvals.service";
import {
  alsoOff,
  balanceAfter,
  decisionError,
  sortQueue,
  type BalanceAfter,
  type Standing,
} from "./lib/queue";

/** A queue row joined with resolved names — what the table renders. */
export interface ApprovalItem {
  userId: string;
  requestId: string;
  requesterName: string;
  /** The requester's department name, when the directory could be read. */
  department?: string;
  typeId: string;
  typeName: string;
  from: string;
  to: string;
  days: number;
  /**
   * Minutes of a few hours off (the API's `permission` kind); 0/absent for a full day. Carried so
   * the approver reads "2 h off · 10:30 am to 12:30 pm" instead of "0.25 days".
   */
  permissionMinutes?: number;
  /** `HH:MM` window, present only for a few hours off. */
  fromTime?: string;
  toTime?: string;
  reason?: string;
  status: string;
  createdAt?: number;
  /** The queue's own balance figures for a pending request (see `ApiApprovalRow.balances`). */
  serverBalances?: { year: string; allowance: number; used: number; charge: number }[];
  /** Documents the requester attached. Metadata only; the URL is fetched per file on demand. */
  attachments: ApiLeaveAttachment[];
}

/** Whether balance-after can be shown, and if not, why. */
export type BalanceAvailability = "ok" | "loading" | "forbidden" | "error" | "off";

const STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;

/** One failed item of a bulk decision. */
export interface BulkFailure {
  item: ApprovalItem;
  title: string;
  description: string;
}

export interface ApprovalsData {
  items: ApprovalItem[];
  counts: Record<string, number>;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /**
   * Approve/reject one. Resolves once the server has recorded the decision — the row shows the new
   * status from that moment, and the queue re-reads in the background.
   */
  /** `reason` goes with a rejection — the requester sees it (TIME-10). */
  decide: (item: ApprovalItem, decision: "approve" | "reject", reason?: string) => Promise<void>;
  /**
   * Approve several, **one at a time** over the same decide route (no burst, so no throttle), and
   * report which failed and why. Never throws; re-reads the queue once at the end.
   */
  approveMany: (
    items: ApprovalItem[],
    onProgress?: (done: number) => void,
  ) => Promise<{ approved: ApprovalItem[]; failed: BulkFailure[] }>;
  /** What approving leaves the requester with, per year; `null` entries = that year unknown. */
  balanceFor: (item: ApprovalItem) => (BalanceAfter | null)[] | null;
  balanceAvailability: BalanceAvailability;
  /** Other people off on any of this request's dates (approved or pending), soonest first. */
  alsoOffFor: (item: ApprovalItem) => ApprovalItem[];
}


/**
 * What approving charges, per calendar year: the server re-costs a full-day request in working days
 * with the calendar as it stands at approval (owner decision 2026-10-20, TIME-07) — a request filed
 * while leave still cost calendar days drops to its working days — and hours off keep their stored
 * fraction.
 */
function yearsOf(from: string, to: string): string[] {
  const fy = Number(from.slice(0, 4));
  const ty = Number(to.slice(0, 4));
  if (!Number.isFinite(fy) || !Number.isFinite(ty) || ty < fy) return [];
  return Array.from({ length: ty - fy + 1 }, (_, n) => String(fy + n));
}

function chargedPortions(
  r: { from: string; to: string; days: number; permissionMinutes?: number },
  cal: WorkCalendar,
): [string, number][] {
  const days = r.permissionMinutes ? r.days : workingDays(r.from, r.to, cal);
  return workingPortions(r.from, r.to, days, cal);
}
export function useApprovals({
  withBalances = false,
}: { withBalances?: boolean } = {}): ApprovalsData {
  // What approving will charge is counted in working days (TIME-07) — see `chargedPortions`.
  const calendar = useWorkCalendar();
  const [rows, setRows] = useState<ApiApprovalRow[]>([]);
  const [typeName, setTypeName] = useState<Map<string, string>>(new Map());
  const [people, setPeople] = useState<
    Map<string, { name: string; department?: string }>
  >(new Map());
  const [ledgers, setLedgers] = useState<Map<string, ApiOrgBalances>>(new Map());
  const [balanceAvailability, setBalanceAvailability] = useState<BalanceAvailability>(
    withBalances ? "loading" : "off",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  /**
   * Verdicts recorded from this page, by request id. The row used to stay "pending" — buttons live —
   * until three queue reads came back, so a second click 409'd (QA audit 2026-10-08, WP-482). And
   * the queues are an index that settles a moment after a write, so the re-read can still say
   * "pending": a request never goes back to pending, so a recorded verdict wins over that.
   */
  const [decided, setDecided] = useState<ReadonlyMap<string, string>>(new Map());

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const queues = await Promise.all(STATUSES.map((s) => api.getQueue(s)));
        if (!live) return;
        const merged = queues.flat();
        setRows(merged);

        // The years the pending requests touch — usually one, two around New Year. Each needs its
        // own ledger read: a balance is per calendar year.
        const years = new Set<string>();
        for (const r of merged) {
          if (r.status !== "pending") continue;
          // Calendar-independent: the years a range touches don't depend on which days are worked.
          for (const y of yearsOf(r.from, r.to)) years.add(y);
        }

        // Side joins, all best-effort. A directory or ledger a role can't read must not fail the
        // queue.
        const [types, roster, ledgerRead] = await Promise.all([
          getTypes()
            .then((ts) => new Map(ts.map((t) => [t.type_id, t.name])))
            .catch(() => new Map<string, string>()),
          // Names are a nicety: a `leave:approve` holder can usually read the directory, but if
          // they can't, the rows fall back to short ids rather than failing the whole queue.
          readRoster().catch(() => null),
          // Only when some pending row lacks the queue's own balances (an older server).
          withBalances &&
          years.size > 0 &&
          merged.some((r) => r.status === "pending" && !r.balances?.length)
            ? Promise.all(
                [...years].map((y) => getOrgBalances(y).then((b) => [y, b] as const)),
              )
                .then((pairs) => ({ ok: new Map(pairs) as Map<string, ApiOrgBalances> }))
                .catch((e: unknown) => ({
                  failed:
                    e instanceof ApiError && e.status === 403 ? "forbidden" : "error",
                }))
            : Promise.resolve({ ok: new Map<string, ApiOrgBalances>() }),
        ]);
        if (!live) return;
        setTypeName(types);
        if (roster) {
          const deptName = new Map((roster.departments ?? []).map((d) => [d.id, d.name]));
          setPeople(
            new Map(
              roster.employees.map((e) => [
                e.user_id,
                { name: e.name, department: deptName.get(e.department_id) },
              ]),
            ),
          );
        }
        if (withBalances) {
          if ("ok" in ledgerRead) {
            setLedgers(ledgerRead.ok);
            setBalanceAvailability("ok");
          } else {
            setLedgers(new Map());
            setBalanceAvailability(ledgerRead.failed as BalanceAvailability);
          }
        }
      } catch (e) {
        if (live) setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [nonce, withBalances]);

  const items = useMemo<ApprovalItem[]>(() => {
    // One row per request. The four queues are separate reads of that settling index, so a
    // just-decided request can briefly come back in two of them — keep the decided copy.
    const byId = new Map<string, ApiApprovalRow>();
    for (const r of rows) {
      const prev = byId.get(r.request_id);
      if (!prev || prev.status === "pending") byId.set(r.request_id, r);
    }
    return sortQueue(
      [...byId.values()].map((r) => ({
        userId: r.user_id,
        requestId: r.request_id,
        requesterName: people.get(r.user_id)?.name ?? shortId(r.user_id),
        department: people.get(r.user_id)?.department,
        typeId: r.type_id,
        typeName: typeName.get(r.type_id) ?? UNKNOWN_TYPE,
        from: r.from,
        to: r.to,
        attachments: r.attachments ?? [],
        days: r.days,
        permissionMinutes: r.permission_minutes,
        fromTime: r.from_time,
        toTime: r.to_time,
        reason: r.reason,
        status:
          r.status === "pending" ? (decided.get(r.request_id) ?? r.status) : r.status,
        createdAt: r.created_at,
        serverBalances: r.balances,
      })),
    );
  }, [rows, typeName, people, decided]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const s of STATUSES) c[s] = items.filter((i) => i.status === s).length;
    return c;
  }, [items]);

  /** `(year, user, type)` → the standing the server's check will read, from the ledger. */
  const standing = useCallback(
    (year: string, userId: string, typeId: string): Standing | null => {
      const ledger = ledgers.get(year);
      if (!ledger) return null;
      const b = ledger.employees
        .find((e) => e.user_id === userId)
        ?.balances.find((x) => x.type_id === typeId);
      if (!b) return null;
      if (b.seeded) return { allowance: b.allowance, used: b.used };
      // Never granted for that year yet: approval seeds it at the catalog allowance, nothing used
      // (`seed_user_year`), so that is the figure the check will meet.
      const t = ledger.types.find((x) => x.type_id === typeId);
      return t ? { allowance: t.annual_allowance, used: 0 } : null;
    },
    [ledgers],
  );

  const balanceFor = useCallback(
    (item: ApprovalItem): (BalanceAfter | null)[] | null => {
      if (item.status !== "pending") return null;
      const others = items.filter(
        (o) =>
          o.status === "pending" &&
          o.userId === item.userId &&
          o.typeId === item.typeId &&
          o.requestId !== item.requestId,
      );
      // The queue's own figures, when the server sends them — the same charge `decide` will make.
      if (item.serverBalances?.length) {
        const byYear = new Map(item.serverBalances.map((b) => [b.year, b]));
        return balanceAfter(
          item.serverBalances.map((b) => [b.year, b.charge] as [string, number]),
          (year) => {
            const b = byYear.get(year);
            return b ? { allowance: b.allowance, used: b.used } : null;
          },
          (year) =>
            others.reduce(
              (sum, o) =>
                sum +
                (o.serverBalances?.find((b) => b.year === year)?.charge ??
                  chargedPortions(o, calendar).find(([y]) => y === year)?.[1] ??
                  0),
              0,
            ),
        );
      }
      if (balanceAvailability !== "ok") return null;
      return balanceAfter(
        chargedPortions(item, calendar),
        (year) => standing(year, item.userId, item.typeId),
        (year) =>
          others.reduce(
            (sum, o) =>
              sum + (chargedPortions(o, calendar).find(([y]) => y === year)?.[1] ?? 0),
            0,
          ),
      );
    },
    [balanceAvailability, items, standing, calendar],
  );

  const alsoOffFor = useCallback((item: ApprovalItem) => alsoOff(item, items), [items]);

  const decide = useCallback(
    async (item: ApprovalItem, decision: "approve" | "reject", reason?: string) => {
      const input: DecideInput = {
        user_id: item.userId,
        request_id: item.requestId,
        decision,
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
      };
      const result = await api.decide(input);
      setDecided((m) => new Map(m).set(item.requestId, result.status));
      reload();
    },
    [reload],
  );

  const approveMany = useCallback(
    async (batch: ApprovalItem[], onProgress?: (done: number) => void) => {
      const approved: ApprovalItem[] = [];
      const failed: BulkFailure[] = [];
      // Sequential on purpose: a parallel burst trips the API's throttle, and each approval debits
      // a balance under an optimistic lock — one at a time keeps every result meaningful.
      for (const [i, item] of batch.entries()) {
        try {
          const result = await api.decide({
            user_id: item.userId,
            request_id: item.requestId,
            decision: "approve",
          });
          approved.push(item);
          setDecided((m) => new Map(m).set(item.requestId, result.status));
        } catch (e) {
          const { title, description } = decisionError(e, item);
          failed.push({ item, title, description });
        }
        onProgress?.(i + 1);
      }
      reload();
      return { approved, failed };
    },
    [reload],
  );

  return {
    items,
    counts,
    loading,
    error,
    reload,
    decide,
    approveMany,
    balanceFor,
    // The queue's own balances make them available to every approver; the ledger state only
    // matters against an older server.
    balanceAvailability: items.some((i) => i.status === "pending" && i.serverBalances?.length)
      ? "ok"
      : balanceAvailability,
    alsoOffFor,
  };
}

/** A short, human-ish fallback when a name can't be resolved — the id's tail, not the whole ULID. */
function shortId(id: string): string {
  return id.length > 10 ? `…${id.slice(-6)}` : id;
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to approvals.";
    return e.message;
  }
  return "Couldn't load approvals. Check your connection and retry.";
}
