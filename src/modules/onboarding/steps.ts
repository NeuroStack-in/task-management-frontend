/** Onboarding step metadata (server-safe — imported by the wizard and the dev preview). */
export const ONBOARDING_STEPS = [
  { key: "org", title: "Your organization", hint: "Confirm the details from your request." },
  { key: "team", title: "Invite your team", hint: "Send invites now, or later from Employees." },
  { key: "tracking", title: "Tracking", hint: "Decide whether screenshots are taken." },
  { key: "dashboard", title: "Your dashboard", hint: "Make the dashboard yours." },
] as const;
