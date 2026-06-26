/**
 * Deterministic payroll data (SPEC.md §3, People). Payslips are derived — not
 * stored — by joining each employee's deterministic hourly rate with the hours
 * they logged that month (from the Attendance dataset). Pure math with explicit
 * date args (no `Date.now()` / `Math.random()`), so a given month always renders
 * the same run across reloads.
 *
 * Flow mirrors the rest of the app: this lib is the single source for pay math;
 * the Payroll view builds on top of it. There is no real money movement.
 */
import { users } from "@/lib/data";
import {
  daysInMonth,
  dayRecordFor,
  isFutureDate,
  REFERENCE_MONTH,
  MONTH_NAMES,
} from "@/lib/mock-attendance";
import type { User } from "@/types/user";

/** Employees who appear on payroll (exclude invited/suspended). */
const PAYROLL_HEADCOUNT = users.filter(
  (u) => u.status === "active" || u.status === "inactive",
);

const hash = (id: string) =>
  [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0);

/** Base hourly rate (USD) by department; everything else falls back to a default. */
const DEPARTMENT_BASE_RATE: Record<string, number> = {
  Developer: 56,
  Creative: 44,
  Marketing: 40,
  Support: 32,
};
const DEFAULT_BASE_RATE = 36;

/** Statutory + benefits withholding applied to gross pay. */
const TAX_RATE = 0.12;
const BENEFITS_RATE = 0.06;

/**
 * Deterministic hourly rate for an employee: department base plus a stable
 * per-person spread and a small bump for higher productivity. Always the same
 * for a given user.
 */
export function hourlyRateFor(user: User): number {
  const base = DEPARTMENT_BASE_RATE[user.department] ?? DEFAULT_BASE_RATE;
  const spread = hash(user.id) % 16; // 0–15
  const merit = Math.round(user.productivityScore / 20); // 0–5
  return base + spread + merit;
}

export type PayslipStatus = "paid" | "pending";

export interface PayslipRow {
  employeeId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  department: string;
  jobTitle: string;
  /** Hours logged in the period (sum of attendance, future days excluded). */
  hours: number;
  hourlyRate: number;
  gross: number;
  tax: number;
  benefits: number;
  deductions: number;
  net: number;
  status: PayslipStatus;
}

export interface PayrollPeriod {
  year: number;
  /** 0-indexed month. */
  month: number;
  /** e.g. "June 2026". */
  label: string;
}

export interface PayrollRun {
  period: PayrollPeriod;
  rows: PayslipRow[];
  totals: {
    headcount: number;
    paid: number;
    hours: number;
    gross: number;
    deductions: number;
    net: number;
  };
}

/** Total hours an employee logged across a calendar month (future days = 0). */
function monthHours(id: string, year: number, month: number): number {
  let hours = 0;
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    if (isFutureDate(year, month, day)) break;
    hours += dayRecordFor(id, year, month, day).hours;
  }
  return Math.round(hours * 10) / 10;
}

/** A period is settled (paid) once it predates the current reference month. */
function isSettled(year: number, month: number): boolean {
  return year * 12 + month < REFERENCE_MONTH.year * 12 + REFERENCE_MONTH.month;
}

/** Build one employee's payslip for the given period. */
export function payslipFor(
  user: User,
  year: number,
  month: number,
): PayslipRow {
  const hours = monthHours(user.id, year, month);
  const hourlyRate = hourlyRateFor(user);
  const gross = Math.round(hours * hourlyRate);
  const tax = Math.round(gross * TAX_RATE);
  const benefits = Math.round(gross * BENEFITS_RATE);
  const deductions = tax + benefits;
  return {
    employeeId: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    department: user.department,
    jobTitle: user.jobTitle,
    hours,
    hourlyRate,
    gross,
    tax,
    benefits,
    deductions,
    net: gross - deductions,
    status: isSettled(year, month) ? "paid" : "pending",
  };
}

/** The full payroll run (every employee + rolled-up totals) for a period. */
export function payrollRun(year: number, month: number): PayrollRun {
  const rows = PAYROLL_HEADCOUNT.map((u) => payslipFor(u, year, month));
  const totals = rows.reduce(
    (acc, r) => {
      acc.hours += r.hours;
      acc.gross += r.gross;
      acc.deductions += r.deductions;
      acc.net += r.net;
      if (r.status === "paid") acc.paid += 1;
      return acc;
    },
    { headcount: rows.length, paid: 0, hours: 0, gross: 0, deductions: 0, net: 0 },
  );
  totals.hours = Math.round(totals.hours * 10) / 10;
  return { period: periodFor(year, month), rows, totals };
}

function periodFor(year: number, month: number): PayrollPeriod {
  return { year, month, label: `${MONTH_NAMES[month]} ${year}` };
}

/**
 * The selectable pay periods, newest first: the current reference month plus
 * the five preceding months.
 */
export const PAYROLL_PERIODS: PayrollPeriod[] = Array.from({ length: 6 }, (_, i) => {
  const total = REFERENCE_MONTH.year * 12 + REFERENCE_MONTH.month - i;
  return periodFor(Math.floor(total / 12), total % 12);
});
