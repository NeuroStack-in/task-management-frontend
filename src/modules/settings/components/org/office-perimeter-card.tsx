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

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { AddressSearch } from "./address-search";
import { LiveMap } from "@/modules/locations/components/live-map";
import { useGeofenceStore } from "@/stores/geofence.store";

export function OfficePerimeterSection() {
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

  const fence = { center, radiusM };

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="size-4 text-primary" /> Office perimeter
        </h3>
        <p className="text-muted-foreground text-sm">
          Everyone inside it reads as &ldquo;on-site&rdquo; on the
          Analytics&nbsp;&rarr;&nbsp;Locations map. It&apos;s a review aid only — being outside
          raises no alert.
        </p>
      </div>

      {/* Search is an ADDITION to the map, not a replacement: the pin stays draggable and the
          radius stays adjustable. Gated on the same permission as the rest of the perimeter — the
          server refuses the write from anyone else, so offering the control would be a lie. */}
      {canManage && showFence ? (
        <AddressSearch
          onPick={(r) => {
            setCenter({ lat: r.lat, lng: r.lng });
            // Placing by address implies intent to move the office, so open the edit mode the drag
            // path requires — otherwise the pin jumps and the Save button never appears.
            setEditing(true);
          }}
        />
      ) : null}

        <LiveMap
          markers={[]}
          geofence={showFence ? fence : null}
          editableCenter={canManage && showFence && editing}
          onCenterChange={setCenter}
          center={center}
          zoom={14}
          recenterKey="org-perimeter"
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
                <>
                  <Button
                    variant={editing ? "default" : "outline"}
                    size="sm"
                    className="h-7"
                    onClick={() => setEditing((v) => !v)}
                  >
                    {editing ? "Done" : "Move office"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7" onClick={reset}>
                    Reset
                  </Button>
                  {/* Explicit save, offered only when something changed — an org-wide autosave would
                      move everyone's on-site status on a stray drag. */}
                  {dirty ? (
                    <Button
                      size="sm"
                      className="h-7"
                      disabled={saving}
                      onClick={() => void save().then((ok) => ok && setEditing(false))}
                    >
                      {saving ? "Saving…" : "Save perimeter"}
                    </Button>
                  ) : null}
                </>
              ) : null}

              {error ? <span className="text-destructive">{error}</span> : null}
            </>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {canManage
            ? "Turn on “Move office”, drag the 🏢 pin (or click the map) to place your office, size it with the slider, then Save. The change applies org-wide and appears on the Analytics Locations map."
            : "You can view the office perimeter here; changing it needs the monitoring-manage permission."}
        </p>
    </div>
  );
}
