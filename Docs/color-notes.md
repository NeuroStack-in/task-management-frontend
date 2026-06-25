# Color notes — project detail "dark" experiment (charcoal variant)

Saved for color-theory research. This is the **first** dark treatment of the
project detail page (graphite charcoal + indigo glow), kept here before switching
the surfaces to an indigo brand background. All values are fixed (theme-independent).

## Hero card
- Surface: `linear-gradient(to bottom right, #1b1e27, #15171e, #0e0f14)`
  - Tailwind: `bg-gradient-to-br from-[#1b1e27] via-[#15171e] to-[#0e0f14]`
- Text: white title; body/meta `#a1a1aa` (zinc-400)
- Border: `rgb(255 255 255 / 0.10)` (white/10)
- Shadow: `0 30px 80px -40px rgb(0 0 0 / 0.7)`
- Ambient glows (blurred radial blobs, `blur-3xl`):
  - top-right: `indigo-500 / 25%` → `rgb(99 102 241 / 0.25)`
  - bottom-left: `violet-600 / 15%` → `rgb(124 58 237 / 0.15)`

## Glassmorphic deadline pill
- Surface: `rgb(255 255 255 / 0.10)` + `backdrop-blur-md`
- Border: `rgb(255 255 255 / 0.15)` (white/15)
- Labels: `#d4d4d8` (zinc-300) / `#a1a1aa` (zinc-400); value white, overdue `#fda4af` (rose-300)

## Task board columns (To do / In progress / In review / Done)
- Column container: `#15171e`, border `white/10`
- Header text: `#e4e4e7` (zinc-200); count `#71717a` (zinc-500); empty `#52525b` (zinc-600)
- Task card: `bg white/[0.04]` → hover `white/[0.07]`; border `white/10` → hover `indigo-400/40`
  - title `#f4f4f5` (zinc-100); unassigned `#52525b`
- Column status dots:
  - to do `#a1a1aa` (zinc-400) · in progress `#818cf8` (indigo-400) ·
    in review `#fbbf24` (amber-400) · done `#34d399` (emerald-400)
- Priority chips:
  - low `bg white/10 / text #d4d4d8` · medium `bg amber-400/15 / text #fcd34d` ·
    high `bg rose-500/15 / text #fda4af`

## Brand reference (from globals.css)
- `--primary` light `#4338ca`, dark `#6366f1`
- indigo scale: 600 `#4f46e5` · 700 `#4338ca` · 800 `#3730a3` · 900 `#312e81` · 950 `#1e1b4b`
