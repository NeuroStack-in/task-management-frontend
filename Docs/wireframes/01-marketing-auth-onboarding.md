# 01 · Marketing · Authentication · Onboarding

Sections 1–3 (SPEC §3). These are **unauthenticated** — no app shell.
`(marketing)` is public; `(auth)` is the sign-in funnel; `/onboarding` runs once after first sign-in.

---

# Section 1 — Marketing Website  `/(marketing)`

## 1.1 Landing Page  `/`
```
┌──────────────────────────────────────────────────────────────────────┐
│ [◆ Logo]   Features  Pricing  Customers  FAQ        [Login] [Sign up ▸]│  «sticky nav»
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│            Track work. See productivity. Act on AI insights.           │  «Hero»
│            One platform for time, activity & workforce analytics.      │
│                                                                        │
│                 [ Start free trial ▸ ]   [ ▷ Watch demo ]              │
│                                                                        │
│        ┌──────────────────────────────────────────────────────┐       │
│        │   ░░░░░░  product screenshot / demo video  ░░░░░░      │       │
│        └──────────────────────────────────────────────────────┘       │
├──────────────────────────────────────────────────────────────────────┤
│ FEATURE SHOWCASE                                                       │
│  ▢ Time Tracking   ▢ Activity Monitor  ▢ Productivity  ▢ AI Insights   │
│  ▢ Employee Mgmt   ▢ Security                                          │
├──────────────────────────────────────────────────────────────────────┤
│ INTEGRATIONS   [slack][teams][jira][github][asana][trello][gworkspace] │
├──────────────────────────────────────────────────────────────────────┤
│ CUSTOMER REVIEWS   « ★★★★★ quote carousel · 3 cards »                  │
├──────────────────────────────────────────────────────────────────────┤
│ PRICING PREVIEW   Free · Pro · Business · Enterprise  [See pricing →]  │
├──────────────────────────────────────────────────────────────────────┤
│ CTA banner:  Ready to get started?   [ Start free trial ▸ ]            │
├──────────────────────────────────────────────────────────────────────┤
│ FOOTER  Product · Company · Resources · Legal(Privacy · Terms · Contact)│
└──────────────────────────────────────────────────────────────────────┘
```
- Sticky nav; all anchor links scroll within page; `Sign up` → `/register`.

## 1.2 Features (detail)  `/features`
```
┌──────────────────────────────────────────────────────────────┐
│ Nav …                                                          │
│  Everything in the platform                                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                 │
│  │ ⏱ Time     │ │ ⚡ Activity │ │ 📊 Analytics│  «icon + copy  │
│  │ tracking   │ │ monitoring │ │            │   + mini shot» │
│  └────────────┘ └────────────┘ └────────────┘                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                 │
│  │ 🤖 AI      │ │ 👥 Employee│ │ 🛡 Security │                 │
│  └────────────┘ └────────────┘ └────────────┘                 │
└────────────────────────────────────────────────────────────────┘
```

## 1.3 Pricing  `/pricing`
```
┌──────────────────────────────────────────────────────────────┐
│  Plans                              [ Monthly ◉  Annual ○ ]    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│  │ FREE    │ │ PRO     │ │BUSINESS │ │ENTERPRISE│             │
│  │ $0      │ │ $7/usr  │ │$12/usr  │ │ Contact  │  «most-     │
│  │         │ │ ★popular│ │         │ │          │   popular   │
│  │ ✓ feat  │ │ ✓ feat  │ │ ✓ feat  │ │ ✓ feat   │   ring»     │
│  │ ✓ feat  │ │ ✓ feat  │ │ ✓ feat  │ │ ✓ feat   │             │
│  │[Choose] │ │[Choose] │ │[Choose] │ │[Contact] │             │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘              │
│  Feature comparison table ▾                                    │
└────────────────────────────────────────────────────────────────┘
```

## 1.4 Customer Stories  `/customers`
Grid of logo + quote + "Read story" cards → individual story pages (out of MVP detail).

## 1.5 FAQ  `/faq`
```
│ Frequently asked questions          🔍 search faq            │
│ ▸ How does time tracking work?                               │  «accordion»
│ ▾ Is monitoring consent-based?                               │
│     Body text…                                               │
│ ▸ Can I export reports?                                      │
```

## 1.6 Contact Us  `/contact`
Two-column: contact form (Name · Email · Company · Message · [Send]) + office/info sidebar.

## 1.7 Terms & Conditions  `/terms` · 1.8 Privacy Policy  `/privacy`
Long-form legal: left in-page TOC anchor list + right scrollable prose. Last-updated stamp at top.

---

# Section 2 — Authentication  `/(auth)`

Centered card on a split / branded background. No shell.

## 2.1 Login  `/login`
```
        ┌───────────────────────────────────┐
        │            ◆ Logo                 │
        │         Welcome back              │
        │ ┌───────────────────────────────┐ │
        │ │ Email                         │ │
        │ └───────────────────────────────┘ │
        │ ┌───────────────────────────────┐ │
        │ │ Password                👁     │ │
        │ └───────────────────────────────┘ │
        │ [x] Remember me     Forgot? →     │
        │ ┌───────────────────────────────┐ │
        │ │        [  Sign in  ]          │ │
        │ └───────────────────────────────┘ │
        │ ──────────── or ───────────────── │
        │ [  Google  ]  [  Microsoft  ]     │  «SSO → 2.6»
        │ No account?  Register org →       │
        └───────────────────────────────────┘
```
- Submit → if MFA enabled → `/mfa`; else → `/dashboard` (or `/onboarding` if first run). Mock JWT → localStorage (TDD §9).

## 2.2 Register Organization  `/register`
```
        ┌───────────────────────────────────┐
        │   Create your organization        │
        │  Full name    [______________]    │
        │  Work email   [______________]    │
        │  Organization [______________]    │
        │  Password     [______________] 👁  │
        │  [x] I agree to Terms & Privacy   │
        │        [  Create account  ]       │
        │  ──────── or sign up with ──────── │
        │  [ Google ]  [ Microsoft ]        │
        │  Already have an account? Login → │
        └───────────────────────────────────┘
```
- Success → `/onboarding` step 1.

## 2.3 Forgot Password  `/forgot-password`
```
        ┌───────────────────────────────────┐
        │  Reset your password              │
        │  Enter your email and we'll send  │
        │  a reset link.                    │
        │  Email   [__________________]     │
        │        [  Send reset link  ]      │
        │  ← Back to login                  │
        └───────────────────────────────────┘
              ↓ (mock) success toast
        "Check your inbox" confirmation state
```

## 2.4 Reset Password  `/reset-password?token=…`
```
        ┌───────────────────────────────────┐
        │  Set a new password               │
        │  New password      [_________] 👁  │
        │  Confirm password  [_________] 👁  │
        │  «strength meter ▰▰▰▱▱»            │
        │  Rules: 8+ chars · 1 number · …    │
        │        [  Update password  ]      │
        └───────────────────────────────────┘
              ↓ → /login with success toast
```

## 2.5 MFA Verification  `/mfa`
```
        ┌───────────────────────────────────┐
        │  Two-factor verification          │
        │  Enter the 6-digit code           │
        │     [_][_][_]  [_][_][_]           │  «auto-advance OTP»
        │  Didn't get it?  Resend (29s)     │
        │  [ ] Trust this device 30 days    │
        │        [  Verify  ]               │
        │  Use a backup code →              │
        └───────────────────────────────────┘
              ↓ → /dashboard
```

## 2.6 SSO Authentication  `/sso/callback`
Interstitial: spinner + "Signing you in with Google…" → resolves to dashboard/onboarding. Error state with retry.

## 2.7 Session Management
Not a standalone auth page — surfaced in **Security Center → Device Management** (see [07](07-admin-security-support.md)). Lists active sessions with revoke.

---

# Section 3 — Onboarding  `/onboarding`

Full-screen wizard. Left vertical stepper, right active step, sticky footer nav. State persists across steps.

```
┌──────────────────────────────────────────────────────────────────┐
│ ◆ Logo                                            Skip setup →     │
├───────────────┬────────────────────────────────────────────────────┤
│ ① Organization │  STEP CONTENT                                      │
│ ② Invite team  │                                                    │
│ ③ Departments  │   « active step body — see below »                 │
│ ④ Roles        │                                                    │
│ ⑤ Tracking     │                                                    │
│ ⑥ Dashboard    │                                                    │
│ ⑦ Tour         │                                                    │
│ ▰▰▰▱▱▱▱ 3/7    │                                                    │
├───────────────┴────────────────────────────────────────────────────┤
│                                        [ ← Back ]   [ Continue → ]  │
└──────────────────────────────────────────────────────────────────────┘
```

## 3.1 Organization Setup (step 1)
Form: Org name · Logo upload (drag-drop ▢) · Industry ▼ · Company size ▼ · Timezone ▼ · Working hours (start/end).

## 3.2 Team Invitation (step 2)
```
│  Invite your team                                       │
│  ┌────────────────────────────────────┬──────────┐     │
│  │ email@company.com                  │ Role ▼   │ ✕   │
│  │ email2@company.com                 │ Role ▼   │ ✕   │
│  └────────────────────────────────────┴──────────┘     │
│  + Add another      |  📋 Bulk paste / CSV upload       │
```

## 3.3 Department Setup (step 3)
Add departments (chips) + assign a lead per department. Optional teams nested under each.

## 3.4 Role Creation (step 4)
Quick role picker: starter roles preselected (Owner/Manager/Employee). "Customize later in Roles →". Inline permission preview matrix (compact).

## 3.5 Tracking Configuration (step 5)
```
│  Tracking preferences                                   │
│  Idle threshold        [ 5 ] min                        │
│  Screenshot frequency  ( ) Off ( ) Low ◉ Normal ( ) High│
│  Silent mode           [toggle ◯]  «consent note»       │
│  Track URLs            [toggle ●]                        │
│  Track applications    [toggle ●]                        │
│  ⓘ All monitoring is consent-based and configurable.   │
```

## 3.6 Dashboard Personalization (step 6)
Choose a starter dashboard template (Executive / Team / Employee) as cards; toggle which widgets appear. Feeds the dashboard widget store.

## 3.7 Guided Product Tour (step 7)
```
│  You're all set! 🎉                                     │
│  Take a 60-second tour of the product.                  │
│      [ Start tour ▸ ]      [ Go to dashboard → ]        │
```
- "Start tour" → enters `/dashboard` with **react-joyride** spotlight overlays:
```
   ┌─────────────────────────────┐
   │ This is your sidebar.       │   «joyride tooltip,
   │           [ Skip ] [ Next ▸]│    dims rest of screen»
   └───────────▼─────────────────┘
```
