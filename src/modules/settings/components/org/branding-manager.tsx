"use client";

/**
 * Branding — the org's visual identity on the **live backend** (`GET`/`PATCH /v1/org/branding`).
 *
 * A singleton (one row per org), so this loads once on mount and PATCHes the whole editable set.
 * Read is open to any member; the save is `settings:manage`-gated server-side (403 → toast).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/shared/loader";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api";
import {
  getBranding,
  updateBranding,
  type OrgBranding,
} from "@/modules/settings/services/org.service";

interface BrandingForm {
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
}

const EMPTY: BrandingForm = { logoUrl: "", primaryColor: "", accentColor: "" };

function formFrom(v: OrgBranding): BrandingForm {
  return {
    logoUrl: v.logo_url ?? "",
    primaryColor: v.primary_color ?? "",
    accentColor: v.accent_color ?? "",
  };
}

function messageOf(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

/** A hex color that CSS can render, else undefined (so we don't paint a broken swatch). */
function swatch(value: string): string | undefined {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : undefined;
}

export function BrandingManager() {
  const { can } = usePermissions();
  const canManage = can("settings:manage");

  const [saved, setSaved] = useState<BrandingForm>(EMPTY);
  const [draft, setDraft] = useState<BrandingForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getBranding()
      .then((v) => {
        if (!alive) return;
        const f = formFrom(v);
        setSaved(f);
        setDraft(f);
      })
      .catch((e) => {
        if (!alive) return;
        // 404 = branding not set yet; start from empty, editable form.
        if (e instanceof ApiError && e.status === 404) return;
        setError(messageOf(e, "Couldn't load branding."));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const update = (patch: Partial<BrandingForm>) => setDraft((d) => ({ ...d, ...patch }));

  async function save() {
    if (!dirty || saving) return;
    const body: OrgBranding = {
      logo_url: draft.logoUrl.trim() || undefined,
      primary_color: draft.primaryColor.trim() || undefined,
      accent_color: draft.accentColor.trim() || undefined,
    };
    setSaving(true);
    try {
      const v = await updateBranding(body);
      const f = formFrom(v);
      setSaved(f);
      setDraft(f);
      toast.success("Branding saved");
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to change branding.");
      } else {
        toast.error(messageOf(e, "Couldn't save branding."));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>
          Your logo and brand colors, used across the platform and in exported reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex min-h-[8rem] items-center justify-center">
            <Loader label="Loading branding…" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <>
            <div className="grid content-start gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Logo URL</Label>
                <div className="flex items-center gap-3">
                  {swatch(draft.primaryColor) || draft.logoUrl.trim() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={draft.logoUrl.trim() || undefined}
                      alt=""
                      className="size-9 shrink-0 rounded-md border border-border object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                  ) : null}
                  <Input
                    type="url"
                    value={draft.logoUrl}
                    disabled={!canManage}
                    placeholder="https://cdn.example.com/logo.png"
                    onChange={(e) => update({ logoUrl: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Primary color</Label>
                <div className="flex items-center gap-2">
                  <span
                    className="size-8 shrink-0 rounded-md border border-border"
                    style={{ background: swatch(draft.primaryColor) ?? "transparent" }}
                    aria-hidden
                  />
                  <Input
                    value={draft.primaryColor}
                    disabled={!canManage}
                    placeholder="#4f46e5"
                    onChange={(e) => update({ primaryColor: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Accent color</Label>
                <div className="flex items-center gap-2">
                  <span
                    className="size-8 shrink-0 rounded-md border border-border"
                    style={{ background: swatch(draft.accentColor) ?? "transparent" }}
                    aria-hidden
                  />
                  <Input
                    value={draft.accentColor}
                    disabled={!canManage}
                    placeholder="#a855f7"
                    onChange={(e) => update({ accentColor: e.target.value })}
                  />
                </div>
              </div>
            </div>
            {canManage ? (
              <div className="flex justify-end">
                <Button onClick={save} disabled={!dirty || saving}>
                  {saving ? "Saving…" : "Save branding"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
