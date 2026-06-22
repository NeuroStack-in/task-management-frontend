"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

const GREETING =
  "Hi! I'm Pulse, your WorkPulse assistant. Ask me about productivity, your team, or this screen.";

const SUGGESTIONS = [
  "Summarize this week",
  "Who needs attention?",
  "Draft a productivity report",
];

/** Canned, keyword-based mock replies (no real AI in Phase 1). */
function mockReply(prompt: string): string {
  const q = prompt.toLowerCase();
  if (q.includes("summar") || q.includes("week"))
    return "This week productivity is up 3% overall, led by Engineering and Product. Weekend activity dropped as expected, and two teams show early burnout signals worth a look.";
  if (q.includes("attention") || q.includes("burnout") || q.includes("risk"))
    return "Design and Backend are trending down — Design has 2 people flagged for burnout, and Backend is at −8% today. The Anomaly Center has the details.";
  if (q.includes("report"))
    return "I can draft a productivity report for the last 7 days covering active vs. productive time, top performers, and deadlines. Head to Reports → Custom Report Builder to export it as PDF or CSV.";
  if (q.includes("top") || q.includes("productive"))
    return "Your top performers this week are leading at 90%+ productivity. You can see the full ranking on the Dashboard and in Employees.";
  return "In this demo I answer from mock data. Try asking for a weekly summary, who needs attention, or a productivity report.";
}

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: "assistant", text: GREETING },
  ]);
  const idRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, open]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const userMsg: Message = { id: idRef.current++, role: "user", text: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setPending(true);
    const reply = mockReply(trimmed);
    setTimeout(() => {
      setMessages((m) => [...m, { id: idRef.current++, role: "assistant", text: reply }]);
      setPending(false);
    }, 700);
  };

  return (
    <>
      {/* Panel */}
      {open ? (
        <div
          role="dialog"
          aria-label="WorkPulse assistant"
          className="fixed bottom-24 right-5 z-50 flex h-[28rem] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[1.4rem] border border-border bg-popover shadow-soft animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <header className="flex items-center gap-2.5 border-b px-4 py-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium leading-none">Pulse Assistant</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Always here to help</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Close assistant"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-3 p-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    m.role === "user"
                      ? "self-end bg-primary text-primary-foreground"
                      : "self-start bg-muted text-foreground",
                  )}
                >
                  {m.text}
                </div>
              ))}
              {pending ? (
                <div className="self-start rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <span className="inline-flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
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
                      className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
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
            className="flex items-center gap-2 border-t p-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Pulse…"
              className="h-10 rounded-full"
              aria-label="Message"
            />
            <Button
              type="submit"
              size="icon"
              className="size-10 shrink-0 rounded-full"
              disabled={!input.trim() || pending}
              aria-label="Send message"
            >
              <ArrowUp className="size-4" />
            </Button>
          </form>
        </div>
      ) : null}

      {/* Floating button */}
      <Button
        size="icon"
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 size-14 rounded-full shadow-soft transition-transform hover:scale-105"
      >
        {open ? <X className="size-6" /> : <Sparkles className="size-6" />}
      </Button>
    </>
  );
}
