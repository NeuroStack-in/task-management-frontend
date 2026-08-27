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
 */
import { useEffect, useRef, useState } from "react";
import { Sparkles, ArrowUp, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { sendAssistantMessage } from "@/modules/communication/services/assistant.service";
import { Markdown } from "@/components/shared/markdown";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

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
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: "assistant", text: GREETING },
  ]);
  const idRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Guards the seeded question against a re-send when the parent re-renders while open.
  const seededRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending, open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setMessages((m) => [...m, { id: idRef.current++, role: "user", text: trimmed }]);
    setInput("");
    setPending(true);
    try {
      // `history` is the state *before* this turn — it is the conversation, not the message.
      // No `page`: see the module note. `"help"` is the surface request.
      const reply = await sendAssistantMessage(
        trimmed,
        messages.map((m) => ({ role: m.role, content: m.text })),
        undefined,
        "help",
      );
      setMessages((m) => [...m, { id: idRef.current++, role: "assistant", text: reply }]);
    } catch (e) {
      const text =
        e instanceof ApiError && e.status === 403
          ? "You don't have access to the assistant."
          : "Sorry — I couldn't reach the assistant just now. Please try again.";
      setMessages((m) => [...m, { id: idRef.current++, role: "assistant", text }]);
    } finally {
      setPending(false);
    }
  };

  // Ask the seeded question once per opening.
  useEffect(() => {
    if (!open) {
      seededRef.current = undefined;
      return;
    }
    const q = seedQuestion?.trim();
    if (q && seededRef.current !== q) {
      seededRef.current = q;
      void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seedQuestion]);

  const clearChat = () => {
    if (pending) return;
    setMessages([{ id: idRef.current++, role: "assistant", text: GREETING }]);
    setInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="flex-row items-center gap-2.5 border-b px-6 py-4 pr-12">
          <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
            <Sparkles className="size-4" />
          </span>
          <div className="flex-1">
            <DialogTitle>Ask WorkPulse</DialogTitle>
            <DialogDescription>
              Answers about how the product works. It can&apos;t look up your data.
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
          <div className="flex flex-col gap-3 p-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground self-end"
                    : "bg-muted text-foreground self-start",
                )}
              >
                {/* Only the assistant writes Markdown — running a user's own words through a
                    renderer would reformat them back at them. */}
                {m.role === "user" ? m.text : <Markdown>{m.text}</Markdown>}
              </div>
            ))}
            {pending ? (
              <div className="bg-muted text-muted-foreground self-start rounded-lg px-3 py-2 text-sm">
                <span className="inline-flex gap-1">
                  <span className="bg-muted-foreground size-1.5 animate-bounce rounded-full [animation-delay:-0.2s]" />
                  <span className="bg-muted-foreground size-1.5 animate-bounce rounded-full [animation-delay:-0.1s]" />
                  <span className="bg-muted-foreground size-1.5 animate-bounce rounded-full" />
                </span>
              </div>
            ) : null}

            {messages.length <= 1 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="border-border bg-card text-muted-foreground hover:border-primary hover:text-primary rounded-md border px-3 py-1 text-xs transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex shrink-0 items-center gap-2 border-t p-3"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="How does WorkPulse…"
            className="h-10 rounded-md"
            aria-label="Message"
          />
          <Button
            type="submit"
            size="icon"
            className="size-10 shrink-0 rounded-md"
            disabled={!input.trim() || pending}
            aria-label="Send message"
          >
            <ArrowUp className="size-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
