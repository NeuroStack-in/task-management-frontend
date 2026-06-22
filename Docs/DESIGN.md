# DESIGN.md — WorkPulse Visual Identity

Original design language. Not modeled on any existing product. Mood: a calm, professional control surface — cool graphite canvas, soft white cards, one restrained indigo accent, and a recurring pulse/wave line that stands for activity over time.

## Thesis

WorkPulse measures the *rhythm* of work. The interface should feel like a quiet workspace, not a surveillance console: composed, soft-cornered, unhurried — with data presented as calm signal, not alarm. The one expressive element is the **pulse line** (sparkline / wave), which appears wherever activity-over-time is shown.

## Color (light) — Graphite & Indigo

A cool, professional neutral with one restrained indigo accent. Indigo is the common SaaS default, so it earns its place only through discipline: used sparingly, on near-white surfaces, against cool graphite neutrals.

| Token | Hex | Use |
|-------|-----|-----|
| `background` | `#F4F5F7` | App canvas (cool graphite grey) |
| `surface` (`card`) | `#FFFFFF` | Cards, sheets, popovers |
| `muted` | `#EEF0F3` | Insets, fills, hover |
| `foreground` (ink) | `#1A1D23` | Primary text |
| `muted-foreground` | `#6B7180` | Secondary text |
| `primary` | `#4338CA` | Indigo accent — buttons, active nav, links |
| `feature` | `#4338CA` | Featured/hero card fill (white text) |
| `feature-tint` | `#EEF0FF` | Soft accent surfaces, icon chips, active pills |
| `border` | `#E3E6EB` | Hairline borders |
| `positive` | `#18794E` | Up deltas, success |
| `negative` | `#C0392B` | Down deltas, errors |
| `warning` | `#B7791F` | Warnings |

Dark mode is a graphite charcoal (`#14161B` canvas, `#1B1E25` surface, `#E7E9EE` ink) with a lighter indigo (`#6366F1`) so the accent keeps contrast. Both themes live as CSS variables in `globals.css`.

Charts use an indigo-led categorical palette (`chart-1` indigo, then blue, teal, amber, violet) — moderate saturation, never neon.

## Type

- **Display — Plus Jakarta Sans (500/600/700).** Greetings, page/section titles, headline KPI numbers. A polished, professional geometric sans used with restraint and real size contrast.
- **Body / UI — Inter.** All controls, labels, descriptions, table text — the industry-standard UI face.
- **Mono — JetBrains Mono.** Time, durations, and tabular figures (the timer `02:14:53`, metric values in tables). Time is literally numbers — it gets a numeric face.

Scale is confident: large friendly greeting (≈30px), generous KPI numbers (≈30–40px), small uppercase-tracked eyebrows for group labels.

## Layout

- **Graphite canvas** with floating, deeply-rounded white cards (`radius ≈ 22px`) and soft, low shadows (no hard borders on cards).
- **Floating sidebar:** a rounded white panel sitting on the canvas (not flush to the edge), grouped nav, active item = solid indigo pill. Collapses to an icon-only rail (dark active square) on desktop, and a sheet on mobile.
- **Greeting topbar:** "Hello, {first name}!" + one-line context on the left; a **pill search** (⌘K), then circular icon buttons (global timer pill, notifications, theme, avatar) on the right.
- **Dashboard grid:** a row of stat cards (label · big number · mini pulse line · delta pill), one **featured indigo card**, then a large trend/comparison card, and people/AI/billing cards.

## Signature

The **pulse line** — a smooth indigo sparkline/area that recurs at three scales: tiny (inside stat cards), medium (the screenshots/featured cards), and large (the trend/comparison charts). It's the visual through-line that makes a screen unmistakably WorkPulse.

## Quality floor

Responsive to mobile, visible keyboard focus (indigo ring), `prefers-reduced-motion` respected, AA contrast for text. Spend boldness only on the pulse motif and the featured card; keep everything else quiet.
