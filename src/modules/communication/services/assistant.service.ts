/**
 * The AI assistant — the real backend (`assistant` context, LLD §19).
 *
 * `POST /v1/assistant/messages` → a Groq Llama 3.3 70B reply. **Session-only**: the server stores
 * nothing (the conversation lives in the client's component state), so each call is a single turn.
 * Gated server-side by `ai_assistant:use`; a caller without it gets a 403, surfaced as `ApiError`.
 *
 * `GET /v1/assistant/threads` → **always `{threads: []}`**. Session-only chat means there is no
 * thread store behind it; the handler's only real behaviour is the `ai_assistant:use` permission
 * check. It is therefore useful as a *capability probe* (200 = the assistant is available to you,
 * 403 = it isn't) and nothing else. There is deliberately no thread-list UI: rendering a
 * "conversations" pane over an endpoint that can never return one would imply history the product
 * doesn't keep.
 */
import { apiFetch, ApiError } from "@/lib/api";

interface MessageReply {
  reply: string;
}

/** Mirrors `assistant::features::list_threads::ThreadsResponse`. */
export interface ApiThreadsResponse {
  /** Always empty — chat is session-only, so nothing is persisted server-side. */
  threads: string[];
}

/** Send one message, get the assistant's reply. Throws `ApiError` on 401/403/5xx. */
export async function sendAssistantMessage(message: string): Promise<string> {
  const res = await apiFetch<MessageReply>("/v1/assistant/messages", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
  return res.reply;
}

/**
 * `GET /v1/assistant/threads` — the stored thread list, which is always empty (see the module note).
 * Throws `ApiError`; a 403 means the caller lacks `ai_assistant:use`.
 */
export async function listAssistantThreads(): Promise<string[]> {
  const res = await apiFetch<ApiThreadsResponse>("/v1/assistant/threads");
  return res?.threads ?? [];
}

/**
 * Probe whether the assistant is available to the signed-in user, using the threads route purely as
 * a cheap permission check. `false` on a 403; other failures (network, 5xx) rethrow so a transient
 * outage isn't mistaken for "you don't have access".
 */
export async function canUseAssistant(): Promise<boolean> {
  try {
    await listAssistantThreads();
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) return false;
    throw e;
  }
}
