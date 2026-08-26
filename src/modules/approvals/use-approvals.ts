"use client";

/**
 * The approval queue, joined into something the table can render, from the real backend.
 *
 * The queue rows carry only ids (`user_id`, `type_id`) — names live in other contexts. So this joins
 * two side reads: the employees directory (`user_id → name`) and the leave-type catalog
 * (`type_id → name`). Both **degrade**: a forbidden or missing lookup falls back to the id, so the
 * queue still renders rather than blanking over a name it couldn't resolve.
 *
 * Fetches pending/approved/rejected together so the status tabs can show real counts and switching a
 * tab is instant — three GSI2 queries on an admin screen, not a hot path.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { employeeNameMap } from "@/modules/employees/services/employees.service";
import { UNKNOWN_TYPE } from "@/lib/format";
import {
  getTypes,
  type ApiLeaveAttachment,
} from "@/modules/leave/services/leave.service";
import * as api from "./services/approvals.service";
import type { ApiApprovalRow, DecideInput } from "./services/approvals.service";

/** A queue row joined with resolved names — what the table renders. */
export interface ApprovalItem {
  userId: string;
  requestId: string;
  requesterName: string;
  typeName: string;
  from: string;
  to: string;
  days: number;
  reason?: string;
  status: string;
  createdAt?: number;
  /** Documents the requester attached. Metadata only; the URL is fetched per file on demand. */
  attachments: ApiLeaveAttachment[];
}

const STATUSES = ["pending", "approved", "rejected"] as const;

export interface ApprovalsData {
  items: ApprovalItem[];
  counts: Record<string, number>;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Approve/reject one; resolves after the server decision and a re-read. */
  decide: (item: ApprovalItem, decision: "approve" | "reject") => Promise<void>;
}

export function useApprovals(): ApprovalsData {
  const [rows, setRows] = useState<ApiApprovalRow[]>([]);
  const [typeName, setTypeName] = useState<Map<string, string>>(new Map());
  const [userName, setUserName] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

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

        // Side joins, both best-effort. A directory a role can't read must not fail the queue.
        const [types, names] = await Promise.all([
          getTypes()
            .then((ts) => new Map(ts.map((t) => [t.type_id, t.name])))
            .catch(() => new Map<string, string>()),
          // Names are a nicety: a `leave:approve` holder can usually read the directory, but if
          // they can't, the rows fall back to short ids rather than failing the whole queue.
          employeeNameMap().catch(() => new Map<string, string>()),
        ]);
        if (!live) return;
        setTypeName(types);
        setUserName(names);
      } catch (e) {
        if (live) setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [nonce]);

  const items = useMemo<ApprovalItem[]>(
    () =>
      rows
        .map((r) => ({
          userId: r.user_id,
          requestId: r.request_id,
          requesterName: userName.get(r.user_id) ?? shortId(r.user_id),
          typeName: typeName.get(r.type_id) ?? UNKNOWN_TYPE,
          from: r.from,
          to: r.to,
          attachments: r.attachments ?? [],
          days: r.days,
          reason: r.reason,
          status: r.status,
          createdAt: r.created_at,
        }))
        // Newest first, when the server stamped a created_at.
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [rows, typeName, userName],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const s of STATUSES) c[s] = items.filter((i) => i.status === s).length;
    return c;
  }, [items]);

  const decide = useCallback(
    async (item: ApprovalItem, decision: "approve" | "reject") => {
      const input: DecideInput = {
        user_id: item.userId,
        request_id: item.requestId,
        decision,
      };
      await api.decide(input);
      reload();
    },
    [reload],
  );

  return { items, counts, loading, error, reload, decide };
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
