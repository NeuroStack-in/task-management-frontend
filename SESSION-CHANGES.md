# Session Changes

A simple page-by-page list of what changed or was newly added this session.

## Analytics (was "Insights")
- Renamed the whole section from **Insights → Analytics** (sidebar, page title, browser tab titles, command palette, help text).
- The **AI Insights** tab keeps its name; the `/insights` route is unchanged.

## Analytics → Reports tab
- Each report's **Export** button is now a **download-icon only** dropdown (no text).
- Fixed: selecting a report no longer **auto-opens** it.
- Cleaner selected-card style.
- Top-right **"Export all" → "Download all"**.

## Time Tracking
- **Removed the Status column** completely from the team timesheet.
- **Total column centered** (was right-aligned).
- Moved the **‹ › week buttons to after "This Week"**.

## Projects → project detail page
- Merged the team info into one compact **"Team details"** card with a **"View more"** button (cards keep their original size).
- **"View more"** opens a redesigned, detailed dialog (plan, health, all members).
- **Tasks board & list now span full width**.
- **List view columns aligned** (added a header row + equal-width Due/Priority/Status columns).

## Attendance
- Merged the two top widgets into **one card** with a **Today's / Department** toggle; Department uses a **dropdown**; **same bar graph** for both views.
- Calendar: **removed the Simple view** (detailed only), **"Export" → "Download" moved to top-right**, **"Today" always enabled** and now **highlights today's date**, and restyled the **"Avg/day"** line.
- Attendance log: **"Export CSV" → "Download" moved to top-right**, and the **Hours column left-aligned** (fixed the gap).

## Payroll
- Made **all columns left-aligned** consistently (fixed mixed left/right alignment).

## Global search
- **Removed the top search bar** from the navbar.
- **Added a Search field to the left sidebar** (expanded + collapsed rail) that opens the ⌘K command palette.

## Settings → Billing (new)
- Added a new **"Billing"** tab in Settings with a minimal, Claude-style billing pane (plan, payment method, recent invoices, cancellation).
- The existing **Billing Center (`/billing`) is untouched**.
