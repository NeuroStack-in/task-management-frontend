# REFINE_PROMPT.md — Layout, Spacing & Density Refinement (Meridian, round 2)

> Reusable prompt for a screenshot-driven re-analysis + fix pass on WorkPulse
> (`sakthi-redesign`). The visual system (Meridian theme, IBM Plex, tokens, IA,
> AiInsight, kanban) is in place; this round fixes **layout correctness, element
> sizing, alignment, and whitespace economy** so every screen looks intentional,
> dense-but-calm, and genuinely enterprise-grade. Do NOT touch `main`.

---

## 1. Goal

Make every page feel **simple, minimal, precise, and finished** — like Linear,
Stripe Dashboard, IBM Carbon, HubSpot CRM. No overlaps, no oversized widgets, no
oceans of empty space, no two screens spaced differently. The product must look
trustworthy enough for payroll, billing, approvals, and executive reporting.

Guiding rule: **every pixel earns its place.** If space, size, or a widget isn't
doing a job, tighten it, resize it, or remove it.

## 1a. License to restructure (not just polish)

This is NOT only a spacing pass. Where a page's **layout or structure is wrong or
over-built, redesign it completely.** For each page, start from the question
*"what does an enterprise user actually need to do here, in 5 seconds?"* and build
the simplest layout that serves that — even if it means discarding the current
structure.

- **Right-size the page to the job.** A capability does not require a full
  multi-section page. If the real need is a compact summary + one action, make it a
  compact card/widget — not a sprawling page. (Think: a heavyweight subscription
  page vs. the small billing widget a SaaS like Claude actually shows. Use this as
  a *principle* for every page; do not literally copy any product.)
- **Collapse over-built screens.** Merge thin sections, cut secondary panels that
  don't earn their space, and prefer one focused work area over a grid of weak cards.
- **Choose the right primitive per page**: a table, a single summary card, a 2-pane
  master-detail, a compact stat row, a form — whatever fits the job best. Don't force
  every page into "KPI cards + chart grid."
- Keep every feature reachable, but a feature can move from a page to a widget,
  a drawer, a dialog, or a section of another page if that's the better enterprise IA.
- Bias hard toward **less**: fewer cards, fewer numbers, fewer columns, more focus.

## 2. Defects to hunt (confirmed + classes to sweep for)

Confirmed on the live build:
- **Overlapping elements** — e.g. the dashboard attendance donut where the "80%"
  label / ring / legend overlap. Find and fix ALL overlap (absolute-positioned
  labels over charts, gauges, donuts, avatars, badges).
- **Oversized / disproportionate widgets** — cards/charts/gauges that are too big
  for the data they carry; bento cells that stretch a small chart into a tall box.
- **Excessive whitespace / dead space** — half-empty wide cards, big gaps between
  sections, single-item rows spanning full width, padding far larger than content.

Sweep every page for these classes too:
- Misaligned columns, headers, and baselines; ragged card edges in a row.
- Inconsistent card heights in the same row; charts that don't fill their card.
- Inconsistent page top-spacing, section gaps, and card padding across pages.
- Tables with cramped or uneven cells; numeric columns not right-aligned.
- Filters/toolbars detached from the content they control.
- Charts with too many colors or unreadable at their rendered size.
- Responsive breakage (overlap/clipping/overflow) at tablet and mobile widths.
- Gauges/rings/sparklines whose value text collides with the arc.

## 3. Method (do this in order, per page)

1. **Look first.** Run the app, log in (`owner@acme.test` / any password), and
   screenshot each page at desktop (1440), then spot-check tablet (834) and mobile
   (390). Read the screenshot before editing — diagnose the actual pixel problem.
2. **Diagnose** the specific cause (e.g. "donut value is absolutely centered but
   the SVG viewBox + legend push it off-center → overlap"). No guess-fixing.
3. **Fix at the component level** with tokens and the shared spacing system, not
   one-off magic numbers. Prefer fixing the shared primitive (gauge, donut, stat
   card, widget shell) so it propagates.
4. **Re-screenshot** the same page and confirm the defect is gone and nothing else
   shifted.

## 4. Fix principles

**Sizing & proportion**
- A widget's size must match its information weight. A single number → a compact
  stat, not a tall card. A 7-point trend → a small chart, not a half-screen panel.
- In the dashboard bento, cap row heights and make charts FILL their cell (no tall
  empty boxes). Equalize heights within a row.
- Gauges/donuts: size the SVG so the value label sits cleanly centered with safe
  padding; never let text overlap the arc or legend. Give them a sensible max size.

**Whitespace economy**
- Tighten oversized padding to the 8px system (cards p-4/p-5, sections gap-4/gap-6).
- No full-width card holding a thin list — use a sensible max-width or a multi-column
  layout; fill or shrink half-empty cards.
- Consistent page shell: same top padding, same section rhythm on every route.

**Alignment & grid**
- Everything on a shared grid; align card edges, header baselines, and label columns.
- Right-align numeric/currency/time columns; left-align text; consistent column widths.
- Cards in a row share one height; content is vertically centered or top-aligned
  consistently.

**Consistency (normalize to one value each)**
- Page padding · section gap · card padding · header height · button height · input
  height · table row height · badge size · icon size (size-4) · modal/drawer width.

**Density (calm, not cramped)**
- Prefer information density over decoration, but keep AA contrast and ≥44px targets.
- Remove any remaining decorative/space-filler element that doesn't aid a task.

## 5. Page-type layout models (apply consistently)

- **Operational** (Time Tracking, Approvals, Tasks): primary action obvious; dense
  readable tables; minimal chrome.
- **Management** (Employees, Projects, Leave, Payroll, Billing): clear list/table +
  focused detail; KPIs only if they drive a decision (≤4).
- **Reporting** (Dashboard, Insights): tight chart grid, equal heights, restrained
  colors, one summary insight — no "wall of cards."
- **Configuration** (Settings, Integrations, Roles): simple forms, aligned labels,
  consistent save state, sub-nav for long pages.

Dashboard specifically: ≤4 KPI cards, every widget leads to an action, charts fill
their cells, no overlap, no dead space, a clean "today / this week / exceptions" read.

## 6. Constraints

- Preserve ALL features, data, and mock/simulated logic (RBAC, dnd, forms, exports,
  routing). This is a frontend wireframe — keep it fully clickable.
- Design tokens only — no hardcoded hex, no one-off durations/shadows.
- Reuse shared components (Card, StatCard, PageHeader, Badge, Button, Table,
  EmptyState, AiInsight, Gauge, Sparkline); fix the primitive, don't clone.
- One coherent Meridian theme; subtle motion; respect reduced-motion.
- No new dependencies. Don't touch `main`. Work on `sakthi-redesign`.

## 7. Acceptance criteria

- **Zero overlapping elements** at desktop, tablet, and mobile.
- No widget looks oversized for its content; charts fill their cards; rows in a grid
  share heights.
- No large dead/empty space; whitespace is intentional and consistent.
- Spacing, padding, radius, heights, and icon sizes are consistent across all pages.
- Every page reads in ~5 seconds and has one clear primary action.
- Dashboard, payroll, billing, approvals, and reports look calm, precise, audit-ready.
- `npx tsc --noEmit` and `npm run build` pass.
- Before/after screenshots prove each fixed defect.

## 8. Deliverables

- The concrete defect list found per page (short).
- Fixes made (component-level, tokenized).
- Before/after screenshots of the key screens (dashboard, the overlapping donut,
  any oversized widgets, a dense table, a settings form).
- `tsc` + `build` results. Commit to `sakthi-redesign`.
