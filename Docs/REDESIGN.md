# REDESIGN.md — WorkPulse "Meridian" Redesign

> **Implementation note (rebased onto latest `main`).** Applied on top of the current
> `origin/main` build (Leave, Payroll, Reports Center, the existing ⌘K command palette, and a
> 13-palette theming system). Meridian ships as a **new default palette** (cool-slate +
> petrol-teal, `data-palette="meridian"`) added alongside — not replacing — the existing
> palettes; the structural changes (IBM Plex type, tighter `--radius`, hairline-bordered
> cards, no loud hero, calmer charts, denser layout, enlarged Kanban, decluttering) apply
> globally. The existing command palette is reused, not duplicated. No features removed.

> Branch: `sakthi-redesign`. A UI **and** UX redesign of WorkPulse for business users:
> minimal, simple, polished, enterprise-grade. This document records the decision and
> the reasoning before any code changes, then the concrete spec the implementation follows.
> It does not replace [DESIGN.md](DESIGN.md) until merged; on conflict, this file wins for
> the redesign branch.

---

## 1. Who actually uses WorkPulse, and what they need

WorkPulse is a **Workforce Activity & Productivity Management** SaaS — a data-dense,
decision-support B2B tool used during the workday, often for long focused sessions on
tables, charts and reports. Three audiences, all *business* users (not consumers):

| Persona | What they do here | What they need from the UI |
|---|---|---|
| **Org Owner / Admin** (e.g. Alex Morgan) | Configure org, roles, billing, monitoring, security | Control + clarity; trust the numbers; find settings fast |
| **Manager / Team Lead** | Review timesheets, approvals, attendance, team productivity | Scan dense data quickly; compare; act (approve/flag) |
| **Employee / IC** | Track own time, view own productivity & profile | Understand "how am I doing" at a glance; low friction |

**Job-to-be-done:** *"Understand the rhythm of work and act on it"* — review, approve,
configure. The UI is a **control surface**, used repeatedly and for long stretches. That
means the priorities are, in order: **legibility → scannability → low cognitive load →
calm aesthetics**. Expressiveness is a distant fifth.

## 2. Diagnosis — why it currently feels "clumsy / complex / difficult"

Evidence from page-by-page + component-by-component audit and before-screenshots
(`.playwright-mcp/before-*.png`):

1. **Loud, arbitrary "hero" blocks.** A big saturated-indigo filled card (`bg-feature`)
   is dropped onto one KPI per screen (Productivity Score, Total Employees…). It dominates
   the page, isn't the most important number, and competes with real content. Pure visual
   noise — violates "color carries meaning."
2. **Scattered floating islands.** Every card floats on grey with a soft shadow and **~22px
   rounding** (`rounded-[1.4rem]`). No structural alignment, no shared edges → the eye has
   no grid to rest on. Reads consumer/playful, not enterprise.
3. **Pill-soup chrome.** The topbar stacks 5 separate rounded-full "pill" clusters
   (search, palette switcher, timer, notifications+theme, avatar). The **palette switcher**
   — a 7-theme color picker — sits in the primary chrome of a workforce tool: a consumer
   gimmick in the wrong place.
4. **Over-rounded, low-density everything.** `rounded-full` nav rows, circle icon chips,
   pill badges/deltas; 2-column card grids on wide screens; generous padding. Wastes space
   that managers want filled with data.
5. **Decoration over data.** An infinite "sheen" sweep animates across meters forever
   (chart-junk; it also made pages never reach a stable paint). Terminal dots and thick
   sparkline strokes add ink without information.
6. **Weak hierarchy & affordances.** Page headers have no anchor/divider; destructive and
   safe actions sit adjacent with no separation; tiny toggle pills are easy to miss; native
   date inputs sit next to custom pills (inconsistent control language).
7. **Duplicated / misplaced features** (UX, not just UI): project-detail right rail repeats
   the hero metadata; appearance controls live in chrome instead of Settings; report-card
   previews mislead. (Full list in §9.)

## 3. Standards consulted (the decision is grounded, not taste-only)

- **IBM Carbon** — structure via a strict grid + hairlines (not shadows); functional color
  used *sparingly*; one productive type family; neutrality is a feature. → our grid, borders,
  restrained accent, IBM Plex type.
- **Atlassian Design System** & **Salesforce Lightning** — neutral surfaces, a single
  restrained brand accent, first-class dense data tables, density tokens. → our neutral-first
  palette, table styling, spacing scale.
- **Microsoft Fluent 2** — calm neutral layering; depth only where it means elevation. →
  shadows reserved for popovers/dialogs, flat content cards.
- **Refactoring UI** (Wathan & Schoger) — limit the palette; let greys do the heavy lifting;
  build hierarchy with **spacing, weight and one accent**, not borders-everywhere or color
  everywhere; semantic colors only for status. → emphasis model, delta/status chips.
- **WCAG 2.2 AA** — text ≥ 4.5:1, UI/graphics ≥ 3:1, always-visible focus, ≥ 24px targets.
  → every token pair checked; focus rings kept; hit areas preserved.
- **Tufte / data-ink** — maximize data-ink, cut chart-junk. → kill the sheen, thin the
  sparklines, keep the pulse motif but quiet.

## 4. The concept — **Refined Enterprise Minimalism: "Meridian"**

> *Meridian* = the sun's highest point; the line that marks time. It fits a product about
> **time and peak productivity**, and the name signals the shift from "friendly SaaS" to
> "calm professional instrument."

A quiet, structured control surface. **Neutral slate canvas, white panels joined by crisp
hairlines into a real grid, and ONE confident teal accent reserved for action, the active
state, and emphasis — never decoration.** Tighter radii, denser purposeful layouts,
semantic status color, accessible contrast. The brand's **pulse line** survives — but as a
thin, calm signal (a heartbeat of work), not a glowing sparkle.

Design tension resolved: *minimal & understandable for business users* (familiar layout,
plain language, strong legibility) **layered with** *polish* (precise spacing, hairline
structure, one sophisticated accent, considered type).

## 5. Color — **Slate & Teal**

Replaces *Graphite & Indigo*. Why teal-petrol over the old indigo or a default blue:

- **Indigo/purple is what we're replacing** and reads generic-SaaS; the loud filled cards
  made it worse.
- **Plain blue** is the safe enterprise default but too close to the current indigo to feel
  like a real change.
- **Green is ruled out as the accent** — the product leans on green=positive / red=negative
  deltas everywhere; a green brand accent would collide with that semantics.
- **Deep petrol teal** threads it: blue enough to read *trustworthy/enterprise*, distinct
  enough to feel genuinely new, calm and analytical (right for an analytics product), far on
  the wheel from the red/amber/green status set, and **on-brand for the pulse/EKG motif**.

### Light (`:root`, default palette "Meridian")
| Token | Hex | Use | Notes |
|---|---|---|---|
| `background` | `#F7F8FA` | App canvas | cool near-white slate |
| `card` | `#FFFFFF` | Panels, sheets, popovers | |
| `muted` | `#F1F3F6` | Insets, hover, table stripe | |
| `foreground` | `#0F1729` | Primary ink | slate-950, AA on canvas |
| `muted-foreground` | `#5B6573` | Secondary text | ≥4.5:1 on card |
| `primary` | `#0E7490` | Accent — buttons, active nav, links, focus | cyan-700 petrol; white text ≈4.9:1 |
| `primary` (hover) | `#0B5E74` | | deeper petrol |
| `accent` / `accent-foreground` | `#E4F1F5` / `#0B5E74` | active pill bg / icon chips | tint, low weight |
| `border` | `#E3E7ED` | Hairlines (the new structural workhorse) | |
| `success`/`positive` | `#157F5B` | Up deltas, present | clearly green ≠ teal accent |
| `negative`/`destructive` | `#C0392B` | Down deltas, errors | |
| `warning` | `#B7791F` | Late, caution | |
| `chart-1..5` | teal-led: `#0E7490`,`#2563EB`,`#0F766E`,`#B7791F`,`#7C3AED` | categorical | accent-led, moderate saturation |

### Dark (`.dark`)
Cool slate charcoal canvas `#0C111A`, panels `#141B26`, ink `#E6EAF0`, a brighter teal
`#2BB8C9`/`#22A5B8` primary so the accent keeps ≥3:1 on dark, hairlines at `rgb(255 255 255 /
0.08)`.

The 6 existing alternate palettes (Ember, Fire Opal, Masterpiece, Gold Amber, Creative,
Midnight Plum) are **kept** (no feature removed) — only the *default* changes to Meridian,
and the picker moves to Settings (§9).

## 6. Typography — IBM Plex

Replaces Plus Jakarta + Inter. Grounded in **IBM Carbon**: a single, engineered, highly
legible family used for an enterprise data product — distinctive vs. the previous Inter,
but never at legibility's expense.

- **UI / body — IBM Plex Sans** (400/500/600). All controls, tables, labels, descriptions.
- **Headings — IBM Plex Sans** (600/700). Hierarchy via **weight + size**, not a second
  display face — restraint is the enterprise move (Carbon uses one family).
- **Numerals / time — IBM Plex Mono** (tabular). The timer `02:14:53`, metric columns,
  KPI figures — time is literally numbers, so they get a precise mono with tabular figures.

Scale tightened: page title ~22px (was 24–30), KPI value ~26–28px (was 30–40), eyebrows
11px uppercase tracked. Confident but not shouty.

## 7. Layout & structure

- **Shell:** sidebar becomes a **full-height inset panel flush to the edge** with a single
  `border-r` hairline (no floating island, no shadow). Content gutters tighten
  (`px-4 sm:px-6 → denser`). A real grid, aligned edges.
- **Topbar:** one clean bar with a **bottom hairline** (not blur-only). Modest bordered
  search field. One quiet icon row {timer · notifications · theme · user}. **Palette
  switcher removed from chrome → Settings ▸ Appearance.**
- **Cards:** white, **1px border**, radius **8–10px**, **no content shadow** (shadow only
  for true elevation: dropdowns, dialogs, sheets, the chat panel). Shared module components
  use the same `<Card>` so this propagates.
- **KPI strip:** all stat cards **equal weight** — the loud filled hero is gone. Emphasis
  on the primary metric comes from a subtle accent (accent sparkline / thin accent top-rule),
  not a saturated block.
- **Tables:** uppercase tracked column headers, restrained `hover:bg-muted/40`, denser rows,
  pagination/"show more" where data was hard-capped.
- **Density:** spacing scale tightened one step; whitespace intentional, not padding-by-default.

## 8. Component language (the rules every component follows)

| Property | Old | New |
|---|---|---|
| Card radius | `~22px` | `10px` (`--radius: 0.625rem`; `lg`) |
| Control radius (button/input/select) | `8–12px` | `6px` (`md`) |
| Badge / delta / status chip | `rounded-full` | `rounded-sm` (squared data chip) |
| Content elevation | `shadow-soft` everywhere | `border border-border`, no shadow |
| Popover/dialog elevation | soft | crisp `shadow-md` + hairline ring |
| Icon chips | `rounded-full` tinted circles | `rounded-md` muted squares |
| Active nav | `rounded-full` indigo pill | `rounded-md`, accent-tint bg + accent left-marker |
| Focus ring | `ring-3 ring/50` | `ring-2 ring-primary/40` (sharper, still visible) |
| Sparkline | stroke 2, area 0.2, terminal dot | stroke 1.5, area 0.10, no dot |
| Meter "sheen" | infinite sweep | removed (keep one-shot grow; respect reduced-motion) |

## 9. UX / IA changes (per the brief: keep every feature; de-dupe; relocate; clarify)

**Nothing is deleted.** Changes:

- **Relocate (feature in wrong place):** palette/theme appearance controls → **Settings ▸
  Appearance** (already partially there); remove from topbar chrome.
- **De-duplicate:** project-detail right-rail that repeats the hero's lead/department/timeline
  → collapse to non-redundant content; reuse the single canonical `<Card>`/`StatCard`
  instead of bespoke clones; consolidate any drifted `*-tab`/`*-view` twins found.
- **Clarify & make understandable:**
  - Page headers get a hairline divider + consistent title/description rhythm (anchor).
  - Separate destructive vs. safe actions (gap/secondary placement) on project & role pages.
  - Replace tiny missable toggle pills with a clear segmented control with labels.
  - Attendance & capped tables get pagination / "show all" so "20 of N" is reachable.
  - Plain-language empty states; ComingSoon shows the phase as a quiet tag, stays navigable.
- **Accessibility:** AA contrast on every new token pair; visible focus retained; status is
  never color-only (icon/label + color on deltas, badges, attendance).

## 10. Motion

Calm and purposeful. Keep: one-shot meter/gauge grow on mount, sidebar width transition,
subtle hover color transitions, dialog/menu fades. Remove: the infinite meter sheen and
attention-seeking pulsing dots. `prefers-reduced-motion` fully respected.

## 11. What is preserved

All 29 sections, all routes navigable, all features, the RBAC-driven nav, the mock-service
seam, the **pulse-line signature** (quieter), light/dark, and all 6 alternate palettes. This
is a reskin + UX tightening at the **token + shared-component** layer so it propagates
everywhere, plus targeted page-level IA fixes — not a rewrite.
