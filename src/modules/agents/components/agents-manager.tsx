"use client"

import { useState } from "react"
import {
  AlertTriangle,
  Copy,
  Download,
  MonitorSmartphone,
  MoreVertical,
  Power,
  RefreshCw,
  Search,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react"
import { toast } from "sonner"
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
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NumberStepper } from "@/components/ui/number-stepper"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { SettingsSaveBar } from "@/components/shared/settings-save-bar"
import { EmptyState } from "@/components/shared/empty-state"
import { usePermissions } from "@/hooks/use-permissions"
import { initials } from "@/lib/format"
import {
  AGENTS,
  AGENT_ENROLLMENT_TOKEN,
  AGENT_PLATFORMS,
  AGENT_SETTINGS_DEFAULTS,
  LATEST_AGENT_VERSION,
  UPDATE_CHANNEL_OPTIONS,
  type Agent,
  type AgentSettings,
  type AgentStatus,
} from "@/lib/mock-agents"
import { cn } from "@/lib/utils"

const STATUS_META: Record<AgentStatus, { label: string; dot: string }> = {
  online: { label: "Online", dot: "bg-success" },
  idle: { label: "Idle", dot: "bg-warning" },
  offline: { label: "Offline", dot: "bg-muted-foreground/40" },
}

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

  const [agents, setAgents] = useState<Agent[]>(() => AGENTS.map((a) => ({ ...a })))
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [osFilter, setOsFilter] = useState("all")
  const [selected, setSelected] = useState<Agent | null>(null)
  const [downloadOpen, setDownloadOpen] = useState(false)

  // Fleet-wide agent settings (dirty-aware save bar).
  const [saved, setSaved] = useState<AgentSettings>({ ...AGENT_SETTINGS_DEFAULTS })
  const [draft, setDraft] = useState<AgentSettings>({ ...AGENT_SETTINGS_DEFAULTS })
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  const isOutdated = (a: Agent) => a.version !== LATEST_AGENT_VERSION
  const total = agents.length
  const online = agents.filter((a) => a.status === "online").length
  const offline = agents.filter((a) => a.status === "offline").length
  const outdated = agents.filter(isOutdated).length

  function updateAgent(id: string) {
    setAgents((list) =>
      list.map((a) => (a.id === id ? { ...a, version: LATEST_AGENT_VERSION } : a)),
    )
    toast.success("Agent updated to the latest version")
  }

  function updateAll() {
    setAgents((list) => list.map((a) => ({ ...a, version: LATEST_AGENT_VERSION })))
    toast.success("All agents queued for update")
  }

  function removeAgent(id: string, hostname: string) {
    setAgents((list) => list.filter((a) => a.id !== id))
    setSelected(null)
    toast.success(`Removed ${hostname}`)
  }

  function handleSave() {
    if (!dirty || saving) return
    const next = draft
    setSaving(true)
    setTimeout(() => {
      setSaved({ ...next })
      setSaving(false)
      toast.success("Agent settings saved")
    }, 500)
  }

  const filtered = agents.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false
    if (osFilter !== "all" && a.os !== osFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${a.hostname} ${a.user} ${a.email}`.toLowerCase().includes(q))
        return false
    }
    return true
  })

  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Desktop Agents"
        description="Monitor and manage the WorkPulse agent installed on employee devices."
        actions={
          <Button onClick={() => setDownloadOpen(true)}>
            <Download className="size-4" /> Download agent
          </Button>
        }
      />

      {/* ── Overview ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total agents" value={total} icon={MonitorSmartphone} hint="enrolled devices" />
        <StatCard label="Online now" value={online} icon={Wifi} hint="reporting activity" />
        <StatCard label="Offline" value={offline} icon={WifiOff} hint="not reporting" />
        <StatCard label="Need update" value={outdated} icon={AlertTriangle} hint={`latest is v${LATEST_AGENT_VERSION}`} />
      </div>

      {/* ── Outdated banner ── */}
      {outdated > 0 && canManage && (
        <div className="flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-5 py-3 text-sm sm:flex-row sm:items-center">
          <AlertTriangle className="size-4 shrink-0 text-warning" />
          <p className="flex-1">
            <span className="font-medium">{outdated} agent{outdated > 1 ? "s are" : " is"}</span>{" "}
            running an outdated version. Update to v{LATEST_AGENT_VERSION} for the
            latest fixes.
          </p>
          <Button size="sm" variant="outline" onClick={updateAll}>
            <RefreshCw className="size-4" /> Update all
          </Button>
        </div>
      )}

      {/* ── Fleet ── */}
      <Card>
        <CardHeader>
          <CardTitle>Agent fleet</CardTitle>
          <CardDescription>
            Every device with the WorkPulse agent installed.
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
              >
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All systems</SelectItem>
                  <SelectItem value="Windows">Windows</SelectItem>
                  <SelectItem value="macOS">macOS</SelectItem>
                  <SelectItem value="Linux">Linux</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
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
                    <TableHead className="w-10 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow
                      key={a.id}
                      onClick={() => setSelected(a)}
                      className="cursor-pointer"
                    >
                      <TableCell className="py-3 pl-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="text-[10px]">
                              {initials(a.user)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium">{a.hostname}</p>
                            <p className="text-xs text-muted-foreground">{a.user}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden py-3 text-muted-foreground md:table-cell">
                        {a.os} {a.osVersion}
                      </TableCell>
                      <TableCell className="hidden py-3 sm:table-cell">
                        <span className="inline-flex items-center gap-2 tabular-nums">
                          v{a.version}
                          {isOutdated(a) && (
                            <Badge className="bg-warning/15 font-normal text-warning">
                              Outdated
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <StatusIndicator status={a.status} />
                      </TableCell>
                      <TableCell className="hidden py-3 text-muted-foreground lg:table-cell">
                        {a.lastSeen}
                      </TableCell>
                      <TableCell className="py-3 pr-4 text-right">
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              }
                            >
                              <MoreVertical className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenuItem onClick={() => setSelected(a)}>
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toast.success(`Restart signal sent to ${a.hostname}`)}
                              >
                                <Power className="size-4" /> Restart agent
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!isOutdated(a)}
                                onClick={() => updateAgent(a.id)}
                              >
                                <RefreshCw className="size-4" /> Update now
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => removeAgent(a.id, a.hostname)}
                              >
                                <Trash2 className="size-4" /> Remove agent
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Agent settings ── */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Settings</CardTitle>
          <CardDescription>
            Fleet-wide behaviour applied to every installed agent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 pb-2">
          <div className="flex items-center justify-between gap-6 py-4 [&+&]:border-t">
            <div>
              <p className="text-sm font-medium">Automatic updates</p>
              <p className="text-xs text-muted-foreground">
                Agents update themselves to the latest version automatically.
              </p>
            </div>
            <Switch
              checked={draft.autoUpdate}
              disabled={!canManage}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, autoUpdate: v }))}
            />
          </div>
          <div className="flex items-center justify-between gap-6 py-4 [&+&]:border-t">
            <div>
              <p className="text-sm font-medium">Update channel</p>
              <p className="text-xs text-muted-foreground">
                Choose between stable releases or early-access builds.
              </p>
            </div>
            <Select
              value={draft.updateChannel}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, updateChannel: v as string }))
              }
              disabled={!canManage}
            >
              <SelectTrigger size="sm" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UPDATE_CHANNEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-6 py-4 [&+&]:border-t">
            <div>
              <p className="text-sm font-medium">Offline alert threshold</p>
              <p className="text-xs text-muted-foreground">
                Flag an agent as offline after it stops reporting for this long.
              </p>
            </div>
            <NumberStepper
              value={draft.offlineAlertMins}
              min={5}
              max={240}
              step={5}
              suffix="min"
              disabled={!canManage}
              onChange={(v) => setDraft((d) => ({ ...d, offlineAlertMins: v }))}
            />
          </div>
          <div className="flex items-center justify-between gap-6 py-4 [&+&]:border-t">
            <div>
              <p className="text-sm font-medium">Upload screenshots</p>
              <p className="text-xs text-muted-foreground">
                Allow agents to capture and upload periodic screenshots.
              </p>
            </div>
            <Switch
              checked={draft.screenshotUpload}
              disabled={!canManage}
              onCheckedChange={(v) =>
                setDraft((d) => ({ ...d, screenshotUpload: v }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {canManage && (
        <SettingsSaveBar
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
          onReset={() => setDraft({ ...saved })}
        />
      )}

      {/* ── Download dialog ── */}
      <Dialog open={downloadOpen} onOpenChange={setDownloadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Download the WorkPulse agent</DialogTitle>
            <DialogDescription>
              Version {LATEST_AGENT_VERSION} · install on an employee device, then
              enroll it with the organization token below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {AGENT_PLATFORMS.map((p) => (
                <button
                  key={p.os}
                  onClick={() => toast.success(`Downloading ${p.file}`)}
                  className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-feature-tint text-primary">
                    <MonitorSmartphone className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{p.os}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.label} · {p.size}
                    </p>
                  </div>
                  <Download className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Organization enrollment token
              </p>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                <code className="min-w-0 flex-1 truncate font-mono text-xs">
                  {AGENT_ENROLLMENT_TOKEN}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(AGENT_ENROLLMENT_TOKEN)
                    toast.success("Token copied")
                  }}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Copy token"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Detail sheet ── */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <StatusIndicator status={selected.status} />
                  {isOutdated(selected) && (
                    <Badge className="bg-warning/15 font-normal text-warning">
                      Outdated
                    </Badge>
                  )}
                </div>
                <SheetTitle className="text-left text-lg">
                  {selected.hostname}
                </SheetTitle>
                <SheetDescription className="text-left">
                  {selected.user} · {selected.email}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 px-4 pb-8">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Operating system" value={`${selected.os} ${selected.osVersion}`} />
                  <Info label="Agent version" value={`v${selected.version}`} />
                  <Info label="IP address" value={selected.ip} mono />
                  <Info label="Last seen" value={selected.lastSeen} />
                </div>

                {/* Live resource usage */}
                <div className="space-y-3 rounded-xl border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Resource usage
                  </p>
                  <Meter label="CPU" value={selected.status === "offline" ? 0 : selected.cpu} />
                  <Meter label="Memory" value={selected.status === "offline" ? 0 : selected.memory} />
                  {selected.status === "offline" && (
                    <p className="text-xs text-muted-foreground">
                      Agent is offline — last reported {selected.lastSeen.toLowerCase()}.
                    </p>
                  )}
                </div>

                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.success(`Restart signal sent to ${selected.hostname}`)}
                    >
                      <Power className="size-4" /> Restart
                    </Button>
                    {isOutdated(selected) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          updateAgent(selected.id)
                          setSelected((s) =>
                            s ? { ...s, version: LATEST_AGENT_VERSION } : s,
                          )
                        }}
                      >
                        <RefreshCw className="size-4" /> Update
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeAgent(selected.id, selected.hostname)}
                    >
                      <Trash2 className="size-4" /> Remove
                    </Button>
                  </div>
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
