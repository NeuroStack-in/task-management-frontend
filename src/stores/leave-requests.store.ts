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
  /** Submit a new request — always starts as pending, awaiting an approver. */
  addRequest: (input: NewLeaveRequest) => LeaveRequest;
  /** Withdraw a still-pending request (requester action). */
  cancelRequest: (id: string) => void;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `lr-${Date.now().toString(36)}-${counter}`;
}

export const useLeaveStore = create<LeaveState>()(
  persist(
    (set) => ({
      requests: [],

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
    }),
    { name: "wp-leave-requests" },
  ),
);
