"use client";

import { useCallback, useRef, useState } from "react";
import {
  sendAssistantMessage,
  type AssistantPage,
  type AssistantSurface,
} from "@/modules/communication/services/assistant.service";
import {
  assistantErrorMessage,
  historyFrom,
  type ChatMessage,
} from "@/modules/communication/lib/assistant-chat";

/**
 * One assistant conversation: the transcript, whether a reply is on its way, and how to add to it.
 *
 * Shared by both entry points so they cannot drift again — the floating assistant (`surface:
 * "chat"`, with the page context) and the Help Center's (`surface: "help"`, no page). What each turn
 * sends back is decided by `historyFrom`, and what a failure says by `assistantErrorMessage`.
 *
 * **Session-only, by decision.** The transcript is React state and nothing else: it is not written
 * to `sessionStorage` or anywhere else, so a reload — or signing out, which unmounts the shell —
 * clears it, and both panels say so ("This chat isn't saved"). Answers can quote pay, attendance or
 * other people's records; keeping them out of browser storage means a shared computer never shows
 * them to the next person (AI audit 2026-10-22, AI-60).
 */
export function useAssistantConversation({
  greeting,
  surface,
  page,
  enabled = true,
}: {
  /** The opening line. Local: shown, never sent. */
  greeting: string;
  surface: AssistantSurface;
  /** What the user is looking at — the floating assistant only. */
  page?: AssistantPage;
  /** A closed gate sends nothing, whatever calls `send`. */
  enabled?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: 0, role: "assistant", text: greeting, local: true },
  ]);
  const [pending, setPending] = useState(false);
  const idRef = useRef(1);
  // Refs beside the state so `send` decides on the current transcript and the current in-flight
  // flag even when it is called from an effect or twice in one tick (a double Enter).
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const pendingRef = useRef(false);

  const update = (next: (m: ChatMessage[]) => ChatMessage[]) => {
    messagesRef.current = next(messagesRef.current);
    setMessages(messagesRef.current);
  };

  /**
   * Ask `text`. Resolves `true` once a reply has arrived, `false` if nothing was sent or the
   * request failed (the failure is in the transcript by then).
   */
  const send = async (text: string): Promise<boolean> => {
    const trimmed = text.trim();
    if (!enabled || !trimmed || pendingRef.current) return false;
    // The conversation *before* this turn: it is the history, not the message.
    const history = historyFrom(messagesRef.current);
    const userId = idRef.current++;
    update((m) => [...m, { id: userId, role: "user", text: trimmed }]);
    pendingRef.current = true;
    setPending(true);
    try {
      const answer = await sendAssistantMessage(trimmed, history, page, surface);
      update((m) => [
        ...m,
        {
          id: idRef.current++,
          role: "assistant",
          // Kept byte for byte: the signature covers exactly this text.
          text: answer.reply,
          sources: answer.sources,
          ...(answer.sig ? { sig: answer.sig } : {}),
        },
      ]);
      return true;
    } catch (e) {
      // Neither the question that failed nor this sentence is a turn the model saw.
      update((m) => [
        ...m.map((x) => (x.id === userId ? { ...x, local: true as const } : x)),
        {
          id: idRef.current++,
          role: "assistant",
          text: assistantErrorMessage(e),
          local: true,
        },
      ]);
      return false;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  /** Back to the greeting. Nothing is stored server-side, so there is nothing to delete there. */
  const clear = useCallback(() => {
    if (pendingRef.current) return;
    messagesRef.current = [
      { id: idRef.current++, role: "assistant", text: greeting, local: true },
    ];
    setMessages(messagesRef.current);
  }, [greeting]);

  return { messages, pending, send, clear };
}
