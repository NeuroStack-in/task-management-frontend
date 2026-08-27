"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth.store";
import { ApiError } from "@/lib/api";
import { provisionMyOrg } from "../services/onboarding.service";

const SIZES = ["1–10", "11–50", "51–200", "201–500", "500+"];

/**
 * Shown to a signed-in user who has **no organization yet** — the "Continue with Google" self-signup
 * path. Names their organization, provisions it (they become Owner), then force-refreshes the token
 * so the new claims take effect and drops them on the dashboard.
 */
export function OnboardingProvision() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshClaims = useAuthStore((s) => s.refreshClaims);

  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = orgName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      let timezone: string | undefined;
      try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
      } catch {
        timezone = undefined;
      }
      await provisionMyOrg({
        org_name: name,
        owner_name: user?.name || undefined,
        industry: industry.trim() || undefined,
        size: size || undefined,
        timezone,
      });
      // The server stamped custom:orgId/roleId; the cached token predates it — re-mint so the owner
      // claims are live, then enter the app.
      await refreshClaims();
      router.replace("/dashboard");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Couldn't create your organization. Please try again.",
      );
      setBusy(false);
    }
  };

  return (
    <div className="bg-card shadow-soft w-full max-w-md rounded-2xl border p-8">
      <div className="mb-6 space-y-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Name your organization
        </h1>
        <p className="text-muted-foreground text-sm">
          {user?.email ? (
            <>
              You&apos;re signed in as{" "}
              <span className="text-foreground font-medium">{user.email}</span>. Set up your
              workspace to get started — you can change any of this later in Settings.
            </>
          ) : (
            "Set up your workspace to get started — you can change any of this later in Settings."
          )}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="org-name">Organization name</Label>
          <Input
            id="org-name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Inc."
            maxLength={100}
            autoFocus
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-industry">
              Industry <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="org-industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Technology"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-size">
              Team size <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <select
              id="org-size"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select…</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={!orgName.trim() || busy}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Creating your workspace…
            </>
          ) : (
            "Create organization"
          )}
        </Button>
      </form>
    </div>
  );
}
