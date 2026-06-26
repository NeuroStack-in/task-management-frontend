/** Static org-structure data used by the Organization settings page. */

export const DEPARTMENTS: string[] = [
  "Engineering",
  "Design",
  "Product",
  "Marketing",
  "Sales",
  "HR",
  "Finance",
  "Operations",
]

export const TEAMS_BY_DEPT: Record<string, string[]> = {
  Engineering: ["Frontend", "Backend", "DevOps", "QA"],
  Design: ["Brand", "Product Design", "UX Research"],
  Product: ["Core Product", "Growth"],
  Marketing: ["Content", "Demand Gen", "Brand"],
  Sales: ["SMB", "Enterprise", "Solutions Engineering"],
  HR: ["Recruiting", "People Ops"],
  Finance: ["Accounting", "FP&A"],
  Operations: ["IT", "Business Ops"],
}

export interface OrgLocation {
  id: string
  name: string
  city: string
  timezone: string
}

export const DEFAULT_LOCATIONS: OrgLocation[] = [
  { id: "loc-1", name: "HQ", city: "New York", timezone: "America/New_York" },
  {
    id: "loc-2",
    name: "West Coast Office",
    city: "San Francisco",
    timezone: "America/Los_Angeles",
  },
  { id: "loc-3", name: "EU Office", city: "London", timezone: "Europe/London" },
]

export type WorkDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"

export const ALL_WORK_DAYS: WorkDay[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
]

export interface WorkingHoursConfig {
  days: Record<WorkDay, boolean>
  startTime: string
  endTime: string
  timezone: string
}

export const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  days: {
    Mon: true,
    Tue: true,
    Wed: true,
    Thu: true,
    Fri: true,
    Sat: false,
    Sun: false,
  },
  startTime: "09:00",
  endTime: "17:00",
  timezone: "America/New_York",
}

export interface OrgHoliday {
  id: string
  name: string
  date: string
}

export const DEFAULT_HOLIDAYS: OrgHoliday[] = [
  { id: "h-1", name: "New Year's Day", date: "2026-01-01" },
  { id: "h-2", name: "Martin Luther King Jr. Day", date: "2026-01-19" },
  { id: "h-3", name: "Memorial Day", date: "2026-05-25" },
  { id: "h-4", name: "Independence Day", date: "2026-07-04" },
  { id: "h-5", name: "Labor Day", date: "2026-09-07" },
  { id: "h-6", name: "Thanksgiving", date: "2026-11-26" },
  { id: "h-7", name: "Christmas Day", date: "2026-12-25" },
]

export const COMMON_TIMEZONES = [
  { label: "Eastern Time (ET)", value: "America/New_York" },
  { label: "Central Time (CT)", value: "America/Chicago" },
  { label: "Mountain Time (MT)", value: "America/Denver" },
  { label: "Pacific Time (PT)", value: "America/Los_Angeles" },
  { label: "UTC", value: "UTC" },
  { label: "London (GMT/BST)", value: "Europe/London" },
  { label: "Paris (CET/CEST)", value: "Europe/Paris" },
  { label: "Berlin (CET/CEST)", value: "Europe/Berlin" },
  { label: "Dubai (GST)", value: "Asia/Dubai" },
  { label: "Singapore (SGT)", value: "Asia/Singapore" },
  { label: "Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Sydney (AEST/AEDT)", value: "Australia/Sydney" },
]

export const INDUSTRY_OPTIONS = [
  "Technology",
  "Finance & Banking",
  "Healthcare",
  "Education",
  "Retail & E-commerce",
  "Manufacturing",
  "Media & Entertainment",
  "Professional Services",
  "Real Estate",
  "Other",
]

export const COMPANY_SIZE_OPTIONS = [
  "1–10",
  "11–50",
  "51–200",
  "201–500",
  "501–1,000",
  "1,001–5,000",
  "5,000+",
]

export const PTO_ACCRUAL_OPTIONS = [
  { label: "Monthly", value: "monthly" },
  { label: "Bi-weekly", value: "bi-weekly" },
  { label: "Annually (lump sum)", value: "annually" },
  { label: "Unlimited", value: "unlimited" },
]
