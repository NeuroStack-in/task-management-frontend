"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAssistantStore } from "@/stores/assistant.store";
import { useIsFeatureOn, useIsPageOn } from "@/hooks/use-features";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api";
import { sendAssistantMessage } from "@/modules/communication/services/assistant.service";
import { navItemForPath } from "@/constants/navigation";
import { usePublishedPageContext } from "@/stores/page-context.store";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/shared/markdown";

/**
 * The assistant's page key. It is a floating launcher, not a route, so it cannot key off an href —
 * but it is a surface an org may want to hide, so it carries a pseudo-key in the same namespace.
 * The `page:` prefix keeps it unmistakable from a real path.
 */
export const ASSISTANT_PAGE_KEY = "page:assistant";

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

/**
 * The Help Center, where an Employee is allowed the assistant.
 *
 * Prefix-matched rather than compared exactly so a future `/help/<topic>` keeps it. Exported so the
 * page's own "Ask AI" button and this launcher can never disagree about where it is offered — a
 * button that opens a panel which then refuses to render is the specific failure to avoid.
 */
export function isHelpRoute(pathname: string | null | undefined): boolean {
  return !!pathname && (pathname === "/help" || pathname.startsWith("/help/"));
}

export function ChatBot() {
  // The assistant is a plan feature: when the org switches it off, the launcher goes with it
  // rather than sitting there offering a surface every request would be refused for.
  const isFeatureOn = useIsFeatureOn()
  const isPageOn = useIsPageOn();
  // …and on the caller holding the assistant bit. The two gates answer different questions —
  // "did the org buy it" vs "may this role use it" — and both must pass. Without the second, every
  // signed-in user got the launcher and reached a surface the server refuses outright.
  const { can } = usePermissions();
  const open = useAssistantStore((s) => s.open);
  const setOpen = useAssistantStore((s) => s.setOpen);
  const pendingPrompt = useAssistantStore((s) => s.pendingPrompt);
  const consumePrompt = useAssistantStore((s) => s.consumePrompt);

  // What the user is looking at, resolved from the same navigation entries that render the menus.
  // The greeting promises answers about "the current screen"; this is what makes that true.
  const pathname = usePathname();
  // …and what that page is *showing* — the selected day and the figures already on screen, when
  // the page publishes them. Identity alone was not enough: the tools all default to today, so a
  // page sitting on another date got answered about the wrong one, and an on-screen figure the
  // assistant had no way to see got flatly denied instead of explained.
  const published = usePublishedPageContext();
  const page = useMemo(() => {
    if (!pathname) return undefined;
    const item = navItemForPath(pathname);
    return {
      path: pathname,
      title: item?.label,
      description: item?.description,
      date: published.date ?? undefined,
      facts: published.facts.length > 0 ? published.facts : undefined,
    };
  }, [pathname, published]);

  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: "assistant", text: GREETING },
  ]);
  const idRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Both halves of "outside": the panel, and the launcher that toggles it. Without the launcher in
  // the exclusion, clicking it while open would close via this handler and immediately reopen via
  // its own onClick — the button would look dead.
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending, open]);

  /**
   * Click (or tap) anywhere else closes the panel, as does Escape.
   *
   * `pointerdown` rather than `click`: a click fires only after pointerup, so dragging a text
   * selection out of the panel and releasing over the page would dismiss it mid-drag. `pointerdown`
   * also beats the FAB's own drag handler to the event, which is why the launcher is excluded by
   * ref rather than by checking the event target's role.
   *
   * Only bound while open — a global listener that runs on every page for a closed panel is a
   * listener nobody needs.
   */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (fabRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

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
        page,
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

  /** Drop the transcript back to the greeting. Session-only state, so there is nothing to delete
   *  server-side — the panel simply forgets, and the next turn starts with no history to replay. */
  const clearChat = () => {
    if (pending) return;
    setMessages([{ id: idRef.current++, role: "assistant", text: GREETING }]);
    setInput("");
  };

  // After every hook, so hook order is identical whether or not the gates pass.
  //
  // **`ai:use` decides whether; `ai:view` decides where.**
  //
  // Employees hold the assistant bit again as of 2026-08-27 (`wp-contracts::roles::employee`), so
  // the "one bit, everywhere" rule that briefly replaced this would now put a chatbot on every
  // page for every employee — the opposite of the decision that granted it back. The grant was
  // deliberately narrow: an Employee gets it on the Help Center, where "how does WorkPulse work"
  // is asked and the answer needs no data reads at all.
  //
  // The objection to this rule was that a custom role granted only `ai:use` would get a launcher
  // that "mysteriously appears on one page". That is accepted, and it is not mysterious once the
  // two bits are read as what they are: `ai:view` is the *oversight* half — it means you may ask
  // about other people — and a role without it has nothing org-wide to ask, anywhere but here.
  // Roles & Permissions describes them separately for that reason.
  //
  // This is UX convenience only: `auth.require(AiAssistantUse)` on `POST /v1/assistant/messages`
  // is the real gate, and `scope::authorize` still refuses every cross-person question behind it.
  // The assistant is a launcher, not a route, so it carries a pseudo page-key rather than an href.
  // Same layer-3 rule as any page: org preference on top of plan + permission, owners exempt.
  if (!isPageOn(ASSISTANT_PAGE_KEY)) return null;
  if (!isFeatureOn("ai.assistant") || !can("ai:use")) return null;
  if (!can("ai:view") && !isHelpRoute(pathname)) return null;

  return (
    <>
      {/* Panel */}
      {open ? (
        <div
          ref={panelRef}
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
            {/* Enabled only when there is a transcript to lose — a greeting-only panel has
                nothing to clear, so the control would do nothing but look available. */}
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
        ref={fabRef}
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
