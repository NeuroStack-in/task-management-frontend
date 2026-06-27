"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Megaphone, Plus, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import {
  CONVERSATIONS,
  QUICK_REPLIES,
  type ChatMessage,
  type Conversation,
} from "@/lib/mock-inbox";
import { cn } from "@/lib/utils";

export function InboxView() {
  const [conversations, setConversations] =
    useState<Conversation[]>(CONVERSATIONS);
  const [activeId, setActiveId] = useState(CONVERSATIONS[0].id);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  /**
   * On narrow viewports (<lg) only one pane is shown at a time.
   * "list" = conversation list, "thread" = active thread.
   */
  const [mobilePane, setMobilePane] = useState<"list" | "thread">("list");
  const idRef = useRef(100);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId)!;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => c.name.toLowerCase().includes(q));
  }, [conversations, query]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [active.messages.length, activeId]);

  const openConversation = (id: string) => {
    setActiveId(id);
    setMobilePane("thread");
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
    );
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const msg: ChatMessage = {
      id: `s-${idRef.current++}`,
      fromMe: true,
      text: trimmed,
      time: "now",
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, messages: [...c.messages, msg], lastTime: "now" }
          : c,
      ),
    );
    setDraft("");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inbox"
        description="Direct messages and team channels."
        actions={
          <Button onClick={() => toast.info("New message isn't wired up in this demo.")}>
            <Plus className="size-4" /> New message
          </Button>
        }
      />

      {/*
        Two-pane layout:
        - lg+: side-by-side (320px list | 1fr thread), both always visible.
        - <lg: single-column; mobilePane controls which is shown.
      */}
      <Card className="grid h-[68vh] min-h-[560px] gap-0 overflow-hidden p-0 lg:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <aside
          className={cn(
            "flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r",
            // Mobile: hide when viewing a thread
            mobilePane === "thread" ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations…"
                className="h-9 pl-8"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                active={c.id === activeId}
                onClick={() => openConversation(c.id)}
              />
            ))}
          </div>
        </aside>

        {/* Thread */}
        <section
          className={cn(
            "flex min-h-0 flex-col",
            // Mobile: hide when viewing the list
            mobilePane === "list" ? "hidden lg:flex" : "flex",
          )}
        >
          {/* Thread header */}
          <div className="flex items-center gap-3 border-b px-4 py-3">
            {/* Back button — visible only on mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 lg:hidden"
              aria-label="Back to conversations"
              onClick={() => setMobilePane("list")}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <ConversationAvatar conversation={active} />
            <div className="min-w-0">
              <p className="truncate font-medium">{active.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {active.kind === "channel"
                  ? active.role
                  : active.online
                    ? "Active now"
                    : `Last seen ${active.lastTime}`}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/30 px-5 py-4"
          >
            {active.messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
          </div>

          {/* Composer */}
          <div className="space-y-2 border-t p-3">
            {/* Quick-reply chips: single row, scrollable, max height capped */}
            <div className="flex max-h-8 flex-nowrap gap-1.5 overflow-x-auto overflow-y-hidden">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
            >
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${active.name}…`}
                className="h-10 flex-1"
              />
              <Button
                type="submit"
                size="icon"
                className="size-10 shrink-0 rounded-full"
                disabled={!draft.trim()}
                aria-label="Send"
              >
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        </section>
      </Card>
    </div>
  );
}

function ConversationRow({
  conversation: c,
  active,
  onClick,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  const last = c.messages[c.messages.length - 1];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
        active && "bg-feature-tint/50",
      )}
    >
      <ConversationAvatar conversation={c} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex-1 truncate text-sm",
              c.unread > 0 ? "font-semibold" : "font-medium",
            )}
          >
            {c.name}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {c.lastTime}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex-1 truncate text-xs",
              c.unread > 0 ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {last.fromMe ? "You: " : ""}
            {last.text}
          </span>
          {c.unread > 0 ? (
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground tabular-nums">
              {c.unread}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function ConversationAvatar({
  conversation: c,
}: {
  conversation: Conversation;
}) {
  if (c.kind === "channel") {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-feature-tint text-primary">
        <Megaphone className="size-4" />
      </span>
    );
  }
  return (
    <span className="relative shrink-0">
      <Avatar className="size-9">
        <AvatarImage src={c.avatarUrl} alt={c.name} />
        <AvatarFallback className="text-xs">{initials(c.name)}</AvatarFallback>
      </Avatar>
      {c.online ? (
        <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-success ring-2 ring-card" />
      ) : null}
    </span>
  );
}

function Bubble({ message: m }: { message: ChatMessage }) {
  return (
    <div className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}>
      <div className="max-w-[78%] space-y-0.5">
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-soft",
            m.fromMe
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md bg-card text-foreground",
          )}
        >
          {m.text}
        </div>
        <p
          className={cn(
            "px-1 text-[10px] text-muted-foreground",
            m.fromMe ? "text-right" : "text-left",
          )}
        >
          {m.time}
        </p>
      </div>
    </div>
  );
}
