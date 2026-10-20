/**
 * Who wrote a summary — the model, or the server's own template — said honestly on every card
 * (UX audit 2026-10-16, MON-08 / XC-08).
 *
 * The cards used to put "AI … report" and the sparkle over whatever text came back, including the
 * server's fixed sentence for a day with nothing to narrate, and none of them said AI can be wrong.
 * The rule now: **AI branding only on text a model wrote**, with "AI-generated · model · time · may
 * be wrong"; the template is labelled "Summary" with no AI mark.
 *
 * **The server says which** (2026-10-20). Every org summary — the day / week / month executive
 * reports, the department and screenshot summaries, the attention brief and the location summary —
 * carries `ai_generated` and `model`: `false` covers every way the server ends up writing the line
 * itself (nothing to narrate, the provider down or failing, AI insights off, another reader already
 * generating it). {@link fromServer} reads those, and each helper below prefers it.
 *
 * Only a payload **without** the fields — a server that predates them, which is what is live until
 * the backend ships — falls back to what the payload can show on its own:
 *
 *  - **Daily executive report**: the fixed line when nobody was scored; otherwise a provider failure
 *    was an HTTP error on those servers, so a report with people scored came from the model.
 *  - **Department / screenshot / location summaries**: the fixed line is visible only when there was
 *    nothing to narrate. The same servers also fell back silently when the provider failed or
 *    another reader was generating, with an identical response, so the card claims neither.
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

/** The authorship fields a payload may carry (`insights::shared::provenance::Authorship`). */
export interface AuthorshipFields {
  ai_generated?: boolean | null;
  model?: string | null;
  generated_at?: number | null;
}

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

/**
 * What the payload itself says about who wrote it — or `null` when it says nothing (a server, or a
 * cached response, from before the fields existed), so the caller falls back to inferring.
 */
export function fromServer(r: AuthorshipFields): Provenance | null {
  if (typeof r.ai_generated !== "boolean") return null;
  if (!r.ai_generated) return { kind: "computed" };
  const model = r.model?.trim();
  return { kind: "ai", generatedAt: r.generated_at ?? null, ...(model ? { model } : {}) };
}

/** The executive report, any resolution (day / week / month) — see the module note. */
export function dailyReportProvenance(
  r: AuthorshipFields & {
    narrative: string;
    reason?: string | null;
    metrics?: { scored_people: number };
  },
): Provenance {
  // Nothing written at all — whatever the flags say, there is no text to attribute.
  if (!r.narrative.trim() || r.reason) return { kind: "computed" };
  const told = fromServer(r);
  if (told) return told;
  if (r.metrics && r.metrics.scored_people === 0) return { kind: "computed" };
  return { kind: "ai", generatedAt: r.generated_at ?? null };
}

/** The department activity summary — see the module note. */
export function deptSummaryProvenance(
  d: AuthorshipFields & { generated_at: number; metrics: { scored_people: number } },
): Provenance {
  const told = fromServer(d);
  if (told) return told;
  if (d.metrics.scored_people === 0) return { kind: "computed" };
  return { kind: "unknown", generatedAt: d.generated_at };
}

/** The screenshot summary — see the module note. */
export function screenshotSummaryProvenance(
  s: AuthorshipFields & { generated_at: number; metrics: { frames: number } },
): Provenance {
  const told = fromServer(s);
  if (told) return told;
  if (s.metrics.frames === 0) return { kind: "computed" };
  return { kind: "unknown", generatedAt: s.generated_at };
}

/**
 * The Locations board's summary — the same rules: the fixed line is visible only when nobody was
 * located; otherwise an older payload can't say whether the model or the fallback wrote it.
 */
export function locationSummaryProvenance(
  l: AuthorshipFields & { generated_at: number; metrics: { located: number } },
): Provenance {
  const told = fromServer(l);
  if (told) return told;
  if (l.metrics.located === 0) return { kind: "computed" };
  return { kind: "unknown", generatedAt: l.generated_at };
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
