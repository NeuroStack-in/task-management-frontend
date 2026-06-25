"use client";

import { useState } from "react";
import {
  FileText,
  Inbox as InboxIcon,
  Mail,
  Megaphone,
  Reply,
  Send,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { initials } from "@/lib/format";
import {
  MESSAGES,
  TEMPLATES,
  type Folder,
  type Message,
} from "@/lib/mock-inbox";
import { cn } from "@/lib/utils";

type View = Folder | "templates";

const FOLDERS: { value: View; label: string; icon: LucideIcon }[] = [
  { value: "inbox", label: "Inbox", icon: InboxIcon },
  { value: "announcements", label: "Announcements", icon: Megaphone },
  { value: "sent", label: "Sent", icon: Send },
  { value: "templates", label: "Templates", icon: FileText },
];

export function InboxView() {
  const [messages, setMessages] = useState<Message[]>(MESSAGES);
  const [view, setView] = useState<View>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>("msg-1");

  const folderMessages =
    view === "templates"
      ? []
      : messages.filter((m) => m.folder === view);
  const selected = messages.find((m) => m.id === selectedId) ?? null;

  const unreadIn = (f: Folder) =>
    messages.filter((m) => m.folder === f && !m.read).length;

  const open = (m: Message) => {
    setSelectedId(m.id);
    if (!m.read) {
      setMessages((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, read: true } : x)),
      );
    }
  };

  const toggleStar = (id: string) =>
    setMessages((prev) =>
      prev.map((x) => (x.id === id ? { ...x, starred: !x.starred } : x)),
    );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inbox"
        description="Internal mail, company announcements, and message templates."
        actions={
          <Button
            onClick={() => toast.info("Compose isn't wired up in this demo.")}
          >
            <Mail className="size-4" /> Compose
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,340px)_1fr]">
        {/* Folders */}
        <nav className="flex gap-2 lg:flex-col">
          {FOLDERS.map((f) => {
            const Icon = f.icon;
            const count =
              f.value === "templates"
                ? TEMPLATES.length
                : unreadIn(f.value as Folder);
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setView(f.value)}
                className={cn(
                  "flex flex-1 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors lg:flex-none",
                  view === f.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1 text-left">{f.label}</span>
                {count > 0 ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      view === f.value
                        ? "bg-white/20"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {view === "templates" ? (
          <Card className="lg:col-span-2">
            <div className="grid gap-3 sm:grid-cols-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toast.success(`Template “${t.name}” loaded.`)}
                  className="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-feature-tint text-primary">
                    <FileText className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.category}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        ) : (
          <>
            {/* Message list */}
            <Card className="max-h-[640px] overflow-y-auto p-0">
              {folderMessages.length === 0 ? (
                <EmptyState
                  icon={InboxIcon}
                  title="No messages"
                  description="This folder is empty."
                  className="m-3 border-0"
                />
              ) : (
                <ul className="divide-y">
                  {folderMessages.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => open(m)}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                          selectedId === m.id && "bg-feature-tint/50",
                          !m.read && "bg-feature-tint/30",
                        )}
                      >
                        <Avatar className="size-8">
                          <AvatarImage src={m.from.avatarUrl} alt={m.from.name} />
                          <AvatarFallback className="text-[10px]">
                            {initials(m.from.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "flex-1 truncate text-sm",
                                !m.read && "font-semibold",
                              )}
                            >
                              {m.from.name}
                            </span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {m.time}
                            </span>
                          </div>
                          <p className="truncate text-sm font-medium">
                            {m.subject}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {m.preview}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Reading pane */}
            <Card className="min-h-[400px]">
              {selected ? (
                <div className="space-y-4 px-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="font-display text-xl font-semibold">
                        {selected.subject}
                      </h2>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarImage
                            src={selected.from.avatarUrl}
                            alt={selected.from.name}
                          />
                          <AvatarFallback className="text-[10px]">
                            {initials(selected.from.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {selected.from.name}
                        </span>
                        {selected.from.role ? (
                          <Badge variant="outline">{selected.from.role}</Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {selected.time}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label="Star"
                      onClick={() => toggleStar(selected.id)}
                    >
                      <Star
                        className={cn(
                          "size-4",
                          selected.starred &&
                            "fill-warning text-warning",
                        )}
                      />
                    </Button>
                  </div>

                  <div className="space-y-3 border-t pt-4 text-sm leading-relaxed text-foreground/90">
                    {selected.body.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>

                  <div className="flex gap-2 border-t pt-4">
                    <Button
                      variant="outline"
                      onClick={() => toast.info("Reply isn't wired up in this demo.")}
                    >
                      <Reply className="size-4" /> Reply
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Mail}
                  title="No message selected"
                  description="Pick a message from the list to read it here."
                  className="border-0"
                />
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
