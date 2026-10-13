"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAssistantStore } from "@/stores/assistant.store";
import { useAssistantAccess } from "@/hooks/use-assistant-access";
import { ApiError } from "@/lib/api";
import {
  sendAssistantMessage,
  type AssistantSource,
} from "@/modules/communication/services/assistant.service";
import { navItemForPath } from "@/constants/navigation";
import { usePublishedPageContext } from "@/stores/page-context.store";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/shared/markdown";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  /**
   * Not a turn of the conversation: the canned greeting, the client's own error sentences, and a
   * question whose request failed. All of it used to be replayed to the model as history — the
   * greeting and the apologies labelled `assistant` — so it answered turns it never produced, and
   * after a 403 it tended to repeat the refusal (QA audit 2026-10-08, WP-543).
   */
  local?: true;
  /**
   * What the answer was read from — the server's own record of which lookups ran, over which day
   * and for whom. Absent on the greeting, on an error, and whenever no lookup happened.
   *
   * Rendered as chips rather than folded into the text on purpose: the assistant is forbidden from
   * naming a tool in its prose, so this is the only honest way to show it, and it cannot be
   * omitted or invented by the model.
   */
  sources?: AssistantSource[];
}

/** Floating-button geometry + persisted position. */
const FAB_SIZE = 56; // size-14
const FAB_MARGIN = 16; // gap from the edge after snapping
const FAB_KEY = "wp-fab-pos";

/** The panel's preferred size (28rem × 22rem), and its gaps to the launcher and the viewport. */
const PANEL_H = 448;
const PANEL_W = 352;
const PANEL_GAP = 12;
const VIEWPORT_EDGE = 8;
const PANEL_ID = "wp-assistant-panel";

interface FabPos {
  x: number;
  y: number;
}

const GREETING =
  "I'm your WorkPulse assistant. Ask about productivity, your team, or the current screen.";

// Opening questions for an empty panel. The assistant can answer from live org data now (the
// handler has a grounded data path, an org snapshot and a tool belt — `send_message/mod.rs`), and
// the on-screen page context rides with every question; these are simply general starters.
const SUGGESTIONS = [
  "What can you help me with?",
  "How does WorkPulse track productivity?",
  "Explain the five attendance statuses",
];

export function ChatBot() {
  // The org's switch (plan feature + page toggle) AND the caller's bits — see `useAssistantAccess`.
  // Evaluated before any effect below: the gate used to sit after every hook, so with the assistant
  // switched off a seeded prompt was still sent from a panel nobody could see (WP-364).
  const available = useAssistantAccess().chat;
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
    { id: 0, role: "assistant", text: GREETING, local: true },
  ]);
  const idRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
    // Escape closes the panel only when it is pressed *in* the assistant. As a bare document
    // listener it also fired for an Escape meant for a select or menu elsewhere on the page, and
    // closed the chat along with it (WP-546).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const target = e.target as Node | null;
      const inside =
        !!target && (!!panelRef.current?.contains(target) || !!fabRef.current?.contains(target));
      if (!inside) return;
      setOpen(false);
      fabRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  // Opening moves focus into the panel's message box, so a keyboard or screen-reader user lands in
  // the dialog they just opened rather than wherever they were on the page.
  useEffect(() => {
    if (open && available) inputRef.current?.focus();
  }, [open, available]);

  // Switched off (or out of reach) while open: close, and drop any seeded question rather than let
  // it fire the next time something opens the store.
  useEffect(() => {
    if (available) return;
    if (open) setOpen(false);
    if (pendingPrompt) consumePrompt();
  }, [available, open, pendingPrompt, setOpen, consumePrompt]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!available || !trimmed || pending) return;
    const userMsg: Message = { id: idRef.current++, role: "user", text: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setPending(true);
    try {
      // Real Groq Llama 3.3 70B via /v1/assistant/messages (session-only; nothing stored
      // server-side — so the conversation so far is replayed with each turn, or a follow-up
      // reaches the model with no question attached to it). `messages` here is deliberately the
      // state *before* this turn was appended: it is the history, not the message — and only its
      // real turns (see `Message.local`).
      const answer = await sendAssistantMessage(
        trimmed,
        messages.filter((m) => !m.local).map((m) => ({ role: m.role, content: m.text })),
        page,
      );
      setMessages((m) => [
        ...m,
        {
          id: idRef.current++,
          role: "assistant",
          text: answer.reply,
          sources: answer.sources,
        },
      ]);
    } catch (e) {
      const text =
        e instanceof ApiError && e.status === 403
          ? "You don't have access to the assistant."
          : "Sorry — I couldn't reach the assistant just now. Please try again.";
      // Neither the question that failed nor this sentence is a turn the model saw.
      setMessages((m) => [
        ...m.map((x) => (x.id === userMsg.id ? { ...x, local: true as const } : x)),
        { id: idRef.current++, role: "assistant", text, local: true },
      ]);
    } finally {
      setPending(false);
    }
  };

  // When opened with a seeded prompt (an "Ask the assistant" button), send it once — after any
  // request already in flight, rather than consuming the prompt and dropping it (WP-364).
  useEffect(() => {
    if (!available || !open || !pendingPrompt || pending) return;
    const prompt = consumePrompt();
    if (prompt) void send(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, open, pendingPrompt, pending]);

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

  /**
   * Anchor the chat panel beside the launcher — and keep all of it on screen.
   *
   * It was a fixed 448px anchored 12px above or below the launcher with no clamping, so a launcher
   * dragged to mid-height (or any short viewport) put the header or the input off-screen (WP-360).
   * Now: the height shrinks to fit the viewport, the panel opens toward whichever side of the
   * launcher has more room, and both axes are clamped inside the viewport.
   */
  const panelStyle: React.CSSProperties | undefined = fab
    ? (() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const height = Math.min(PANEL_H, vh - VIEWPORT_EDGE * 2);
        const width = Math.min(PANEL_W, vw - VIEWPORT_EDGE * 2);
        const cx = fab.x + FAB_SIZE / 2;
        const preferredLeft = cx < vw / 2 ? fab.x : fab.x + FAB_SIZE - width;
        const left = Math.min(Math.max(VIEWPORT_EDGE, preferredLeft), vw - width - VIEWPORT_EDGE);
        const roomAbove = fab.y - PANEL_GAP;
        const roomBelow = vh - (fab.y + FAB_SIZE + PANEL_GAP);
        const preferredTop =
          roomAbove >= roomBelow ? fab.y - PANEL_GAP - height : fab.y + FAB_SIZE + PANEL_GAP;
        const top = Math.min(Math.max(VIEWPORT_EDGE, preferredTop), vh - height - VIEWPORT_EDGE);
        return { left, top, width, height };
      })()
    : undefined;

  /** Drop the transcript back to the greeting. Session-only state, so there is nothing to delete
   *  server-side — the panel simply forgets, and the next turn starts with no history to replay. */
  const clearChat = () => {
    if (pending) return;
    setMessages([{ id: idRef.current++, role: "assistant", text: GREETING, local: true }]);
    setInput("");
  };

  // After every hook, so hook order is identical whether or not the gates pass.
  //
  // **The floating chatbot needs BOTH bits; the Help Center needs only `ai:use`** (owner decision,
  // 2026-08-27). There are two assistants now, and they are not the same product:
  //
  //   floating chatbot (here)  — `ai:use` + `ai:view` — Owner/Admin. Grounded data, org snapshot,
  //                              full tool belt. Answers questions about other people.
  //   Help Center box          — `ai:use`             — everyone. Product knowledge only; no
  //                              lookups at all (see `help-page.tsx`).
  //
  // `ai:view` (`AiInsightsRead`, bit 62) is the oversight half. Employees hold `ai:use` so they can
  // ask the Help Center how WorkPulse works, and lack `ai:view` — which is precisely what the
  // server reads in `Surface::resolve` to confine them to the Help surface. Gating this widget on
  // `ai:use` alone would put the oversight launcher on every page for every employee.
  //
  // This is UX convenience only. The real boundary is server-side: `Surface::resolve` decides the
  // surface from the caller's own bits and ignores what the client asks for, so an employee who
  // calls the endpoint directly still gets the Help assistant — no tools, no snapshot, no fetch.
  // The assistant is a launcher, not a route, so it carries a pseudo page-key rather than an href.
  // Same layer-3 rule as any page: org preference on top of plan + permission, owners exempt.
  if (!available) return null;

  return (
    <>
      {/* Panel */}
      {open ? (
        <div
          ref={panelRef}
          id={PANEL_ID}
          role="dialog"
          aria-label="WorkPulse assistant"
          style={panelStyle}
          className={cn(
            "border-border bg-popover shadow-soft animate-in fade-in slide-in-from-bottom-3 fixed z-50 flex h-[28rem] max-h-[calc(100dvh-1rem)] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border duration-200",
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
                  {/* What it read. Deliberately quiet — this is a footnote a reader checks when a
                      figure surprises them, not a headline. The most likely wrong answer left is
                      one that is right about the wrong day, and this is what makes that visible
                      instead of indistinguishable from a correct one. */}
                  {m.sources?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1 border-t pt-1.5">
                      {m.sources.map((src, i) => (
                        <span
                          key={i}
                          className="bg-background/60 text-muted-foreground rounded px-1.5 py-0.5 text-[0.7rem] leading-tight"
                        >
                          {[src.label, src.date, src.scope].filter(Boolean).join(" · ")}
                        </span>
                      ))}
                    </div>
                  ) : null}
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
              ref={inputRef}
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
        aria-controls={open ? PANEL_ID : undefined}
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
