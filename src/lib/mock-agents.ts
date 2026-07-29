/**
 * Static demo data for the Device Agents page + the agent download surface.
 * Deterministic — no Math.random() / Date.now(). UI-first: the real fleet arrives
 * via GET /v1/fleet and the real installers via the release pipeline; until then
 * this drives the layout.
 */

export type AgentOS = "Windows" | "macOS" | "Linux"
export type AgentStatus = "online" | "idle" | "offline"

export interface Agent {
  id: string
  hostname: string
  user: string
  email: string
  os: AgentOS
  osVersion: string
  version: string
  status: AgentStatus
  lastSeen: string
  ip: string
  cpu: number
  memory: number
}

export const LATEST_AGENT_VERSION = "2.4.1"

/** The **real** shipped desktop-agent version (the Download page + installers). Distinct from
 *  `LATEST_AGENT_VERSION`, which the still-mock agents-manager uses to compare its seeded fleet. */
export const AGENT_RELEASE_VERSION = "0.1.1"

export const AGENTS: Agent[] = [
  { id: "ag-1", hostname: "alex-morgan-mbp", user: "Alex Morgan", email: "owner@acme.test", os: "macOS", osVersion: "14.5", version: "2.4.1", status: "online", lastSeen: "Active now", ip: "198.51.100.10", cpu: 12, memory: 41 },
  { id: "ag-2", hostname: "priya-nair-win", user: "Priya Nair", email: "priya.nair@acme.test", os: "Windows", osVersion: "11", version: "2.4.1", status: "online", lastSeen: "Active now", ip: "198.51.100.31", cpu: 22, memory: 55 },
  { id: "ag-3", hostname: "daniel-kim-mbp", user: "Daniel Kim", email: "daniel.kim@acme.test", os: "macOS", osVersion: "13.6", version: "2.3.0", status: "idle", lastSeen: "12 min ago", ip: "203.0.113.51", cpu: 4, memory: 38 },
  { id: "ag-4", hostname: "sara-lopez-win", user: "Sara Lopez", email: "sara.lopez@acme.test", os: "Windows", osVersion: "10", version: "2.4.0", status: "online", lastSeen: "Active now", ip: "192.0.2.140", cpu: 31, memory: 62 },
  { id: "ag-5", hostname: "tom-becker-ubuntu", user: "Tom Becker", email: "tom.becker@acme.test", os: "Linux", osVersion: "Ubuntu 22.04", version: "2.4.1", status: "offline", lastSeen: "2 hours ago", ip: "198.51.100.77", cpu: 0, memory: 0 },
  { id: "ag-6", hostname: "maya-patel-mbp", user: "Maya Patel", email: "maya.patel@acme.test", os: "macOS", osVersion: "14.4", version: "2.4.1", status: "idle", lastSeen: "30 min ago", ip: "198.51.100.5", cpu: 6, memory: 44 },
  { id: "ag-7", hostname: "rosa-diaz-win", user: "Rosa Diaz", email: "rosa.diaz@acme.test", os: "Windows", osVersion: "11", version: "2.2.5", status: "offline", lastSeen: "3 days ago", ip: "203.0.113.88", cpu: 0, memory: 0 },
  { id: "ag-8", hostname: "liam-chen-mbp", user: "Liam Chen", email: "liam.chen@acme.test", os: "macOS", osVersion: "14.5", version: "2.4.1", status: "online", lastSeen: "Active now", ip: "198.51.100.19", cpu: 18, memory: 49 },
  { id: "ag-9", hostname: "nina-roy-win", user: "Nina Roy", email: "nina.roy@acme.test", os: "Windows", osVersion: "11", version: "2.4.0", status: "offline", lastSeen: "Yesterday", ip: "192.0.2.61", cpu: 0, memory: 0 },
  { id: "ag-10", hostname: "omar-said-fedora", user: "Omar Said", email: "omar.said@acme.test", os: "Linux", osVersion: "Fedora 39", version: "2.4.1", status: "online", lastSeen: "Active now", ip: "203.0.113.40", cpu: 9, memory: 35 },
]

export interface AgentPlatform {
  os: AgentOS
  label: string
  file: string
  size: string
  /** Whether this platform's installer is shipping yet. */
  available: boolean
  /** Public URL the installer downloads from. */
  url: string
  /** Optional secondary format (e.g. the Linux AppImage alongside the .deb). */
  altUrl?: string
  altFile?: string
  altLabel?: string
  altSize?: string
}

// ── Published installer URLs ──────────────────────────────────────────────────
// The desktop repo is PRIVATE, so its GitHub release assets can't be fetched anonymously. The
// release pipeline mirrors each build to a public S3 bucket under `agent/latest/*` (a stable pointer
// overwritten every release), and the web app links there. Override the host per-env with
// NEXT_PUBLIC_DOWNLOADS_URL; the default is the dev bucket.
const DOWNLOADS_BASE =
  process.env.NEXT_PUBLIC_DOWNLOADS_URL?.replace(/\/$/, "") ??
  "https://wp-downloads-dev.s3.ap-south-1.amazonaws.com/agent/latest"

export const WINDOWS_INSTALLER_URL = `${DOWNLOADS_BASE}/WorkPulse-x64-setup.exe`

// Sizes are the real v0.1.1 artifacts in `agent/latest/` — they are shown before the download
// starts, so a stale number is a small lie about what someone is about to pull over their connection.
export const AGENT_PLATFORMS: AgentPlatform[] = [
  { os: "Windows", label: "Windows 10 / 11", file: "WorkPulse-Setup.exe", size: "3.3 MB", available: true, url: WINDOWS_INSTALLER_URL },
  // Live since v0.1.1: the macOS job had never produced a dmg before (its `rustup target add` list
  // was comma-separated, so it died in 17s), and the build is unsigned — see the note on the card.
  { os: "macOS", label: "macOS 12 and later", file: "WorkPulse.dmg", size: "7.9 MB", available: true, url: `${DOWNLOADS_BASE}/WorkPulse-universal.dmg` },
  { os: "Linux", label: "Ubuntu / Debian", file: "WorkPulse.deb", size: "5.5 MB", available: true, url: `${DOWNLOADS_BASE}/WorkPulse-amd64.deb`, altUrl: `${DOWNLOADS_BASE}/WorkPulse-amd64.AppImage`, altFile: "WorkPulse.AppImage", altLabel: "AppImage", altSize: "79 MB" },
]

export const AGENT_ENROLLMENT_TOKEN = "wp_agent_8f3a2b9c4d1e7a60f5c2"

export interface AgentSettings {
  autoUpdate: boolean
  updateChannel: string
  offlineAlertMins: number
  screenshotUpload: boolean
}

export const AGENT_SETTINGS_DEFAULTS: AgentSettings = {
  autoUpdate: true,
  updateChannel: "stable",
  offlineAlertMins: 30,
  screenshotUpload: true,
}

export const UPDATE_CHANNEL_OPTIONS = [
  { value: "stable", label: "Stable" },
  { value: "beta", label: "Beta (early access)" },
]

// ── Per-device detail ─────────────────────────────────────────────────────────
// Drives the dedicated device page (/settings/agents/[agentId]). Everything below is
// DERIVED from the roster row above plus a seeded PRNG keyed on the agent id, so a device
// renders the same values on every visit and on the server as on the client (no
// Math.random(), no Date.now() — SSR-safe and stable across re-renders).
//
// The shapes mirror what the real backend already models, so the wiring pass is a swap of
// this adapter and not a redesign:
//   AgentDetail.{cpu,memory,outboxMb,batchSeq}                    → AgentDevice heartbeat (LLD §18)
//   AgentDetail.{cadenceMins,blurLevel,retentionDays,autoUpdate}  → CONFIG#TRACK (fleet::serve_config)
//   AgentDetail.sessions                                          → TimeEntry rows (LLD §4)
//   AgentDetail.capabilities                                      → the agent's own per-OS
//                                                                   capability report (CAPTURE.md §3)

/** Whether a capture signal is usable on this device — the honest-degradation states. */
export type CapabilityState = "granted" | "denied" | "unsupported"

export interface AgentCapability {
  key: "screenshots" | "input" | "windows" | "location"
  label: string
  state: CapabilityState
  /** Why it is in this state, in the user's words — never a bare "false". */
  note: string
}

export interface AgentSession {
  id: string
  project: string
  task: string
  /** Local wall-clock start/end on the device, e.g. "09:12". */
  from: string
  to: string
  minutes: number
  running?: boolean
}

export interface AgentDetail extends Agent {
  /** The per-install UUID the agent generates at first boot (not an identity — ENROLLMENT.md). */
  agentUuid: string
  deviceModel: string
  cpuModel: string
  ramGb: number
  timezone: string
  location: string
  enrolledOn: string
  uptime: string
  /** Heartbeat + outbox state from the last batch. */
  batchSeq: number
  outboxMb: number
  /** Effective tracking policy pulled from the org config (0 = screenshots off). */
  cadenceMins: number
  blurLevel: number
  retentionDays: number
  autoUpdate: boolean
  updateChannel: string
  /** Monitoring consent granted on the device — capture is hard-gated on it (PRIVACY.md). */
  consent: boolean
  /** Last 12 heartbeat cycles (~1 hour) of CPU, for the header pulse line. */
  cpuSeries: number[]
  trackedMins: number
  idleMins: number
  screenshotsToday: number
  capabilities: AgentCapability[]
  sessions: AgentSession[]
}

/** Deterministic 32-bit FNV-1a → mulberry32 PRNG. Same id ⇒ same sequence, always. */
function seeded(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PROJECTS = [
  { name: "Atlas Platform", tasks: ["Billing webhook retries", "Schema migration", "Audit trail"] },
  { name: "Orion Mobile", tasks: ["Offline sync", "Push permissions", "Crash triage"] },
  { name: "Helios Analytics", tasks: ["Cohort report", "Query cache", "Dashboard polish"] },
  { name: "Internal Tools", tasks: ["Onboarding flow", "Access review", "Runbook update"] },
]

const CITIES = [
  { city: "Chennai, IN", tz: "Asia/Kolkata (UTC+5:30)" },
  { city: "Bengaluru, IN", tz: "Asia/Kolkata (UTC+5:30)" },
  { city: "Lisbon, PT", tz: "Europe/Lisbon (UTC+1)" },
  { city: "Austin, US", tz: "America/Chicago (UTC−5)" },
  { city: "Berlin, DE", tz: "Europe/Berlin (UTC+2)" },
]

const HARDWARE: Record<AgentOS, { models: string[]; cpus: string[] }> = {
  macOS: {
    models: ['MacBook Pro 14" (M3 Pro)', 'MacBook Air 13" (M2)', 'MacBook Pro 16" (M3 Max)'],
    cpus: ["Apple M3 Pro (11-core)", "Apple M2 (8-core)", "Apple M3 Max (14-core)"],
  },
  Windows: {
    models: ["Dell Latitude 7440", "Lenovo ThinkPad T14 Gen 4", "HP EliteBook 840 G10"],
    cpus: ["Intel Core i7-1355U", "AMD Ryzen 7 7840U", "Intel Core i5-1345U"],
  },
  Linux: {
    models: ["Dell XPS 13 Plus", "Framework Laptop 13", "System76 Lemur Pro"],
    cpus: ["Intel Core i7-1360P", "AMD Ryzen 7 7840U", "Intel Core i5-1240P"],
  },
}

/**
 * Per-OS capture capability, following the real matrix in `desktop/docs/CAPTURE.md` §3:
 * macOS needs two runtime grants (Screen Recording + Accessibility) and has no location
 * backend wired; Linux/Wayland legitimately cannot read global input; Windows does it all.
 * A denied grant is surfaced as a *state with a reason*, never as silent zero data.
 */
function capabilitiesFor(os: AgentOS, rng: () => number): AgentCapability[] {
  if (os === "macOS") {
    const screen = rng() > 0.25
    const access = screen && rng() > 0.3
    return [
      {
        key: "screenshots",
        label: "Screenshots",
        state: screen ? "granted" : "denied",
        note: screen
          ? "Screen Recording granted in System Settings."
          : "Screen Recording denied — the employee must grant it in System Settings › Privacy.",
      },
      {
        key: "input",
        label: "Input counts",
        state: access ? "granted" : "denied",
        note: access
          ? "Accessibility granted — keystroke and mouse totals only."
          : "Accessibility denied — activity counts cannot be sampled on this device.",
      },
      {
        key: "windows",
        label: "Window titles",
        state: access ? "granted" : "denied",
        note: access
          ? "Foreground app and title resolved via Accessibility."
          : "Needs the same Accessibility grant as input counts.",
      },
      {
        key: "location",
        label: "Location",
        state: "unsupported",
        note: "CoreLocation isn't wired on macOS — no fixes are recorded.",
      },
    ]
  }
  if (os === "Linux") {
    const wayland = rng() > 0.5
    return [
      {
        key: "screenshots",
        label: "Screenshots",
        state: "granted",
        note: wayland
          ? "Captured through the xdg-desktop-portal screencast grant."
          : "Captured directly on X11.",
      },
      {
        key: "input",
        label: "Input counts",
        state: wayland ? "unsupported" : "granted",
        note: wayland
          ? "Wayland exposes no global input API — an OS limit, not a setup gap."
          : "Sampled via XInput2 — counts only, never key values.",
      },
      {
        key: "windows",
        label: "Window titles",
        state: wayland ? "unsupported" : "granted",
        note: wayland
          ? "The compositor does not expose the foreground window title."
          : "Resolved from EWMH window properties.",
      },
      {
        key: "location",
        label: "Location",
        state: "unsupported",
        note: "GeoClue isn't wired on Linux — no fixes are recorded.",
      },
    ]
  }
  const locationOn = rng() > 0.35
  return [
    {
      key: "screenshots",
      label: "Screenshots",
      state: "granted",
      note: "Captured via the desktop duplication API.",
    },
    {
      key: "input",
      label: "Input counts",
      state: "granted",
      note: "Sampled once a second — keystroke and mouse totals only.",
    },
    {
      key: "windows",
      label: "Window titles",
      state: "granted",
      note: "Foreground app, title and browser host resolved natively.",
    },
    {
      key: "location",
      label: "Location",
      state: locationOn ? "granted" : "denied",
      note: locationOn
        ? "Windows location service allowed — one fix per cycle while tracking."
        : "Windows location access denied — no fixes are recorded.",
    },
  ]
}

/** A smooth utilization series around `centre`, clamped to 0–100. Offline ⇒ flat zero. */
function series(centre: number, rng: () => number, points = 12): number[] {
  if (centre <= 0) return Array.from({ length: points }, () => 0)
  const out: number[] = []
  let v = centre
  for (let i = 0; i < points; i++) {
    v = v + (rng() - 0.5) * Math.max(6, centre * 0.5)
    out.push(Math.max(2, Math.min(97, Math.round(v))))
  }
  return out
}

const pad2 = (n: number) => String(n).padStart(2, "0")
const clock = (mins: number) => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`
export const durationLabel = (mins: number) =>
  mins >= 60 ? `${Math.floor(mins / 60)}h ${pad2(mins % 60)}m` : `${mins}m`

/**
 * The full device record for one agent id. `null` when the id isn't in the roster — the
 * page renders an explicit "not enrolled" state rather than inventing a device.
 */
export function getAgentDetail(agentId: string): AgentDetail | null {
  const base = AGENTS.find((a) => a.id === agentId)
  if (!base) return null

  const rng = seeded(base.id + base.hostname)
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rng() * xs.length)]
  const int = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1))

  const offline = base.status === "offline"
  const hw = HARDWARE[base.os]
  const place = pick(CITIES)

  // Today's sessions: the running one (if any) last, so the list reads chronologically.
  const running = base.status === "online" && rng() > 0.45
  const sessionCount = offline ? int(0, 1) : int(2, 4)
  const sessions: AgentSession[] = []
  let cursor = int(8, 10) * 60 + int(0, 45) // first clock-in, in minutes past midnight
  for (let i = 0; i < sessionCount; i++) {
    const project = pick(PROJECTS)
    const minutes = int(35, 145)
    const isLast = i === sessionCount - 1
    const live = running && isLast
    sessions.push({
      id: `${base.id}-s${i + 1}`,
      project: project.name,
      task: pick(project.tasks),
      from: clock(cursor),
      to: live ? "now" : clock(cursor + minutes),
      minutes,
      running: live,
    })
    cursor += minutes + int(10, 40) // a break between sessions
  }
  const trackedMins = sessions.reduce((sum, s) => sum + s.minutes, 0)
  const cadenceMins = offline ? 5 : pick([3, 5, 5, 10])
  const consent = !offline || rng() > 0.4

  return {
    ...base,
    agentUuid: `${base.id.replace("ag-", "a9f4c1")}-${int(1000, 9999)}-4${int(100, 999)}-8${int(100, 999)}-${int(100000, 999999)}${int(100000, 999999)}`,
    deviceModel: pick(hw.models),
    cpuModel: pick(hw.cpus),
    ramGb: pick([8, 16, 16, 32]),
    timezone: place.tz,
    location: place.city,
    enrolledOn: `${int(2, 27)} ${pick(["Jan", "Feb", "Mar", "Apr", "May"])} 2026`,
    uptime: offline ? "—" : `${int(1, 9)}d ${int(1, 23)}h`,
    batchSeq: int(2_400, 18_900),
    outboxMb: offline ? Number((rng() * 24 + 3).toFixed(1)) : Number((rng() * 1.4).toFixed(1)),
    cadenceMins,
    blurLevel: int(0, 2),
    retentionDays: 90,
    autoUpdate: rng() > 0.2,
    updateChannel: rng() > 0.85 ? "beta" : "stable",
    consent,
    cpuSeries: series(base.cpu, rng),
    trackedMins,
    idleMins: offline ? 0 : int(18, 96),
    screenshotsToday:
      offline || cadenceMins === 0 || !consent
        ? 0
        : Math.round((trackedMins / cadenceMins) * 0.5),
    capabilities: capabilitiesFor(base.os, rng),
    sessions,
  }
}
