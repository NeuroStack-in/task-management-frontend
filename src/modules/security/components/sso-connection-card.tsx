"use client";

/**
 * Enterprise SSO configuration — the real admin surface (replaces the "not available" stub).
 *
 * Flow: pick SAML or OIDC and save the connection (provisions a per-org Cognito IdP) → add each
 * email domain that should route to it and publish the DNS-TXT challenge we show → Verify → Enable.
 * Once enabled with a verified domain, users on that domain are routed to this IdP at login
 * (email-first discovery). Gated server-side on SecurityManage; the UI mirrors that.
 */
import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Copy, Check, Loader2, Trash2, Globe } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import { usePermissions } from "@/hooks/use-permissions";
import {
  listConnections,
  putConnection,
  deleteConnection,
  registerDomain,
  verifyDomain,
  type SsoConnection,
  type DomainChallenge,
} from "../services/sso-admin.service";

function msg(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.status === 403) return "You don't have permission to configure SSO.";
    if (e.status === 409) return "That domain is already claimed by another organization.";
    return e.message || fallback;
  }
  return fallback;
}

export function SsoConnectionCard() {
  const { can } = usePermissions();
  const canManage = can("security:manage");

  const [conn, setConn] = useState<SsoConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    listConnections()
      .then((r) => setConn(r.connections[0] ?? null))
      .catch((e) => setError(msg(e, "Couldn't load SSO settings.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  if (loading) {
    return (
      <Card id="sso" className="scroll-mt-24">
        <CardContent className="flex min-h-[8rem] items-center justify-center">
          <Loader label="Loading SSO…" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="sso" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Single Sign-On (SSO)
          <StatusBadge conn={conn} />
        </CardTitle>
        <CardDescription>
          Let members sign in through your identity provider (SAML / OIDC). Users on a verified
          domain are routed to your IdP automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <p className="rounded-md border border-border bg-muted px-4 py-2.5 text-sm text-muted-foreground">
            {error}
          </p>
        ) : null}

        {conn ? (
          <ConnectionManager conn={conn} canManage={canManage} onChange={reload} />
        ) : (
          <NewConnectionForm canManage={canManage} onCreated={reload} />
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ conn }: { conn: SsoConnection | null }) {
  if (!conn) {
    return (
      <Badge variant="secondary" className="font-normal text-muted-foreground">
        Not configured
      </Badge>
    );
  }
  const enabled = conn.status === "enabled";
  return (
    <Badge className={enabled ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"}>
      {enabled ? "Enabled" : conn.status === "draft" ? "Draft" : "Disabled"}
    </Badge>
  );
}

// ── Create a new connection ──

function NewConnectionForm({
  canManage,
  onCreated,
}: {
  canManage: boolean;
  onCreated: () => void;
}) {
  const [protocol, setProtocol] = useState<"saml" | "oidc">("saml");
  const [metadata, setMetadata] = useState("");
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await putConnection({
        protocol,
        metadata: protocol === "saml" ? metadata : undefined,
        issuer: protocol === "oidc" ? issuer : undefined,
        client_id: protocol === "oidc" ? clientId : undefined,
        client_secret: protocol === "oidc" ? clientSecret : undefined,
        enabled: false, // draft first; enable after a domain is verified
        version: 0,
      });
      toast.success("SSO connection saved. Add and verify a domain, then enable it.");
      onCreated();
    } catch (e) {
      toast.error(msg(e, "Couldn't save the connection."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Protocol</Label>
        <Select
          value={protocol}
          onValueChange={(v) => setProtocol(v as "saml" | "oidc")}
          items={{ saml: "SAML 2.0", oidc: "OIDC" }}
        >
          <SelectTrigger className="sm:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="saml">SAML 2.0</SelectItem>
            <SelectItem value="oidc">OIDC</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {protocol === "saml" ? (
        <div className="space-y-1.5">
          <Label htmlFor="sso-metadata">Metadata URL or XML</Label>
          <Input
            id="sso-metadata"
            value={metadata}
            onChange={(e) => setMetadata(e.target.value)}
            placeholder="https://idp.example.com/metadata.xml"
            disabled={!canManage}
          />
          <p className="text-xs text-muted-foreground">
            Paste your IdP&apos;s metadata URL, or the full metadata XML.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sso-issuer">Issuer URL</Label>
            <Input
              id="sso-issuer"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="https://idp.example.com"
              disabled={!canManage}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sso-client-id">Client ID</Label>
            <Input
              id="sso-client-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={!canManage}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sso-client-secret">Client secret</Label>
            <Input
              id="sso-client-secret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              disabled={!canManage}
            />
          </div>
        </div>
      )}

      <Button onClick={save} disabled={!canManage || saving}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
        Save connection
      </Button>
    </div>
  );
}

// ── Manage an existing connection ──

function ConnectionManager({
  conn,
  canManage,
  onChange,
}: {
  conn: SsoConnection;
  canManage: boolean;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const toggleEnabled = async () => {
    setBusy(true);
    try {
      await putConnection({
        protocol: conn.protocol,
        enabled: conn.status !== "enabled",
        enforced: conn.enforced, // preserve — a bare put would reset it
        version: conn.version,
      });
      toast.success(conn.status === "enabled" ? "SSO disabled." : "SSO enabled.");
      onChange();
    } catch (e) {
      toast.error(msg(e, "Couldn't update the connection."));
    } finally {
      setBusy(false);
    }
  };

  const toggleEnforced = async () => {
    setBusy(true);
    try {
      await putConnection({
        protocol: conn.protocol,
        enabled: conn.status === "enabled",
        enforced: !conn.enforced,
        version: conn.version,
      });
      toast.success(conn.enforced ? "SSO no longer required." : "SSO now required for your domains.");
      onChange();
    } catch (e) {
      toast.error(msg(e, "Couldn't update the connection."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteConnection(conn.protocol);
      toast.success("SSO connection removed.");
      onChange();
    } catch (e) {
      toast.error(msg(e, "Couldn't remove the connection."));
    } finally {
      setBusy(false);
    }
  };

  const canEnable = conn.domains.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium uppercase">{conn.protocol}</p>
          <p className="text-xs text-muted-foreground">
            IdP: <span className="font-mono">{conn.cognito_idp_name}</span>
            {conn.issuer ? ` · ${conn.issuer}` : ""}
          </p>
          <CertExpiry expires={conn.cert_expires} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={conn.status === "enabled" ? "outline" : "default"}
            size="sm"
            onClick={toggleEnabled}
            disabled={!canManage || busy || (conn.status !== "enabled" && !canEnable)}
            title={!canEnable ? "Verify a domain before enabling" : undefined}
          >
            {conn.status === "enabled" ? "Disable" : "Enable"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={remove}
            disabled={!canManage || busy}
            aria-label="Remove SSO connection"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Require SSO</p>
          <p className="text-xs text-muted-foreground">
            Block password sign-in for your verified domains — members must use the IdP.
          </p>
        </div>
        <Switch
          checked={conn.enforced}
          disabled={!canManage || busy}
          onCheckedChange={toggleEnforced}
          aria-label="Require SSO for verified domains"
        />
      </div>

      <DomainSection conn={conn} canManage={canManage} onChange={onChange} />
    </div>
  );
}

// ── Domains + DNS-TXT verification ──

function DomainSection({
  conn,
  canManage,
  onChange,
}: {
  conn: SsoConnection;
  canManage: boolean;
  onChange: () => void;
}) {
  const [domain, setDomain] = useState("");
  const [challenge, setChallenge] = useState<DomainChallenge | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!domain.trim()) return;
    setBusy(true);
    try {
      const c = await registerDomain(conn.protocol, domain.trim());
      setChallenge(c);
      if (c.verified) {
        toast.success("Domain already verified.");
        onChange();
      } else {
        toast.info("Add the DNS TXT record below, then click Verify.");
      }
    } catch (e) {
      toast.error(msg(e, "Couldn't register that domain."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!challenge) return;
    setBusy(true);
    try {
      const c = await verifyDomain(challenge.domain);
      setChallenge(c);
      if (c.verified) {
        toast.success(`${c.domain} verified.`);
        setChallenge(null);
        setDomain("");
        onChange();
      } else {
        toast.error("TXT record not found yet. DNS can take a few minutes to propagate.");
      }
    } catch (e) {
      toast.error(msg(e, "Verification failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium">Verified domains</p>
      </div>

      {conn.domains.length ? (
        <ul className="space-y-1.5">
          {conn.domains.map((d) => (
            <li
              key={d}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <Check className="size-4 text-success" />
              {d}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No verified domains yet — add one to route its users to your IdP.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="sso-domain">Add a domain</Label>
          <Input
            id="sso-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            disabled={!canManage || busy}
          />
        </div>
        <Button onClick={add} disabled={!canManage || busy || !domain.trim()}>
          {busy && !challenge ? <Loader2 className="size-4 animate-spin" /> : null}
          Add
        </Button>
      </div>

      {challenge && !challenge.verified ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">
            Create this DNS <span className="font-medium">TXT</span> record at your domain
            registrar, then verify:
          </p>
          <CopyRow label="Name" value={challenge.txt_name} />
          <CopyRow label="Value" value={challenge.txt_value} />
          <Button size="sm" onClick={verify} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Verify domain
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CertExpiry({ expires }: { expires?: number }) {
  if (!expires) return null;
  const days = Math.floor((expires * 1000 - Date.now()) / 86_400_000);
  const date = new Date(expires * 1000).toLocaleDateString();
  const tone =
    days <= 0 ? "text-negative" : days <= 30 ? "text-warning" : "text-muted-foreground";
  const label =
    days <= 0 ? `Certificate expired ${date}` : `Certificate expires ${date} (${days}d)`;
  return <p className={`text-xs ${tone}`}>{label}</p>;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
      <div className="min-w-0">
        <span className="mr-2 text-[10px] uppercase text-muted-foreground">{label}</span>
        <span className="break-all font-mono text-xs">{value}</span>
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          toast.success(`${label} copied`);
        }}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        aria-label={`Copy ${label}`}
      >
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}
