"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type * as MaplibreNS from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { initials } from "@/lib/format";
import type { GeoPoint } from "@/lib/mock-locations";
import { cn } from "@/lib/utils";

export type MarkerVariant =
  | "avatar"
  | "login"
  | "current"
  | "logout"
  | "default";

export interface MapMarker {
  id: string;
  point: GeoPoint;
  variant: MarkerVariant;
  avatarUrl?: string;
  name?: string;
  online?: boolean;
  onClick?: () => void;
}

/**
 * OpenFreeMap "Liberty" — a free, open-source, no-API-key vector basemap that
 * looks like Google Maps (streets, labels, landmarks). Swap this URL for a
 * MapTiler / Stadia style (with a key) for production reliability.
 */
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const PIN_COLOR: Record<MarkerVariant, string> = {
  avatar: "#4f46e5",
  login: "#16a34a",
  current: "#4f46e5",
  logout: "#6b7280",
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
      ? `<span style="position:absolute;bottom:-1px;right:-1px;width:10px;height:10px;border-radius:9999px;background:#16a34a;border:2px solid #fff"></span>`
      : "";
    return `<div style="position:relative;width:34px;height:34px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.35))">
      <div style="width:34px;height:34px;border-radius:9999px;overflow:hidden;border:2px solid #fff;background:#fff">${inner}</div>${dot}
    </div>`;
  }
  const color = PIN_COLOR[m.variant];
  const ring =
    m.variant === "current"
      ? `<span style="position:absolute;inset:-6px;border-radius:9999px;background:${color};opacity:.25"></span>`
      : "";
  return `<div style="position:relative;width:18px;height:18px;display:flex;align-items:center;justify-content:center">
    ${ring}<span style="position:relative;width:16px;height:16px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>
  </div>`;
}

/**
 * A real, interactive vector map (MapLibre GL + OpenFreeMap) with employee
 * avatars and location pins as HTML markers, a dashed trail line, and zoom/pan.
 * Loaded client-only (MapLibre touches `window`), so it never runs during SSR.
 */
export function LiveMap({
  markers,
  path,
  center,
  zoom,
  recenterKey,
  className,
}: {
  markers: MapMarker[];
  path?: GeoPoint[];
  center: GeoPoint;
  zoom: number;
  /** Change this to re-center the map (e.g. switching employee/day). */
  recenterKey?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreNS.Map | null>(null);
  const glRef = useRef<typeof MaplibreNS | null>(null);
  const markersRef = useRef<MaplibreNS.Marker[]>([]);
  const [ready, setReady] = useState(0);

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

  // (Re)draw markers + trail whenever they change (and once the map is ready).
  useEffect(() => {
    const gl = glRef.current;
    const map = mapRef.current;
    if (!gl || !map || !ready) return;

    // Markers
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

    // Trail line
    const data: GeoJSON.Feature = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: (path ?? []).map((p) => [p.lng, p.lat]),
      },
    };
    const src = map.getSource("trail") as MaplibreNS.GeoJSONSource | undefined;
    if (src) {
      src.setData(data);
    } else if ((path?.length ?? 0) > 1) {
      map.addSource("trail", { type: "geojson", data });
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
  }, [markers, path, ready]);

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
