"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type * as MaplibreNS from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { initials } from "@/lib/format";
import type { GeoPoint, Geofence } from "@/modules/locations/types";
import { cn } from "@/lib/utils";

export type MarkerVariant =
  | "avatar"
  | "login"
  | "current"
  | "logout"
  | "moment"
  | "default";

export interface MapMarker {
  id: string;
  point: GeoPoint;
  variant: MarkerVariant;
  avatarUrl?: string;
  name?: string;
  online?: boolean;
  /** Draw a warning (red) ring — e.g. outside the perimeter. */
  alert?: boolean;
  onClick?: () => void;
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const PIN_COLOR: Record<MarkerVariant, string> = {
  avatar: "#4f46e5",
  login: "#16a34a",
  current: "#4f46e5",
  logout: "#6b7280",
  moment: "#d97706",
  default: "#4f46e5",
};

function escapeAttr(s: string) {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function markerHtml(m: MapMarker): string {
  if (m.variant === "avatar") {
    const inner = m.avatarUrl
      ? `<img src="${escapeAttr(m.avatarUrl)}" style="width:100%;height:100%;object-fit:cover" alt="" />`
      : `<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:11px;font-weight:600;background:#e2e8f0;color:#334155">${initials(m.name ?? "")}</span>`;
    const dot = m.online
      ? `<span style="position:absolute;bottom:-1px;right:-1px;width:10px;height:10px;border-radius:9999px;background:${m.alert ? "#dc2626" : "#16a34a"};border:2px solid #fff"></span>`
      : "";
    const ringColor = m.alert ? "#dc2626" : "#fff";
    const halo = m.alert ? "box-shadow:0 0 0 2px #dc2626;" : "";
    return `<div style="position:relative;width:34px;height:34px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.35))">
      <div style="width:34px;height:34px;border-radius:9999px;overflow:hidden;border:2px solid ${ringColor};background:#fff;${halo}">${inner}</div>${dot}
    </div>`;
  }
  const color = PIN_COLOR[m.variant];
  const big = m.variant === "moment";
  const size = big ? 22 : 18;
  const inner = big ? 18 : 16;
  const ring =
    m.variant === "current" || big
      ? `<span style="position:absolute;inset:-6px;border-radius:9999px;background:${color};opacity:.25"></span>`
      : "";
  return `<div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">
    ${ring}<span style="position:relative;width:${inner}px;height:${inner}px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>
  </div>`;
}

/** The geofence center marker (office pin), optionally draggable in edit mode. */
function centerHtml(editable: boolean): string {
  return `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:30px;height:30px">
    <span style="position:absolute;inset:0;border-radius:9999px;background:#4f46e5;opacity:.18"></span>
    <span style="position:relative;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:#4f46e5;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);font-size:12px">🏢</span>
    ${
      editable
        ? `<span style="position:absolute;top:-16px;white-space:nowrap;font-size:10px;font-weight:600;color:#fff;background:#4f46e5;padding:1px 6px;border-radius:6px;box-shadow:0 1px 2px rgba(0,0,0,.25)">drag to move</span>`
        : ""
    }
  </div>`;
}

/** Polygon ring approximating a circle of `radiusM` around `center`. */
function circleRing(center: GeoPoint, radiusM: number, steps = 72): number[][] {
  const coords: number[][] = [];
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([center.lng + dLng * Math.cos(a), center.lat + dLat * Math.sin(a)]);
  }
  return coords;
}

/**
 * Interactive vector map (MapLibre GL + OpenFreeMap) with employee avatars,
 * location pins, a dashed trail, and an optional geofence perimeter circle.
 * Client-only (MapLibre touches `window`), so it never runs during SSR.
 */
export function LiveMap({
  markers,
  path,
  geofence,
  editableCenter,
  onCenterChange,
  center,
  zoom,
  recenterKey,
  className,
}: {
  markers: MapMarker[];
  path?: GeoPoint[];
  geofence?: Geofence | null;
  /** Show the office pin as draggable + let a map click reposition it. */
  editableCenter?: boolean;
  onCenterChange?: (p: GeoPoint) => void;
  center: GeoPoint;
  zoom: number;
  recenterKey?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreNS.Map | null>(null);
  const glRef = useRef<typeof MaplibreNS | null>(null);
  const markersRef = useRef<MaplibreNS.Marker[]>([]);
  const centerMarkerRef = useRef<MaplibreNS.Marker | null>(null);
  const [ready, setReady] = useState(0);

  const geoKey = geofence
    ? `${geofence.center.lat.toFixed(5)},${geofence.center.lng.toFixed(5)},${geofence.radiusM}`
    : "";

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const gl = await import("maplibre-gl");
      if (cancelled || !containerRef.current || mapRef.current) return;
      glRef.current = gl;
      const map = new gl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [center.lng, center.lat],
        zoom,
        attributionControl: { compact: true },
      });
      map.addControl(new gl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        map.resize();
        setReady((r) => r + 1);
      });
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-center when the key changes.
  useEffect(() => {
    mapRef.current?.flyTo({ center: [center.lng, center.lat], zoom, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  // (Re)draw geofence, trail, and markers.
  useEffect(() => {
    const gl = glRef.current;
    const map = mapRef.current;
    if (!gl || !map || !ready) return;

    // Geofence perimeter (drawn first so it sits under the trail/markers).
    const fillId = "geofence-fill";
    const lineId = "geofence-line";
    if (geofence) {
      const data: GeoJSON.Feature = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [circleRing(geofence.center, geofence.radiusM)],
        },
      };
      const src = map.getSource("geofence") as MaplibreNS.GeoJSONSource | undefined;
      if (src) {
        src.setData(data);
      } else {
        map.addSource("geofence", { type: "geojson", data });
        map.addLayer({
          id: fillId,
          type: "fill",
          source: "geofence",
          paint: { "fill-color": "#4f46e5", "fill-opacity": 0.1 },
        });
        map.addLayer({
          id: lineId,
          type: "line",
          source: "geofence",
          paint: { "line-color": "#4f46e5", "line-width": 2, "line-dasharray": [2, 2] },
        });
      }
    } else {
      if (map.getLayer(fillId)) map.removeLayer(fillId);
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getSource("geofence")) map.removeSource("geofence");
    }

    // Trail line.
    const trailData: GeoJSON.Feature = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: (path ?? []).map((p) => [p.lng, p.lat]),
      },
    };
    const tsrc = map.getSource("trail") as MaplibreNS.GeoJSONSource | undefined;
    if (tsrc) {
      tsrc.setData(trailData);
    } else if ((path?.length ?? 0) > 1) {
      map.addSource("trail", { type: "geojson", data: trailData });
      map.addLayer({
        id: "trail",
        type: "line",
        source: "trail",
        paint: {
          "line-color": "#4f46e5",
          "line-width": 3,
          "line-dasharray": [2, 2],
          "line-opacity": 0.8,
        },
      });
    }

    // Markers.
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = markers.map((m) => {
      const el = document.createElement("div");
      el.innerHTML = markerHtml(m);
      if (m.name) el.title = m.name;
      if (m.onClick) {
        el.style.cursor = "pointer";
        el.addEventListener("click", m.onClick);
      }
      return new gl.Marker({ element: el })
        .setLngLat([m.point.lng, m.point.lat])
        .addTo(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, path, ready, geoKey]);

  // Geofence center marker (office pin) + click-to-place when editing.
  useEffect(() => {
    const gl = glRef.current;
    const map = mapRef.current;
    if (!gl || !map || !ready) return;

    centerMarkerRef.current?.remove();
    centerMarkerRef.current = null;
    if (geofence) {
      const el = document.createElement("div");
      el.innerHTML = centerHtml(!!editableCenter);
      el.style.cursor = editableCenter ? "move" : "default";
      const mk = new gl.Marker({ element: el, draggable: !!editableCenter })
        .setLngLat([geofence.center.lng, geofence.center.lat])
        .addTo(map);
      if (editableCenter && onCenterChange) {
        mk.on("dragend", () => {
          const l = mk.getLngLat();
          onCenterChange({ lat: l.lat, lng: l.lng });
        });
      }
      centerMarkerRef.current = mk;
    }

    const onClick = (e: MaplibreNS.MapMouseEvent) =>
      onCenterChange?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    if (editableCenter && onCenterChange) map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, geoKey, editableCenter]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative z-0 aspect-[5/2] w-full overflow-hidden rounded-2xl border",
        className,
      )}
    />
  );
}
