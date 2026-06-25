"use client"

import { useState } from "react"
import {
  BarChart2,
  ChevronDown,
  Clock,
  Compass,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { EmptyState } from "@/components/shared/empty-state"
import { useAssistantStore } from "@/stores/assistant.store"
import {
  FAQS,
  HELP_ARTICLES,
  HELP_CATEGORIES,
  MOCK_TICKETS,
  VIDEO_TUTORIALS,
  nextTicketId,
  type HelpArticle,
  type HelpCategory,
  type SupportTicket,
} from "@/lib/mock-help"
import { cn } from "@/lib/utils"

// ──────────────────────────────────────────────────────────────────────────────
// Ticket form
// ──────────────────────────────────────────────────────────────────────────────

const ticketSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  category: z.string().min(1, "Please select a category"),
  priority: z.string().min(1),
  message: z.string().min(20, "Message must be at least 20 characters"),
})

type TicketForm = z.infer<typeof ticketSchema>

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", dot: "bg-muted-foreground/40" },
  { value: "medium", label: "Medium", dot: "bg-primary" },
  { value: "high", label: "High", dot: "bg-warning" },
  { value: "urgent", label: "Urgent", dot: "bg-destructive" },
] as const

const TICKET_DOT: Record<SupportTicket["status"], string> = {
  open: "bg-primary",
  pending: "bg-warning",
  resolved: "bg-success",
}

// ──────────────────────────────────────────────────────────────────────────────
// Status badge
// ──────────────────────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<
  SupportTicket["status"],
  "default" | "secondary" | "outline"
> = {
  open: "default",
  pending: "secondary",
  resolved: "outline",
}

function StatusBadge({ status }: { status: SupportTicket["status"] }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className="capitalize">
      {status}
    </Badge>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Article sheet
// ──────────────────────────────────────────────────────────────────────────────

function ArticleSheet({
  article,
  onClose,
}: {
  article: HelpArticle | null
  onClose: () => void
}) {
  return (
    <Sheet open={!!article} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {article && (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {HELP_CATEGORIES.find((c) => c.key === article.category)?.label ??
                    article.category}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  {article.readMins} min read
                </span>
              </div>
              <SheetTitle className="text-left text-lg leading-snug">
                {article.title}
              </SheetTitle>
              <SheetDescription className="text-left">{article.excerpt}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-8 text-sm leading-relaxed text-foreground/90">
              {article.body}
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
    title: "Insights & Reports",
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

const POPULAR_SEARCHES = ["Time tracking", "Screenshots", "Reports", "Billing"]

// ──────────────────────────────────────────────────────────────────────────────
// Help page root
// ──────────────────────────────────────────────────────────────────────────────

export function HelpPage() {
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [tickets, setTickets] = useState<SupportTicket[]>([...MOCK_TICKETS])

  const openAssistant = useAssistantStore((s) => s.openAssistant)
  const askAi = () => openAssistant(search.trim() || undefined)

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
    defaultValues: { subject: "", category: "", message: "", priority: "medium" },
  })

  const messageLength = watch("message")?.length ?? 0

  function onTicketSubmit(data: TicketForm) {
    const id = nextTicketId()
    const newTicket: SupportTicket = {
      id,
      subject: data.subject,
      category: data.category as HelpCategory,
      status: "open",
      createdAt: "2026-06-25",
    }
    setTickets((p) => [newTicket, ...p])
    reset()
    toast.success(`Ticket submitted — ${id}`)
  }

  // Filtered articles
  const filteredArticles = HELP_ARTICLES.filter((a) => {
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
      <section className="relative overflow-hidden rounded-[1.6rem] bg-feature px-6 py-12 text-center text-feature-foreground sm:py-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          How can we help?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-feature-foreground/80">
          Search the knowledge base, browse guides, or ask the WorkPulse AI
          assistant.
        </p>

        <div className="mx-auto mt-7 flex max-w-xl flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for answers…"
              className="h-12 rounded-xl border-transparent bg-card pl-10 text-foreground shadow-sm placeholder:text-muted-foreground"
            />
          </div>
          <Button
            type="button"
            onClick={askAi}
            className="h-12 gap-2 rounded-xl bg-card text-foreground hover:bg-card/90"
          >
            <Sparkles className="size-4 text-primary" /> Ask AI
          </Button>
        </div>

        <div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-feature-foreground/70">Popular:</span>
          {POPULAR_SEARCHES.map((term) => (
            <button
              key={term}
              onClick={() => setSearch(term)}
              className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-feature-foreground transition-colors hover:bg-white/25"
            >
              {term}
            </button>
          ))}
        </div>
      </section>

      {/* ── Quick links / categories ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Browse by category
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {HELP_CATEGORIES.map((cat) => {
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

      {/* ── Video tutorials ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Video tutorials
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VIDEO_TUTORIALS.map((video, i) => {
            const hue = [210, 160, 280, 30, 190, 320][i % 6]
            return (
              <button
                key={video.title}
                onClick={() => toast.info("Video player coming soon")}
                className="group relative overflow-hidden rounded-2xl border text-left"
              >
                {/* Gradient thumbnail */}
                <div
                  className="flex h-36 items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, hsl(${hue} 60% 30%), hsl(${hue + 40} 70% 50%))`,
                  }}
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform group-hover:scale-110">
                    <Play className="size-5 fill-white text-white" />
                  </div>
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
      </section>

      {/* ── FAQs ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Frequently asked questions
        </h2>
        <Card>
          <CardContent className="divide-y p-0">
            {FAQS.map((faq, i) => (
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

      {/* ── Guided walkthroughs ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Guided walkthroughs
        </h2>
        <p className="text-sm text-muted-foreground">
          Interactive step-by-step tours that walk you through key features in context.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WALKTHROUGHS.map((tour) => {
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
                      onClick={() => toast.success(`"${tour.title}" tour started`)}
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Controller
                      control={control}
                      name="category"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger
                            className={cn(
                              "w-full",
                              errors.category && "border-destructive",
                            )}
                          >
                            <SelectValue placeholder="Select a category…" />
                          </SelectTrigger>
                          <SelectContent>
                            {HELP_CATEGORIES.map((cat) => (
                              <SelectItem key={cat.key} value={cat.key}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.category && (
                      <p className="text-xs text-destructive">
                        {errors.category.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Controller
                      control={control}
                      name="priority"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {(v) => {
                                const opt = PRIORITY_OPTIONS.find(
                                  (p) => p.value === v,
                                )
                                return (
                                  <span className="flex items-center gap-2">
                                    {opt && (
                                      <span
                                        className={cn(
                                          "size-2 rounded-full",
                                          opt.dot,
                                        )}
                                      />
                                    )}
                                    {opt?.label ?? "Select"}
                                  </span>
                                )
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                <span className="flex items-center gap-2">
                                  <span
                                    className={cn("size-2 rounded-full", p.dot)}
                                  />
                                  {p.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
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

                <button
                  type="button"
                  onClick={() => toast.info("File attachments are coming soon")}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  <Paperclip className="size-3.5" />
                  Attach screenshots or files
                </button>

                <Button type="submit" className="w-full">
                  <Send className="size-4" />
                  Submit ticket
                </Button>

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
              {tickets.length === 0 ? (
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
                    <li key={ticket.id}>
                      <button
                        onClick={() => toast.info(`Opening ${ticket.id}`)}
                        className="flex w-full items-center gap-3 px-6 py-3.5 text-left transition-colors hover:bg-muted/50"
                      >
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            TICKET_DOT[ticket.status],
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {ticket.subject}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-mono">{ticket.id}</span> ·{" "}
                            {ticket.createdAt}
                          </p>
                        </div>
                        <StatusBadge status={ticket.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Article reader sheet */}
      <ArticleSheet
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </div>
  )
}
