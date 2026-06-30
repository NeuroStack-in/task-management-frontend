"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAssistantStore } from "@/stores/assistant.store";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

/** Floating-button geometry + persisted position. */
const FAB_SIZE = 56; // size-14
const FAB_MARGIN = 16; // gap from the edge after snapping
const FAB_KEY = "wp-fab-pos";

interface FabPos {
  x: number;
  y: number;
}

const GREETING =
  "I'm your WorkPulse assistant. Ask about productivity, your team, or the current screen.";

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
  return "This assistant runs on sample data in the demo. Try asking for a weekly summary, who needs attention, or a productivity report.";
}

export function ChatBot() {
  const open = useAssistantStore((s) => s.open);
  const setOpen = useAssistantStore((s) => s.setOpen);
  const pendingPrompt = useAssistantStore((s) => s.pendingPrompt);
  const consumePrompt = useAssistantStore((s) => s.consumePrompt);

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

  // When opened with a seeded prompt (e.g. from the Help Center "Ask AI"
  // button), send it once.
  useEffect(() => {
    if (open && pendingPrompt) {
      const prompt = consumePrompt();
      if (prompt) send(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingPrompt]);

  /* ── Draggable, edge-snapping floating button ──────────────────────── */
  const [fab, setFab] = useState<FabPos | null>(null);
  const dragRef = useRef(false);
  const movedRef = useRef(false);
  const startRef = useRef({ px: 0, py: 0, x: 0, y: 0 });

  const clampFab = (p: FabPos): FabPos => ({
    x: Math.min(Math.max(8, p.x), window.innerWidth - FAB_SIZE - 8),
    y: Math.min(Math.max(8, p.y), window.innerHeight - FAB_SIZE - 8),
  });

  // Load the saved position (or default to bottom-right) once mounted, and keep
  // it inside the viewport on resize.
  useEffect(() => {
    let initial: FabPos = {
      x: window.innerWidth - FAB_SIZE - 20,
      y: window.innerHeight - FAB_SIZE - 20,
    };
    try {
      const raw = window.localStorage.getItem(FAB_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.x === "number" && typeof p?.y === "number") initial = p;
      }
    } catch {
      /* ignore */
    }
    setFab(clampFab(initial));
    const onResize = () => setFab((p) => (p ? clampFab(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /** Snap the button to whichever viewport edge is nearest. */
  const snapToEdge = (p: FabPos): FabPos => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dl = p.x;
    const dr = vw - (p.x + FAB_SIZE);
    const dt = p.y;
    const db = vh - (p.y + FAB_SIZE);
    const nearest = Math.min(dl, dr, dt, db);
    let { x, y } = p;
    if (nearest === dl) x = FAB_MARGIN;
    else if (nearest === dr) x = vw - FAB_SIZE - FAB_MARGIN;
    else if (nearest === dt) y = FAB_MARGIN;
    else y = vh - FAB_SIZE - FAB_MARGIN;
    return clampFab({ x, y });
  };

  const onFabPointerDown = (e: React.PointerEvent) => {
    if (!fab) return;
    movedRef.current = false;
    dragRef.current = true;
    startRef.current = { px: e.clientX, py: e.clientY, x: fab.x, y: fab.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onFabPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - startRef.current.px;
    const dy = e.clientY - startRef.current.py;
    if (!movedRef.current && Math.hypot(dx, dy) > 4) movedRef.current = true;
    if (movedRef.current) {
      setFab(clampFab({ x: startRef.current.x + dx, y: startRef.current.y + dy }));
    }
  };
  const onFabPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (movedRef.current) {
      setFab((p) => {
        if (!p) return p;
        const snapped = snapToEdge(p);
        try {
          window.localStorage.setItem(FAB_KEY, JSON.stringify(snapped));
        } catch {
          /* ignore */
        }
        return snapped;
      });
    }
  };
  const onFabClick = () => {
    // Ignore the click synthesized at the end of a drag.
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    setOpen(!open);
  };

  // Anchor the chat panel to the button's current corner.
  const panelStyle: React.CSSProperties | undefined = fab
    ? (() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cx = fab.x + FAB_SIZE / 2;
        const cy = fab.y + FAB_SIZE / 2;
        const s: React.CSSProperties = {};
        if (cx < vw / 2) s.left = fab.x;
        else s.right = vw - (fab.x + FAB_SIZE);
        if (cy > vh / 2) s.bottom = vh - fab.y + 12;
        else s.top = fab.y + FAB_SIZE + 12;
        return s;
      })()
    : undefined;

  return (
    <>
      {/* Panel */}
      {open ? (
        <div
          role="dialog"
          aria-label="WorkPulse assistant"
          style={panelStyle}
          className={cn(
            "fixed z-50 flex h-[28rem] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-soft animate-in fade-in slide-in-from-bottom-3 duration-200",
            !panelStyle && "bottom-24 right-5",
          )}
        >
          <header className="flex items-center gap-2.5 border-b px-4 py-3">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium leading-none">WorkPulse Assistant</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                AI productivity assistant
              </p>
            </div>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-3 p-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                    m.role === "user"
                      ? "self-end bg-primary text-primary-foreground"
                      : "self-start bg-muted text-foreground",
                  )}
                >
                  {m.text}
                </div>
              ))}
              {pending ? (
                <div className="self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
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
                      className="rounded-md border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
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
              placeholder="Ask the assistant…"
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
        </div>
      ) : null}

      {/* Floating button — draggable, snaps to the nearest edge */}
      <Button
        size="icon"
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
        style={fab ? { left: fab.x, top: fab.y } : undefined}
        onPointerDown={onFabPointerDown}
        onPointerMove={onFabPointerMove}
        onPointerUp={onFabPointerUp}
        onClick={onFabClick}
        className={cn(
          "fixed z-50 size-14 touch-none cursor-grab rounded-lg shadow-soft transition-[opacity,transform] hover:scale-105 hover:opacity-100 active:cursor-grabbing",
          !open && "opacity-40",
          !fab && "bottom-5 right-5",
        )}
      >
        {open ? <X className="size-6" /> : <Sparkles className="size-6" />}
      </Button>
    </>
  );
}
