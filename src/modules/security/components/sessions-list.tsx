"use client";

/**
 * Your signed-in browsers (`GET /v1/me/sessions`) — UX audit SET-18.
 *
 * It listed every row the same way: "Chrome on Windows" nine times over, each with a raw device id,
 * and "This device" put on the newest row whenever this browser's id wasn't found. Now each row says
 * when it was last active (relative and exact), the ids are gone, "This device" appears only on the
 * row whose id this browser holds, and the five most recent show with the rest one click away.
 *
 * **Ending sessions.** One browser can't be signed out on its own — Cognito revokes per account — so
 * the control is "Sign out everywhere" (`POST /v1/me/sessions/sign-out-everywhere`), which says
 * plainly that it signs this browser out too. Location isn't recorded: the row's `ip` field exists on
 * the server's shape but nothing writes it, so it shows only if it ever arrives.
 *
 * Rendered on Login & security (`/settings/login-security#sessions`) — personal sign-in security
 * lives there for every role; Settings → Security is organisation-only (UX audit SET-08).
 */
import { useState } from "react";
import { LogOut, Monitor } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { friendlyError } from "@/lib/errors";
import { useAuthStore } from "@/stores/auth.store";
import { signOutEverywhere } from "../services/security.service";
import { useDeviceId } from "@/hooks/use-device-id";
import { formatDateTime } from "@/lib/format";
import { useSessions } from "../use-sessions";
import { orderSessions, sessionLabel, SESSIONS_SHOWN } from "../lib/sessions";

/** Epoch ms → a short relative label. */
function timeAgo(ms: number | null): string {
  if (!ms) return "never";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function SessionsList() {
  const { sessions, loading, error, reload } = useSessions();
  const deviceId = useDeviceId();
  const [showAll, setShowAll] = useState(false);
  const logout = useAuthStore((s) => s.logout);
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (loading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Loading sessions…</p>;
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }
  if (sessions.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">No active sessions recorded.</p>
    );
  }

  const rows = orderSessions(sessions, deviceId);
  const shown = showAll ? rows : rows.slice(0, SESSIONS_SHOWN);
  const thisListed = rows.some((r) => r.isThisDevice);

  return (
    <div className="space-y-2.5">
      <ul className="space-y-2.5">
        {shown.map(({ session: s, isThisDevice }) => (
          <li
            key={s.session_id}
            className="flex items-center gap-3 rounded-lg border border-border p-3"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Monitor className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium">
                {sessionLabel(s)}
                {isThisDevice ? (
                  <span className="rounded-full bg-success/12 px-1.5 py-0.5 text-[10px] font-medium text-success">
                    This device
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {isThisDevice ? "Active now" : `Last active ${timeAgo(s.last_seen)}`}
                {s.last_seen && !isThisDevice ? ` · ${formatDateTime(s.last_seen)}` : ""}
                {s.created_at ? ` · first seen ${formatDateTime(s.created_at)}` : ""}
                {s.ip ? ` · ${s.ip}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {rows.length > SESSIONS_SHOWN ? (
        <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show the 5 most recent" : `Show all ${rows.length}`}
        </Button>
      ) : null}
      {deviceId && !thisListed ? (
        <p className="text-xs text-muted-foreground">
          This browser isn&apos;t in the list yet — it&apos;s added when it next checks in.
        </p>
      ) : null}
      {/* A lost laptop or a shared computer: the one way to end the other sessions. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="text-xs text-muted-foreground">
          Don&apos;t recognise a device? Sign out everywhere and change your password.
        </p>
        <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
          <LogOut className="size-4" /> Sign out everywhere
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(o) => !o && setConfirming(false)}
        title="Sign out everywhere?"
        description="Every browser and device signed in to your account is signed out — this one included. You sign in again here straight after."
        confirmLabel="Sign out everywhere"
        destructive
        busy={signingOut}
        onConfirm={async () => {
          setSigningOut(true);
          try {
            await signOutEverywhere();
            toast.success("Signed out everywhere", {
              description: "Sign in again to continue.",
            });
            logout();
          } catch (e) {
            toast.error(friendlyError(e, "Couldn't sign out everywhere."));
            setSigningOut(false);
            setConfirming(false);
          }
        }}
      />
    </div>
  );
}
