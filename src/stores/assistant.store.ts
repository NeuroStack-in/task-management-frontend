import { create } from "zustand";

interface AssistantState {
  /** Whether the floating assistant panel is open. */
  open: boolean;
  /** A prompt to auto-send the next time the panel opens (e.g. from "Ask AI"). */
  pendingPrompt: string | null;
  setOpen: (open: boolean) => void;
  /** Open the assistant, optionally seeding a question to send immediately. */
  openAssistant: (prompt?: string) => void;
  /** Read and clear the pending prompt (the chatbot consumes it on open). */
  consumePrompt: () => string | null;
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  open: false,
  pendingPrompt: null,
  setOpen: (open) => set({ open }),
  openAssistant: (prompt) => set({ open: true, pendingPrompt: prompt ?? null }),
  consumePrompt: () => {
    const p = get().pendingPrompt;
    if (p !== null) set({ pendingPrompt: null });
    return p;
  },
}));
