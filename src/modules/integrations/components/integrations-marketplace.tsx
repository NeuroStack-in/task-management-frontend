"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Eye,
  Link2,
  Loader2,
  Plug,
  Send,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader } from "@/components/shared/loader";
import { EmptyState } from "@/components/shared/empty-state";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api";
import {
  disconnect,
  getAuthorizeUrl,
  getSlackConfig,
  listIntegrations,
  listSlackChannels,
  sendSlackTest,
  setSlackConfig,
  SLACK_EVENTS,
  type ApiIntegration,
  type SlackConfig,
} from "@/modules/integrations/services/integrations.service";
import { rememberPendingProvider } from "./integrations-callback";
import { ProviderLogo } from "./provider-logo";

/**
 * The Integrations marketplace — **server-driven**.
 *
 * The provider list comes from `GET /v1/integrations`, not from a local catalog. That is deliberate:
 * this screen previously rendered ~20 hard-coded apps from `mock-integrations.ts`, none of which the
 * backend could connect. A card for an app that cannot be connected is a button that lies, so the
 * only providers shown are the ones the server actually implements.
 */
export function IntegrationsMarketplace() {
  const { can } = usePermissions();
  const canManage = can("integrations:manage");

  const [rows, setRows] = useState<ApiIntegration[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [channelsOpen, setChannelsOpen] = useState(false);

  const load = useCallback(() => {
    listIntegrations()
      .then(setRows)
      .catch((e) =>
        setError(
          e instanceof ApiError ? e.message : "Couldn't load your integrations.",
        ),
      );
  }, []);

  useEffect(load, [load]);

  const onConnect = async (provider: string) => {
    setBusy(provider);
    try {
      // Stashed before we navigate away — the callback needs it, and `redirect_uri` must match the
      // provider's registered value exactly, so it cannot carry the provider itself.
      rememberPendingProvider(provider);
      window.location.href = await getAuthorizeUrl(provider);
    } catch (e) {
      setBusy(null);
      toast.error("Couldn't start the connection", {
        description: e instanceof ApiError ? e.message : undefined,
      });
    }
  };

  const onDisconnect = async (provider: string, label: string) => {
    setBusy(provider);
    try {
      await disconnect(provider);
      toast.success(`${label} disconnected`, {
        description: "The access token was revoked at the provider.",
      });
      load();
    } catch (e) {
      toast.error("Couldn't disconnect", {
        description: e instanceof ApiError ? e.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load integrations"
        description={error}
        action={
          <Button
            onClick={() => {
              setError(null);
              load();
            }}
          >
            Try again
          </Button>
        }
      />
    );
  }

  if (!rows) return <Loader label="Loading integrations…" />;

  const slack = rows.find((r) => r.provider === "slack");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((row) => (
          <ProviderCard
            key={row.provider}
            row={row}
            canManage={canManage}
            busy={busy === row.provider}
            comingSoon={COMING_SOON.has(row.provider)}
            // The channel-routing view is Slack-specific and only meaningful once connected; the
            // eye button that opens it is shown only then.
            onViewChannels={
              row.provider === "slack" &&
              row.status === "connected" &&
              canManage
                ? () => setChannelsOpen(true)
                : undefined
            }
            onConnect={() => onConnect(row.provider)}
            onDisconnect={() => onDisconnect(row.provider, row.label)}
          />
        ))}
      </div>

      {/* Routing lives in a dialog now, opened from the Slack card's eye button, so the card grid
          stays compact instead of a tall panel always hanging below it. */}
      <Dialog open={channelsOpen} onOpenChange={setChannelsOpen}>
        {/* `sm:max-w-2xl` (not plain max-w) — DialogContent's base sets `sm:max-w-sm`, and a
            `sm:` variant only loses to another `sm:` variant. */}
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Slack channels</DialogTitle>
            <DialogDescription>
              Choose where each update is posted. Anything left on the default falls back to the
              default channel; with no default, that update isn&apos;t posted at all.
            </DialogDescription>
          </DialogHeader>
          {slack?.status === "connected" ? <SlackRouting /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Providers shown but temporarily switched off in the UI — rendered softly blurred and
 * non-interactive with a "Coming soon" overlay. Softly: the point is to say *this one isn't ready
 * yet*, not to hide which provider it is. The backend still lists and can connect them; this is a
 * front-end gate only (e.g. Google Calendar is parked until its OAuth verification lands).
 */
const COMING_SOON = new Set<string>(["google_calendar"]);

function ProviderCard({
  row,
  canManage,
  busy,
  comingSoon,
  onViewChannels,
  onConnect,
  onDisconnect,
}: {
  row: ApiIntegration;
  canManage: boolean;
  busy: boolean;
  comingSoon?: boolean;
  /** When set (Slack, connected), an eye button that opens the channel-routing dialog. */
  onViewChannels?: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const connected = row.status === "connected";
  const errored = row.status === "error";
  // A personal connection is the user's own to make; an org-wide one is an admin action, because
  // connecting hands WorkPulse a credential to the whole company's workspace.
  const mayAct = row.org_wide ? canManage : true;

  // Parked in the UI: blur a representative card and overlay a "Coming soon" badge, made inert so
  // nothing can fire. The backend still supports the provider — this is a front-end pause only.
  if (comingSoon) {
    return (
      <Card className="relative overflow-hidden">
        {/* 1px, not 3px: enough to read as "parked" without hiding *which* provider is parked.
            At 3px the name and logo were unreadable, so the card said "Coming soon" about nothing
            in particular. The scrim below carries most of the de-emphasis; the blur only softens. */}
        <div className="pointer-events-none select-none blur-[1px]" aria-hidden>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                <ProviderLogo provider={row.provider} className="size-6" />
              </span>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {row.label}
                  <Badge variant="secondary" className="text-xs">
                    {row.org_wide ? "Organization" : "Personal"}
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-1">Not connected</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button disabled>Connect</Button>
          </CardContent>
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/25">
          <Badge variant="secondary" className="text-sm font-medium shadow-soft">
            Coming soon
          </Badge>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
              <ProviderLogo provider={row.provider} className="size-6" />
            </span>
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                {row.label}
                <Badge variant="secondary" className="text-xs">
                  {row.org_wide ? "Organization" : "Personal"}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                {connected && row.external_account
                  ? `Connected to ${row.external_account}`
                  : errored
                    ? "Needs reconnecting"
                    : "Not connected"}
              </CardDescription>
            </div>
          </div>
          <span
            className={
              connected
                ? "text-success"
                : errored
                  ? "text-warning"
                  : "text-muted-foreground"
            }
          >
            {connected ? (
              <Link2 className="size-5" />
            ) : errored ? (
              <AlertTriangle className="size-5" />
            ) : (
              <Plug className="size-5" />
            )}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* The reason the provider gave, so "reconnect" is actionable rather than mysterious. */}
        {errored && row.last_error ? (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {row.last_error}
          </p>
        ) : null}

        {!mayAct ? (
          <p className="text-xs text-muted-foreground">
            Only an owner or admin can change this connection.
          </p>
        ) : connected || errored ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onConnect} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Reconnect
            </Button>
            <Button variant="ghost" onClick={onDisconnect} disabled={busy}>
              <Unplug className="size-4" />
              Disconnect
            </Button>
            {/* Opens the channel-routing dialog. Only present for a connected Slack card. */}
            {onViewChannels ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label="View channel routing"
                title="Channel routing"
                onClick={onViewChannels}
                className="ml-auto"
              >
                <Eye className="size-4" />
              </Button>
            ) : null}
          </div>
        ) : (
          <Button onClick={onConnect} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Connect
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Which WorkPulse events go to which Slack channel.
 *
 * An event with no channel and no default is **dropped**, not guessed — Slack channels are not
 * private by default and leave data is sensitive, so posting somewhere nobody chose would be worse
 * than posting nothing. The copy says so rather than leaving it to be discovered.
 */
// Sentinel for "no explicit channel — fall back to the default". A Select can't hold "", so the
// empty routing choice needs a real value; it's mapped back to "" on save.
const USE_DEFAULT = "__default__";

function SlackRouting() {
  const [config, setConfig] = useState<SlackConfig | null>(null);
  const [channels, setChannels] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    getSlackConfig()
      .then(setConfig)
      // A 404 means "connected, but never configured" — an empty editor, not an error.
      .catch(() => setConfig({ default_channel: "", channels: {} }));
    // The picker's whole reason to exist. If it fails (scope missing, transient), fall back to
    // free-text entry rather than blocking routing entirely.
    listSlackChannels()
      .then(setChannels)
      .catch(() => setChannels([]));
  }, []);

  if (!config) return null;

  // A channel already routed but no longer returned by Slack (renamed/archived) must still be
  // selectable, or saving would silently drop it. Merge stored values into the option list.
  const known = channels ?? [];
  const routed = [config.default_channel, ...Object.values(config.channels)].filter(Boolean);
  const options = Array.from(new Set([...known, ...routed])).sort();
  const usePicker = known.length > 0;

  const save = async () => {
    setSaving(true);
    try {
      setConfig(await setSlackConfig(config));
      toast.success("Channel routing saved");
    } catch (e) {
      toast.error("Couldn't save routing", {
        description: e instanceof ApiError ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const channel = await sendSlackTest();
      toast.success(`Test message sent to ${channel}`);
    } catch (e) {
      toast.error("Couldn't send the test message", {
        description: e instanceof ApiError ? e.message : undefined,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
          <Label htmlFor="default-channel">Default channel</Label>
          {usePicker ? (
            <Select
              value={config.default_channel || ""}
              onValueChange={(v) =>
                setConfig({ ...config, default_channel: v as string })
              }
            >
              <SelectTrigger id="default-channel" className="w-full sm:w-64">
                <SelectValue placeholder="Choose a channel…" />
              </SelectTrigger>
              <SelectContent>
                {options.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="default-channel"
              placeholder="#general"
              value={config.default_channel}
              onChange={(e) =>
                setConfig({ ...config, default_channel: e.target.value })
              }
            />
          )}
        </div>

        <div className="space-y-3">
          {SLACK_EVENTS.map((ev) => {
            const current = config.channels[ev.key] ?? "";
            return (
              <div key={ev.key} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{ev.label}</p>
                  <p className="text-xs text-muted-foreground">{ev.description}</p>
                </div>
                {usePicker ? (
                  <Select
                    value={current || USE_DEFAULT}
                    onValueChange={(v) => {
                      const next = v === USE_DEFAULT ? "" : (v as string);
                      setConfig({
                        ...config,
                        channels: { ...config.channels, [ev.key]: next },
                      });
                    }}
                  >
                    <SelectTrigger
                      className="w-44"
                      aria-label={`${ev.label} channel`}
                    >
                      {/* Base UI SelectValue renders the raw value; map the sentinel to a label so
                          the trigger reads "Default channel", not "__default__". */}
                      <SelectValue>
                        {(value) =>
                          value === USE_DEFAULT
                            ? "Default channel"
                            : String(value ?? "")
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={USE_DEFAULT}>Default channel</SelectItem>
                      {options.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="w-44"
                    placeholder="default"
                    aria-label={`${ev.label} channel`}
                    value={current}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        channels: { ...config.channels, [ev.key]: e.target.value },
                      })
                    }
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save routing
          </Button>
          {/* Without this, the first sign that routing is wrong is a leave request that silently
              never appeared — noticed days later, if at all. */}
          <Button variant="outline" onClick={test} disabled={testing}>
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send test message
          </Button>
        </div>
    </div>
  );
}
