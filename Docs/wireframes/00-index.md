# Wireframes — Index & Conventions

> Low-fidelity ASCII wireframes for the **Workforce Activity & Productivity Management Platform**.
> Scope and route map follow [SPEC.md §3](../SPEC.md) (PAGES.md V2 — 29 sections, 90–120 screens).
> These are **layout + interaction** sketches, not pixel specs. Fidelity = grey-box.

---

## How to read these

| Symbol | Meaning |
|--------|---------|
| `┌─┐ └─┘` | Container / card / panel boundary |
| `▢ ▢ ▢` | Repeated cards (KPI tiles, list rows) |
| `░░░ chart ░░░` | Chart / data-viz region (Recharts) |
| `[ Button ]` | Primary/secondary button |
| `( ) ◉` | Radio (unselected / selected) |
| `[x] [ ]` | Checkbox (checked / unchecked) |
| `▼` | Dropdown / select |
| `🔍 ⏱ 🔔 👤 🌙 ⌘` | Search · timer · notifications · profile · theme · command palette |
| `«…»` | Annotation / behavior note (not visible UI) |
| `→` | Navigation / state transition |
| `▰▰▰▱▱` | Progress / completion bar |

**Responsive rule (TDD §21):** Desktop (sidebar pinned) → Tablet (sidebar collapses to icons) → Mobile (sidebar becomes a drawer, topbar becomes hamburger + timer pill). Tables become stacked cards on mobile.

**Theme (TDD §22):** Every screen supports light/dark via `next-themes`; the 🌙 switcher lives in the topbar. Wireframes are theme-agnostic.

**3-click rule (TDD §21):** Any screen reachable from the dashboard in ≤3 interactions. Command Palette (⌘K) is the universal shortcut.

---

## Global App Shell (authenticated layout)

Every authenticated route (sections 4–29) renders inside this shell. `(marketing)` and `(auth)` do **not** use it.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR                                                                         │
│ ┌────────────┐  ┌──────────────────────────┐         ┌───────────────────────┐│
│ │ [Org ▼]    │  │ 🔍 Search… (⌘K)          │         │ ⏱ 02:14:53 ▸ ⏸ ■ 🔔³ 🌙 👤│
│ │ Acme Inc   │  │                          │         │  Global Timer  Notif    ││
│ └────────────┘  └──────────────────────────┘         └───────────────────────┘│
├──────────────┬─────────────────────────────────────────────────────────────────┤
│ SIDEBAR      │  PAGE CONTENT AREA                                              │
│ «generated   │  ┌───────────────────────────────────────────────────────────┐ │
│  from        │  │ PageHeader: Title            [secondary] [Primary action] │ │
│  role.perms» │  │ breadcrumb ▸ here                                          │ │
│              │  ├───────────────────────────────────────────────────────────┤ │
│ ⌂ Dashboard  │  │                                                           │ │
│ ⏱ Time       │  │   « per-screen content — see module files »               │ │
│ ☑ Tasks      │  │                                                           │ │
│ ▤ Projects   │  │                                                           │ │
│ 👥 Employees │  │                                                           │ │
│ ⚡ Activity   │  │                                                           │ │
│ 📷 Screens   │  │                                                           │ │
│ 📊 Reports   │  │                                                           │ │
│ 🤖 AI        │  │                                                           │ │
│ ⚠ Anomalies  │  │                                                           │ │
│ ✓ Approvals  │  │                                                           │ │
│ ✉ Inbox      │  │                                                           │ │
│ 💼 Jobs      │  │                                                           │ │
│ 🔌 Integr.   │  │                                                           │ │
│ 💳 Billing   │  │                                                           │ │
│ 🛡 Security   │  │                                                           │ │
│ 🖥 Agents     │  │                                                           │ │
│ ⚙ Settings ▸ │  │                                                           │ │
│ ? Help       │  └───────────────────────────────────────────────────────────┘ │
│              │                                              ╭──────────────────╮│
│ [collapse «] │                                              │ 🤖 AI Assistant  ││
└──────────────┴──────────────────────────────────────────── ╰──────(FAB)───────╯┘
```

### Shell sub-components (global, on every authenticated screen)

**Organization Switcher** (topbar left)
```
[Org ▼] click →  ┌────────────────────────┐
                 │ ◉ Acme Inc             │
                 │ ○ Globex Ltd           │
                 │ ○ Initech              │
                 │ ────────────────────── │
                 │ + Create organization  │
                 └────────────────────────┘
```

**Global Timer** (topbar right — persistent, Zustand `timer` store)
```
Idle:     [ ⏱ Start timer ]
Running:  ⏱ 02:14:53  «Task: Design login»  ▸resume ⏸pause ■stop  ⇄switch
                                                                   │
Switch task ▾ ──────────────────────────────────────────┐         │
┌──────────────────────────────────────────────┐        │ «timer keeps running
│ 🔍 Filter tasks…                              │        │  while task switches»
│ ☑ Design login screen      (active)           │        │
│ ☐ Fix nav bug              PROJ-2             │        │
│ ☐ Write API docs           PROJ-7             │        │
└──────────────────────────────────────────────┘        │
On stop → «Auto-submit worklog» dialog (see Time Tracking)
```

**Notifications Panel** (🔔 → right drawer)
```
                                        ┌─────────────────────────────┐
                                        │ Notifications      [Mark all]│
                                        │ ─────────────────────────── │
                                        │ ⚠ Deadline: PROJ-2 due 2h    │
                                        │ ✓ Approval: timesheet OK     │
                                        │ 📉 Productivity alert: team A │
                                        │ 💳 Invoice #1042 paid         │
                                        │ ─────────────────────────── │
                                        │ [ View all → /notifications ]│
                                        └─────────────────────────────┘
```

**Command Palette** (⌘K / Ctrl+K — center modal overlay)
```
        ┌───────────────────────────────────────────────┐
        │ ⌘ > type a command or search…                 │
        ├───────────────────────────────────────────────┤
        │ NAVIGATE                                      │
        │   ⌂ Go to Dashboard                           │
        │   ☑ Go to Tasks                               │
        │ ACTIONS                                       │
        │   ⏱ Start timer on…                           │
        │   + New task                                  │
        │   📊 Generate report                          │
        │ RECENT                                        │
        │   PROJ-2 · Fix nav bug                        │
        └───────────────────────────────────────────────┘
```

**AI Assistant** (floating button → slide-over panel; see [05-reports-ai-anomalies.md](05-reports-ai-anomalies.md))
**User Profile menu** (👤): Profile · Preferences · Theme · Keyboard shortcuts · Sign out.
**Help Widget** (?): contextual help + link to Help Center.

---

## File map

| File | Sections (SPEC §3) |
|------|--------------------|
| [01-marketing-auth-onboarding.md](01-marketing-auth-onboarding.md) | 1 Marketing · 2 Auth · 3 Onboarding |
| [02-dashboard-time-tasks-projects.md](02-dashboard-time-tasks-projects.md) | 4 Dashboard · 5 Time Tracking · 6 Tasks · 7 Projects |
| [03-employees-organization.md](03-employees-organization.md) | 8 Employees · 9 Organization Mgmt |
| [04-monitoring.md](04-monitoring.md) | 10 Activity · 11 Screenshots · 12 Monitoring Config · 13 App & URL Mgmt |
| [05-reports-ai-anomalies.md](05-reports-ai-anomalies.md) | 14 Reports · 15 AI Center · 16 Anomaly Detection |
| [06-business.md](06-business.md) | 17 Approvals · 18 Communication · 19 Notifications · 20 Jobs · 21 Integrations · 22 Billing |
| [07-admin-security-support.md](07-admin-security-support.md) | 23 Roles · 24 Features · 25 Security · 26 Audit Logs · 27 Remote Support · 28 Agents · 29 Help |
