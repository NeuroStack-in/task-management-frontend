# 03 · Employee Management · Organization Management

Sections 8–9 (SPEC §3). Inside the [global app shell](00-index.md). Employees = Phase 3; Org Mgmt = Phase 4 (`/settings/organization`).

---

# Section 8 — Employee Management  `/employees`

## 8.1 Employee Directory  `/employees`
```
┌───────────────────────────────────────────────────────────────────────┐
│ Employees  🔍 search   [Dept ▼][Team ▼][Status ▼]  [⊞grid][≣list][+ Add]│
├───────────────────────────────────────────────────────────────────────┤
│ Grid view:                                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│ │  👤      │ │  👤      │ │  👤      │ │  👤      │                     │
│ │ A. Rao   │ │ M. Khan  │ │ S. Lee   │ │ J. Diaz  │  «card: avatar,    │
│ │ Engineer │ │ Designer │ │ PM       │ │ QA       │   role, dept,      │
│ │ Eng·●on  │ │ Design·●on│ │ PM·○off  │ │ QA·●idle │   status dot,      │
│ │ 92% prod │ │ 88%      │ │ 76%      │ │ 81%      │   productivity»    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                    │
│ (list view = TanStack table: name·email·dept·team·role·status·prod·⋮)   │
└───────────────────────────────────────────────────────────────────────┘
```
- `+ Add` → invite drawer (email + role + dept/team). Click card → 8.2.

## 8.2 Employee Profile  `/employees/[id]`
```
┌───────────────────────────────────────────────────────────────────┐
│ 👤  A. Rao   Senior Engineer · Engineering        [Message][Edit]   │
│     ● Online · joined Jan 2024 · a.rao@acme.com                     │
│ Tabs:[Overview][Productivity][Performance][Goals][Attendance][Activity]│
├───────────────────────────────────────────────────────────────────┤
│ OVERVIEW                                                            │
│ ┌────────┐┌────────┐┌────────┐┌────────┐                            │
│ │Prod 92%││Hours/wk││Tasks   ││Projects│  KPIs                      │
│ │        ││ 38h    ││ 7 open ││ 3      │                            │
│ └────────┘└────────┘└────────┘└────────┘                            │
│ Assigned projects · Recent tasks · Reporting line · Contact         │
└───────────────────────────────────────────────────────────────────┘
```

## 8.3 Teams  `/employees/teams`
List of teams: name · lead · member count · department · avg productivity · [Manage]. `[+ New team]` → name/lead/members. (Mirror of Org Mgmt Teams; this is the people-centric view.)

## 8.4 Departments  `/employees/departments`
Department cards: name · head · #teams · #people · avg productivity. Drill into department → its teams + people.

## 8.5 Attendance  `/employees/attendance`
```
│ Attendance   [Month Jun ▼]   [Dept ▼]                         │
│ Name     │ M T W T F S S … (per-day status grid)              │
│ A. Rao   │ ● ● ● ● ● ○ ○   ●present ◐half ○absent ▲leave      │
│ M. Khan  │ ● ● ▲ ● ● ○ ○                                      │
│ Summary KPIs: present % · avg arrival · absences               │
```

## 8.6 Productivity Profile  `/employees/[id]/productivity`
Charts: productivity trend, active vs inactive, app/website mix, focus hours heatmap; period selector; benchmark vs team avg.

## 8.7 Performance History  `/employees/[id]/performance`
Timeline of reviews/ratings + productivity history line; milestones; notes log. [+ Add review note].

## 8.8 Employee Goals  `/employees/[id]/goals`
```
│ Goals  [+ New goal]                                           │
│ ▢ Ship auth module       Due Jul 15   ▰▰▰▱▱ 60%  On track     │
│ ▢ Reduce idle to <10%    Due Jun 30   ▰▰▰▰▱ 80%  At risk ⚠    │
│ ▢ Mentor 1 junior        Q3           ▱▱▱▱▱  0%  Not started   │
```

---

# Section 9 — Organization Management  `/settings/organization`

Settings sub-area. Left settings nav + right panel. Covers Company · Departments · Teams · Locations · Working Hours · Holidays · Policies · Branding.

```
┌───────────────┬──────────────────────────────────────────────────────┐
│ SETTINGS NAV  │  PANEL                                                 │
│ Organization ▾│                                                        │
│  · Company    │   « active sub-section »                               │
│  · Departments│                                                        │
│  · Teams      │                                                        │
│  · Locations  │                                                        │
│  · Hours      │                                                        │
│  · Holidays   │                                                        │
│  · Policies   │                                                        │
│  · Branding   │                                                        │
│ Monitoring  ▸ │                                                        │
│ Tracking    ▸ │                                                        │
│ Features    ▸ │                                                        │
└───────────────┴──────────────────────────────────────────────────────┘
```

## 9.1 Company Information
Form: legal name · display name · logo ▢ · industry ▼ · size ▼ · website · tax/registration IDs · primary contact · address. `[Save changes]`.

## 9.2 Departments
Table: name · head ▼ · #teams · #members · [Edit][Delete]; `[+ Add department]`. Drag to reorder hierarchy.

## 9.3 Teams
Table: name · department ▼ · lead ▼ · members (avatars) · [Manage]; `[+ Add team]`.

## 9.4 Locations
List of office locations: name · address · timezone ▼ · #employees; map preview optional. `[+ Add location]`.

## 9.5 Working Hours
```
│ Default working hours                                         │
│ Mon [09:00]–[17:00]  [x] working                              │
│ Tue [09:00]–[17:00]  [x]      … per weekday rows              │
│ Sat        —          [ ] working                             │
│ Timezone ▼  · Break policy [60] min · Overtime rules ▼        │
│ [ ] Allow per-location overrides                              │
```

## 9.6 Holidays
Calendar + table of holidays: date · name · location scope ▼ · recurring [toggle]; import national holidays; `[+ Add holiday]`.

## 9.7 Policies
List of org policies (Leave · Overtime · Remote work · Monitoring consent): title · version · last updated · [View][Edit]. Rich-text editor on edit; acknowledge-required toggle.

## 9.8 Branding
```
│ Branding                                                      │
│ Logo (light) ▢ upload   Logo (dark) ▢ upload                  │
│ Primary color [#4F46E5] ◼   Accent [#06B6D4] ◼                │
│ Favicon ▢   Email header preview ░░░                          │
│ Login background ▢                                            │
│ Live preview:  ┌── mini app shell with brand applied ──┐      │
│                └────────────────────────────────────────┘     │
│ [ Reset ]                                  [ Save branding ]  │
```
