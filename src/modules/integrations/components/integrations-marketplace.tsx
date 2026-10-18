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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
  /** A Slack reconnect waiting for the admin to confirm that it clears the routing. */
  const [confirmReconnect, setConfirmReconnect] = useState<ApiIntegration | null>(null);
  /** Disconnecting revokes the token and drops the connection — Slack's channel routing with it (XC-07). */
  const [confirmDisconnect, setConfirmDisconnect] = useState<{ provider: string; label: string } | null>(null);

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
  // Routing is editable whenever the connection exists — **including `error`**. A post to a channel
  // the bot was never invited to marks the connection errored, and the editor was reachable only when
  // connected, so the one way out of a bad-channel error was Reconnect — which wipes the routing
  // (QA audit 2026-10-08, WP-235). The routing routes don't depend on the status.
  const hasConnection = (r?: ApiIntegration) => r?.status === "connected" || r?.status === "error";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {rows
          // A hidden provider still shows while it holds a connection, so whoever connected it
          // earlier can disconnect it — hiding it outright left no way to revoke the token (WP-471).
          .filter((row) => !HIDDEN_PROVIDERS.has(row.provider) || hasConnection(row))
          .map((row) => (
          <ProviderCard
            key={row.provider}
            row={row}
            canManage={canManage}
            busy={busy === row.provider}
            retired={HIDDEN_PROVIDERS.has(row.provider)}
            // The channel-routing view is Slack-specific and only meaningful once a connection exists.
            onViewChannels={
              row.provider === "slack" && hasConnection(row) && canManage
                ? () => setChannelsOpen(true)
                : undefined
            }
            onConnect={() => onConnect(row.provider)}
            // Reconnecting Slack starts a fresh connection server-side, which clears the routing —
            // say so first rather than let it vanish (WP-235).
            onReconnect={() =>
              row.provider === "slack" ? setConfirmReconnect(row) : onConnect(row.provider)
            }
            onDisconnect={() => setConfirmDisconnect({ provider: row.provider, label: row.label })}
          />
        ))}
      </div>

      <ConfirmDialog
        open={confirmDisconnect !== null}
        onOpenChange={(o) => !o && setConfirmDisconnect(null)}
        title={`Disconnect ${confirmDisconnect?.label ?? ""}?`}
        description={
          confirmDisconnect?.provider === "slack"
            ? "WorkPulse's access is revoked at Slack and notifications stop. Your channel routing is deleted too — connecting again starts from scratch."
            : `WorkPulse's access is revoked at ${confirmDisconnect?.label ?? "the provider"} and anything it sends there stops. Connecting again starts from scratch.`
        }
        confirmLabel="Disconnect"
        destructive
        busy={confirmDisconnect ? busy === confirmDisconnect.provider : false}
        onConfirm={async () => {
          if (!confirmDisconnect) return;
          await onDisconnect(confirmDisconnect.provider, confirmDisconnect.label);
          setConfirmDisconnect(null);
        }}
      />

      <Dialog
        open={confirmReconnect !== null}
        onOpenChange={(o) => !o && setConfirmReconnect(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reconnect {confirmReconnect?.label}?</DialogTitle>
            <DialogDescription>
              Reconnecting starts a new connection and clears your channel routing, so you&apos;ll
              need to choose the channels again afterwards. If Slack refused a message because of a
              channel, fix that channel in Channel routing instead — no reconnect needed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            {confirmReconnect && hasConnection(confirmReconnect) && canManage ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirmReconnect(null);
                  setChannelsOpen(true);
                }}
              >
                Open channel routing
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setConfirmReconnect(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const row = confirmReconnect;
                setConfirmReconnect(null);
                if (row) void onConnect(row.provider);
              }}
            >
              Reconnect
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
          {hasConnection(slack) ? <SlackRouting /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Providers the **frontend** does not show at all.
 *
 * Distinct from the old "Coming soon" treatment, which rendered the card blurred with an overlay:
 * a parked card still occupies the page and still invites the question "when?". Google Calendar is
 * hidden (2026-08-27) — Slack is the integration this product ships — except while an org still
 * holds a connection to it, when its card offers Disconnect only.
 *
 * A front-end gate only. `GET /v1/integrations` still lists it and the backend can still connect
 * it, so restoring the card is deleting one string; nothing server-side was removed.
 */
const HIDDEN_PROVIDERS = new Set<string>(["google_calendar"]);

function ProviderCard({
  row,
  canManage,
  busy,
  retired = false,
  onViewChannels,
  onConnect,
  onReconnect,
  onDisconnect,
}: {
  row: ApiIntegration;
  canManage: boolean;
  busy: boolean;
  /** A provider no longer offered ({@link HIDDEN_PROVIDERS}) but still connected: disconnect only. */
  retired?: boolean;
  /** When set (Slack, connected or errored), an eye button that opens the channel-routing dialog. */
  onViewChannels?: () => void;
  onConnect: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
}) {
  const connected = row.status === "connected";
  const errored = row.status === "error";
  // A personal connection is the user's own to make; an org-wide one is an admin action, because
  // connecting hands WorkPulse a credential to the whole company's workspace.
  const mayAct = row.org_wide ? canManage : true;

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
              {/* "Connected" even without an account label — Google's is always empty by design,
                  and a connected provider read "Not connected" (WP-471). */}
              <CardDescription className="mt-1">
                {connected
                  ? row.external_account
                    ? `Connected to ${row.external_account}`
                    : "Connected"
                  : errored
                    ? "Needs attention"
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
        ) : retired ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              This integration isn&apos;t offered any more. Disconnect it to revoke WorkPulse&apos;s
              access.
            </p>
            <Button variant="ghost" onClick={onDisconnect} disabled={busy}>
              <Unplug className="size-4" />
              Disconnect
            </Button>
          </div>
        ) : connected || errored ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onReconnect} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Reconnect
            </Button>
            <Button variant="ghost" onClick={onDisconnect} disabled={busy}>
              <Unplug className="size-4" />
              Disconnect
            </Button>
            {/* Opens the channel-routing dialog. Present for a Slack card with a connection. */}
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
// The same for "no default channel" — without it a default, once picked, could never be cleared in
// picker mode (WP-471).
const NO_DEFAULT = "__none__";

function SlackRouting() {
  const [config, setConfig] = useState<SlackConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [channels, setChannels] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadConfig = useCallback(() => {
    setLoadError(null);
    getSlackConfig()
      .then(setConfig)
      .catch((e) => {
        // Only a 404 means "connected, but never configured" — an empty editor. Any other failure
        // is a read that did not happen: showing the empty editor then let Save overwrite the org's
        // real routing with nothing (QA audit 2026-10-08, WP-069).
        if (e instanceof ApiError && e.status === 404) {
          setConfig({ default_channel: "", channels: {} });
        } else {
          setLoadError(e instanceof ApiError ? e.message : "Couldn't load the channel routing.");
        }
      });
  }, []);

  useEffect(() => {
    loadConfig();
    // The picker's whole reason to exist. If it fails (scope missing, transient), fall back to
    // free-text entry rather than blocking routing entirely.
    listSlackChannels()
      .then(setChannels)
      .catch(() => setChannels([]));
  }, [loadConfig]);

  if (loadError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <span className="min-w-0">{loadError}</span>
        <Button variant="outline" size="sm" className="shrink-0" onClick={loadConfig}>
          Retry
        </Button>
      </div>
    );
  }
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
              value={config.default_channel || NO_DEFAULT}
              onValueChange={(v) =>
                setConfig({ ...config, default_channel: v === NO_DEFAULT ? "" : (v as string) })
              }
            >
              <SelectTrigger id="default-channel" className="w-full sm:w-64">
                <SelectValue>
                  {(value) => (value === NO_DEFAULT ? "No default channel" : String(value ?? ""))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEFAULT}>No default channel</SelectItem>
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
