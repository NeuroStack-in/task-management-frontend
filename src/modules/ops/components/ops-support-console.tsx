"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LifeBuoy, Send, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/shared/loader";
import { EmptyState } from "@/components/shared/empty-state";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  listOpsTickets,
  getOpsThread,
  replyOpsTicket,
  setOpsStatus,
  type OpsStatus,
  type OpsTicketRow,
  type OpsThread,
} from "../services/ops.service";
import { attachmentName } from "@/modules/help/services/support.service";

const STATUSES: { value: OpsStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const STATUS_BADGE: Record<OpsStatus, string> = {
  open: "bg-warning/15 text-warning",
  in_progress: "bg-primary/15 text-primary",
  resolved: "bg-success/15 text-success",
  closed: "bg-muted text-muted-foreground",
};

const when = (ms?: number) =>
  ms ? new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export function OpsSupportConsole() {
  const [status, setStatus] = useState<OpsStatus>("open");
  const [tickets, setTickets] = useState<OpsTicketRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selected, setSelected] = useState<OpsTicketRow | null>(null);
  const [thread, setThread] = useState<OpsThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * Which list request is current. Clicking through the status tabs let a slow response land under
   * the tab chosen after it — a slow "Open" list under "Closed" (QA audit 2026-10-08, WP-252).
   */
  const listSeq = useRef(0);
  const loadList = useCallback(() => {
    const seq = ++listSeq.current;
    setListLoading(true);
    listOpsTickets(status)
      .then((r) => {
        if (seq === listSeq.current) setTickets(r.tickets);
      })
      .catch((e) => {
        if (seq === listSeq.current) {
          toast.error(e instanceof ApiError ? e.message : "Couldn't load the queue.");
        }
      })
      .finally(() => {
        if (seq === listSeq.current) setListLoading(false);
      });
  }, [status]);

  useEffect(() => {
    loadList();
    threadSeq.current += 1; // a thread still loading belongs to the queue we just left
    setSelected(null);
    setThread(null);
  }, [loadList]);

  // Which thread request is current. Loads used to land in whatever order the network chose, so a
  // slow ticket A could overwrite a fast ticket B on screen while `selected` stayed B: the operator
  // read org X's ticket and replied to org Y's requester (QA audit 2026-10-08, WP-067).
  const threadSeq = useRef(0);

  const openThread = (row: OpsTicketRow) => {
    const seq = ++threadSeq.current;
    setSelected(row);
    setThread(null);
    setThreadLoading(true);
    getOpsThread(row.tenant_id, row.user_id, row.ticket_id)
      .then((t) => {
        if (seq === threadSeq.current) setThread(t);
      })
      .catch((e) => {
        if (seq === threadSeq.current) {
          toast.error(e instanceof ApiError ? e.message : "Couldn't load the ticket.");
        }
      })
      .finally(() => {
        if (seq === threadSeq.current) setThreadLoading(false);
      });
  };

  /**
   * The ticket a reply or status change goes to: **the one on screen**, read from the thread
   * itself, and only when it is the selected one — never `selected` alone, which can name a ticket
   * the operator is not looking at.
   */
  const target = (): OpsThread | null =>
    thread && selected && thread.ticket_id === selected.ticket_id && thread.tenant_id === selected.tenant_id
      ? thread
      : null;

  const sendReply = async () => {
    const t = target();
    if (!t || !reply.trim() || busy) return;
    const seq = threadSeq.current;
    setBusy(true);
    try {
      const next = await replyOpsTicket(t.tenant_id, t.user_id, t.ticket_id, reply.trim());
      // The operator may have opened another ticket while this was in flight.
      if (seq === threadSeq.current) {
        setThread(next);
        setReply("");
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't post the reply.");
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (next: OpsStatus) => {
    const t = target();
    if (!t || busy) return;
    const seq = threadSeq.current;
    setBusy(true);
    try {
      const updated = await setOpsStatus(t.tenant_id, t.user_id, t.ticket_id, next);
      if (seq === threadSeq.current) setThread(updated);
      toast.success(`Ticket marked ${next.replace("_", " ")}`);
      loadList(); // it may have left this status's queue
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't change the status.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Support desk"
        description="Support tickets from every organization, for the WorkPulse support team."
      />

      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus(s.value)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              status === s.value
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground shadow-soft hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
        <Button variant="ghost" size="icon-sm" onClick={loadList} aria-label="Refresh">
          <RefreshCw className={cn("size-4", listLoading && "animate-spin")} />
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
        {/* Queue */}
        <Card className="max-h-[70vh] overflow-y-auto p-0">
          {listLoading && tickets.length === 0 ? (
            <div className="p-6">
              <Loader label="Loading queue…" />
            </div>
          ) : tickets.length === 0 ? (
            <EmptyState icon={LifeBuoy} title="Empty queue" description={`No ${status.replace("_", " ")} tickets.`} />
          ) : (
            <ul className="divide-y divide-border">
              {tickets.map((row) => (
                <li key={`${row.tenant_id}/${row.ticket_id}`}>
                  <button
                    type="button"
                    onClick={() => openThread(row)}
                    className={cn(
                      "w-full space-y-1 px-4 py-3 text-left transition-colors hover:bg-muted",
                      selected?.ticket_id === row.ticket_id && "bg-accent",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{row.subject || "(no subject)"}</span>
                      <Badge className={STATUS_BADGE[row.status]}>{row.status.replace("_", " ")}</Badge>
                    </div>
                    <p className="text-muted-foreground truncate text-xs">
                      {row.category || "—"} · org {row.tenant_id.slice(0, 14)}… · {when(row.created_at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Thread */}
        <Card className="min-h-[24rem] p-5">
          {!selected ? (
            <div className="flex h-full min-h-[20rem] items-center justify-center">
              <p className="text-muted-foreground text-sm">Select a ticket to view the conversation.</p>
            </div>
          ) : threadLoading || !thread ? (
            <Loader label="Loading ticket…" />
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-heading text-lg font-medium">{thread.subject || "(no subject)"}</h3>
                  <Badge className={STATUS_BADGE[thread.status]}>{thread.status.replace("_", " ")}</Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {thread.category || "—"} · org {thread.tenant_id} · user {thread.user_id} · opened {when(thread.created_at)}
                </p>
              </div>

              {/* Status controls */}
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <Button
                    key={s.value}
                    variant={thread.status === s.value ? "default" : "outline"}
                    size="sm"
                    disabled={busy || thread.status === s.value}
                    onClick={() => changeStatus(s.value)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>

              {/* Messages — led by what the customer wrote when filing, which `messages` (replies
                  only) never contained (WP-068). */}
              <div className="space-y-3 rounded-xl border border-border p-3">
                {thread.description?.trim() ? (
                  <div className="flex justify-start">
                    <div className="bg-muted max-w-[80%] space-y-1 rounded-xl px-3 py-2 text-sm">
                      <p className="text-[11px] font-medium opacity-70">
                        Requester · {when(thread.created_at)}
                      </p>
                      <p className="whitespace-pre-wrap">{thread.description}</p>
                      {thread.attachments.length > 0 ? (
                        // Named, not linked: there is no operator read route for these yet. The files
                        // also reach the support inbox with the filing email.
                        <p className="text-muted-foreground text-xs">
                          {thread.attachments.length} attachment
                          {thread.attachments.length === 1 ? "" : "s"}:{" "}
                          {thread.attachments.map(attachmentName).join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {thread.messages.length === 0 && !thread.description?.trim() ? (
                  <p className="text-muted-foreground text-sm">No messages on this ticket.</p>
                ) : (
                  thread.messages.map((m, i) => {
                    const staff = m.author !== "user";
                    return (
                      <div key={i} className={cn("flex", staff ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[80%] space-y-1 rounded-xl px-3 py-2 text-sm",
                            staff ? "bg-primary text-primary-foreground" : "bg-muted",
                          )}
                        >
                          <p className="text-[11px] font-medium opacity-70">
                            {staff ? "Support" : "Requester"} · {when(m.created_at)}
                          </p>
                          <p className="whitespace-pre-wrap">{m.body}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reply */}
              <div className="space-y-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Reply as support…"
                  rows={3}
                  className="border-input bg-background w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex justify-end">
                  <Button size="sm" disabled={busy || !reply.trim()} onClick={sendReply}>
                    <Send className="size-4" /> Send reply
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
