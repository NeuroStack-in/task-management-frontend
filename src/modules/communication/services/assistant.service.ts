/**
 * The AI assistant — the real backend (`assistant` context, LLD §19).
 *
 * `POST /v1/assistant/messages` → a Groq Llama 3.3 70B reply. **Session-only**: the server stores
 * nothing (the conversation lives in the client's component state), so each call is a single turn.
 * Gated server-side by `ai_assistant:use`; a caller without it gets a 403, surfaced as `ApiError`.
 */
import { apiFetch } from "@/lib/api";
import { localDateOf } from "@/lib/local-day";

interface MessageReply {
  reply: string;
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

/** One earlier turn of the open conversation. Mirrors `assistant::…::dto::HistoryTurn`. */
export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Send one message, get the assistant's reply. Throws `ApiError` on 401/403/5xx.
 *
 * `history` is the conversation so far, oldest first, **excluding** the message being sent. The
 * server stores nothing, so it only knows what the client replays — without this the model saw a
 * single turn and a follow-up like "from 2/8/26 to 8/8/26" had no question to attach to, which
 * read as the assistant forgetting the conversation. The server bounds and role-filters it.
 */
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

export async function sendAssistantMessage(
  message: string,
  history: AssistantTurn[] = [],
  page?: AssistantPage,
  surface: AssistantSurface = "chat",
): Promise<string> {
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
  return res.reply;
}

/**
 * Mirrors `assistant::features::list_threads::ThreadsResponse` — the server's thread summaries are
 * **bare strings** (no id / title / timestamp / messages). Because the chat is session-only (LLD
 * §19), the deployed handler always returns `[]` today; the route exists so history can light up
 * without a client change if the server ever starts persisting threads.
 */
interface ThreadsResponse {
  threads: string[];
}

/**
 * List past assistant threads — `GET /v1/assistant/threads` (gated by `ai_assistant:use`, 403 →
 * `ApiError`). Note there is **no** route to fetch a thread's messages, so a summary from this list
 * can never be resumed server-side — callers may only start a new conversation about it.
 */
export async function listAssistantThreads(): Promise<string[]> {
  const res = await apiFetch<ThreadsResponse>("/v1/assistant/threads");
  return res.threads;
}
