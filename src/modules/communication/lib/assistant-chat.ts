/**
 * The assistant conversation's client-side rules — pure functions, shared by the floating
 * assistant (`components/layout/chat-bot.tsx`) and the Help Center's (`help-assistant-dialog.tsx`).
 *
 * Both surfaces used to carry their own copy of this logic, and they drifted: the Help one never got
 * the live region, the disclaimer or the source chips the floating one had (AI audit 2026-10-22,
 * AI-34). What the two must agree on — which turns go back to the server, what a refusal says, how
 * close to the length cap a message is — now lives once, here, with tests.
 */
import { ApiError } from "@/lib/api";
import {
  ASSISTANT_MESSAGE_MAX,
  type AssistantSource,
  type AssistantTurn,
} from "@/modules/communication/services/assistant.service";

/** One bubble in the transcript. */
export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  /**
   * Not a turn of the conversation: the canned greeting, the client's own error sentences, and a
   * question whose request failed. All of it used to be replayed to the model as history — the
   * greeting and the apologies labelled `assistant` — so it answered turns it never produced, and
   * after a 403 it tended to repeat the refusal (QA audit 2026-10-08, WP-543).
   */
  local?: true;
  /**
   * What the answer was read from — the server's own record of which lookups ran, over which day
   * and for whom. Absent on the greeting, on an error, and whenever no lookup happened.
   *
   * Rendered as chips rather than folded into the text on purpose: the assistant is forbidden from
   * naming a tool in its prose, so this is the only honest way to show it, and it cannot be
   * omitted or invented by the model.
   */
  sources?: AssistantSource[];
  /** The server's signature over `text`, when it sent one — see `AssistantAnswer.sig`. */
  sig?: string;
}

/**
 * How much history the server replays: its newest `MAX_HISTORY_TURNS` turns, then newest-first
 * while `MAX_HISTORY_CHARS` lasts (`assistant::…::dto`). Mirrored so the client stops sending what
 * the server would drop anyway — the whole transcript went up on every turn (AI audit FP-16).
 * The server still enforces its own bounds; these only keep the request honest about its size.
 */
export const HISTORY_MAX_TURNS = 20;
export const HISTORY_MAX_CHARS = 16_000;

/** Characters, counted the way the server counts them (Unicode scalar values, not UTF-16 units). */
const charCount = (s: string) => Array.from(s).length;

/**
 * The `history` to send with the next message: the conversation's real turns, oldest first.
 *
 * - **Local messages never go back** — not the greeting, not an error sentence, not a question
 *   whose request failed. They are words the app wrote, and an assistant turn is a claim that the
 *   model said them.
 * - **An assistant turn carries its `sig`**, exactly as the server sent it, with exactly the text
 *   it signed. A reply that came without one (an older server) goes back without one — the server
 *   then treats it as a quoted note, never as the model's words — and no signature is ever made up.
 * - A user turn never carries a `sig`, even if one were somehow attached to it.
 */
export function historyFrom(messages: readonly ChatMessage[]): AssistantTurn[] {
  const turns: AssistantTurn[] = [];
  for (const m of messages) {
    if (m.local || m.text.trim() === "") continue;
    if (m.role === "assistant") {
      turns.push(
        m.sig
          ? { role: "assistant", content: m.text, sig: m.sig }
          : { role: "assistant", content: m.text },
      );
    } else {
      turns.push({ role: "user", content: m.text });
    }
  }
  // Newest first until the server's budgets are spent, then back into conversation order.
  const recent = turns.slice(-HISTORY_MAX_TURNS);
  let budget = HISTORY_MAX_CHARS;
  let start = recent.length;
  for (let i = recent.length - 1; i >= 0; i--) {
    const len = charCount(recent[i].content);
    if (len > budget) break;
    budget -= len;
    start = i;
  }
  return recent.slice(start);
}

/* ── Errors ──────────────────────────────────────────────────────────────────────────────── */

/**
 * The assistant's own refusal codes (the server ↔ client contract, assistant hardening round
 * 2026-10-27). Each comes with a server sentence written to be shown to the person who asked.
 */
export type AssistantLimitCode =
  | "assistant_rate_limited"
  | "assistant_daily_limit"
  | "assistant_budget_exhausted"
  | "message_too_long";

/**
 * What to say for each code when the server's own sentence is missing or unfit to show (an older
 * server put `rate limited: assistant_rate_limited` in `message`). Each says what happened and what
 * to do next — and none of them says "couldn't reach the assistant", which told a rate-limited
 * person to retry at once and someone with a too-long message to resend it forever (AI-25).
 */
const LIMIT_FALLBACK: Record<AssistantLimitCode, string> = {
  assistant_rate_limited:
    "You've sent a lot of messages in the last minute. Wait a moment, then try again.",
  assistant_daily_limit:
    "You've reached today's limit for assistant messages. You can ask again tomorrow.",
  assistant_budget_exhausted:
    "Your organization has used today's AI allowance, so the assistant is paused until tomorrow.",
  message_too_long: `That message is too long. Keep it under ${ASSISTANT_MESSAGE_MAX.toLocaleString(
    "en-US",
  )} characters and try again.`,
};

const isLimitCode = (code: string | undefined): code is AssistantLimitCode =>
  !!code && Object.prototype.hasOwnProperty.call(LIMIT_FALLBACK, code);

/** Said only when the request never got an answer at all — the one case it is true. */
export const ASSISTANT_UNREACHABLE =
  "Sorry — I couldn't reach the assistant just now. Check your connection and try again.";
const ASSISTANT_TIMEOUT = "The assistant took too long to answer. Try again in a moment.";
const ASSISTANT_NO_ACCESS = "You don't have access to the assistant.";
const ASSISTANT_TURNED_OFF = "The assistant is turned off for your organization.";

/**
 * Is a server sentence fit to show as-is? The contract says these codes carry one, but an older
 * server sends `rate limited: assistant_rate_limited` — a code dressed as a sentence — so anything
 * that reads like a developer message falls back to ours.
 */
function showable(msg: string | undefined): string | null {
  const t = msg?.trim();
  if (!t || t.length < 8 || t.length > 300) return null;
  if (/^[a-z][a-z _]*:\s/i.test(t)) return null; // "rate limited: …", "validation: …"
  if (/\b[a-z0-9]+_[a-z0-9_]+\b/.test(t)) return null; // a raw code or field name
  if (/exception|panic|unwrap|internal error/i.test(t)) return null;
  const sentence = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?…]$/.test(sentence) ? sentence : `${sentence}.`;
}

/** A sentence that already says when: "40 seconds", "about 7 hours", "2 min", "at 00:00 UTC". */
const SAYS_WHEN =
  /\d+\s*(?:seconds?|secs?|s|minutes?|mins?|hours?|hrs?|h)\b|\d{1,2}:\d{2}/i;

/**
 * `retry_after_secs` from the error, when the client was given it.
 *
 * Duck-typed: the server puts it in the error object, and `ApiError` exposes it as `retryAfterSecs`
 * once `lib/api` copies it across. Until then this reads nothing and the sentence simply has no
 * countdown — never a made-up one.
 */
export function retryAfterOf(e: unknown): number | undefined {
  if (typeof e !== "object" || e === null) return undefined;
  const o = e as { retryAfterSecs?: unknown; retry_after_secs?: unknown };
  const v = o.retryAfterSecs ?? o.retry_after_secs;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

/**
 * A wait, as a person reads it: "40 s", "3 min", "2 h 15 min".
 *
 * Rounded **up**, so "try again in 1 min" is never early. Not `HH:MM:SS` — that is the glossary's
 * notation for an amount of time worked, and a countdown in it ("00:00:40") reads as a duration.
 */
export function formatWait(secs: number): string {
  const s = Math.max(1, Math.ceil(secs));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.ceil(s / 60)} min`;
  let h = Math.floor(s / 3600);
  let m = Math.ceil((s % 3600) / 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * The sentence to show in the transcript when a message fails.
 *
 * - The assistant's four limit codes: the **server's** sentence (it knows which budget ran out and
 *   when it resets), or ours when it sent none fit to show — plus "Try again in 40 s" when the
 *   server said how long.
 * - No answer at all (offline, DNS, a timeout): the only case that says "couldn't reach".
 * - 403: no access, or the assistant turned off for the organization.
 * - Anything else: `ApiError.message`, which `lib/errors` has already made display-ready
 *   ("Something went wrong on our side…"), rather than claiming the network failed.
 */
export function assistantErrorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return ASSISTANT_UNREACHABLE;

  // An older server refused an over-long message as plain `validation`; it is the same refusal.
  const code =
    e.code === "validation" && /too long/i.test(e.serverMessage ?? "")
      ? "message_too_long"
      : e.code;

  if (isLimitCode(code)) {
    const said = showable(e.serverMessage) ?? LIMIT_FALLBACK[code];
    const wait = retryAfterOf(e);
    // Don't append a countdown to a sentence that already gives one — the server's own say "wait
    // about 40 seconds" and "resets at 00:00 UTC (in about 7 hours)".
    if (wait === undefined || SAYS_WHEN.test(said)) return said;
    return `${said} Try again in ${formatWait(wait)}.`;
  }

  if (e.status === 0)
    return e.code === "timeout" ? ASSISTANT_TIMEOUT : ASSISTANT_UNREACHABLE;
  if (e.status === 403) {
    return e.code === "feature_disabled" || e.code === "feature_not_in_plan"
      ? ASSISTANT_TURNED_OFF
      : ASSISTANT_NO_ACCESS;
  }
  return e.message || ASSISTANT_UNREACHABLE;
}

/* ── Composer ────────────────────────────────────────────────────────────────────────────── */

/**
 * From how many characters the composer shows its counter. Below this it is noise; from here on
 * someone pasting a long question needs to see the cap coming (contract 4: 4,000 characters).
 */
export const COUNTER_FROM = 3500;

/**
 * The counter's text, or `null` while the message is comfortably short.
 *
 * Counted in UTF-16 units — the same unit `maxLength` enforces — so the counter and the cap can
 * never disagree. The server counts characters, which is never more, so a message the box accepts
 * is never refused as too long.
 */
export function counterText(
  length: number,
  max: number = ASSISTANT_MESSAGE_MAX,
): string | null {
  if (length < COUNTER_FROM) return null;
  const n = (v: number) => v.toLocaleString("en-US");
  return length >= max
    ? `${n(max)} / ${n(max)} — that's the limit`
    : `${n(length)} / ${n(max)}`;
}

/* ── Focus ───────────────────────────────────────────────────────────────────────────────── */

/**
 * Where Tab should go so focus stays inside an open panel: the first item after the last, the last
 * before the first, or `null` to let the browser move normally.
 *
 * The floating assistant is a non-modal dialog, and Tab from its message box used to land on
 * "Skip to main content" while the panel stayed open over the page (AI audit AI-61). Escape (or the
 * launcher) is the way out, as it already was.
 */
export function focusLoopTarget<T>(
  items: readonly T[],
  active: T | null,
  backwards: boolean,
): T | null {
  if (items.length === 0) return null;
  const first = items[0];
  const last = items[items.length - 1];
  const at = active === null ? -1 : items.indexOf(active);
  if (backwards) return at <= 0 ? last : null;
  return at === -1 || at === items.length - 1 ? first : null;
}

/** The keyboard-reachable controls inside `root`, in tab order. */
export function focusablesIn(root: HTMLElement): HTMLElement[] {
  const sel =
    'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  // `:disabled` again after the selector: Base UI keeps `tabindex="0"` on a disabled button, so the
  // `[tabindex]` arm matched the disabled Send button and Tab "wrapped" to a control the browser
  // itself skips — straight out of the panel.
  return Array.from(root.querySelectorAll<HTMLElement>(sel)).filter(
    (el) =>
      el.tabIndex >= 0 &&
      !el.matches(":disabled") &&
      el.getAttribute("aria-disabled") !== "true" &&
      el.getClientRects().length > 0,
  );
}
