# WorkPulse — Color Scheme Guide

> Design reference for the Workforce Activity & Productivity Management Platform.
> Choose one scheme as the primary identity; the others serve as documented alternatives for future theming or white-label use.

---

## How to use this guide

1. Pick one scheme as your base.
2. Drop its `:root {}` block into `src/app/globals.css`.
3. Map each token to the Tailwind config in `tailwind.config.ts` under `theme.extend.colors`.
4. All semantic tokens (`--color-success`, `--color-warning`, `--color-danger`) are shared across schemes — only the brand tokens change per scheme.

---

## Shared semantic tokens (all schemes)

These do not change between schemes. Define them once in `globals.css`.

```css
:root {
  --color-success:         #10B981;
  --color-success-light:   #D1FAE5;
  --color-warning:         #F59E0B;
  --color-warning-light:   #FEF3C7;
  --color-danger:          #EF4444;
  --color-danger-light:    #FEE2E2;
  --color-info:            #3B82F6;
  --color-info-light:      #DBEAFE;
  --color-muted:           #64748B;
  --color-border:          #E2E8F0;
  --color-text:            #0F172A;
  --color-bg:              #FFFFFF;
  --color-surface:         #F8FAFC;
}
```

---

## Scheme 1 — Graphite & Indigo

**Personality:** Neutral base, bold indigo primary. The default PRD palette. Safe, professional, and familiar to users of enterprise tools.

**Best for:** Default WorkPulse identity. Strong dark-mode story with the deep graphite base.

**Comparable products:** Linear, Vercel, Raycast.

### Palette

| Role | Name | Hex |
|------|------|-----|
| Ink | Graphite Deep | `#1E1E2E` |
| Primary | Indigo | `#4F46E5` |
| Primary Dark | Indigo Deep | `#312E81` |
| Interactive | Indigo Mid | `#818CF8` |
| Accent | Indigo Tint | `#E0E7FF` |
| Surface | Slate White | `#F8FAFC` |

### CSS variables

```css
:root {
  --color-primary:             #4F46E5;
  --color-primary-foreground:  #FFFFFF;
  --color-primary-dark:        #312E81;
  --color-secondary:           #818CF8;
  --color-accent:              #E0E7FF;
  --color-accent-foreground:   #312E81;
  --color-surface:             #F8FAFC;
  --color-bg:                  #FFFFFF;
  --color-text:                #1E1E2E;
  --color-muted:               #64748B;
  --color-border:              #E2E8F0;
}
```

### Tailwind mapping

```ts
// tailwind.config.ts
colors: {
  primary: { DEFAULT: '#4F46E5', dark: '#312E81', light: '#E0E7FF' },
  secondary: '#818CF8',
}
```

---

## Scheme 2 — Slate & Teal

**Personality:** Clean, enterprise-grade. Teal communicates clarity and precision. Feels like a tool built for serious work.

**Best for:** Organizations that want a calm, trustworthy tool — HR directors and operations leads.

**Comparable products:** Rippling, Lattice, Deel.

### Palette

| Role | Name | Hex |
|------|------|-----|
| Ink | Slate Deep | `#0F172A` |
| Primary | Teal | `#0F766E` |
| Primary Light | Teal Mid | `#14B8A6` |
| Accent | Teal Tint | `#99F6E4` |
| Surface | Teal White | `#F0FDFA` |
| Background | Off White | `#F8FAFC` |

### CSS variables

```css
:root {
  --color-primary:             #0F766E;
  --color-primary-foreground:  #FFFFFF;
  --color-primary-dark:        #0D5E57;
  --color-secondary:           #14B8A6;
  --color-accent:              #99F6E4;
  --color-accent-foreground:   #134E4A;
  --color-surface:             #F0FDFA;
  --color-bg:                  #FFFFFF;
  --color-text:                #0F172A;
  --color-muted:               #64748B;
  --color-border:              #CCFBF1;
}
```

---

## Scheme 3 — Midnight & Amber

**Personality:** High-contrast, premium, and decisive. Amber as the hero color evokes focus and urgency — natural fit for time-tracking dashboards.

**Best for:** Dark-mode-first teams, analytics-heavy usage, and products where urgency of data is the core emotion.

**Comparable products:** Superhuman, Vercel (dark), Retool (dark).

### Palette

| Role | Name | Hex |
|------|------|-----|
| Ink | Near Black | `#09090B` |
| Primary | Amber | `#D97706` |
| Primary Light | Amber Mid | `#F59E0B` |
| Accent | Amber Tint | `#FCD34D` |
| Surface | Warm White | `#FFFBEB` |
| Background | Stone | `#FAFAF9` |

### CSS variables

```css
:root {
  --color-primary:             #D97706;
  --color-primary-foreground:  #FFFFFF;
  --color-primary-dark:        #92400E;
  --color-secondary:           #F59E0B;
  --color-accent:              #FCD34D;
  --color-accent-foreground:   #78350F;
  --color-surface:             #FFFBEB;
  --color-bg:                  #FFFFFF;
  --color-text:                #09090B;
  --color-muted:               #71717A;
  --color-border:              #FDE68A;
}
```

---

## Scheme 4 — Cloud & Violet

**Personality:** Approachable and modern. Violet communicates creativity alongside structure — popular in people-ops and HR tools. Feels warm and less corporate than blue.

**Best for:** Products emphasizing employee wellbeing, engagement, and culture alongside productivity.

**Comparable products:** Notion, Coda, Leapsome.

### Palette

| Role | Name | Hex |
|------|------|-----|
| Ink | Charcoal | `#1C1B1F` |
| Primary | Violet | `#7C3AED` |
| Primary Dark | Violet Deep | `#5B21B6` |
| Accent | Violet Soft | `#C4B5FD` |
| Surface | Violet White | `#EDE9FE` |
| Background | Off White | `#FAFAFA` |

### CSS variables

```css
:root {
  --color-primary:             #7C3AED;
  --color-primary-foreground:  #FFFFFF;
  --color-primary-dark:        #5B21B6;
  --color-secondary:           #C4B5FD;
  --color-accent:              #EDE9FE;
  --color-accent-foreground:   #3B0764;
  --color-surface:             #F5F3FF;
  --color-bg:                  #FFFFFF;
  --color-text:                #1C1B1F;
  --color-muted:               #6B7280;
  --color-border:              #DDD6FE;
}
```

---

## Scheme 5 — Ocean & Coral

**Personality:** Energetic and bold. Blue as the reliable primary; coral as a warm, unexpected accent. The pairing is distinctive and stands out from typical enterprise tools.

**Best for:** Products targeting startups, agencies, and modern tech teams who want something that doesn't look like every other HR tool.

**Comparable products:** Framer, Loom, Pitch.

### Palette

| Role | Name | Hex |
|------|------|-----|
| Ink | Navy | `#0C1A2E` |
| Primary | Ocean Blue | `#1D4ED8` |
| Interactive | Blue Mid | `#3B82F6` |
| Accent | Coral | `#FB7185` |
| Surface | Sky Tint | `#F0F9FF` |
| Background | Coral White | `#FFF1F2` |

### CSS variables

```css
:root {
  --color-primary:             #1D4ED8;
  --color-primary-foreground:  #FFFFFF;
  --color-primary-dark:        #1E3A8A;
  --color-secondary:           #3B82F6;
  --color-accent:              #FB7185;
  --color-accent-foreground:   #FFFFFF;
  --color-surface:             #F0F9FF;
  --color-bg:                  #FFFFFF;
  --color-text:                #0C1A2E;
  --color-muted:               #64748B;
  --color-border:              #BFDBFE;
}
```

---

## Scheme 6 — Forest & Sage

**Personality:** Calm, grounded, and sustainable. Green communicates growth and health — a natural fit for platforms that surface burnout detection and wellbeing alongside productivity.

**Best for:** Products where employee wellbeing is a first-class feature, or organizations in healthcare, education, and mission-driven sectors.

**Comparable products:** Calm Business, Culture Amp, 15Five.

### Palette

| Role | Name | Hex |
|------|------|-----|
| Ink | Forest Deep | `#14210D` |
| Primary | Forest Green | `#16A34A` |
| Primary Light | Green Mid | `#22C55E` |
| Accent | Sage | `#86EFAC` |
| Surface | Green White | `#F0FDF4` |
| Background | Stone | `#FAFAF9` |

### CSS variables

```css
:root {
  --color-primary:             #16A34A;
  --color-primary-foreground:  #FFFFFF;
  --color-primary-dark:        #15803D;
  --color-secondary:           #22C55E;
  --color-accent:              #86EFAC;
  --color-accent-foreground:   #14532D;
  --color-surface:             #F0FDF4;
  --color-bg:                  #FFFFFF;
  --color-text:                #14210D;
  --color-muted:               #6B7280;
  --color-border:              #BBF7D0;
}
```

---

## Scheme 7 — Iron & Crimson

**Personality:** Authoritative and bold. A steel-gray primary anchors the UI; crimson is reserved only for CTAs and alert states — creating high drama without visual noise. Feels security-focused.

**Best for:** Enterprise-grade deployments emphasizing security, compliance, and access control. Monitoring-heavy use cases.

**Comparable products:** Datadog, PagerDuty, Crowdstrike.

### Palette

| Role | Name | Hex |
|------|------|-----|
| Ink | Iron Dark | `#111318` |
| Primary | Steel | `#374151` |
| Interactive | Steel Mid | `#6B7280` |
| Accent | Crimson | `#DC2626` |
| Surface | Cool Gray | `#F9FAFB` |
| Background | White | `#FFFFFF` |

### CSS variables

```css
:root {
  --color-primary:             #374151;
  --color-primary-foreground:  #FFFFFF;
  --color-primary-dark:        #111318;
  --color-secondary:           #6B7280;
  --color-accent:              #DC2626;
  --color-accent-foreground:   #FFFFFF;
  --color-surface:             #F9FAFB;
  --color-bg:                  #FFFFFF;
  --color-text:                #111318;
  --color-muted:               #9CA3AF;
  --color-border:              #E5E7EB;
}
```

---

## Scheme 8 — Dusk & Rose

**Personality:** Sophisticated and editorial. Deep plum base with a rose-pink accent creates a premium, magazine-like feel. The warmest and most distinctive option.

**Best for:** Premium white-label deployments, executive dashboards, or organizations targeting creative industries and agencies.

**Comparable products:** Figma (dark), Stytch, Clerk.

### Palette

| Role | Name | Hex |
|------|------|-----|
| Ink | Plum | `#1A0A1E` |
| Primary | Dusk Purple | `#6D28D9` |
| Primary Light | Purple Mid | `#8B5CF6` |
| Accent | Rose | `#F43F5E` |
| Surface | Rose Tint | `#FFF1F2` |
| Background | Warm White | `#FAFAFA` |

### CSS variables

```css
:root {
  --color-primary:             #6D28D9;
  --color-primary-foreground:  #FFFFFF;
  --color-primary-dark:        #4C1D95;
  --color-secondary:           #8B5CF6;
  --color-accent:              #F43F5E;
  --color-accent-foreground:   #FFFFFF;
  --color-surface:             #FFF1F2;
  --color-bg:                  #FFFFFF;
  --color-text:                #1A0A1E;
  --color-muted:               #7C3F6E;
  --color-border:              #EDE9FE;
}
```

---

## Scheme 9 — Arctic & Sapphire

**Personality:** Crisp, precise, and data-forward. Light steel backgrounds with a deep sapphire primary. The palette of dashboards built to be trusted — nothing decorative, nothing warm.

**Best for:** Analytics-first interfaces where dense data and charts dominate. Financial reporting, utilization dashboards, executive summary views.

**Comparable products:** Tableau, Hex, Sigma Computing.

### Palette

| Role | Name | Hex |
|------|------|-----|
| Ink | Sapphire Deep | `#0A1628` |
| Primary | Sapphire | `#1849A9` |
| Interactive | Blue | `#2563EB` |
| Accent | Ice Blue | `#BAE6FD` |
| Surface | Arctic | `#F0F7FF` |
| Background | White | `#FFFFFF` |

### CSS variables

```css
:root {
  --color-primary:             #1849A9;
  --color-primary-foreground:  #FFFFFF;
  --color-primary-dark:        #0A1628;
  --color-secondary:           #2563EB;
  --color-accent:              #BAE6FD;
  --color-accent-foreground:   #0C2461;
  --color-surface:             #F0F7FF;
  --color-bg:                  #FFFFFF;
  --color-text:                #0A1628;
  --color-muted:               #64748B;
  --color-border:              #DBEAFE;
}
```

---

## Scheme 10 — Copper & Obsidian

**Personality:** Warm, premium, and unconventional. Obsidian black with a metallic copper accent — feels crafted rather than templated. The most adventurous option in this set.

**Best for:** Organizations that want a truly distinct identity and are willing to invest in a cohesive visual system. Best paired with Inter or a geometric display face.

**Comparable products:** Oxide, Craft, Campfire.

### Palette

| Role | Name | Hex |
|------|------|-----|
| Ink | Obsidian | `#0C0C0F` |
| Primary | Copper | `#B45309` |
| Primary Light | Copper Mid | `#D97706` |
| Accent | Copper Soft | `#FED7AA` |
| Surface | Warm Gray | `#FAFAF9` |
| Background | White | `#FFFFFF` |

### CSS variables

```css
:root {
  --color-primary:             #B45309;
  --color-primary-foreground:  #FFFFFF;
  --color-primary-dark:        #78350F;
  --color-secondary:           #D97706;
  --color-accent:              #FED7AA;
  --color-accent-foreground:   #431407;
  --color-surface:             #FAFAF9;
  --color-bg:                  #FFFFFF;
  --color-text:                #0C0C0F;
  --color-muted:               #78716C;
  --color-border:              #E7E5E4;
}
```

---

## Decision guide

| If you want… | Use |
|---|---|
| Safe default, enterprise trust | Scheme 1 — Graphite & Indigo |
| Calm, HR-tool credibility | Scheme 2 — Slate & Teal |
| Analytics urgency, dark mode first | Scheme 3 — Midnight & Amber |
| People-ops warmth, modern feel | Scheme 4 — Cloud & Violet |
| Startup energy, standout identity | Scheme 5 — Ocean & Coral |
| Wellbeing & growth positioning | Scheme 6 — Forest & Sage |
| Security-focused, compliance-heavy | Scheme 7 — Iron & Crimson |
| Premium, editorial, executive | Scheme 8 — Dusk & Rose |
| Data-dense, analytics dashboards | Scheme 9 — Arctic & Sapphire |
| Distinctive, unconventional brand | Scheme 10 — Copper & Obsidian |

---

## Implementation checklist

- [ ] Pick one scheme as `primary`
- [ ] Add shared semantic tokens to `globals.css`
- [ ] Add brand tokens from chosen scheme to `globals.css`
- [ ] Map to Tailwind in `tailwind.config.ts`
- [ ] Verify all tokens in both **light** and **dark** mode
- [ ] Check contrast ratios (primary on white ≥ 4.5:1 for WCAG AA)
- [ ] Run `npm run build` after token changes

---

*Version 1.0 — aligned to PRD v1.1 and PAGES.md V2 (29 sections)*
