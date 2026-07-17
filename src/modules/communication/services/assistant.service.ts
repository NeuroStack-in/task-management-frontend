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

/** Send one message, get the assistant's reply. Throws `ApiError` on 401/403/5xx. */
export async function sendAssistantMessage(message: string): Promise<string> {
  const res = await apiFetch<MessageReply>("/v1/assistant/messages", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
  return res.reply;
}
