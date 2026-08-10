"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAssistantStore } from "@/stores/assistant.store";
import { useIsFeatureOn } from "@/hooks/use-features";
import { ApiError } from "@/lib/api";
import { sendAssistantMessage } from "@/modules/communication/services/assistant.service";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/shared/markdown";

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

// Questions v1 can answer well. It has no live org-data grounding yet (that lands with `insights`),
// so the old data-summary prompts ("Summarize this week") would just draw an honest "I can't see
// your data yet" — these play to what the assistant actually does now.
const SUGGESTIONS = [
  "What can you help me with?",
  "How does WorkPulse track productivity?",
  "Explain the five attendance statuses",
];

export function ChatBot() {
  // The assistant is a plan feature: when the org switches it off, the launcher goes with it
  // rather than sitting there offering a surface every request would be refused for.
  const isFeatureOn = useIsFeatureOn();
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
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending, open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const userMsg: Message = { id: idRef.current++, role: "user", text: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setPending(true);
    try {
      // Real Groq Llama 3.3 70B via /v1/assistant/messages (session-only; nothing stored
      // server-side — so the conversation so far is replayed with each turn, or a follow-up
      // reaches the model with no question attached to it). `messages` here is deliberately the
      // state *before* this turn was appended: it is the history, not the message.
      const reply = await sendAssistantMessage(
        trimmed,
        messages.map((m) => ({ role: m.role, content: m.text })),
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

  // After every hook, so hook order is identical whether or not the feature is on.
  if (!isFeatureOn("ai.assistant")) return null;

  return (
    <>
      {/* Panel */}
      {open ? (
        <div
          role="dialog"
          aria-label="WorkPulse assistant"
          style={panelStyle}
          className={cn(
            "border-border bg-popover shadow-soft animate-in fade-in slide-in-from-bottom-3 fixed z-50 flex h-[28rem] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border duration-200",
            !panelStyle && "right-5 bottom-24",
          )}
        >
          <header className="flex items-center gap-2.5 border-b px-4 py-3">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
              <Sparkles className="size-4" />
            </span>
            <div className="flex-1">
              <p className="text-sm leading-none font-medium">WorkPulse Assistant</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
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
                      ? "bg-primary text-primary-foreground self-end"
                      : "bg-muted text-foreground self-start",
                  )}
                >
                  {/* Only the assistant writes Markdown. A user's message is rendered as the
                      literal text they typed — running it through a renderer would silently
                      reformat their own words back at them. */}
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
          "shadow-soft fixed z-50 size-14 cursor-grab touch-none rounded-lg transition-[opacity,transform] hover:scale-105 hover:opacity-100 active:cursor-grabbing",
          !open && "opacity-40",
          !fab && "right-5 bottom-5",
        )}
      >
        {open ? <X className="size-6" /> : <Sparkles className="size-6" />}
      </Button>
    </>
  );
}
