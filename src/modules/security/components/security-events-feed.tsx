"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, MonitorSmartphone, ShieldCheck } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/shared/user-avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { Loader } from "@/components/shared/loader"
import { useSecurityEvents } from "../use-security-events"

const PAGE_SIZE = 8

/**
 * The security-events feed — `GET /v1/security-events` (identity, LLD §15), the audit trail
 * pre-filtered to the `security` category. A distinct slice from the full Audit Logs page:
 * this answers "what security-relevant things happened lately" in place, and links out to the
 * audit log for the full cross-category trail.
 *
 * The server row is lean (`ts, actor, action, target?`) — no IP, severity, or outcome exists,
 * so none is invented. No pagination cursor either: "Show more" reveals more of the fetched
 * window (up to the server's 500-row cap) client-side.
 */
export function SecurityEventsFeed() {
  const { events, loading, error, reload } = useSecurityEvents()
  const [visible, setVisible] = useState(PAGE_SIZE)

  const shown = events.slice(0, visible)

  return (
    <Card id="security-events" className="scroll-mt-24">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>Security Events</CardTitle>
            {/* Only what the server records under `security`: no sign-ins and no role or permission
                changes are written (QA audit 2026-10-08, WP-336). */}
            <CardDescription>
              Authenticator resets, ownership changes, device enrolments and removals, and
              on-demand screenshots — newest first.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/settings/audit-logs" />}
          >
            Full audit log <ArrowUpRight className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader label="Loading security events…" className="py-6" />
        ) : error ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-8 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={reload}>
              Retry
            </Button>
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No security events yet"
            description="Authenticator resets, ownership changes and device enrolments will appear here as they happen."
          />
        ) : (
          <>
            <ol className="divide-y divide-border/60">
              {shown.map((e) => (
                <li key={e.key} className="flex items-center gap-3 py-2.5">
                  {/* A device actor gets a monitor glyph, not person-initials (as in Audit Logs). */}
                  {e.actorIsDevice ? (
                    <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                      <MonitorSmartphone className="size-4" />
                    </span>
                  ) : (
                    <UserAvatar
                      userId={e.actorId}
                      name={e.actorName}
                      className="size-8 shrink-0"
                      fallbackClassName="text-[10px]"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">{e.actorName}</span>{" "}
                      <span className="text-muted-foreground">{e.action}</span>
                    </p>
                    {e.target ? (
                      <p className="truncate text-xs text-muted-foreground">{e.target}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {e.timestamp}
                  </span>
                </li>
              ))}
            </ol>
            {visible < events.length && (
              <div className="flex justify-center pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                >
                  Show more events
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
