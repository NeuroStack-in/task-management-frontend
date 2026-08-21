"use client"

import { useEffect, useRef, useState } from "react"
import {
  BarChart2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  Loader2,
  Paperclip,
  Play,
  PlayCircle,
  Search,
  Send,
  Settings2,
  Sparkles,
  Ticket,
  Timer,
  Users,
  X,
} from "lucide-react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  BannerBackground,
} from "@/components/shared/banner-pattern"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { EmptyState } from "@/components/shared/empty-state"
import { useAssistantStore } from "@/stores/assistant.store"
import { useTourStore } from "@/stores/tour.store"
import { getTour } from "../lib/tours"
import { usePageTitle } from "@/stores/page-header.store"
import { usePermissions } from "@/hooks/use-permissions"
import { useIsSurfaceOn } from "@/hooks/use-features"
import type { PermissionId } from "@/types/rbac"
import {
  FAQS,
  HELP_ARTICLES,
  HELP_CATEGORIES,
  VIDEO_TUTORIALS,
  type HelpArticle,
  type HelpCategory,
} from "../lib/content"
import { ApiError } from "@/lib/api"
import {
  listTickets,
  createTicket,
  getThread,
  addReply,
  closeTicket,
  uploadAttachment,
  ATTACHMENT_TYPES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  type ApiTicketSummary,
  type ApiThread,
} from "../services/support.service"
import { cn } from "@/lib/utils"

// ──────────────────────────────────────────────────────────────────────────────
// Ticket form
// ──────────────────────────────────────────────────────────────────────────────

const ticketSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  category: z.string().min(1, "Please select a category"),
  message: z.string().min(20, "Message must be at least 20 characters"),
})

type TicketForm = z.infer<typeof ticketSchema>

// ──────────────────────────────────────────────────────────────────────────────
// Status badge — the server's status is a free string; map known ones, fall back safely.
// ──────────────────────────────────────────────────────────────────────────────

const TICKET_DOT: Record<string, string> = {
  open: "bg-primary",
  pending: "bg-warning",
  in_progress: "bg-warning",
  resolved: "bg-success",
  closed: "bg-muted-foreground/50",
}
const statusDot = (s: string) => TICKET_DOT[s] ?? "bg-muted-foreground/40"

function StatusBadge({ status }: { status: string }) {
  const variant = status === "open" ? "default" : status === "resolved" ? "outline" : "secondary"
  return (
    <Badge variant={variant} className="capitalize">
      {status.replace(/_/g, " ")}
    </Badge>
  )
}


/**
 * Ticket and reply stamps are epoch **milliseconds**, not seconds.
 *
 * The server writes every one of them with `now_ms()`
 * (`workforce::support_tickets::data`), but this multiplied by 1000 anyway — so a ticket
 * opened today rendered as **"29 Sept 58563"**. The server's shape wins (CLAUDE.md
 * pattern 3): it emits ms, so read ms.
 */
function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// Article sheet
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Split an article body into paragraphs.
 *
 * Bodies are authored as one long string, which rendered verbatim is a wall of text. Where an
 * author used real breaks we honour them; otherwise whole **sentences** are grouped in pairs. The
 * match is on sentence-ending punctuation, so "Settings → Organization, then…" stays intact.
 * Presentation only — no word is added, removed or reordered.
 */
function paragraphs(body: string): string[] {
  const authored = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (authored.length > 1) return authored

  const sentences = body.match(/[^.!?]+[.!?]+(\s|$)/g)?.map((s) => s.trim()) ?? [body]
  const out: string[] = []
  for (let i = 0; i < sentences.length; i += 2) {
    out.push(sentences.slice(i, i + 2).join(" "))
  }
  return out
}

/**
 * The documentation reading panel.
 *
 * Was a badge, a title and an undifferentiated block of body text. Now it has the shape of
 * something written for a person: an accent header carrying the category's own icon, the excerpt
 * set apart as a lead-in, paragraphed prose, and — the part that matters most for a help centre —
 * somewhere to go next. An article ending in whitespace makes a stuck reader close the panel; one
 * ending in related reading and a support CTA does not.
 */
function ArticleSheet({
  article,
  onClose,
  onSelectArticle,
  onAskAi,
}: {
  article: HelpArticle | null
  onClose: () => void
  onSelectArticle: (a: HelpArticle) => void
  onAskAi: () => void
}) {
  const meta = article ? HELP_CATEGORIES.find((c) => c.key === article.category) : undefined
  const Icon = meta?.icon ?? Compass
  const related = article
    ? HELP_ARTICLES.filter(
        (a) => a.category === article.category && a.slug !== article.slug,
      ).slice(0, 3)
    : []

  return (
    <Sheet open={!!article} onOpenChange={(open) => !open && onClose()}>
      {/* `data-[side=right]:` matches the variant the primitive sets its own max-width with, so
          tailwind-merge replaces it instead of leaving two competing rules. */}
      <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:sm:max-w-lg">
        {article && (
          <>
            {/* `shrink-0` is load-bearing: SheetContent is `flex flex-col`, so without it this
                header is a shrinkable flex child and a long article squeezes it until the title
                clips. The body scrolls; the header stays. */}
            <div className="relative shrink-0 overflow-hidden bg-feature px-6 pb-6 pt-7 text-feature-foreground">
              {/* A soft corner wash for depth. The shared `BannerBackground` grid was tried here
                  and read as stray diagonal lines — that motif is drawn for a full-width hero, not
                  a 512px drawer. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,rgb(255_255_255/0.16),transparent_60%)]"
              />
              <SheetHeader className="relative gap-0 p-0">
                {/* `pr-10` keeps the meta row clear of the primitive's absolute close button. */}
                <div className="mb-4 flex items-center gap-2.5 pr-10">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">
                      {meta?.label ?? article.category}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-feature-foreground/75">
                      <Clock className="size-3" />
                      {article.readMins} min read
                    </p>
                  </div>
                </div>
                <SheetTitle className="text-left font-display text-xl font-semibold leading-snug text-feature-foreground">
                  {article.title}
                </SheetTitle>
                <SheetDescription className="mt-2 text-left text-[13px] leading-relaxed text-feature-foreground/85">
                  {article.excerpt}
                </SheetDescription>
              </SheetHeader>
            </div>

            {/* The one scrolling region. `min-h-0` lets a flex child shrink below its content
                height — without it the panel grows and nothing scrolls. */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <article className="px-6 py-6">
                {paragraphs(article.body).map((p, i) => (
                  <p
                    key={i}
                    className={cn(
                      "text-[15px] leading-7 text-foreground/90",
                      i > 0 && "mt-4",
                      i === 0 && "text-foreground",
                    )}
                  >
                    {p}
                  </p>
                ))}
              </article>

              {related.length > 0 && (
                <div className="border-t border-border px-6 py-5">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Related articles
                  </p>
                  <ul className="space-y-1">
                    {related.map((a) => (
                      <li key={a.slug}>
                        <button
                          onClick={() => onSelectArticle(a)}
                          className="group/rel flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{a.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{a.excerpt}</p>
                          </div>
                          <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="size-3" />
                            {a.readMins}m
                          </span>
                          <ChevronDown className="size-4 shrink-0 -rotate-90 text-muted-foreground transition-transform group-hover/rel:translate-x-0.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* The exit for a reader the article didn't help. Without it the panel's only ending
                  is a scrollbar that stops. */}
              <div className="border-t border-border bg-muted/40 px-6 py-5">
                <p className="text-sm font-medium">Didn&apos;t answer your question?</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Ask the assistant, or send it to our support team.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={onAskAi}>
                    <Sparkles className="size-3.5" />
                    Ask the AI assistant
                  </Button>
                  <Button size="sm" variant="outline" onClick={onClose}>
                    <Ticket className="size-3.5" />
                    Submit a ticket
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Guided walkthroughs data
// ──────────────────────────────────────────────────────────────────────────────

const WALKTHROUGHS = [
  {
    id: "getting-started",
    icon: Compass,
    title: "Getting Started",
    description:
      "A 5-step overview of the dashboard, timer, and your first project setup.",
    duration: "~3 min",
  },
  {
    id: "time-tracking",
    icon: Timer,
    title: "Time Tracking",
    description:
      "Start timers, log manual entries, and review daily work summaries.",
    duration: "~4 min",
  },
  {
    id: "insights",
    icon: BarChart2,
    title: "Analytics & Reports",
    description:
      "Navigate productivity scores, anomaly alerts, and export team reports.",
    duration: "~5 min",
  },
  {
    id: "team-management",
    icon: Users,
    title: "Team Management",
    description:
      "Add members, assign roles, and organise departments and teams.",
    duration: "~4 min",
  },
  {
    id: "monitoring-setup",
    icon: Settings2,
    title: "Monitoring Setup",
    description:
      "Configure idle detection, screenshot intervals, and alert thresholds.",
    duration: "~3 min",
  },
] as const

const POPULAR_SEARCHES: { term: string; category: HelpCategory }[] = [
  { term: "Time tracking", category: "time-tracking" },
  { term: "Timesheets", category: "time-tracking" },
  { term: "MFA", category: "security" },
  { term: "Screenshots", category: "monitoring" },
  { term: "Reports", category: "reports" },
  { term: "Billing", category: "billing" },
]

/**
 * Role-based visibility. A category with a `null` permission is visible to
 * everyone; the rest require the matching permission — so employees (who don't
 * hold settings/reports/billing/integrations access) never see admin help
 * content. The support ticket section stays common to all roles.
 */
const CATEGORY_PERMISSION: Record<HelpCategory, PermissionId | null> = {
  "getting-started": null,
  "time-tracking": null,
  security: null,
  general: null,
  monitoring: "settings:view",
  reports: "reports:view",
  billing: "billing:view",
  integrations: "integrations:view",
}

// ──────────────────────────────────────────────────────────────────────────────
// Ticket thread sheet — real GET /v1/support/tickets/{id} + reply
// ──────────────────────────────────────────────────────────────────────────────

function TicketThreadSheet({
  ticketId,
  onClose,
  onReplied,
}: {
  ticketId: string | null
  onClose: () => void
  onReplied: () => void
}) {
  const [thread, setThread] = useState<ApiThread | null>(null)
  const [loading, setLoading] = useState(false)
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!ticketId) {
      setThread(null)
      return
    }
    let live = true
    setLoading(true)
    setThread(null)
    setReply("")
    getThread(ticketId)
      .then((t) => {
        if (live) setThread(t)
      })
      .catch(() => {})
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [ticketId])

  async function send() {
    if (!ticketId || !reply.trim()) return
    setSending(true)
    try {
      await addReply(ticketId, reply.trim())
      setReply("")
      setThread(await getThread(ticketId))
      onReplied()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't send the reply.")
    } finally {
      setSending(false)
    }
  }

  return (
    <Sheet open={!!ticketId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {loading && !thread ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : thread ? (
          <>
            <SheetHeader className="gap-2 border-b p-5">
              <div className="flex items-center gap-2">
                <StatusBadge status={thread.ticket.status} />
                <Badge variant="secondary" className="capitalize">
                  {thread.ticket.category}
                </Badge>
              </div>
              <SheetTitle className="text-left text-base leading-snug">
                {thread.ticket.subject}
              </SheetTitle>
              <SheetDescription className="text-left font-mono text-xs">
                {thread.ticket.ticket_id}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="mb-1 text-xs text-muted-foreground">
                  {fmtDate(thread.ticket.created_at)}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{thread.ticket.description}</p>
              </div>
              {thread.replies.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">No replies yet.</p>
              ) : (
                thread.replies.map((r, i) => (
                  <div key={i} className="rounded-lg border p-3 text-sm">
                    <p className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {r.author === "support" ? "Support" : "Member"}
                      </span>
                      <span>{fmtDate(r.created_at)}</span>
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed">{r.body}</p>
                  </div>
                ))
              )}
            </div>
            <div className="border-t p-4">
              <textarea
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply…"
                className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
              <Button className="mt-2 w-full" size="sm" disabled={!reply.trim() || sending} onClick={send}>
                <Send className="size-4" /> {sending ? "Sending…" : "Send reply"}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Couldn&apos;t load this ticket.
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Help page root
// ──────────────────────────────────────────────────────────────────────────────

export function HelpPage() {
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [tickets, setTickets] = useState<ApiTicketSummary[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  /**
   * Files already uploaded to S3 and waiting to be named on the ticket.
   *
   * Uploaded on pick, not on submit: by the time someone presses "Submit ticket" the bytes are
   * already in S3 and the create call carries only keys. It also means a failed upload is reported
   * next to the file that failed, rather than sinking the whole submission at the end.
   */
  const [files, setFiles] = useState<{ key: string; name: string; size: number }[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [openThreadId, setOpenThreadId] = useState<string | null>(null)
  /** Ticket currently being closed — per-id, so one row's spinner can't disable the others. */
  const [closingId, setClosingId] = useState<string | null>(null)
  const [mediaTab, setMediaTab] = useState<"videos" | "walkthroughs">("videos")
  /**
   * The video being watched, or null.
   *
   * Nothing is mounted until this is set — the tiles are a facade. Six <video> elements on a page
   * people mostly skim would start six range requests against a 125 MB file each.
   */
  const [playing, setPlaying] = useState<(typeof VIDEO_TUTORIALS)[number] | null>(null)

  const openAssistant = useAssistantStore((s) => s.openAssistant)
  // The tour outlives this page — its later steps are on other routes — so it is driven by
  // ProductTour in the app shell and only *started* from here.
  const startTour = useTourStore((s) => s.startTour)
  const askAi = () => openAssistant(search.trim() || undefined)
  const { can } = usePermissions()
  /**
   * Mirrors ChatBot's own gate — if the panel would not render, don't offer a way to open it.
   * On this page that is the assistant bit alone: an Employee holds it without `ai:view`, and the
   * Help Center is exactly where they are meant to use it.
   */
  const canAskAi = can("ai:use")
  const isSurfaceOn = useIsSurfaceOn()

  // Show the page title in the top navbar (this page has no PageHeader).
  usePageTitle("Help Center", "Find answers, guides, and support.")

  // Ticket form
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { subject: "", category: "", message: "" },
  })

  const messageLength = watch("message")?.length ?? 0

  // Load the caller's tickets (real; GSI7). An empty list is the honest initial state.
  const loadTickets = () => {
    let live = true
    setTicketsLoading(true)
    listTickets()
      .then((t) => {
        if (live) setTickets(t)
      })
      .catch(() => {
        /* leave the list empty rather than invent tickets */
      })
      .finally(() => {
        if (live) setTicketsLoading(false)
      })
    return () => {
      live = false
    }
  }
  useEffect(loadTickets, [])

  /**
   * Upload each picked file, one at a time.
   *
   * Sequential rather than `Promise.all`: a burst of parallel presign calls is exactly the
   * per-item fan-out that trips the API's 429/503 throttle (frontend CLAUDE.md pattern 3), and
   * nobody attaches enough screenshots for the latency to matter.
   */
  async function onPickFiles(picked: FileList | null) {
    if (!picked?.length) return
    const room = MAX_ATTACHMENTS - files.length
    const chosen = Array.from(picked).slice(0, room)
    if (picked.length > room) {
      toast.info(`Only ${MAX_ATTACHMENTS} attachments per ticket — the rest were skipped.`)
    }
    setUploading(true)
    try {
      for (const file of chosen) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          toast.error(
            `${file.name} is too large — ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB max.`,
          )
          continue
        }
        try {
          const key = await uploadAttachment(file)
          setFiles((prev) => [...prev, { key, name: file.name, size: file.size }])
        } catch (e) {
          // Named per file: "upload failed" with three selected is not actionable.
          toast.error(
            `Couldn't upload ${file.name}${e instanceof ApiError ? ` — ${e.message}` : ""}`,
          )
        }
      }
    } finally {
      setUploading(false)
    }
  }

  /**
   * Close a ticket the caller opened.
   *
   * No confirmation dialog: closing is reversible — replying to a closed ticket reopens it — so a
   * misclick costs one more click, which is cheaper than a modal on every close. The toast says so
   * rather than leaving them to wonder.
   */
  async function onCloseTicket(id: string) {
    setClosingId(id)
    try {
      await closeTicket(id)
      toast.success("Ticket closed. Replying to it will reopen it.")
      loadTickets()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't close the ticket. Try again.")
    } finally {
      setClosingId(null)
    }
  }

  async function onTicketSubmit(data: TicketForm) {
    setSubmitting(true)
    try {
      const created = await createTicket({
        subject: data.subject,
        description: data.message,
        category: data.category,
        attachments: files.map((f) => f.key),
      })
      reset()
      setFiles([])
      toast.success(`Ticket submitted — ${created.ticket_id}`)
      loadTickets()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't submit the ticket. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // Role-based visibility — admin-only categories/content are filtered out.
  const canCategory = (c: HelpCategory) => {
    const perm = CATEGORY_PERMISSION[c]
    return perm === null || can(perm)
  }
  const visibleCategories = HELP_CATEGORIES.filter((c) => canCategory(c.key))
  // Gated on BOTH the category (as before) and the video's own permission — getting-started
  // ships as two cuts, and an employee has no use for a walkthrough of Payroll and Settings.
  const visibleVideos = VIDEO_TUTORIALS.filter(
    (v) => canCategory(v.category) && (!v.permission || can(v.permission)),
  )
  const visibleWalkthroughs = WALKTHROUGHS.filter((t) => {
    // The gate lives with the tour data, not here. When it was duplicated in this file the two
    // could drift into a visible card whose tour has no steps for that role — a button that does
    // nothing. `tours.test.ts` asserts they agree.
    const tour = getTour(t.id)
    if (tour?.permission && !can(tour.permission)) return false
    // …and hide a tour whose feature the org switched off (or whose mode hides it), so we never
    // launch a walkthrough whose every step would drop (MANAGED-AGENT.md §8).
    if (tour?.feature && !isSurfaceOn(tour.feature)) return false
    return true
  })
  const visibleFaqs = FAQS.filter((f) => !f.permission || can(f.permission))
  const visiblePopular = POPULAR_SEARCHES.filter((p) => canCategory(p.category))

  // Filtered articles (also gated by role via canCategory)
  const filteredArticles = HELP_ARTICLES.filter((a) => {
    if (!canCategory(a.category)) return false
    const matchesSearch =
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.excerpt.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !selectedCategory || a.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-10">
      {/* ── Hero ── */}
      <section className="relative isolate overflow-hidden rounded-[1.6rem] bg-feature px-6 py-10 text-center ring-1 ring-inset ring-white/15 duration-700 animate-in fade-in slide-in-from-bottom-2 sm:py-14">
        {/* Grid lines. The pattern is fixed rather than pickable: `BannerPatternPicker` was a
            temporary preview control, not a product feature, and shipping it let every user restyle
            a page header. The `"dots"` variant is deliberately KEPT in
            `components/shared/banner-pattern.tsx` — it is a real, working alternative and the
            reference for it must stay in the codebase. To switch, change the literal below to
            `"dots"`; to bring the picker back, re-render `<BannerPatternPicker />` here. */}
        <BannerBackground pattern="grid" />
        <div className="relative z-10 text-feature-foreground">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          How can we help?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-feature-foreground/80">
          Search the knowledge base, browse guides, or ask the WorkPulse AI
          assistant.
        </p>

        <div className="mx-auto mt-7 flex max-w-xl flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for answers…"
              className="h-12 rounded-xl border-transparent bg-white pl-10 text-slate-900 shadow-sm placeholder:text-slate-500 dark:bg-white"
            />
          </div>
          {/* The assistant is Owner/Admin-only, and ChatBot renders nothing without `ai:view` —
              so for anyone else this button would set store state and open no panel. Hide it
              rather than ship a control that silently does nothing. */}
          {canAskAi ? (
            <Button
              type="button"
              onClick={askAi}
              className="h-12 gap-2 rounded-xl bg-white text-slate-900 hover:bg-white/90"
            >
              <Sparkles className="size-4 text-primary" /> Ask the assistant
            </Button>
          ) : null}
        </div>

        <div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-feature-foreground/70">Popular:</span>
          {visiblePopular.map((p) => (
            <button
              key={p.term}
              onClick={() => setSearch(p.term)}
              className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-feature-foreground transition-colors hover:bg-white/25"
            >
              {p.term}
            </button>
          ))}
        </div>
        </div>
      </section>

      {/* ── Support tickets ── */}
      <section className="space-y-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Support
        </h2>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Submit ticket form */}
          <Card>
            <CardHeader>
              <CardTitle>Submit a ticket</CardTitle>
              <CardDescription>
                Our support team typically responds within 24 hours on business days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onTicketSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ticket-subject">Subject</Label>
                  <Input
                    id="ticket-subject"
                    placeholder="Brief description of your issue"
                    {...register("subject")}
                    className={cn(errors.subject && "border-destructive")}
                  />
                  {errors.subject && (
                    <p className="text-xs text-destructive">{errors.subject.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Controller
                    control={control}
                    name="category"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        items={Object.fromEntries(
                          visibleCategories.map((cat) => [cat.key, cat.label]),
                        )}
                      >
                        <SelectTrigger
                          className={cn("w-full", errors.category && "border-destructive")}
                        >
                          <SelectValue placeholder="Select a category…" />
                        </SelectTrigger>
                        <SelectContent>
                          {visibleCategories.map((cat) => (
                            <SelectItem key={cat.key} value={cat.key}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.category && (
                    <p className="text-xs text-destructive">{errors.category.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ticket-message">Message</Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {messageLength}/500
                    </span>
                  </div>
                  <textarea
                    id="ticket-message"
                    rows={5}
                    maxLength={500}
                    placeholder="Describe your issue in detail — steps to reproduce, screenshots, error messages…"
                    {...register("message")}
                    className={cn(
                      "w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50",
                      errors.message && "border-destructive",
                    )}
                  />
                  {errors.message && (
                    <p className="text-xs text-destructive">{errors.message.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ATTACHMENT_TYPES.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      void onPickFiles(e.target.files);
                      // Clear it, so re-picking the same file still fires `change`.
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploading || files.length >= MAX_ATTACHMENTS}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Paperclip className="size-3.5" />
                    )}
                    {uploading
                      ? "Uploading…"
                      : files.length >= MAX_ATTACHMENTS
                        ? `Attachment limit reached (${MAX_ATTACHMENTS})`
                        : "Attach screenshots or files"}
                  </button>

                  {files.length > 0 && (
                    <ul className="space-y-1">
                      {files.map((f) => (
                        <li
                          key={f.key}
                          className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs"
                        >
                          <Paperclip className="size-3 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{f.name}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {Math.max(1, Math.round(f.size / 1024))} KB
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${f.name}`}
                            onClick={() =>
                              setFiles((prev) => prev.filter((x) => x.key !== f.key))
                            }
                            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                          >
                            <X className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  <Send className="size-4" />
                  {submitting ? "Submitting…" : "Submit ticket"}
                </Button>

                {canAskAi ? (
                  <p className="text-center text-xs text-muted-foreground">
                    Need an answer now?{" "}
                    <button
                      type="button"
                      onClick={askAi}
                      className="font-medium text-primary hover:underline"
                    >
                      Ask the AI assistant
                    </button>
                  </p>
                ) : null}
              </form>
            </CardContent>
          </Card>

          {/* Recent tickets */}
          <Card>
            <CardHeader>
              <CardTitle>Your recent tickets</CardTitle>
              <CardDescription>Status of previously submitted support requests.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {ticketsLoading ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                  Loading tickets…
                </p>
              ) : tickets.length === 0 ? (
                <div className="px-6 py-8">
                  <EmptyState
                    icon={Ticket}
                    title="No tickets yet"
                    description="Submit your first ticket using the form."
                  />
                </div>
              ) : (
                <ul className="divide-y">
                  {tickets.map((ticket) => (
                    <li
                      key={ticket.ticket_id}
                      className="group/ticket flex items-center gap-3 px-6 py-3.5 transition-colors hover:bg-muted/50"
                    >
                      {/* A <li> with a button inside, not a button wrapping everything: Close needs
                          to be its own control, and a button inside a button is invalid HTML that
                          browsers resolve by silently dropping one of them. */}
                      <button
                        onClick={() => setOpenThreadId(ticket.ticket_id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className={cn("size-2 shrink-0 rounded-full", statusDot(ticket.status))}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{ticket.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-mono">{ticket.ticket_id}</span> ·{" "}
                            {fmtDate(ticket.created_at)}
                          </p>
                        </div>
                      </button>
                      <StatusBadge status={ticket.status} />
                      {ticket.status !== "closed" && (
                        <button
                          onClick={() => onCloseTicket(ticket.ticket_id)}
                          disabled={closingId === ticket.ticket_id}
                          title="Close this ticket"
                          className="flex shrink-0 items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground disabled:opacity-60 sm:opacity-0 sm:group-hover/ticket:opacity-100 sm:focus-visible:opacity-100"
                        >
                          {closingId === ticket.ticket_id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-3.5" />
                          )}
                          Close
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Quick links / categories ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Browse by category
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {visibleCategories.map((cat) => {
            const Icon = cat.icon
            const active = selectedCategory === cat.key
            return (
              <button
                key={cat.key}
                onClick={() =>
                  setSelectedCategory(active ? null : cat.key)
                }
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border p-3 text-center text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/5 text-primary"
                    : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl",
                    active ? "bg-primary/10" : "bg-muted",
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <span className="leading-tight">{cat.label}</span>
                <span className="text-[10px] text-muted-foreground">{cat.count} articles</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Articles ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Documentation &amp; guides
          </h2>
          {(search || selectedCategory) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch("")
                setSelectedCategory(null)
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {filteredArticles.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No articles found"
            description="Try a different search term or browse by category."
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setSelectedCategory(null)
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredArticles.map((article) => {
              const categoryDef = HELP_CATEGORIES.find((c) => c.key === article.category)
              return (
                <button
                  key={article.slug}
                  onClick={() => setSelectedArticle(article)}
                  className="group flex flex-col items-start gap-2 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-muted"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {categoryDef?.label ?? article.category}
                    </Badge>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="size-3" />
                      {article.readMins} min
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-snug group-hover:text-primary">
                    {article.title}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {article.excerpt}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Tutorials: videos / guided walkthroughs (toggle) ── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Tutorials
          </h2>
          <div className="flex rounded-lg border border-border bg-card p-0.5">
            {(
              [
                { k: "videos", label: "Videos", icon: PlayCircle },
                { k: "walkthroughs", label: "Walkthroughs", icon: Compass },
              ] as const
            ).map((o) => {
              const activeTab = mediaTab === o.k
              return (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => setMediaTab(o.k)}
                  aria-pressed={activeTab}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    activeTab
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <o.icon className="size-4" />
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>

        {mediaTab === "videos" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleVideos.map((video, i) => {
              const hue = [210, 160, 280, 30, 190, 320][i % 6]
              return (
                <button
                  key={video.title}
                  disabled={!video.src}
                  onClick={() => video.src && setPlaying(video)}
                  title={video.src ? `Play ${video.title}` : "Not filmed yet"}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border text-left",
                    !video.src && "cursor-not-allowed opacity-60",
                  )}
                >
                  {/* Gradient thumbnail */}
                  <div
                    className="flex h-36 items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, hsl(${hue} 60% 30%), hsl(${hue + 40} 70% 50%))`,
                    }}
                  >
                    {video.src ? (
                      <div className="flex size-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform group-hover:scale-110">
                        <Play className="size-5 fill-white text-white" />
                      </div>
                    ) : (
                      <span className="rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                        Coming soon
                      </span>
                    )}
                  </div>
                  {/* Duration badge */}
                  <div className="absolute top-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
                    {video.duration}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium leading-snug">{video.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                      {HELP_CATEGORIES.find((c) => c.key === video.category)?.label ??
                        video.category}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleWalkthroughs.map((tour) => {
              const Icon = tour.icon
              return (
                <Card key={tour.id} className="flex flex-col">
                  <CardContent className="flex flex-1 flex-col gap-3 pt-5">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-feature-tint text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{tour.title}</p>
                      <p className="text-xs text-muted-foreground">{tour.description}</p>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {tour.duration}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => startTour(tour.id)}
                      >
                        <PlayCircle className="size-4" />
                        Start tour
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ── FAQs ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Frequently asked questions
        </h2>
        <Card>
          <CardContent className="divide-y p-0">
            {visibleFaqs.map((faq, i) => (
              <div key={i}>
                <button
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left text-sm font-medium transition-colors hover:bg-muted/50"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  {faq.q}
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      openFaq === i && "rotate-180",
                    )}
                  />
                </button>
                {openFaq === i && (
                  <p className="px-6 pb-4 text-sm text-muted-foreground">{faq.a}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Article reader sheet */}
      {/* Video player. `key` forces a fresh <video> per title, so switching videos can't leave the
          previous one's buffered stream attached. */}
      <Dialog open={!!playing} onOpenChange={(open) => !open && setPlaying(null)}>
        {/* `sm:` prefixed to match the variant DialogContent sets its own width with
            (`sm:max-w-sm`). An unprefixed `max-w-*` is a different tailwind-merge key, so it
            loses at every breakpoint above sm — which is why this opened at 384px. */}
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="px-5 pb-3 pt-4">
            <DialogTitle className="text-base">{playing?.title}</DialogTitle>
            <DialogDescription className="text-xs">
              {HELP_CATEGORIES.find((c) => c.key === playing?.category)?.label} · {playing?.duration}
            </DialogDescription>
          </DialogHeader>
          {playing?.src ? (
            playing.kind === "embed" ? (
              <iframe
                key={playing.title}
                src={playing.src}
                title={playing.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                className="aspect-video max-h-[72vh] w-full border-0 bg-black"
              />
            ) : (
              <video
                key={playing.title}
                src={playing.src}
                poster={playing.poster}
                controls
                autoPlay
                controlsList="nodownload"
                // `preload` is irrelevant here (we only mount on click) but explicit beats implicit:
                // the browser should stream, never fetch the whole file up front.
                preload="metadata"
                className="aspect-video max-h-[72vh] w-full bg-black object-contain"
              >
                Your browser can&apos;t play this video.
              </video>
            )
          ) : null}
        </DialogContent>
      </Dialog>

      <ArticleSheet
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
        // Swaps content in place rather than closing and reopening, so following a related link
        // reads as turning a page.
        onSelectArticle={setSelectedArticle}
        onAskAi={() => {
          setSelectedArticle(null)
          openAssistant(selectedArticle?.title)
        }}
      />

      {/* Support ticket thread */}
      <TicketThreadSheet
        ticketId={openThreadId}
        onClose={() => setOpenThreadId(null)}
        onReplied={loadTickets}
      />
    </div>
  )
}
