/**
 * The AI assistant — the real backend (`assistant` context, LLD §19).
 *
 * `POST /v1/assistant/messages` → one model reply. **Session-only**: the server stores nothing (the
 * conversation lives in the client's component state), so each call is a single turn and the
 * conversation so far rides along as `history`. Gated server-side by `ai_assistant:use`; a caller
 * without it gets a 403, surfaced as `ApiError`.
 *
 * Which model answers is the server's business (`wp-platform::ai::models`) and changes without a
 * client release, so it is deliberately not named here — this comment used to say "Groq Llama 3.3
 * 70B" long after that stopped being true (AI audit 2026-10-22, AI-68).
 */
import { apiFetch } from "@/lib/api";
import { localDateOf } from "@/lib/local-day";

/**
 * The longest message the server accepts, in characters. Mirrors
 * `assistant::…::dto::MAX_MESSAGE_CHARS`; a longer one is refused with `400 message_too_long`.
 * Both inputs cap at this with `maxLength`, so the refusal is a last resort, not the UX.
 */
export const ASSISTANT_MESSAGE_MAX = 4000;

interface MessageReply {
  reply: string;
  sources?: AssistantSource[];
  /** See {@link AssistantAnswer.sig}. Absent from a server older than the signing change. */
  sig?: string;
}

/**
 * One lookup an answer was built from. Mirrors `assistant::…::provenance::Source`.
 *
 * **The server decides this, not the model.** The system prompt forbids the assistant naming a
 * tool in its prose — an earlier draft asked for a figure's source and got
 * "(Source: member_day_summary)" — so provenance travels beside the text as data the UI renders.
 * That also means it cannot be omitted or invented by the model.
 */
export interface AssistantSource {
  /** Human label, e.g. "Attendance". Never a tool identifier. */
  label: string;
  /** The day or range actually read. Absent for a lookup with no date. */
  date?: string;
  /** Whose data — a person's name, or a phrase like "the organization". */
  scope?: string;
}

/** A reply and what stands behind it. */
export interface AssistantAnswer {
  reply: string;
  sources: AssistantSource[];
  /**
   * The server's signature over this reply (an HMAC over tenant, user and content). **Opaque** —
   * never parsed, shown or altered here; it is stored with the message and handed back, unchanged,
   * with that message's `content` in the next turn's `history`.
   *
   * It is what lets the server tell its own earlier words from words a client puts in its mouth.
   * History used to be replayed verbatim, so a hand-built `{"role":"assistant"}` turn was treated as
   * something the model had said (AI audit 2026-10-22, AI-23 / WP-543). An assistant turn without a
   * valid signature is now never replayed as the model's words.
   */
  sig?: string;
}

/**
 * Where the user is when they ask. Mirrors `assistant::…::dto::PageContext`.
 *
 * The panel offers to explain "the current screen", and until this existed the request carried no
 * page at all — so the model guessed. Asked on Roles & Permissions it described Attendance.
 *
 * The **description travels from the client** because the client owns routing: it comes from the
 * same navigation entries that render the menus, so a renamed route and its wording change
 * together. A table on the server would go stale silently and answer confidently about a page that
 * no longer exists.
 */
export interface AssistantPage {
  /** Route path, e.g. `/settings/roles`. */
  path: string;
  title?: string;
  description?: string;
  /**
   * `YYYY-MM-DD` the page is showing, when it is date-scoped.
   *
   * Every date-keyed tool on the server defaults to **today (UTC)**. Without this, a user on
   * Analytics with Aug 14 selected got answered about Aug 15 — "no screenshots were captured
   * today" — which is correct about a day they were not looking at.
   */
  date?: string;
  /**
   * What the page currently displays: its filters, and figures the user can already see.
   *
   * Sent so the assistant can *reconcile* a question like "why does it say 1 needs review" against
   * the claim being asked about. The server treats these as an unverified hint, never as evidence
   * — a figure here must be confirmed by a real lookup before the reply asserts it.
   */
  facts?: { label: string; value: string }[];
}

/**
 * One earlier turn of the open conversation. Mirrors `assistant::…::dto::HistoryTurn`.
 *
 * Two shapes, on purpose:
 * - a **user** turn is just what they typed;
 * - an **assistant** turn is a reply *the server returned*, with the `sig` it came with.
 *
 * Nothing the app wrote itself — the greeting, an error sentence, a local note — is ever an
 * assistant turn: those are not words the model said, and replaying them as if they were made it
 * answer turns it never produced (WP-543). `historyFrom` in `../lib/assistant-chat` is the one
 * place that builds this list.
 */
export type AssistantTurn =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      /** Exactly the `reply` the server sent — the signature covers it byte for byte. */
      content: string;
      /** Omitted when the reply came without one (an older server); never invented. */
      sig?: string;
    };

/**
 * Which assistant is being asked.
 *
 * - `"chat"` — the floating assistant: grounded data, org snapshot, full tool belt. Owner/Admin.
 * - `"help"` — the Help Center box: product knowledge only, no lookups. Everyone.
 *
 * **This is a request, not a grant.** The server resolves the effective surface from the caller's
 * permissions (`Surface::resolve`) and only ever narrows it — a caller without `ai:view` is
 * answered on the Help surface whatever this says. Sending it is what lets an Owner/Admin *choose*
 * the Help Center's narrower answer while on that page.
 */
export type AssistantSurface = "chat" | "help";

/**
 * Send one message, get the assistant's reply. Throws `ApiError` on any failure — read it with
 * `assistantErrorMessage` (`../lib/assistant-chat`), which knows the assistant's own error codes
 * (`assistant_rate_limited`, `assistant_daily_limit`, `assistant_budget_exhausted`,
 * `message_too_long`).
 *
 * `history` is the conversation so far, oldest first, **excluding** the message being sent. The
 * server stores nothing, so it only knows what the client replays — without this the model saw a
 * single turn and a follow-up like "from 2/8/26 to 8/8/26" had no question to attach to, which
 * read as the assistant forgetting the conversation. The server bounds, role-filters and
 * signature-checks it.
 */
export async function sendAssistantMessage(
  message: string,
  history: AssistantTurn[] = [],
  page?: AssistantPage,
  surface: AssistantSurface = "chat",
): Promise<AssistantAnswer> {
  // What "today" means to the person typing.
  //
  // The server used to derive this itself, in UTC, so for a UTC+05:30 org every question asked
  // between midnight and 05:30 local resolved to the previous day — "yesterday" answered about the
  // day before yesterday, with real figures for a day nobody asked about. The server now prefers
  // the org's own timezone, but it can't get there alone: that's a display label on some tenants
  // and an IANA name on others, and neither says whether daylight saving is in effect today.
  //
  // `localDateOf` (not `toISOString`, which is UTC and would reintroduce the exact off-by-one) is
  // the same helper the charts use — one definition of "the viewer's day" for the whole app.
  // Computed per call, so a panel left open across midnight doesn't keep asserting yesterday.
  const client_date = localDateOf(Date.now());
  const res = await apiFetch<MessageReply>("/v1/assistant/messages", {
    method: "POST",
    // `page` is omitted rather than sent null when unknown — the server treats an absent page as
    // "don't claim to know where they are", which is the honest default.
    body: JSON.stringify(
      page
        ? { message, history, page, surface, client_date }
        : { message, history, surface, client_date },
    ),
  });
  // Only a non-empty string is a signature. Anything else is dropped rather than echoed back: the
  // server would refuse it anyway, and a turn sent without one is the honest "unsigned" case.
  const sig = typeof res.sig === "string" && res.sig !== "" ? res.sig : undefined;
  return sig
    ? { reply: res.reply, sources: res.sources ?? [], sig }
    : { reply: res.reply, sources: res.sources ?? [] };
}

// There is no thread-history client. The chat is session-only (LLD §19): the server's
// `GET /v1/assistant/threads` always answers `{ threads: [] }` and nothing fetches a thread's
// messages, so the old `listAssistantThreads` had no caller but its own test (QA audit 2026-10-08,
// WP-548).
