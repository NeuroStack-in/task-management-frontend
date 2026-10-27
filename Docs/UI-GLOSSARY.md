# UI glossary

One word per idea, one spelling, one capitalization — for every string a user can read: labels,
headings, buttons, toasts, dialogs, empty states, tooltips, page titles and the copy the assistant
quotes from the nav. Written for the UX audit of 2026-10-16 (XC-12, SET-23, SET-24, PEOPLE-20), which
found "organisation" and "organization" on one page, "Ownership & deletion" in the rail above an
"Ownership & closure" page, and internal words ("§15", "outbox", "contributor-only", raw ids) in the UI.

When a term here disagrees with older copy, this file wins. When you need a term that isn't here,
add it — don't invent a second word for something already listed.

## House rules

| Rule | Do | Don't |
| --- | --- | --- |
| **American spelling** | organization, color, center, canceled, enroll / enrollment, recognize, summarize, utilization, penalize, behavior | organisation, colour, centre, cancelled, enrol / enrolment, recognise, summarise, utilisation |
| **Sentence case** for headings, card titles, tabs, labels, buttons, menu items, toasts, page titles | "Multi-factor authentication", "Session & access", "Audit logs" | "Multi-Factor Authentication", "Session & Access", "Audit Logs" |
| Proper nouns keep their capitals | WorkPulse, Slack, Google, Windows, macOS | — |
| **No internal language** | say what it means to the reader | "§15", "LLD", "outbox", "heartbeat", "telemetry", "push rail", "tenant", "slug", "token", "mint", "contributor-only", "wildcard", "bitset", "Cognito" |
| **No raw ids** | a name; or, when someone must quote it, a labeled *reference* in small muted text | agent ids, session ids, job ids, tenant ids or user UUIDs as a value in the UI |
| **Turn on / turn off** for switches and features | "Turn on MFA", "Screenshots are off" | "Enable", "Disable", "toggle" in body copy |
| **Sign in / sign out** (verb), **sign-in** (noun) | "Sign in again", "Windows sign-in" | "log in", "log out", "logon" — except the page name *Login & security* |
| **Dates** | `formatDate` / `formatDateTime` / `formatDateRange` from `src/lib/format.ts` | `toLocaleDateString()` / `toLocaleString()` in a component |
| **Durations** | `HH:MM:SS` (`formatDuration` / `formatHours`) — owner decision 2026-10-20 | "12.5 h" |
| **Time zone** — two words | "Primary time zone", "Select a time zone…" | "timezone", "TZ" |
| **Settings paths** | "Settings → Organization → Departments", as a link where the reader can follow it | "the Departments section of the Organization settings" |
| **Permission names** | quoted exactly as the role editor shows them (the server catalog, sentence case): *Manage organization settings*, *Manage monitoring settings*, *Manage security & audit*, *Manage device agents*, *Manage feature toggles* | "Manage Settings", "monitoring-manage permission" |
| **Support** | "Help → Submit a ticket", linking to `/help#submit-ticket` | a support email address (there is none — owner decision), "Contact support" with nowhere to go |

## Terms

### The organization and its people

| Use | Meaning | Not |
| --- | --- | --- |
| **organization** | The WorkPulse account a company signs up for. Everyone in it belongs to exactly one. | organisation, workspace, tenant, org (in UI copy), company (except as below) |
| company | The business itself, where that is what's meant: *company computer*, *company size*, *company holidays*, and the read-only **Company** page every employee sees. | — |
| **owner** | The role with every permission; an organization always has at least one. Lowercase in a sentence ("only an owner can…"); **Owner** when it is shown as a role name. | Organization Owner, org owner, super admin |
| **admin** | Someone whose role manages part of the organization. Lowercase in a sentence. | administrator (in UI copy) |
| **employee** | A person on the Employees page. Use it in people-management copy: invite, deactivate, assign, move. | user, staff |
| **member** | Anyone in the organization, owners and admins included, in organization-wide policy copy ("applies to every member", "2 active members" for seats); and belonging to something (*members of this team*, *department members*). | user, account (for a person) |
| **department** | The one unit everyone belongs to. Managed in Settings → Organization → Departments (`/settings/organization#departments`). | division, group |
| **team** | A working group that spans departments; a person can be in several. | squad, group |
| **Not tracked** | An employee who still signs in but has been excluded from time tracking and attendance. Not the same as a role that doesn't track time (owners, admins) — say "their role doesn't track time" for that. Also used for apps and sites WorkPulse records nothing in. | inactive, benched, untracked, unmonitored |
| **Deactivated** | An employee who has left: they can't sign in and stop counting as a seat. Reactivating lets them sign in again. | inactive, disabled, archived, removed (for a person) |
| **idle** | No keyboard or mouse input for a while. Describes time, never a person's status. | inactive, away |
| **seat** | One active (not deactivated) member, for billing. | license |

### Ownership & closure

| Use | Meaning | Not |
| --- | --- | --- |
| **Ownership & closure** | The settings page (`/settings/ownership`): owners, data export, closing the organization. Same name in the rail, search, page title and browser tab. | Ownership & deletion, Ownership & lifecycle, Danger zone |
| **close** the organization | Stops sign-in for everyone but owners and schedules all data for deletion after 30 days. | delete the organization, cancel the account |
| **reopen** | Undo a close within the 30 days. | restore, undelete |
| **export** | A complete copy of the organization's data, as downloadable files. | backup, dump |
| **confirmation text** | What an owner types to confirm an export or close — shown in the dialog ("Type acme-3f9a2b to confirm"). | workspace slug, slug |

### Devices and agents

| Use | Meaning | Not |
| --- | --- | --- |
| **desktop app** | The WorkPulse app an employee installs, signs in to and runs a timer in (*Project & task time* mode). | interactive agent, tray app, client |
| **background service** | The login-less Windows service IT installs on a company computer (*Machine uptime* mode). | managed agent, managed service, daemon |
| **device agent** | Either of the two, when it doesn't matter which: the *Device agents* page lists both. | fleet (in UI copy), agent instance |
| **device** | One computer running a device agent. | machine (except in "Machine uptime"), endpoint, host |
| **enroll** a device | Connect a company computer to the organization with an enrollment code. | enrol, register, provision |
| **enrollment code** | The one-time code an admin **generates** for one employee and installs with the background service. It can be **revoked** before use. | enrollment key, enrolment token, mint |
| **release** a device | Free a device from its employee: its sign-in is revoked and it can be enrolled again. | unassign, unenroll |
| **check-in** | A device reporting in (status, CPU, memory, version). "Last check-in", "checked in 3 m ago". | heartbeat, telemetry, ping |
| **data waiting to upload** | Recorded data a device hasn't sent yet. | outbox, unsent outbox, batch, queue |
| **device health** | CPU, memory and upload backlog at the last check-in. | telemetry |
| **uninstall passcode** | Stops the background service being removed without it. | uninstall password, PIN |

### Sign-in and security

| Use | Meaning | Not |
| --- | --- | --- |
| **multi-factor authentication (MFA)** | The 6-digit code from an authenticator app at sign-in. Spell it out in headings; "MFA" is fine after that. | 2FA, two-step (for WorkPulse's own; Google's is "2-Step Verification") |
| **authenticator app** | The phone app that shows the code. | device (for the app), token |
| **reset an authenticator** | An admin turns off someone's MFA after a lost phone. | reset device, reset MFA device |
| **session** | One browser or device signed in to your account. | token, login |
| **sign out everywhere** | Ends every session for your account, this one included. | revoke tokens, global logout |
| **Planned** | A capability that isn't built yet — say it plainly, with no spec reference. | "planned (§15)", "deferred", "roadmap" |

### Monitoring

| Use | Meaning | Not |
| --- | --- | --- |
| **screenshot** | An image of an employee's screen. | capture (as a noun in headings), frame, shot |
| **screenshot frequency** | How often a screenshot is taken. | cadence, interval (in labels) |
| **retention** | How long screenshots are kept before they're deleted automatically. | TTL, expiry |
| **privacy pause** | Time an employee pauses recording in the desktop app while their timer keeps running. | break, pause mode |
| **tracking mode** | How the organization records work: *Project & task time*, *Machine uptime*, or *Both*. | agent mode, surfaces |
| **productivity score** | The daily 0–100 score; its four parts are Utilization, Quality, Focus and Reliability. | performance score, utilisation |

### AI

| Use | Meaning | Not |
| --- | --- | --- |
| **WorkPulse Assistant** | The in-app chat, in both places it opens (the sparkle button and Help center). | Ask WorkPulse, the AI assistant, chatbot |
| **Ask the assistant** | The button or link that opens it. | Ask the AI assistant, Ask AI |
| **AI-generated · may be wrong** | The line under text a model wrote; *Summary of the figures · not written by AI* under the server's own sentence. | AI insight (for template text) |

## Where this has been applied

- Settings (every page under `/settings`), Security, Device agents, the operator pages (`/ops/*`) and
  the navigation tree (`src/constants/navigation.ts`) — UX audit Low round, 2026-10-21.
- Every other area applies these rules in its own pass; anything still out of line is a bug against
  this file.
