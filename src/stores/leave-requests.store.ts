import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LeaveType = "vacation" | "sick" | "personal" | "unpaid";
export type LeaveStatus = "pending" | "approved" | "rejected";

/** Leave types and their yearly allowance (days). `null` = no fixed allowance. */
export const LEAVE_TYPES: {
  value: LeaveType;
  label: string;
  allowance: number | null;
}[] = [
  { value: "vacation", label: "Vacation", allowance: 20 },
  { value: "sick", label: "Sick leave", allowance: 10 },
  { value: "personal", label: "Personal", allowance: 5 },
  { value: "unpaid", label: "Unpaid", allowance: null },
];

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = Object.fromEntries(
  LEAVE_TYPES.map((t) => [t.value, t.label]),
) as Record<LeaveType, string>;

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  type: LeaveType;
  /** ISO "YYYY-MM-DD". */
  startDate: string;
  endDate: string;
  /** Working days requested (inclusive). */
  days: number;
  reason: string;
  status: LeaveStatus;
  /** ISO date the request was submitted. */
  submittedAt: string;
}

export interface NewLeaveRequest {
  userId: string;
  userName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
}

interface LeaveState {
  requests: LeaveRequest[];
  /** Users we've already seeded demo history for (so we don't re-add it). */
  seeded: string[];
  /** Submit a new request — always starts as pending, awaiting an approver. */
  addRequest: (input: NewLeaveRequest) => LeaveRequest;
  /** Withdraw a still-pending request (requester action). */
  cancelRequest: (id: string) => void;
  /** Populate a user's leave history once, so the page isn't empty on a fresh demo. */
  seedFor: (userId: string, userName: string) => void;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `lr-${Date.now().toString(36)}-${counter}`;
}

/** Deterministic demo leave history for a user (mix of types & statuses). */
function buildDemoRequests(userId: string, userName: string): LeaveRequest[] {
  const base: Omit<LeaveRequest, "id" | "userId" | "userName">[] = [
    {
      type: "vacation",
      startDate: "2026-04-13",
      endDate: "2026-04-17",
      days: 5,
      reason: "Spring break with family",
      status: "approved",
      submittedAt: "2026-03-30",
    },
    {
      type: "sick",
      startDate: "2026-05-11",
      endDate: "2026-05-12",
      days: 2,
      reason: "Flu recovery",
      status: "approved",
      submittedAt: "2026-05-11",
    },
    {
      type: "personal",
      startDate: "2026-06-26",
      endDate: "2026-06-26",
      days: 1,
      reason: "DMV appointment",
      status: "approved",
      submittedAt: "2026-06-15",
    },
    {
      type: "vacation",
      startDate: "2026-07-20",
      endDate: "2026-07-22",
      days: 3,
      reason: "Long weekend trip",
      status: "pending",
      submittedAt: "2026-06-20",
    },
    {
      type: "sick",
      startDate: "2026-02-09",
      endDate: "2026-02-09",
      days: 1,
      reason: "Migraine",
      status: "rejected",
      submittedAt: "2026-02-09",
    },
  ];
  return base.map((r, i) => ({
    id: `demo-${userId}-${i + 1}`,
    userId,
    userName,
    ...r,
  }));
}

export const useLeaveStore = create<LeaveState>()(
  persist(
    (set) => ({
      requests: [],
      seeded: [],

      addRequest: (input) => {
        const request: LeaveRequest = {
          id: nextId(),
          ...input,
          status: "pending",
          submittedAt: new Date().toISOString().slice(0, 10),
        };
        set((s) => ({ requests: [request, ...s.requests] }));
        return request;
      },

      cancelRequest: (id) =>
        set((s) => ({ requests: s.requests.filter((r) => r.id !== id) })),

      seedFor: (userId, userName) =>
        set((s) => {
          const alreadyHas = s.requests.some((r) => r.userId === userId);
          if (!userId || s.seeded.includes(userId) || alreadyHas) {
            return userId && !s.seeded.includes(userId)
              ? { seeded: [...s.seeded, userId] }
              : s;
          }
          return {
            requests: [...buildDemoRequests(userId, userName), ...s.requests],
            seeded: [...s.seeded, userId],
          };
        }),
    }),
    { name: "wp-leave-requests" },
  ),
);
