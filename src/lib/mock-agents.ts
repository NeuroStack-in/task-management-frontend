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
export const AGENT_RELEASE_VERSION = "0.1.0"

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

export const AGENT_PLATFORMS: AgentPlatform[] = [
  { os: "Windows", label: "Windows 10 / 11", file: "WorkPulse-Setup.exe", size: "3.3 MB", available: true, url: WINDOWS_INSTALLER_URL },
  // macOS is "coming soon" until its universal build ships to S3 (the dmg isn't mirrored yet).
  { os: "macOS", label: "macOS 12 and later", file: "WorkPulse.dmg", size: "9.5 MB", available: false, url: `${DOWNLOADS_BASE}/WorkPulse-universal.dmg` },
  { os: "Linux", label: "Ubuntu / Debian", file: "WorkPulse.deb", size: "5.2 MB", available: true, url: `${DOWNLOADS_BASE}/WorkPulse-amd64.deb`, altUrl: `${DOWNLOADS_BASE}/WorkPulse-amd64.AppImage`, altFile: "WorkPulse.AppImage", altLabel: "AppImage", altSize: "79 MB" },
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
