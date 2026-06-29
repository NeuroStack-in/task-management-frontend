# DESIGN_INSPIRATION.md — benchmarks & what to borrow

> Shortlist of apps that are **good-looking AND good UX** (HubSpot = strong UX but plain;
> we want both), and the concrete patterns WorkPulse adopts from each. Drives the
> precision/density polish on `sakthi-redesign`.

## Shortlist

### In-domain (workforce · time · HR · payroll · monitoring)
- **Rippling** — HR/IT/payroll. Structured IA, consistent modules, dense admin tables, calm.
- **Deel** — global payroll/HR. Polished, friendly-professional, excellent onboarding + status.
- **Gusto** — payroll/HR (SMB). Warm-but-clean, best-in-class empty/success/loading states,
  one obvious primary action per screen, plain-language copy.
- **Harvest / Toggl Track** — time tracking. Focused, frictionless timer; minimal chrome.
- **ActivTrak** — workforce analytics (closest to our monitoring) — decent dashboards, scope
  filters by user/team/group (relevant to our Activity scope gap).

### Aesthetic + UX bar (adjacent best-in-class)
- **Linear** — the benchmark. Minimal chrome, dense scannable lists, small *precise* type,
  monochrome + one accent, subtle fast motion, command palette, keyboard-first.
- **Stripe Dashboard** — world-class **data-dense tables**, full-width structured content,
  superb number formatting (tabular), restrained status color, crisp hierarchy.
- **Vercel** — minimal geometric, hairline borders, technical calm, light/dark parity.
- **Notion** — content-first, whitespace used *purposefully* (never dead bands).
- **Height / PostHog / Hex** — modern analytics/PM density done cleanly.

## What we borrow (concrete → apply)

1. **Stripe/Linear — full-width structured content.** Kill centered narrow columns
   (`max-w-3xl mx-auto`) that leave dead side-bands. Data/list/finance pages fill the width
   with a real grid; only true reading-forms keep a comfortable max — and even then via a
   2-column layout that fills the screen. *(Directly fixes the whitespace complaint.)*
2. **Linear — precise typography & density.** Slightly smaller, tighter, higher-contrast type;
   tabular figures for all numbers; dense rows; generous *but purposeful* spacing — no padding
   for padding's sake.
3. **Stripe — tables as first-class.** Quiet hairline rows, sticky headers, right-aligned
   numerics, clear column hierarchy, restrained status chips, row hover/selection.
4. **ActivTrak/Stripe — scope filters on analytics.** Activity/insights get an All / Department
   / Team / Individual scope selector so timing pairs with each person/team.
5. **Gusto/Deel — premium states & one primary action.** Professional empty/loading/success
   states; exactly one obvious primary action per screen; plain-language copy.
6. **Linear/Vercel — restrained surface.** Hairline borders over shadows, one accent for
   action/active only, subtle fast motion, monochrome data viz with the single accent. *(Mostly
   in place — push further on precision.)*

## Direction: "Meridian → Linear/Stripe-grade precision"

Keep the Meridian Slate-&-Teal system; raise the execution bar to Linear/Stripe: **full-width
structured layouts (no dead whitespace), precise dense typography, first-class tables, scope
filters on analytics, premium states.** Calm, premium, operational — and unmistakably designed.
