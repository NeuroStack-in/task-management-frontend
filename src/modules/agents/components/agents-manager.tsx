"use client"

import { useMemo, useState } from "react"
import {
  Info as InfoIcon,
  MonitorSmartphone,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { EmptyState } from "@/components/shared/empty-state"
import { Loader } from "@/components/shared/loader"
import { usePermissions } from "@/hooks/use-permissions"
import { useFleet } from "../use-fleet"
import type { ApiDevice } from "../services/fleet.service"
import { STATUS_META, lastSeen, toStatus, type AgentStatus } from "../lib/presentation"
import { cn } from "@/lib/utils"

function StatusIndicator({ status }: { status: AgentStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className={cn("size-2 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  )
}

export function AgentsManager() {
  const { can } = usePermissions()
  const canManage = can("agents:manage")

  const { fleet, loading, error, reload } = useFleet()
  const devices = useMemo(() => fleet?.devices ?? [], [fleet])

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [osFilter, setOsFilter] = useState("all")
  const [selected, setSelected] = useState<ApiDevice | null>(null)

  // Overview counts come straight from the real fleet read.
  const total = devices.length
  const online = devices.filter((d) => toStatus(d.connectivity) === "online").length
  const idle = devices.filter((d) => toStatus(d.connectivity) === "idle").length
  const offline = devices.filter((d) => toStatus(d.connectivity) === "offline").length

  // OS filter options are derived from the live data — the server's `os` string is free-form.
  const osOptions = useMemo(
    () => [...new Set(devices.map((d) => d.os).filter(Boolean))].sort(),
    [devices],
  )

  const filtered = devices.filter((d) => {
    if (statusFilter !== "all" && toStatus(d.connectivity) !== statusFilter) return false
    if (osFilter !== "all" && d.os !== osFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${d.hostname} ${d.user_id}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Device agents"
        description="Monitor the WorkPulse agent installed on employee devices."
        actions={
          <Button variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh
          </Button>
        }
      />

      {/* ── Overview ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total agents" value={total} icon={MonitorSmartphone} hint="enrolled devices" />
        <StatCard label="Online now" value={online} icon={Wifi} hint="reporting activity" />
        <StatCard label="Idle" value={idle} icon={MonitorSmartphone} hint="connected, inactive" />
        <StatCard label="Offline" value={offline} icon={WifiOff} hint="not reporting" />
      </div>

      {/* ── Enrollment (degraded — no live route issues tokens yet) ── */}
      {canManage && (
        <div className="flex flex-col gap-3 rounded-2xl border bg-muted/30 px-5 py-3 text-sm sm:flex-row sm:items-center">
          <InfoIcon className="size-4 shrink-0 text-muted-foreground" />
          <p className="flex-1 text-muted-foreground">
            Agent downloads and enrollment tokens aren&apos;t issued by a live endpoint
            yet. Devices appear here automatically once an enrolled agent starts
            reporting heartbeats.
          </p>
        </div>
      )}

      {/* ── Fleet ── */}
      <Card>
        <CardHeader>
          <CardTitle>Device agents</CardTitle>
          <CardDescription>
            Every device with the WorkPulse agent installed and reporting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by device or user…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-3 sm:ml-auto">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as string)}
                items={{ all: "All status", online: "Online", idle: "Idle", offline: "Offline" }}
              >
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="idle">Idle</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={osFilter}
                onValueChange={(v) => setOsFilter(v as string)}
                items={{
                  all: "All systems",
                  ...Object.fromEntries(osOptions.map((os) => [os, os])),
                }}
              >
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All systems</SelectItem>
                  {osOptions.map((os) => (
                    <SelectItem key={os} value={os}>
                      {os}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading && !fleet ? (
            <div className="flex min-h-[12rem] items-center justify-center">
              <Loader label="Loading the device fleet…" />
            </div>
          ) : error ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button size="sm" variant="outline" onClick={reload}>
                <RefreshCw className="size-4" /> Retry
              </Button>
            </div>
          ) : devices.length === 0 ? (
            <EmptyState
              icon={MonitorSmartphone}
              title="No agents reporting yet"
              description="Devices show up here once the desktop agent is installed and sending heartbeats."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={MonitorSmartphone}
              title="No agents found"
              description="Try a different search or filter."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full caption-bottom text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Device</TableHead>
                    <TableHead className="hidden md:table-cell">System</TableHead>
                    <TableHead className="hidden sm:table-cell">Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Last seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => (
                    <TableRow
                      key={d.agent_id}
                      onClick={() => setSelected(d)}
                      className="cursor-pointer"
                    >
                      <TableCell className="py-3 pl-4">
                        <div className="min-w-0">
                          <p className="font-medium">{d.hostname}</p>
                          <p className="text-xs text-muted-foreground">{d.user_id}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden py-3 text-muted-foreground md:table-cell">
                        {d.os} {d.os_version}
                      </TableCell>
                      <TableCell className="hidden py-3 sm:table-cell">
                        <span className="inline-flex items-center gap-2 tabular-nums">
                          {d.agent_version ? `v${d.agent_version}` : "—"}
                          {d.state === "deactivated" && (
                            <Badge className="bg-muted font-normal text-muted-foreground">
                              Deactivated
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <StatusIndicator status={toStatus(d.connectivity)} />
                      </TableCell>
                      <TableCell className="hidden py-3 text-muted-foreground lg:table-cell">
                        {lastSeen(d.last_heartbeat)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Detail sheet ── */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <StatusIndicator status={toStatus(selected.connectivity)} />
                  {selected.state === "deactivated" && (
                    <Badge className="bg-muted font-normal text-muted-foreground">
                      Deactivated
                    </Badge>
                  )}
                </div>
                <SheetTitle className="text-left text-lg">
                  {selected.hostname}
                </SheetTitle>
                <SheetDescription className="text-left">
                  {selected.user_id}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 px-4 pb-8">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Operating system" value={`${selected.os} ${selected.os_version}`} />
                  <Info
                    label="Agent version"
                    value={selected.agent_version ? `v${selected.agent_version}` : "—"}
                  />
                  <Info label="IP address" value={selected.ip || "—"} mono />
                  <Info label="Last seen" value={lastSeen(selected.last_heartbeat)} />
                  <Info label="Outbox" value={`${selected.outbox_mb} MB`} />
                  <Info label="Idle" value={selected.idle ? "Yes" : "No"} />
                </div>

                {/* Live resource usage (from the last heartbeat). */}
                <div className="space-y-3 rounded-xl border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Resource usage
                  </p>
                  <Meter
                    label="CPU"
                    value={toStatus(selected.connectivity) === "offline" ? 0 : selected.cpu_pct}
                  />
                  <Meter
                    label="Memory"
                    value={toStatus(selected.connectivity) === "offline" ? 0 : selected.mem_pct}
                  />
                  {toStatus(selected.connectivity) === "offline" && (
                    <p className="text-xs text-muted-foreground">
                      Agent is offline — last reported {lastSeen(selected.last_heartbeat).toLowerCase()}.
                    </p>
                  )}
                </div>

                {canManage && (
                  <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    Remote agent commands (restart, update, deactivate) aren&apos;t
                    available from a live endpoint yet.
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Info({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-medium", mono && "font-mono text-xs")}>{value}</p>
    </div>
  )
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", value > 80 ? "bg-warning" : "bg-primary")}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}
