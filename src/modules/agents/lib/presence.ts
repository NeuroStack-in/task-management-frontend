/**
 * Who is *actually* present right now, from a device's telemetry (MANAGED-AGENT.md §8 Ph2).
 *
 * The naive "connectivity ∈ {online, idle} ⇒ in" rule breaks in two ways the moment managed devices
 * exist, and both are silent wrong-headcounts, not crashes:
 *
 * 1. **A sleeping laptop reads "out" while the employee is on shift.** A managed machine that slept
 *    stops heartbeating, so the connectivity window says offline — but the person is mid-workday.
 * 2. **A managed machine reads "in" with nobody logged in.** It heartbeats from boot (§5), so
 *    connectivity says online even when no one has signed in.
 *
 * So presence for a managed device is decided by its **logon state**, not its socket. This module is
 * pure and unit-tested; every consumer that used to read `connectivity`/`user_id` directly routes
 * through it, so the rule lives in exactly one place.
 */

/** The device fields presence reads. A subset of `ApiDevice`, all optional/guarded — a value the
 *  server learns before the console does must degrade, never crash. */
export interface PresenceDevice {
  /** `interactive` | `service` — absent on pre-Ph1 rows (an interactive device). */
  variant?: string;
  /** `online` | `idle` | `offline` — the heartbeat/MQTT window. */
  connectivity?: string;
  /** The account the agent runs as (interactive: the JWT user). May be empty for a managed device
   *  with nobody signed in. */
  user_id?: string;
  /** The 1:1-assigned employee (managed only) — attribution independent of who is signed in. */
  assigned_user_id?: string;
  /** `signed_in` | `signed_out` | `asleep` — the managed logon state (absent on interactive). */
  logon_state?: string;
  /** `deactivated`/`released`/`revoked` lifecycle — such a device is never "in". */
  state?: string;
}

/** in = at the keyboard now · asleep = machine slept mid-shift · out = signed out / offline / gone. */
export type Presence = "in" | "asleep" | "out";

/**
 * The employee a device's activity attributes to.
 *
 * `assigned_user_id` (the 1:1 managed binding) wins over `user_id` (who is signed in), because a
 * managed device's *attribution* is the assigned employee even when a colleague is at the keyboard —
 * and the batch that colleague produced was gated out server-side anyway (§6.3). `null` when neither
 * is set (a managed device before assignment, which cannot occur post-enrolment).
 *
 * 🔴 **The four consumers that read `d.user_id` directly must route through this** (§8 Ph2): a
 * managed device's `user_id` can be empty, and a missed one is a silently wrong headcount.
 */
export function effectiveUserId(d: PresenceDevice): string | null {
  return d.assigned_user_id || d.user_id || null;
}

/**
 * Presence from the best signal available, evaluated in order (the order is the contract):
 * 1. deactivated/released/revoked → **out** (a retired device is never present);
 * 2. no effective user → **out** (nobody to be present);
 * 3. managed + `logon_state === "signed_out"` → **out** (heartbeating from boot, nobody signed in);
 * 4. managed + `logon_state === "asleep"` → **asleep** (slept mid-shift — the sleeping-laptop fix);
 * 5. connectivity online/idle → **in**;
 * 6. managed + `logon_state === "signed_in"` but offline connectivity → **in** (the logon state is
 *    fresher than a stale heartbeat window for a device that just slept a moment);
 * 7. else → **out**.
 *
 * Unknown enum values fall through to the connectivity rule — degrade, never crash.
 */
export function presenceOf(d: PresenceDevice): Presence {
  const dead = d.state === "deactivated" || d.state === "released" || d.state === "revoked";
  if (dead) return "out";
  if (!effectiveUserId(d)) return "out";

  const managed = d.variant === "service";
  if (managed) {
    if (d.logon_state === "signed_out") return "out";
    if (d.logon_state === "asleep") return "asleep";
    if (d.logon_state === "signed_in") {
      // Signed in — in, even if the heartbeat window briefly reads offline (a just-slept machine).
      return d.connectivity === "offline" ? "in" : "in";
    }
  }

  if (d.connectivity === "online" || d.connectivity === "idle") return "in";
  return "out";
}

/**
 * The strongest presence across a person's devices — for the multi-device dedupe the raw fleet list
 * has no notion of (a person with both an interactive app and a managed laptop). `in` beats
 * `asleep` beats `out`, so someone at *any* live device counts present once, never twice.
 */
export function bestPresence(devices: PresenceDevice[]): Presence {
  let best: Presence = "out";
  for (const d of devices) {
    const p = presenceOf(d);
    if (p === "in") return "in";
    if (p === "asleep") best = "asleep";
  }
  return best;
}

/** Whether a device counts toward a live "who's in now" headcount. `asleep` does **not** — the
 *  person is on shift but not at the keyboard, which attendance reflects separately. */
export function isPresent(d: PresenceDevice): boolean {
  return presenceOf(d) === "in";
}
