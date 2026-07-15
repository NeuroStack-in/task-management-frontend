/** Onboarding step metadata (server-safe — imported by the wizard and the dev preview). */
export const ONBOARDING_STEPS = [
  { key: "org", title: "Organization setup", hint: "Add your company details." },
  { key: "team", title: "Invite your team", hint: "Invite teammates to your workspace." },
  { key: "tracking", title: "Tracking preferences", hint: "Configure what to monitor." },
  { key: "dashboard", title: "Personalize", hint: "Choose the widgets you want to see." },
] as const;
