# Changelog — 2026-07-02

Page-by-page summary of everything that changed today. Each entry lists the
user-facing **page/area**, the **files** touched, and the **edits** made.

> Branch `sandhiya/redesign`. This builds on the merge of `origin/preview`
> (HEAD was `49aad61`).

## Changed files

| File | Area |
|------|------|
| `modules/auth/components/login-experience.tsx` | Login page |
| `modules/auth/components/signup-experience.tsx` | Sign-up page |
| `public/logindesign01.png` *(new)* | Login artwork |
| `public/logindesign.png` *(new)* | Sign-up artwork |
| `modules/help/components/help-page.tsx` | Help Center banner |
| `modules/employees/components/employees-view.tsx` | Employees filter |
| `modules/attendance/components/attendance-view.tsx` | Attendance filter |
| `modules/attendance/components/attendance-calendar.tsx` | Attendance filter |
| `modules/insights/components/reports-experimental.tsx` | Insights & Reports |

---

## Login (`/login`)

**Files:** `modules/auth/components/login-experience.tsx`,
`public/logindesign01.png` (new)

- Rebuilt as a **split screen** — an immersive dark-teal brand panel on the
  **left** (Logo + "Your workforce, in perfect rhythm." headline + subcopy) and
  the sign-in form on the right; collapses to a single column on mobile.
- Brand panel now uses the **`logindesign01.png`** flowing-wave artwork as a
  full-bleed `next/image` background (`object-cover`), with a left scrim so the
  headline stays legible.
- **SSO** simplified from three social icon buttons to a single full-width
  **"Continue with SSO"** button (divider label "or"), matching sign-up.
- **Orchestrated entrance:** Logo fades up, headline slides in from the left,
  form slides in from the right (reduced-motion-safe).

## Sign-up (`/register`)

**Files:** `modules/auth/components/signup-experience.tsx`,
`public/logindesign.png` (new)

- Synced to the login split-screen, then made the **mirror opposite**: form on
  the **left**, brand panel on the **right** (reversed grid + `lg:order`,
  mirrored gradient/glow), with entrance directions flipped to match.
- Brand panel uses the **`logindesign.png`** "team on a path" artwork as a
  full-bleed background with a left scrim.
- All sign-up logic preserved (name/email/password/confirm, Terms checkbox,
  Continue with SSO, and the SSO / account-picker / org-setup modals).

## Help Center — banner (`/help`)

**Files:** `modules/help/components/help-page.tsx`

- Redesigned the hero to the reference: a **static `bg-feature` teal** (no
  gradient — removed the white-smoke bloom), with **edge-anchored dots** (masked
  to the left/right, fading to centre) and two soft **wave lines**.
- **Reduced height** back to a compact size (`py-10 / sm:py-14`).
- **Removed** the top-left white glow orb and the **outer colored glow**
  (`shadow-xl shadow-primary/25`).
- **Dark-theme fix:** the search field was invisible because the shared `Input`
  ships `dark:bg-input/30`; the search + Ask AI controls now use a fixed **white
  surface with dark text** (`bg-white dark:bg-white`, `text-slate-900`), visible
  and matched in both themes.

## Employees (`/employees`)

**Files:** `modules/employees/components/employees-view.tsx`

- The department filter is **fixed to Design** in the management view — defaults
  to `"Design"` and the dropdown lists only Design (no "All departments").

## Attendance (`/attendance`)

**Files:** `modules/attendance/components/attendance-view.tsx`,
`modules/attendance/components/attendance-calendar.tsx`

- Department is now shown as a **static "Department: Design"** label (an
  outlined pill), not a dropdown. Removed the `Select`, the `onDeptChange` /
  `departments` props, and the `DEPARTMENTS` list; `dept` is a fixed `"Design"`
  const and still narrows the day log.

## Insights & Reports (Analytics)

**Files:** `modules/insights/components/reports-experimental.tsx`

- Fixed the mismatched card heights in the executive overview: the **AI
  workforce health** card had `self-start` and sat shorter than **AI reporting
  summary**. Removed `self-start` so it stretches to equal height, and added
  `mt-auto` to its KPI grid so the driver stats anchor to the bottom.
