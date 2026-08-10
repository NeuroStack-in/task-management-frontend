/**
 * The AI assistant — the real backend (`assistant` context, LLD §19).
 *
 * `POST /v1/assistant/messages` → a Groq Llama 3.3 70B reply. **Session-only**: the server stores
 * nothing (the conversation lives in the client's component state), so each call is a single turn.
 * Gated server-side by `ai_assistant:use`; a caller without it gets a 403, surfaced as `ApiError`.
 */
import { apiFetch } from "@/lib/api";

interface MessageReply {
  reply: string;
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
export async function sendAssistantMessage(
  message: string,
  history: AssistantTurn[] = [],
): Promise<string> {
  const res = await apiFetch<MessageReply>("/v1/assistant/messages", {
    method: "POST",
    body: JSON.stringify({ message, history }),
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
