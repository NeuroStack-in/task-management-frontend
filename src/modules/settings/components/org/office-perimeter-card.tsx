"use client";

/**
 * Org → Locations: the interactive **office perimeter** editor.
 *
 * The perimeter is one org-wide circle (center + radius), server-backed via `useGeofenceStore`
 * (`GET/PUT /v1/org/geofence`). It is the SAME store the Analytics → Locations board reads, so a
 * perimeter set here shows up there automatically — no duplicate state, no second source of truth.
 *
 * Editing is a mode (drag the 🏢 pin only in "Move office"), and the write is explicit (Save), so
 * an admin doesn't move every colleague's on-site/off-site status by accident. Visual only — being
 * outside the perimeter raises no alert (owner decision).
 */

import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { useCardGuard } from "../../lib/card-guard";
import { CardSaveFooter } from "../save-footer";
import { LiveMap } from "@/modules/locations/components/live-map";
import { useGeofenceStore } from "@/stores/geofence.store";

export function OfficePerimeterCard() {
  const { can } = usePermissions();
  // The write route is `PUT /v1/org/geofence`, which the server gates on `monitoring:manage`
  // (not `settings:manage`) — mirror that here so the controls only enable for users the
  // backend will actually accept. See `geofence.store.ts` and the help text below.
  const canManage = can("monitoring:manage");

  const {
    center,
    radiusM,
    enabled: showFence,
    setCenter,
    setRadius,
    setEnabled,
    reset,
    dirty,
    saved,
    saving,
    error,
    load,
    save,
  } = useGeofenceStore();
  const [editing, setEditing] = useState(false);

  // Org-wide config, not per-date data — load once.
  useEffect(() => {
    void load();
  }, [load]);

  // Its own Save, so its own guard (WP-347). Unsaved perimeter edits live in the shared store and
  // survive moving around the app (the Save stays up when you come back), so only closing or
  // reloading the tab — which does lose them — asks first.
  useCardGuard(canManage && dirty, { keptOnLeave: true });

  const fence = { center, radiusM };

  // Frame the org's **saved** office once it has loaded (and again after a save). The map is created
  // before the read lands, so it opened on the placeholder centre and never moved: an org elsewhere
  // saw an empty street map, and "Move office" there put the office in the wrong city
  // (QA audit 2026-10-08, WP-354). Keyed on the saved centre, so dragging the pin never re-frames.
  const officePoints = useMemo(() => (saved ? [saved.center] : undefined), [saved]);
  const officeKey = saved ? `${saved.center.lat},${saved.center.lng}` : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" /> Office perimeter
        </CardTitle>
        <CardDescription>
          Set your office location and radius on the map. Everyone inside it reads as
          &ldquo;on-site&rdquo; on the Analytics&nbsp;&rarr;&nbsp;Locations map. It&apos;s a review
          aid only — being outside raises no alert.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <LiveMap
          markers={[]}
          geofence={showFence ? fence : null}
          editableCenter={canManage && showFence && editing}
          onCenterChange={setCenter}
          center={center}
          zoom={14}
          fitPoints={officePoints}
          fitKey={officeKey}
        />

        {/* Perimeter controls */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <label className="flex items-center gap-1.5 font-medium">
            <input
              type="checkbox"
              checked={showFence}
              disabled={!canManage}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-3.5"
              style={{ accentColor: "var(--primary)" }}
            />
            Enable perimeter
          </label>

          {showFence ? (
            <>
              <input
                type="range"
                min={100}
                max={2000}
                step={50}
                value={radiusM}
                disabled={!canManage}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-40"
                style={{ accentColor: "var(--primary)" }}
                aria-label="Perimeter radius"
              />
              <span className="tabular-nums text-muted-foreground">{radiusM} m radius</span>

              {canManage ? (
                <Button
                  variant={editing ? "default" : "outline"}
                  size="sm"
                  className="h-7"
                  onClick={() => setEditing((v) => !v)}
                >
                  {editing ? "Done" : "Move office"}
                </Button>
              ) : null}
            </>
          ) : null}

          {error ? <span className="text-destructive">{error}</span> : null}
        </div>

        {/* Explicit save, offered only when something changed — an org-wide autosave would move
            everyone's on-site status on a stray drag. Shown whenever there are edits, the off switch
            included: with Save inside the enabled-only controls it vanished the moment the box was
            cleared, so turning the perimeter off could never be saved (QA audit 2026-10-08, WP-101).
            Cancel goes back to the saved perimeter, not the shipped placeholder (WP-535). The same
            footer as every other organization card (UX audit XC-11). */}
        <CardSaveFooter
          dirty={canManage && dirty}
          saving={saving}
          onSave={() => void save().then((ok) => ok && setEditing(false))}
          onCancel={() => {
            reset();
            setEditing(false);
          }}
          saveLabel="Save perimeter"
        />

        <p className="text-xs text-muted-foreground">
          {canManage
            ? "Turn on “Move office”, drag the 🏢 pin (or click the map) to place your office, size it with the slider, then Save. The change applies to the whole organization and appears on the Analytics Locations map."
            : "You can view the office perimeter here; changing it needs the Manage monitoring settings permission."}
        </p>
      </CardContent>
    </Card>
  );
}
