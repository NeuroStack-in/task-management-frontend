/** Onboarding step metadata (server-safe — imported by the wizard and the dev preview).
 *  Org identity + plan are collected in the sign-up OrgSetupModal, so onboarding
 *  picks up at workspace configuration (team, roles, tracking, dashboard). */
export const ONBOARDING_STEPS = [
  { key: "team", title: "Invite your team", hint: "Invite teammates to your workspace." },
  { key: "roles", title: "Choose roles", hint: "Select the roles you'll use." },
  { key: "tracking", title: "Tracking preferences", hint: "Configure what to monitor." },
  { key: "dashboard", title: "Personalize", hint: "Choose the widgets you want to see." },
] as const;
