/**
 * The **real** desktop-agent release surface: where the installers live, what the release manifest
 * is called, and the fallback version number.
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

/** The **real** shipped desktop-agent version — the offline fallback for the manifest fetch.
 *
 *  **Bump this on every agent release.** It is the trigger for the "new version available" dot on
 *  the navbar's Download-agent button: the UI compares it against the release each user has already
 *  acknowledged (`ui.store`'s `agentReleaseSeen`), so raising it here shows the dot once to everyone
 *  and clicking through dismisses it until the next bump. Forget it and the release ships silently.
 *
 *  `useAgentRelease` prefers {@link AGENT_MANIFEST_URL} precisely because this constant has gone
 *  stale before; it survives only for the offline case. */
export const AGENT_RELEASE_VERSION = "0.1.20";

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
 * The release manifest the desktop agent's self-updater reads — `{ version, platforms: {…} }`.
 *
 * The Download page reads it too, so the version it advertises is the version it actually serves.
 * {@link AGENT_RELEASE_VERSION} is a hand-maintained constant and had already gone stale twice in a
 * day: `agent/latest/*` is overwritten by every release, so the files move whether or not anyone
 * remembers to edit this file. The constant survives only as the fallback for a failed fetch.
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
