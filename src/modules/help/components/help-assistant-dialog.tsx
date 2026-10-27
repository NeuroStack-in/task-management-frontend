"use client";

/**
 * The **Help Center assistant** — the one every user gets.
 *
 * Deliberately not the floating `ChatBot`. That one is an oversight tool: it carries the page
 * context, the org snapshot and the full tool belt, and it is gated on `ai:view` so only Owner and
 * Admin see it. This one answers "how does WorkPulse work?" and nothing else.
 *
 * **The narrowing is server-side, not here.** Every turn is sent with `surface: "help"`, and
 * `Surface::resolve` on the server confines a caller without `ai:view` to that surface no matter
 * what the body says — so an employee gets product knowledge with **no grounded fetch, no org
 * snapshot and an empty tool belt**, whether they use this panel or `curl`. Sending the surface is
 * what lets an Owner/Admin *choose* this narrower answer while they are on the Help Center; it is
 * not what enforces it for anyone else.
 *
 * Consequently **no page context is sent**. The floating assistant passes `page` so it can answer
 * "what is this screen showing"; that question is meaningless here, and passing it would only put
 * on-screen figures in front of a model that must not reason about them.
 *
 * It is built from the same pieces as the floating assistant (`modules/communication`): the same
 * signed history, error sentences, live-region transcript, source chips, 4,000-character box and
 * "AI can be wrong" line. It had none of the last four (AI audit 2026-10-22, AI-34).
 */
import { useEffect, useRef, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAssistantAccess } from "@/hooks/use-assistant-access";
import { useAssistantConversation } from "@/modules/communication/hooks/use-assistant-conversation";
import {
  ASSISTANT_NAME,
  AssistantComposer,
  AssistantFootnote,
  AssistantTranscript,
} from "@/modules/communication/components/assistant-transcript";

const GREETING =
  "Ask me how WorkPulse works — productivity scores, attendance statuses, projects, leave, or how to get something done.";

/**
 * Questions this surface can actually answer well.
 *
 * All definitional on purpose. "How am I doing this week?" is a data question, and this assistant
 * cannot look anything up — offering it would be advertising a capability the surface does not have.
 */
const SUGGESTIONS = [
  "How is the productivity score calculated?",
  "What do the attendance statuses mean?",
  "How do I request leave?",
];

export function HelpAssistantDialog({
  open,
  onOpenChange,
  seedQuestion,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A question to ask on open — the Help Center's search box hands its text over. */
  seedQuestion?: string;
}) {
  const [input, setInput] = useState("");
  const { messages, pending, send: ask, clear } = useAssistantConversation({
    greeting: GREETING,
    surface: "help",
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /**
   * The seed question last asked. **Not reset on close**: the dialog keeps its transcript while the
   * Help Center is open, and reopening it from the same search text used to send the same question
   * again — a second billed turn with a duplicate answer under the first (AI audit FP-15 / AI-61).
   * It is asked once per distinct question; clearing the chat forgets it, so it can be asked anew.
   */
  const seededRef = useRef<string | undefined>(undefined);

  // What it can do *for this reader*. An owner or admin also has the floating assistant, which
  // reads the organization's data; telling them flatly "it can't look up your data" (as the old
  // "Ask WorkPulse" title did) read as though no assistant could (AI audit AI-58).
  const hasDataAssistant = useAssistantAccess().chat;

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending, open]);

  const send = (text: string) => {
    if (!text.trim() || pending) return;
    setInput("");
    void ask(text);
  };

  // Ask the seeded question once per distinct question — not once per opening.
  useEffect(() => {
    if (!open) return;
    const q = seedQuestion?.trim();
    if (!q || seededRef.current === q) return;
    // Already the last thing asked (typed, or a seed before a clear-and-reopen): don't repeat it.
    const lastAsked = [...messages].reverse().find((m) => m.role === "user" && !m.local);
    seededRef.current = q;
    if (lastAsked?.text === q) return;
    send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seedQuestion]);

  const clearChat = () => {
    if (pending) return;
    clear();
    seededRef.current = undefined;
    setInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Focus lands in the message box, as it does in the floating assistant — it used to land
          on the Clear button, so a keyboard user had to find the box first (AI-34). */}
      <DialogContent
        initialFocus={inputRef}
        className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogHeader className="flex-row items-center gap-2.5 border-b px-6 py-4 pr-12">
          <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
            <Sparkles className="size-4" />
          </span>
          <div className="flex-1">
            <DialogTitle>{ASSISTANT_NAME}</DialogTitle>
            <DialogDescription>
              {hasDataAssistant
                ? "Answers how WorkPulse works. For your organization's data, open the assistant from the sparkle button."
                : "Answers how WorkPulse works. It can't look up hours, leave or anyone's data here."}
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={clearChat}
            disabled={messages.length <= 1 || pending}
            title="Clear chat"
            aria-label="Clear chat"
            className="text-muted-foreground hover:text-foreground size-8 shrink-0"
          >
            <Trash2 className="size-4" />
          </Button>
        </DialogHeader>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {/* Source chips render here too: the Help surface may now say what it read
              (contract 3), and it is shown exactly as the floating assistant shows it. */}
          <AssistantTranscript
            messages={messages}
            pending={pending}
            suggestions={SUGGESTIONS}
            onSuggestion={send}
          />
        </div>

        <AssistantComposer
          inputRef={inputRef}
          value={input}
          onChange={setInput}
          onSubmit={() => send(input)}
          pending={pending}
          placeholder="How does WorkPulse…"
        />
        <AssistantFootnote className="-mt-1">
          AI can be wrong — check anything important in the help articles. This chat isn&apos;t
          saved; leaving the Help center or reloading clears it.
        </AssistantFootnote>
      </DialogContent>
    </Dialog>
  );
}
