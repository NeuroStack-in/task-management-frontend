"use client"

import { useState } from "react"
import { Check, Plug, Search, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { usePermissions } from "@/hooks/use-permissions"
import {
  INTEGRATIONS,
  INTEGRATION_CATEGORIES,
  type Integration,
} from "@/lib/mock-integrations"
import { cn } from "@/lib/utils"

// ── App logo (real favicon with a monogram fallback) ──────────────────────────

function AppLogo({
  domain,
  name,
  className,
}: {
  domain: string
  name: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    const hue = [...name].reduce((s, c) => s + c.charCodeAt(0), 0) % 360
    return (
      <span
        className={cn(
          "flex items-center justify-center rounded-xl text-sm font-semibold text-white",
          className,
        )}
        style={{ backgroundColor: `hsl(${hue} 42% 45%)` }}
      >
        {name.charAt(0)}
      </span>
    )
  }
  return (
    <span
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-xl border bg-white",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
        alt=""
        className="size-6 object-contain"
        onError={() => setFailed(true)}
      />
    </span>
  )
}

function ConnectedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
      <Check className="size-3" /> Connected
    </span>
  )
}

export function IntegrationsMarketplace() {
  const { can } = usePermissions()
  const canManage = can("integrations:manage")

  // Connection state keyed by integration id (seeded from the mock data).
  const [connections, setConnections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(INTEGRATIONS.map((i) => [i.id, i.connected])),
  )
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [selected, setSelected] = useState<Integration | null>(null)

  const connectedCount = Object.values(connections).filter(Boolean).length

  function setConnected(id: string, value: boolean, name: string) {
    setConnections((c) => ({ ...c, [id]: value }))
    toast.success(value ? `Connected to ${name}` : `Disconnected from ${name}`)
  }

  const filtered = INTEGRATIONS.filter((i) => {
    if (category !== "all" && i.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !`${i.name} ${i.description} ${i.category}`.toLowerCase().includes(q)
      )
        return false
    }
    return true
  })

  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Integrations Marketplace"
        description="Connect WorkPulse to the tools your team already uses."
        actions={
          <Button
            variant="outline"
            onClick={() => toast.success("Integration request sent to our team")}
          >
            <Sparkles className="size-4" /> Request integration
          </Button>
        }
      />

      {/* ── Toolbar ── */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search integrations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground sm:ml-auto">
            <span className="font-medium text-foreground">{connectedCount}</span>{" "}
            connected · {INTEGRATIONS.length} available
          </span>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", ...INTEGRATION_CATEGORIES].map((cat) => {
            const active = category === cat
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {cat === "all" ? "All" : cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-10">
          <EmptyState
            icon={Plug}
            title="No integrations found"
            description="Try a different search term or category."
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((integration) => {
            const isConnected = connections[integration.id]
            return (
              <div
                key={integration.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(integration)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setSelected(integration)
                  }
                }}
                className={cn(
                  "group flex cursor-pointer flex-col rounded-lg border bg-card p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  isConnected
                    ? "border-success/30 hover:border-success/50"
                    : "border-border hover:border-primary/30",
                )}
              >
                <div className="flex items-start gap-3">
                  <AppLogo
                    domain={integration.domain}
                    name={integration.name}
                    className="size-11 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold">
                      {integration.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {integration.category}
                    </p>
                  </div>
                  {isConnected && <ConnectedBadge />}
                </div>

                <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted-foreground">
                  {integration.description}
                </p>

                <div className="mt-4">
                  {isConnected ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canManage}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelected(integration)
                      }}
                    >
                      Manage
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!canManage}
                      onClick={(e) => {
                        e.stopPropagation()
                        setConnected(integration.id, true, integration.name)
                      }}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Detail sheet ── */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <IntegrationDetail
              integration={selected}
              connected={connections[selected.id]}
              canManage={canManage}
              onConnect={(v) => setConnected(selected.id, v, selected.name)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ── Detail sheet body ─────────────────────────────────────────────────────────

function IntegrationDetail({
  integration,
  connected,
  canManage,
  onConnect,
}: {
  integration: Integration
  connected: boolean
  canManage: boolean
  onConnect: (value: boolean) => void
}) {
  const [notifications, setNotifications] = useState(true)
  const [twoWaySync, setTwoWaySync] = useState(false)

  return (
    <>
      <SheetHeader className="pb-2">
        <div className="flex items-center gap-3">
          <AppLogo
            domain={integration.domain}
            name={integration.name}
            className="size-12 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-left text-lg">
              {integration.name}
            </SheetTitle>
            <p className="text-xs text-muted-foreground">{integration.category}</p>
          </div>
          {connected && <ConnectedBadge />}
        </div>
        <SheetDescription className="pt-2 text-left">
          {integration.description}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 px-4 pb-8">
        {/* What it does */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            What you can do
          </p>
          <ul className="space-y-2">
            {integration.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {connected ? (
          <>
            {/* Connection info */}
            <div className="space-y-1 rounded-xl bg-muted/50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Account</span>
                <span className="font-medium">
                  {integration.account ?? "Connected"}
                </span>
              </div>
              {integration.lastSync && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last sync</span>
                  <span className="tabular-nums">{integration.lastSync}</span>
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="divide-y rounded-xl border">
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Send notifications</p>
                  <p className="text-xs text-muted-foreground">
                    Push WorkPulse alerts to {integration.name}.
                  </p>
                </div>
                <Switch
                  size="sm"
                  checked={notifications}
                  disabled={!canManage}
                  onCheckedChange={setNotifications}
                />
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Two-way sync</p>
                  <p className="text-xs text-muted-foreground">
                    Let changes flow both ways between the apps.
                  </p>
                </div>
                <Switch
                  size="sm"
                  checked={twoWaySync}
                  disabled={!canManage}
                  onCheckedChange={setTwoWaySync}
                />
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              disabled={!canManage}
              onClick={() => onConnect(false)}
            >
              Disconnect
            </Button>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
              On connecting, WorkPulse will be able to read and write data in{" "}
              {integration.name} on your organization&apos;s behalf. You can
              disconnect at any time.
            </div>
            <Button
              className="w-full"
              disabled={!canManage}
              onClick={() => onConnect(true)}
            >
              <Plug className="size-4" /> Connect {integration.name}
            </Button>
          </>
        )}
      </div>
    </>
  )
}
