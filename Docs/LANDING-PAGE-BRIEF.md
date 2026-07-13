# WorkPulse — Landing Page Content Brief

> A content + information-architecture brief for the UI/UX designers. Grounded in
> the actual product (features, pricing, brand identity). The repo already ships a
> landing page (`src/app/page.tsx`) using much of this copy — treat this as the
> spec to redesign against or validate.

---

## 1. Product in one line

**WorkPulse is a workforce activity & productivity platform** — time tracking,
activity insights, projects, attendance, and consent-based monitoring in one
place. It gives leaders a clear "pulse" on how work is going **without turning
into surveillance**.

- **Category:** Workforce productivity / time-tracking SaaS (B2B).
- **Positioning:** *"Proof of work and real productivity insight — transparent,
  consent-first, and built to support teams, not spy on them."*

## 2. Audience

- **Primary buyer:** Head of Operations, People/HR lead, Founder/COO of a
  20–1,000-person company.
- **Secondary:** Team leads/managers who approve time and watch capacity;
  IT/Security for enterprise deals.
- **Industries to speak to:** Field service · Remote & hybrid teams · Agencies &
  consultancies · BPO & support centers.
- **Job-to-be-done (emotional):** "I need visibility into hours, focus, and
  delivery — but I don't want to feel like Big Brother or fight my team."

## 3. Brand & visual direction (must honor)

- **Identity:** *Graphite & Indigo* — a calm, professional "control surface."
  Original — **do not model on any competitor.**
- **Palette:** graphite canvas `#F4F5F7` · white cards `#FFFFFF` · ink `#1A1D23`
  · secondary text `#6B7180` · restrained **indigo accent `#4338CA`** (used
  sparingly) · borders `#E3E6EB`. States: success `#18794E`, warning `#B7791F`,
  error `#C0392B`. Dark mode = graphite charcoal with lighter indigo `#6366F1`.
- **Signature motif:** a recurring **pulse / wave line** (activity over time) —
  weave it through the hero, dividers, and feature cards. Lean on it instead of
  generic illustration.
- **Charts:** indigo-led categorical palette (indigo → blue → teal → amber →
  violet), moderate saturation, **never neon**.
- **Voice:** confident, plain-spoken, reassuring. Anti-jargon, anti-hype.
  Recurring counter-message: *"context, not surveillance theatre."*
- **Do:** whitespace, soft shadows, real product UI, real numbers.
  **Don't:** stocky corporate imagery, fearmongering, dark-pattern urgency.

## 4. Messaging pillars (the 4 things to land)

1. **Effortless time tracking** → clean timesheets for approval, payroll, billing.
2. **Real productivity insight** → active vs. idle, app/site usage, a
   productivity score per person and team.
3. **Delivery in view** → projects, attendance, leave, schedules next to time data.
4. **Trust by design** → consent-based, blurred, audited screenshots;
   enterprise-grade security.

---

## 5. Page structure & section-by-section content

### A. Top nav
Logo · Product · Solutions (by industry) · Pricing · Security · Docs/Help ·
`Sign in` (text) · **Start free** (primary). Sticky; condenses on scroll.

### B. Hero
- **Eyebrow:** Workforce activity & productivity platform
- **Headline (pick/adapt):**
  - "See how work is really going."
  - "One clear pulse on your whole team."
  - "Time, activity, and delivery — in one place."
- **Subhead:** *"Effortless time tracking, honest productivity insight, and
  consent-based monitoring — so you get proof of work without the surveillance
  theatre."*
- **CTAs:** Start free · Book a demo.
- **Trust microcopy:** "Free plan · No card required · SSO & MFA ready."
- **Visual:** live product dashboard (productivity score, pulse-line chart,
  attendance ring) with a subtle animated pulse line — real app UI, lightly framed.

### C. Social proof strip
Logo row ("Trusted by teams at…") **or** a metric strip: *"Timesheets in minutes,
not days · Consent-first monitoring · Enterprise-ready security."*

### D. Core feature sections (alternating image/text, 4 blocks)
1. **Time tracking** — "Track time without the friction." *A one-tap timer on web,
   desktop, and mobile turns into clean, automatic timesheets — ready for
   approval, payroll, and billing.*
2. **Activity & productivity** — "See where focus actually goes." *Active vs. idle
   time, app & site usage, and a productivity score per person and team —
   context, not surveillance theatre.*
3. **Projects & attendance** — "Plan, assign, and stay on track." *Kanban boards,
   attendance, schedules, and leave live next to the time data — so delivery and
   capacity are always in view.*
4. **Screenshots (with consent)** — "Proof of work, captured with consent."
   *Optional, policy-gated screenshots at set intervals — blurred by default,
   multi-monitor aware, and fully audited.*
   - *Design note:* show the multi-monitor gallery (a capture = a set of monitors)
     and the "blurred by default" state — this is a differentiator.

### E. How it works (3 steps)
1. **Invite your team** — "Bring people in by email or SSO and group them into
   teams and projects in minutes."
2. **Track time & activity** — "The timer and a lightweight desktop agent capture
   hours, attendance, and activity automatically."
3. **Act on insights** — "Read one clear pulse, approve timesheets, and catch
   burnout or overruns early."

### F. Solutions / use cases (4 cards)
- **Field service** — GPS-aware clock-in, job costing, crews tracking from anywhere.
- **Remote & hybrid teams** — async-friendly visibility into focus and capacity
  without micromanaging.
- **Agencies & consultancies** — billable hours, project budgets, client-ready
  reports out of the box.
- **BPO & support** — shift attendance, adherence, and productivity at scale, with
  audit trails.

### G. Insights & AI highlight (indigo feature-fill card)
"Turn activity into decisions." Aggregated dashboards, productivity scores, and
**AI summaries & anomaly/burnout detection** that flag who needs attention — with
export to reports/PDF. Visual: AI summary card + productivity trend.

### H. Security & trust
- **Header:** "Enterprise-grade, privacy-first."
- **Grid of 4:**
  - **SSO / SAML & SCIM** — one-click sign-on and automated provisioning.
  - **MFA & session policies** — enforce multi-factor, session limits, device controls.
  - **Audit logs** — every action, permission change, and login — searchable.
  - **Data residency & DPA** — choose where data lives; encrypted in transit & at rest.
- **Consent/ethics callout:** "Monitoring is opt-in, policy-gated, blurred by
  default, and fully auditable — designed to support teams, not spy on them."

### I. Testimonial(s)
> "We replaced three tools with WorkPulse. Timesheets that used to take a day now
> take ten minutes." — **Priya Menon, Head of Operations, Northwind**
> *(placeholder — replace with real logos/quotes when available)*

### J. Pricing (4 tiers) — Monthly ↔ **Annual** toggle (annual default, "save ~2 months")

| Plan | Price | For | Highlights |
|------|-------|-----|------------|
| **Free** | $0 | Individuals / very small teams | Core tracking, ≤5 members, 1 project, 7-day history |
| **Pro** | $12/mo ($10 annual) | Growing teams | Analytics, unlimited projects, reports, dashboards, priority support |
| **Max** *(featured)* | $22/mo ($18 annual) | Scaling orgs | Everything in Pro + SSO/SAML & SCIM, AI anomaly/burnout, audit logs, DPA & residency |
| **Enterprise** | Custom | Procurement / security review | Custom contracts, SAML/SCIM at scale, tailored onboarding, premier SLA |

Per-seat, monthly billing. CTA per card: **Start free** (Free/Pro/Max) ·
**Talk to sales** (Enterprise).

### K. FAQ (accordion)
- **"Is WorkPulse employee monitoring or surveillance?"** — No. It focuses on
  transparent, aggregate signals — hours, attendance, productivity context — with
  controls and consent. Built to support teams, not spy on them.
- **"Is my data secure?"** — Encrypted in transit and at rest. Enterprise plans
  add SSO/SAML, SCIM, audit logs, and a signed DPA.
- Add: platforms supported (web/desktop/mobile), whether the desktop agent is
  required, can employees see their own data, how screenshots/blur work, cancellation.

### L. Final CTA band (indigo)
"Get one clear pulse on your team." **Start free** · **Book a demo.**
Microcopy: "Free plan · No card required."

### M. Footer
Product · Solutions · Pricing · Security · Docs · Company · Legal (Privacy, Terms,
**DPA**) · Status · social. Reassurance line: "SSO · MFA · Audit logs · Data residency."

---

## 6. Copy deck (ready to drop in)

- **Primary CTAs:** "Start free" / "Book a demo" / "Talk to sales."
- **Trust microcopy:** "Free plan · No card required · SSO & MFA ready."
- **Differentiator line (reuse):** "Context, not surveillance theatre."
- **Meta title:** "WorkPulse — Workforce Time Tracking & Productivity Insights."
- **Meta description:** "Effortless time tracking, honest productivity analytics,
  and consent-based monitoring for modern teams. Free plan, SSO & MFA ready."

## 7. Assets to prepare

- Real product screenshots: dashboard (pulse chart + productivity score),
  timer/timesheet, kanban board, **multi-monitor screenshot gallery (blurred
  state)**, AI summary card, security settings.
- The **pulse/wave line** motif as a reusable SVG (hero, dividers, cards).
- **Light and dark** hero variants (the app is theme-aware).
- Icon set consistent with in-app lucide icons.
- Customer logos + real testimonials (currently placeholders).

## 8. Responsive, a11y & performance

- Mobile-first: hero → headline + one CTA; feature sections stack; pricing becomes
  stacked/scrollable with the featured (Max) plan highlighted.
- WCAG AA contrast (watch muted text). Keyboard-reachable interactive elements;
  motion respects `prefers-reduced-motion` (pulse animation needs a static fallback).
- Screenshots optimized/lazy-loaded; theme-aware images.

---

## Accuracy flags for the designers

- **Testimonials and customer logos are placeholders** — replace with real ones.
- Keep pricing tiers to **Free / Pro / Max / Enterprise** (some in-app onboarding
  surfaces still reference legacy tiers; the landing page should not).
