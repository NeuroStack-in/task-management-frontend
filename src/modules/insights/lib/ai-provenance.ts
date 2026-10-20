/**
 * Who wrote a summary — the model, or the server's own template — said honestly on every card
 * (UX audit 2026-10-16, MON-08 / XC-08).
 *
 * The cards used to put "AI … report" and the sparkle over whatever text came back, including the
 * server's fixed sentence for a day with nothing to narrate, and none of them said AI can be wrong.
 * The rule now: **AI branding only on text we know a model wrote**, with "AI-generated · time · may
 * be wrong"; a known template is labelled "Summary" with no AI mark; and where the payload cannot
 * tell the two apart, the card says so rather than claiming either.
 *
 * What each payload can and cannot tell us (read from `backend/crates/insights`, 2026-10-20):
 *
 *  - **Daily executive report** (`/v1/insights/reports/ai`): with nobody scored it returns the fixed
 *    line and spends no model call; otherwise a provider failure is an HTTP error, never a silent
 *    fallback — so a report that arrives with people scored was written by the model. (The one
 *    exception is a server with no AI key configured, a deployment error this cannot see.)
 *  - **Department activity summary** (`/reports/dept-summary`) and **screenshot summary**
 *    (`/screenshots/dept-summary`): the fixed line when nobody was scored / no frame was analysed —
 *    that much is visible. But they **also** fall back to the fixed line when the provider fails,
 *    when another reader is generating the same summary, or (screenshots) when AI insights are off,
 *    and the response is identical either way. The server knows (`narrate` returns `from_model`)
 *    and doesn't send it — the field it needs is listed in the audit report.
 *  - **None of them sends the model id.** The server stamps `ai_model` on the cache item for its
 *    own use and deliberately keeps it off the wire, so no card names a model until a DTO carries
 *    it; naming one from a constant here would be a guess that goes stale the day routing moves.
 */

export type Provenance =
  /** A model wrote it. `model` only when the payload says which. */
  | { kind: "ai"; generatedAt: number | null; model?: string }
  /** The server's own sentence over the figures — no model involved. */
  | { kind: "computed" }
  /** Usually a model, but the payload can't rule out the template fallback. */
  | { kind: "unknown"; generatedAt: number | null }
  /** Nothing to attribute yet — loading, or a read that failed. No AI mark, no line. */
  | { kind: "none" };

/**
 * When a summary was written, as local date-time, or `null` when that isn't known.
 *
 * `generated_at` is epoch **milliseconds** (the backend's `now_ms()`); `0` is the DTOs' stand-in
 * for "absent" and would otherwise render as 1 Jan 1970.
 */
export function formatGeneratedAt(ms: number | null | undefined): string | null {
  if (!ms || !Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/** The daily executive report — see the module note. */
export function dailyReportProvenance(r: {
  narrative: string;
  reason?: string | null;
  generated_at?: number | null;
  metrics?: { scored_people: number };
}): Provenance {
  if (!r.narrative.trim() || r.reason) return { kind: "computed" };
  if (r.metrics && r.metrics.scored_people === 0) return { kind: "computed" };
  return { kind: "ai", generatedAt: r.generated_at ?? null };
}

/** The department activity summary — the template is visible only when nobody was scored. */
export function deptSummaryProvenance(d: {
  generated_at: number;
  metrics: { scored_people: number };
}): Provenance {
  if (d.metrics.scored_people === 0) return { kind: "computed" };
  return { kind: "unknown", generatedAt: d.generated_at };
}

/** The screenshot summary — the template is visible only when no frame was analysed. */
export function screenshotSummaryProvenance(s: {
  generated_at: number;
  metrics: { frames: number };
}): Provenance {
  if (s.metrics.frames === 0) return { kind: "computed" };
  return { kind: "unknown", generatedAt: s.generated_at };
}

/** The one line every card prints under its text (empty for `none`). */
export function provenanceLine(p: Provenance): string {
  if (p.kind === "none") return "";
  if (p.kind === "computed") return "Summary of the figures · not written by AI";
  const when = formatGeneratedAt(p.generatedAt);
  if (p.kind === "ai") {
    return ["AI-generated", p.model, when, "may be wrong"].filter(Boolean).join(" · ");
  }
  // Said as it is: usually the model, occasionally the template, and the payload doesn't say which.
  return ["Usually written by AI, which can be wrong", when ? `generated ${when}` : null]
    .filter(Boolean)
    .join(" · ");
}
