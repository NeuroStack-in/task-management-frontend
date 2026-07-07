/**
 * Deterministic mock data for the Employee Location tracker (admin monitoring).
 * Phase 1 is frontend-only — these are simulated GPS pings, not real telemetry.
 *
 * Design intent: the data carries REAL `{lat, lng}` coordinates and is rendered
 * through a projection into a self-contained SVG map. When a backend + a maps
 * provider land later, the SVG backdrop can be swapped for a tile map
 * (react-leaflet / Mapbox) reading these same points — nothing else changes.
 *
 * Server-safe: no `Date.now()` / `Math.random()`. Login / logout times are
 * pulled from the attendance mock so the two features agree.
 */
import { users } from "@/lib/data";
import type { User } from "@/types/user";
import { TODAY, dayRecordFor, isFutureDate, MONTH_NAMES } from "@/lib/mock-attendance";

/* --------------------------------- geo ---------------------------------- */

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** The city the sample workforce is monitored in, with a padded bounding box. */
export const CITY = {
  name: "Chennai",
  bounds: { minLat: 12.9, maxLat: 13.15, minLng: 80.1, maxLng: 80.31 },
};

export interface Area {
  area: string;
  label: string;
  point: GeoPoint;
}

/** The company office — everyone in-office is here (Thoraipakkam, OMR). */
export const OFFICE: Area = {
  area: "Thoraipakkam",
  label: "WorkPulse HQ, Thoraipakkam (OMR)",
  point: { lat: 12.9424, lng: 80.2411 },
};

/** Residential areas remote employees work from. */
export const AREAS: Area[] = [
  { area: "Ambattur", label: "Ambattur Industrial Estate", point: { lat: 13.098, lng: 80.161 } },
  { area: "Anna Nagar", label: "Anna Nagar", point: { lat: 13.085, lng: 80.21 } },
  { area: "Egmore", label: "Egmore", point: { lat: 13.078, lng: 80.261 } },
  { area: "Porur", label: "Porur", point: { lat: 13.038, lng: 80.157 } },
  { area: "T. Nagar", label: "T. Nagar", point: { lat: 13.04, lng: 80.234 } },
  { area: "Guindy", label: "Guindy", point: { lat: 13.008, lng: 80.212 } },
  { area: "Adyar", label: "Adyar", point: { lat: 13.006, lng: 80.257 } },
  { area: "Velachery", label: "Velachery", point: { lat: 12.979, lng: 80.221 } },
  { area: "Perungudi", label: "Perungudi, OMR", point: { lat: 12.965, lng: 80.243 } },
  { area: "Tambaram", label: "Tambaram", point: { lat: 12.925, lng: 80.127 } },
];

/** Look up an area (office or residential) by name. */
export function areaByName(name: string): Area | undefined {
  return name === OFFICE.area ? OFFICE : AREAS.find((a) => a.area === name);
}

/** Modern devices with built-in GPS (locatable). */
const GPS_DEVICES = [
  "iPhone 14 Pro",
  "Samsung Galaxy S23",
  'MacBook Pro 14"',
  "Dell Latitude 5540",
  "Lenovo ThinkPad X1 Carbon",
  "Google Pixel 8",
];

/** Older devices with NO built-in GPS — location can't be tracked. */
const NO_GPS_DEVICES = [
  "HP Compaq 6200 Pro (desktop)",
  "Dell OptiPlex 780 (desktop)",
  "Lenovo ThinkCentre M58 (desktop)",
  "Acer Veriton M200 (desktop)",
];

/**
 * Project a geo point into a viewport of `w × h` (north-up), padded by `pad`.
 * The same projection is used for the SVG backdrop and the overlaid HTML pins.
 */
export function project(
  p: GeoPoint,
  w: number,
  h: number,
  pad = 0,
): { x: number; y: number } {
  const { minLat, maxLat, minLng, maxLng } = CITY.bounds;
  const nx = (p.lng - minLng) / (maxLng - minLng);
  const ny = (maxLat - p.lat) / (maxLat - minLat); // invert: north is up
  return {
    x: pad + nx * (w - 2 * pad),
    y: pad + ny * (h - 2 * pad),
  };
}

/* ------------------------------ determinism ----------------------------- */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Small deterministic jitter so people in the same area don't stack exactly. */
function jitter(p: GeoPoint, seed: number): GeoPoint {
  const dx = (((seed % 97) / 97) - 0.5) * 0.012;
  const dy = ((((seed >>> 5) % 89) / 89) - 0.5) * 0.012;
  return { lat: p.lat + dy, lng: p.lng + dx };
}

/* ------------------------------- location -------------------------------- */

/** Where the employee is working from for the day. "remote" = work from home. */
export type WorkMode = "in-office" | "remote";

export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  "in-office": "In office",
  remote: "Remote",
};

export type LocationEventKind = "login" | "ping" | "logout";

export interface LocationEvent {
  id: string;
  kind: LocationEventKind;
  time: string; // "09:01"
  area: string; // "Ambattur"
  city: string; // "Chennai"
  label: string; // "Ambattur Industrial Estate"
  point: GeoPoint;
  accuracyM: number;
}

export interface EmployeeLocation {
  user: User;
  date: { year: number; month: number; day: number };
  status: "online" | "offline";
  /** Working in office or remotely (work from home) for the day. */
  mode: WorkMode;
  /** The device this employee is monitored on. */
  device: string;
  /** Can this employee's device be located at all? False = no built-in GPS. */
  gpsCapable: boolean;
  /** Why there's no location. "no-gps" = the device has no GPS hardware. */
  offlineReason?: "on-leave" | "absent" | "no-data" | "no-gps";
  login: LocationEvent | null;
  /** Latest known ping — "live" today, or last-seen for a completed day. */
  current: LocationEvent | null;
  logout: LocationEvent | null;
  trail: LocationEvent[];
}

const isSameDay = (a: { year: number; month: number; day: number }) =>
  a.year === TODAY.year && a.month === TODAY.month && a.day === TODAY.day;

const isPastDay = (d: { year: number; month: number; day: number }) =>
  new Date(d.year, d.month, d.day).getTime() <
  new Date(TODAY.year, TODAY.month, TODAY.day).getTime();

function event(
  kind: LocationEventKind,
  time: string,
  area: Area,
  seed: number,
): LocationEvent {
  return {
    id: `${kind}-${area.area}-${time}`,
    kind,
    time,
    area: area.area,
    city: CITY.name,
    label: area.label,
    point: jitter(area.point, seed + kind.length),
    accuracyM: 6 + (hash(kind + area.area) % 34),
  };
}

/**
 * A person's location record for a specific day, derived deterministically from
 * their attendance record (present/late → online) and a seeded area choice.
 * - Today (still clocked in): login + a live "current" ping, no logout.
 * - A completed past day: login → midday ping → logout (last-seen = logout).
 */
export function locationFor(
  user: User,
  year: number,
  month: number,
  day: number,
): EmployeeLocation {
  const date = { year, month, day };
  const rec = dayRecordFor(user.id, year, month, day);
  const online = rec.status === "present" || rec.status === "late";

  // Device + GPS capability are stable per employee (not per day).
  const deviceSeed = hash(user.id);
  const gpsCapable = deviceSeed % 7 !== 0; // ~1 in 7 has an old, GPS-less device
  const device = gpsCapable
    ? GPS_DEVICES[deviceSeed % GPS_DEVICES.length]
    : NO_GPS_DEVICES[deviceSeed % NO_GPS_DEVICES.length];

  const seed = hash(`${user.id}:${year}-${month}-${day}`);
  // ~35% of the online workforce is remote (work from home) on a given day.
  const mode: WorkMode = seed % 20 < 7 ? "remote" : "in-office";

  const offline = (
    reason: "on-leave" | "absent" | "no-data" | "no-gps",
  ): EmployeeLocation => ({
    user,
    date,
    status: "offline",
    mode,
    device,
    gpsCapable,
    offlineReason: reason,
    login: null,
    current: null,
    logout: null,
    trail: [],
  });

  // No GPS hardware → location can never be tracked, regardless of attendance.
  if (!gpsCapable) return offline("no-gps");

  if (!online || isFutureDate(year, month, day)) {
    return offline(
      rec.status === "leave"
        ? "on-leave"
        : rec.status === "absent"
          ? "absent"
          : "no-data",
    );
  }

  const homeArea = AREAS[seed % AREAS.length];
  // In-office employees work from the Thoraipakkam HQ; remote from home.
  const workArea = mode === "in-office" ? OFFICE : homeArea;
  // A few in-office people are out at a client site during the day.
  const fieldWork = mode === "in-office" && seed % 5 === 0;
  // `>>>` (unsigned) — `>>` would go negative on high-bit seeds → AREAS[neg].
  const currentArea = fieldWork ? AREAS[(seed >>> 3) % AREAS.length] : workArea;
  const loginArea = workArea;
  const middayTime = `${12 + (seed % 3)}:${pad2(seed % 60)}`;

  const login = event("login", rec.clockIn, loginArea, seed);

  // A completed past day tells the full login → last-seen → logout story.
  if (isPastDay(date)) {
    const ping = event("ping", middayTime, currentArea, seed + 11);
    const logout = event("logout", rec.clockOut, homeArea, seed + 23);
    return {
      user,
      date,
      status: "offline",
      mode,
      device,
      gpsCapable,
      login,
      current: logout, // last-seen for a finished day
      logout,
      trail: fieldWork ? [login, ping, logout] : [login, logout],
    };
  }

  // Today, still clocked in: a live current ping, no logout yet.
  const current = event("ping", middayTime, currentArea, seed + 11);
  return {
    user,
    date,
    status: "online",
    mode,
    device,
    gpsCapable,
    login,
    current,
    logout: null,
    trail: fieldWork ? [login, current] : [login, current],
  };
}

/** The monitored workforce (everyone employed). */
const MONITORED: User[] = users.filter(
  (u) => u.status === "active" || u.status === "inactive",
);

/** Today's location for every monitored employee (the org board). */
export const LOCATION_EMPLOYEES: EmployeeLocation[] = MONITORED.map((u) =>
  locationFor(u, TODAY.year, TODAY.month, TODAY.day),
);

export function employeeLocationById(
  id: string,
): EmployeeLocation | undefined {
  return LOCATION_EMPLOYEES.find((e) => e.user.id === id);
}

/** "2026-06-25" → "Jun 25, 2026". */
export function dateLabel(d: {
  year: number;
  month: number;
  day: number;
}): string {
  return `${MONTH_NAMES[d.month].slice(0, 3)} ${d.day}, ${d.year}`;
}

export { isSameDay };
