"use client"

/**
 * Device agents — live from `GET /v1/fleet` (LLD §18).
 *
 * This page is deliberately read-only. The `fleet` context serves two read routes and nothing else:
 * there is no restart, update, remove, or enrollment-token endpoint, and no agent command channel
 * to carry one (the WebSocket control rail was cut; the agent polls `GET /v1/agent/config`). Earlier
 * revisions of this screen had buttons for all four — they toasted success and did nothing. They are
 * gone rather than disabled, because a greyed-out control still implies the capability exists.
 *
 * Capture policy is not configured here either — that's the tracking rules editor, which is real.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  HardDrive,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { initials } from "@/lib/format"
import { useFleet, type DeviceStatus, type FleetDevice } from "../use-fleet"
import { cn } from "@/lib/utils"

const STATUS_META: Record<DeviceStatus, { label: string; dot: string }> = {
  online: { label: "Online", dot: "bg-success" },
  idle: { label: "Idle", dot: "bg-warning" },
  offline: { label: "Offline", dot: "bg-muted-foreground/40" },
}

function StatusIndicator({ status }: { status: DeviceStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className={cn("size-2 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  )
}

export function AgentsManager() {
  const { devices, total, online, offline, loading, error, reload } = useFleet()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [osFilter, setOsFilter] = useState("all")
  const [selected, setSelected] = useState<FleetDevice | null>(null)

  // Derived from what the fleet actually reports — the agent's `os` string comes from `sysinfo`,
  // so hardcoding a Windows/macOS/Linux list here would silently hide anything else.
  const osOptions = useMemo(
    () => Array.from(new Set(devices.map((d) => d.os).filter(Boolean))).sort(),
    [devices],
  )

  const filtered = devices.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false
    if (osFilter !== "all" && d.os !== osFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${d.hostname} ${d.userName} ${d.ip}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Device agents"
        description="Machines running the WorkPulse desktop agent."
        actions={
          <Button variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh
          </Button>
        }
      />

      {error ? (
        <EmptyState
          icon={MonitorSmartphone}
          title="Couldn't load device agents"
          description={error}
          action={
            <Button variant="outline" onClick={reload}>
              <RefreshCw className="size-4" /> Retry
            </Button>
          }
        />
      ) : loading ? (
        <Loader label="Loading device agents…" />
      ) : (
        <>
          {/* ── Overview ── */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total devices" value={total} icon={MonitorSmartphone} hint="reporting to this org" />
            <StatCard label="Online now" value={online} icon={Wifi} hint="heard from in the last 10 min" />
            <StatCard label="Offline" value={offline} icon={WifiOff} hint="no recent heartbeat" />
          </div>

          {/* ── Fleet ── */}
          <Card>
            <CardHeader>
              <CardTitle>Devices</CardTitle>
              <CardDescription>
                Every device that has checked in at least once. Status is derived from the last
                heartbeat, so it updates on refresh.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {total > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by device, user, or IP…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex gap-3 sm:ml-auto">
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as string)}>
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
                    {osOptions.length > 1 && (
                      <Select value={osFilter} onValueChange={(v) => setOsFilter(v as string)}>
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
                    )}
                  </div>
                </div>
              )}

              {total === 0 ? (
                <EmptyState
                  icon={MonitorSmartphone}
                  title="No devices are reporting yet"
                  description="A device appears here after the WorkPulse desktop agent is installed, signed in, and sends its first heartbeat."
                />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={MonitorSmartphone}
                  title="No devices found"
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
                        <TableRow key={d.id} onClick={() => setSelected(d)} className="cursor-pointer">
                          <TableCell className="py-3 pl-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="size-8">
                                <AvatarFallback className="text-[10px]">
                                  {initials(d.userName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium">{d.hostname}</p>
                                <p className="text-xs text-muted-foreground">{d.userName}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden py-3 text-muted-foreground md:table-cell">
                            {[d.os, d.osVersion].filter(Boolean).join(" ") || "—"}
                          </TableCell>
                          <TableCell className="hidden py-3 sm:table-cell tabular-nums">
                            {d.version ? `v${d.version}` : "—"}
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="inline-flex items-center gap-2">
                              <StatusIndicator status={d.status} />
                              {d.deactivated && (
                                <Badge className="bg-muted font-normal text-muted-foreground">
                                  Deactivated
                                </Badge>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="hidden py-3 text-muted-foreground lg:table-cell">
                            {d.lastSeen}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Capture policy lives with the tracking rules, which are real and writable. */}
          <Card>
            <CardHeader>
              <CardTitle>Capture policy</CardTitle>
              <CardDescription>
                What agents record — screenshot cadence, blur, and app/URL rules — is configured once
                for the organization and pulled by every agent on its next cycle.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" render={<Link href="/settings/tracking-rules" />} nativeButton={false}>
                Open tracking rules
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Detail sheet ── */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader className="pb-2">
                <StatusIndicator status={selected.status} />
                <SheetTitle className="text-left text-lg">{selected.hostname}</SheetTitle>
                <SheetDescription className="text-left">{selected.userName}</SheetDescription>
              </SheetHeader>

              <div className="space-y-5 px-4 pb-8">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info
                    label="Operating system"
                    value={[selected.os, selected.osVersion].filter(Boolean).join(" ") || "—"}
                  />
                  <Info label="Agent version" value={selected.version ? `v${selected.version}` : "—"} />
                  <Info label="IP address" value={selected.ip || "—"} mono />
                  <Info label="Last seen" value={selected.lastSeen} />
                </div>

                <div className="space-y-3 rounded-xl border p-4">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Last reported telemetry
                  </p>
                  <Meter label="CPU" value={selected.cpu} />
                  <Meter label="Memory" value={selected.memory} />
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <HardDrive className="size-3.5" /> Pending upload
                    </span>
                    <span className="tabular-nums">{selected.outboxMb.toFixed(1)} MB</span>
                  </div>
                  {selected.status === "offline" && (
                    <p className="text-xs text-muted-foreground">
                      Agent is offline — these are the values from its last heartbeat.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
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
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}
