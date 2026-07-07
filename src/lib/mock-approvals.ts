/**
 * Deterministic mock data for the Approval Center (SPEC.md §3, section 17).
 * Server-safe — derived from the seeded users, no randomness.
 *
 * Tracked time is NOT approved in WorkPulse — time flows automatically and
 * timesheets are never signed off. The only thing routed here for a decision is
 * time-off (leave) requests.
 */
import { users } from "@/lib/data";
import type { User } from "@/types/user";

export type ApprovalKind = "leave";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRequest {
  id: string;
  kind: ApprovalKind;
  requester: User;
  title: string;
  detail: string;
  /** Human amount, e.g. "3 days". */
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
  leave: { label: "Leave" },
};

export const APPROVALS: ApprovalRequest[] = [
  {
    id: "ap-1",
    kind: "leave",
    requester: PEOPLE[0],
    title: "Annual leave request",
    detail: "Jul 8–10 · vacation. 6 days remaining this year.",
    amount: "3 days",
    submitted: "1h ago",
    status: "pending",
  },
  {
    id: "ap-2",
    kind: "leave",
    requester: PEOPLE[1],
    title: "Sick leave",
    detail: "Jun 24 · single day, doctor's note attached.",
    amount: "1 day",
    submitted: "3h ago",
    status: "pending",
  },
  {
    id: "ap-3",
    kind: "leave",
    requester: PEOPLE[2],
    title: "Personal day",
    detail: "Jul 1 · family commitment.",
    amount: "1 day",
    submitted: "5h ago",
    status: "pending",
  },
  {
    id: "ap-4",
    kind: "leave",
    requester: PEOPLE[3],
    title: "Parental leave",
    detail: "Aug 4–15 · planned, coverage arranged with the team.",
    amount: "10 days",
    submitted: "Yesterday",
    status: "approved",
  },
  {
    id: "ap-5",
    kind: "leave",
    requester: PEOPLE[4],
    title: "Annual leave request",
    detail: "Jun 30 – Jul 2 · long weekend.",
    amount: "3 days",
    submitted: "Yesterday",
    status: "approved",
  },
  {
    id: "ap-6",
    kind: "leave",
    requester: PEOPLE[5],
    title: "Unpaid leave",
    detail: "Jul 21 · exceeds remaining balance for the year.",
    amount: "1 day",
    submitted: "2 days ago",
    status: "rejected",
  },
];
