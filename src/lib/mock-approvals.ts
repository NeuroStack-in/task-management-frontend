/**
 * Deterministic mock data for the Approval Center (SPEC.md §3, section 17).
 * Server-safe — derived from the seeded users, no randomness.
 *
 * Weekly timesheets are NOT approved here — tracked time flows automatically.
 * Approvals are only needed when an employee asks to CHANGE their recorded time
 * (edit an existing record), add a manual entry, or take leave.
 */
import { users } from "@/lib/data";
import type { User } from "@/types/user";

export type ApprovalKind = "time-change" | "manual-entry" | "leave";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRequest {
  id: string;
  kind: ApprovalKind;
  requester: User;
  title: string;
  detail: string;
  /** Human amount, e.g. "+45m" or "3 days". */
  amount: string;
  submitted: string;
  status: ApprovalStatus;
}

// Lead with one team (Design / Product Design) so a team-scoped approver view
// is populated, then fill with other active people for org roles.
const APPROVAL_TEAM = users.filter(
  (u) =>
    u.department === "Design" &&
    u.team === "Product Design" &&
    u.status === "active",
);
const APPROVAL_TEAM_IDS = new Set(APPROVAL_TEAM.map((u) => u.id));
const PEOPLE = [
  ...[...APPROVAL_TEAM].sort((a, b) => a.id.localeCompare(b.id)),
  ...[...users]
    .filter((u) => u.status === "active" && !APPROVAL_TEAM_IDS.has(u.id))
    .sort((a, b) => a.id.localeCompare(b.id)),
].slice(0, 8);

export const KIND_META: Record<ApprovalKind, { label: string }> = {
  "time-change": { label: "Time change" },
  "manual-entry": { label: "Manual entry" },
  leave: { label: "Leave" },
};

export const APPROVALS: ApprovalRequest[] = [
  {
    id: "ap-1",
    kind: "time-change",
    requester: PEOPLE[0],
    title: "Change start time — Jun 18",
    detail:
      "Timer started at 09:00 but I was already working from 08:15. Please update the start time on that record.",
    amount: "+45m",
    submitted: "12m ago",
    status: "pending",
  },
  {
    id: "ap-2",
    kind: "leave",
    requester: PEOPLE[1],
    title: "Annual leave request",
    detail: "Jul 8–10 · vacation. 6 days remaining this year.",
    amount: "3 days",
    submitted: "1h ago",
    status: "pending",
  },
  {
    id: "ap-3",
    kind: "manual-entry",
    requester: PEOPLE[2],
    title: "Manual time entry — client call",
    detail: "Forgot to start the timer for a 90-minute onboarding call.",
    amount: "1h 30m",
    submitted: "2h ago",
    status: "pending",
  },
  {
    id: "ap-4",
    kind: "time-change",
    requester: PEOPLE[3],
    title: "Reclassify idle time — Tue",
    detail:
      "The 48m flagged as idle on Tuesday was a long build running, not a break. Please count it as active time.",
    amount: "+48m",
    submitted: "3h ago",
    status: "pending",
  },
  {
    id: "ap-5",
    kind: "time-change",
    requester: PEOPLE[4],
    title: "Move logged time to correct project",
    detail:
      "2h on Wednesday was logged to Internal; it should be against Platform. Please reassign the record.",
    amount: "2h 00m",
    submitted: "5h ago",
    status: "pending",
  },
  {
    id: "ap-6",
    kind: "leave",
    requester: PEOPLE[5],
    title: "Sick leave",
    detail: "Jun 24 · single day, doctor's note attached.",
    amount: "1 day",
    submitted: "Yesterday",
    status: "approved",
  },
  {
    id: "ap-7",
    kind: "manual-entry",
    requester: PEOPLE[6],
    title: "Manual time entry — design review",
    detail: "Offline whiteboard session that wasn't captured by the tracker.",
    amount: "2h 15m",
    submitted: "Yesterday",
    status: "approved",
  },
  {
    id: "ap-8",
    kind: "time-change",
    requester: PEOPLE[7],
    title: "Adjust clock-out — Mon",
    detail:
      "Clock-out didn't register; I worked until 18:30, not 17:00. Please extend the record.",
    amount: "+1h 30m",
    submitted: "2 days ago",
    status: "rejected",
  },
];
