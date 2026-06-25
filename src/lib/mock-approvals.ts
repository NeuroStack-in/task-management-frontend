/**
 * Deterministic mock data for the Approval Center (SPEC.md §3, section 17).
 * Server-safe — derived from the seeded users, no randomness. Requests cover the
 * four approvable kinds: timesheets, leave, manual time entries, and corrections.
 */
import { users } from "@/lib/data";
import type { User } from "@/types/user";

export type ApprovalKind = "timesheet" | "leave" | "manual-entry" | "correction";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRequest {
  id: string;
  kind: ApprovalKind;
  requester: User;
  title: string;
  detail: string;
  /** Human amount, e.g. "42h 30m" or "3 days". */
  amount: string;
  submitted: string;
  status: ApprovalStatus;
}

const PEOPLE = [...users]
  .filter((u) => u.status === "active")
  .sort((a, b) => a.id.localeCompare(b.id))
  .slice(0, 8);

export const KIND_META: Record<ApprovalKind, { label: string }> = {
  timesheet: { label: "Timesheet" },
  leave: { label: "Leave" },
  "manual-entry": { label: "Manual entry" },
  correction: { label: "Correction" },
};

export const APPROVALS: ApprovalRequest[] = [
  {
    id: "ap-1",
    kind: "timesheet",
    requester: PEOPLE[0],
    title: "Weekly timesheet — Jun 16–20",
    detail: "42h 30m tracked across 4 projects, 88% billable.",
    amount: "42h 30m",
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
    detail: "Forgot to start timer for a 90-min onboarding call.",
    amount: "1h 30m",
    submitted: "2h ago",
    status: "pending",
  },
  {
    id: "ap-4",
    kind: "correction",
    requester: PEOPLE[3],
    title: "Timesheet correction",
    detail: "Idle time on Tue was a long build, not a break.",
    amount: "+48m",
    submitted: "3h ago",
    status: "pending",
  },
  {
    id: "ap-5",
    kind: "timesheet",
    requester: PEOPLE[4],
    title: "Weekly timesheet — Jun 16–20",
    detail: "39h 10m tracked, 74% billable.",
    amount: "39h 10m",
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
    detail: "Offline whiteboard session not captured by the tracker.",
    amount: "2h 15m",
    submitted: "Yesterday",
    status: "approved",
  },
  {
    id: "ap-8",
    kind: "correction",
    requester: PEOPLE[7],
    title: "Project reassignment",
    detail: "Hours logged to wrong project; moved to Platform.",
    amount: "4h 00m",
    submitted: "2 days ago",
    status: "rejected",
  },
];
