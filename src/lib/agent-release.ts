/**
 * The **real** desktop-agent release surface: where the installers live and what the release
 * manifest is called. (The version itself comes only from that manifest — see `useAgentRelease`.)
 *
 * These constants were carved out of the old `lib/mock-agents.ts` when its seeded fleet was deleted
 * (the routed fleet pages read `GET /v1/fleet` through `modules/agents/services/fleet.service.ts`).
 * Nothing here is mock data — every URL points at the bucket the release pipeline actually writes.
 */

export type AgentOS = "Windows" | "macOS" | "Linux";

export interface AgentPlatform {
  os: AgentOS;
  label: string;
  file: string;
  size: string;
  /** Whether this platform's installer is shipping yet. */
  available: boolean;
  /** Public URL the installer downloads from. */
  url: string;
  /** Optional secondary format (e.g. the Linux AppImage alongside the .deb). */
  altUrl?: string;
  altFile?: string;
  altLabel?: string;
  altSize?: string;
}

// There is deliberately **no** hard-coded version constant any more. `AGENT_RELEASE_VERSION` was the
// manifest's offline fallback and went stale on every release nobody remembered to bump it for — it
// read 0.1.22 while 0.1.29 shipped, and it was announced as "new" on every page load until the
// manifest answered (QA audit 2026-10-08, WP-367).

// ── Published installer URLs ──────────────────────────────────────────────────
// The desktop repo is PRIVATE, so its GitHub release assets can't be fetched anonymously. The
// release pipeline mirrors each build to a public S3 bucket under `agent/latest/*` (a stable pointer
// overwritten every release), and the web app links there. Override the host per-env with
// NEXT_PUBLIC_DOWNLOADS_URL; the default is the dev bucket.
const DOWNLOADS_BASE =
  process.env.NEXT_PUBLIC_DOWNLOADS_URL?.replace(/\/$/, "") ??
  "https://wp-downloads-dev.s3.ap-south-1.amazonaws.com/agent/latest";

export const WINDOWS_INSTALLER_URL = `${DOWNLOADS_BASE}/WorkPulse-x64-setup.exe`;

/**
 * The **managed** (machine-mode) agent's installer. monitoring-agent's release workflow publishes
 * each signed release to the same public bucket under `managed-agent/latest/WorkPulse.msi` — the
 * file name the enrolment commands use (QA audit 2026-10-08, WP-250; owner decision 2026-10-09).
 * Override the folder per-env with NEXT_PUBLIC_MANAGED_DOWNLOADS_URL.
 */
const MANAGED_DOWNLOADS_BASE =
  process.env.NEXT_PUBLIC_MANAGED_DOWNLOADS_URL?.replace(/\/$/, "") ??
  "https://wp-downloads-dev.s3.ap-south-1.amazonaws.com/managed-agent/latest";

export const MANAGED_AGENT_MSI_URL = `${MANAGED_DOWNLOADS_BASE}/WorkPulse.msi`;

/**
 * The managed service's release manifest — `{ version, platforms: {…} }`, the file its own updater
 * polls, written **last** by monitoring-agent's release workflow (after the MSI it points at). Until
 * that workflow has published a release the file doesn't exist, and the bucket answers **403** (it
 * doesn't allow listing, so a missing key reads as forbidden, not 404) — see `useManagedAgentRelease`.
 */
export const MANAGED_AGENT_MANIFEST_URL = `${MANAGED_DOWNLOADS_BASE}/latest.json`;

/**
 * The release manifest the desktop agent's self-updater reads — `{ version, platforms: {…} }`.
 *
 * The navbar and the Download page read it too (through `useAgentRelease`), so the version they
 * advertise is the version actually served: `agent/latest/*` is overwritten by every release, so the
 * files move whether or not anyone remembers to edit this file.
 *
 * Publicly readable and CORS-enabled (GET/HEAD from any origin), same as the installers beside it.
 */
export const AGENT_MANIFEST_URL = `${DOWNLOADS_BASE}/latest.json`;

// Sizes are the real v0.1.1 artifacts in `agent/latest/` — they are shown before the download
// starts, so a stale number is a small lie about what someone is about to pull over their connection.
export const AGENT_PLATFORMS: AgentPlatform[] = [
  {
    os: "Windows",
    label: "Windows 10 / 11",
    file: "WorkPulse-Setup.exe",
    size: "3.3 MB",
    available: true,
    url: WINDOWS_INSTALLER_URL,
  },
  // Live since v0.1.1: the macOS job had never produced a dmg before (its `rustup target add` list
  // was comma-separated, so it died in 17s), and the build is unsigned — see the note on the card.
  {
    os: "macOS",
    label: "macOS 12 and later",
    file: "WorkPulse.dmg",
    size: "7.9 MB",
    available: true,
    url: `${DOWNLOADS_BASE}/WorkPulse-universal.dmg`,
  },
  {
    os: "Linux",
    label: "Ubuntu / Debian",
    file: "WorkPulse.deb",
    size: "5.5 MB",
    available: true,
    url: `${DOWNLOADS_BASE}/WorkPulse-amd64.deb`,
    altUrl: `${DOWNLOADS_BASE}/WorkPulse-amd64.AppImage`,
    altFile: "WorkPulse.AppImage",
    altLabel: "AppImage",
    altSize: "79 MB",
  },
];
