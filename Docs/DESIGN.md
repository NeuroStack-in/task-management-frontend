# DESIGN.md — WorkPulse Visual Identity

Original design language. Not modeled on any existing product. Reference mood: a calm, warm "studio desk" — greige paper canvas, soft white cards, one sage accent, and a recurring pulse/wave line that stands for activity over time.

## Thesis

WorkPulse measures the *rhythm* of work. The interface should feel like a quiet workspace, not a surveillance console: warm, soft-cornered, unhurried — with data presented as calm signal, not alarm. The one expressive element is the **pulse line** (sparkline / wave), which appears wherever activity-over-time is shown.

## Color (light)

| Token | Hex | Use |
|-------|-----|-----|
| `canvas` | `#E8E5DD` | App background (the "paper") |
| `surface` | `#FFFFFF` | Cards, sheets, popovers |
| `surface-muted` | `#F3F1EA` | Insets, fills, hover |
| `ink` | `#21241E` | Primary text |
| `muted-ink` | `#7C7B70` | Secondary text |
| `sage` | `#5C7B57` | Primary accent — buttons, active nav, links |
| `sage-strong` | `#7E9A78` | Featured/hero card fill (white text) |
| `sage-tint` | `#E6EDE1` | Soft accent surfaces, active pills |
| `line` | `#E3DFD5` | Hairline borders |
| `positive` | `#3F7C53` | Up deltas, success |
| `negative` | `#B5503B` | Down deltas, errors |
| `warning` | `#BD8A3C` | Warnings |

Dark mode is a warm charcoal-olive (`#181A15` canvas, `#21241D` surface, `#ECEAE0` ink) with a lighter sage (`#9CBD94`) so the accent keeps contrast. Both themes live as CSS variables in `globals.css`.

Charts use a sage-led categorical palette (`chart-1` sage, then clay, slate-blue, gold, dusty-rose) — muted, never neon.

## Type

- **Display — Plus Jakarta Sans (500/600/700).** Greetings, page/section titles, headline KPI numbers. A polished, professional geometric sans used with restraint and real size contrast.
- **Body / UI — Inter.** All controls, labels, descriptions, table text — the industry-standard UI face.
- **Mono — JetBrains Mono.** Time, durations, and tabular figures (the timer `02:14:53`, metric values in tables). Time is literally numbers — it gets a numeric face.

Scale is confident: large friendly greeting (≈30px), generous KPI numbers (≈30–40px), small uppercase-tracked eyebrows for group labels.

## Layout

- **Greige canvas** with floating, deeply-rounded white cards (`radius ≈ 22px`) and soft, low shadows (no hard borders on cards).
- **Floating sidebar:** a rounded white panel sitting on the canvas (not flush to the edge), grouped nav, active item = solid sage pill. Collapses to a sheet on mobile.
- **Greeting topbar:** "Hello, {first name}!" + one-line context on the left; a **pill search** (⌘K), then circular icon buttons (global timer pill, notifications, theme, avatar) on the right.
- **Dashboard grid:** a row of stat cards (label · big number · mini pulse line · delta pill), one **featured sage card** (Activity, with the full wave), then a large trend card, a focus **gauge**, and a people/AI card.

## Signature

The **pulse line** — a smooth sage sparkline/area that recurs at three scales: tiny (inside stat cards), medium (the featured Activity card), and large (the productivity trend). It's the visual through-line that makes a screen unmistakably WorkPulse.

## Quality floor

Responsive to mobile, visible keyboard focus (sage ring), `prefers-reduced-motion` respected, AA contrast for text. Spend boldness only on the pulse motif and the featured card; keep everything else quiet.
