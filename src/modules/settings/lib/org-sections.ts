/**
 * The Organization settings page's tabs, and how a URL hash picks one.
 *
 * The page's sections (UX audit 2026-10-16, SET-06): it was one 4,400 px column of eleven cards with
 * no way to jump between them. Each card still saves on its own; the tabs only decide which are on
 * screen. Not a client module, so it can be tested and linked to without React.
 */
export const ORG_SECTIONS = [
  { key: "profile", label: "Profile", intro: "Who the organization is, and how it tracks work." },
  // Named for what people come looking for (UX audit 2026-10-16, PEOPLE-22). Departments were the
  // fourth card on a 4,400 px page, then sat behind a tab called "Structure"; People links here as
  // `/settings/organization#departments` (DEPARTMENTS_HREF below).
  { key: "departments", label: "Departments", intro: "Departments, and the teams that span them." },
  { key: "schedule", label: "Schedule", intro: "The working week, working hours and holidays." },
  { key: "places", label: "Places", intro: "Office locations and the office perimeter." },
  {
    key: "policies",
    label: "Policies",
    intro: "How work is scored, and the policies your people can read.",
  },
] as const

export type OrgSection = (typeof ORG_SECTIONS)[number]["key"]

/** Where departments are managed — the link People and anyone else should use. */
export const DEPARTMENTS_HREF = "/settings/organization#departments"

/**
 * Hashes that open a section without being its key. `#structure` was the Departments tab's key until
 * PEOPLE-22, and bookmarks and older links still carry it; `#teams` opens the same tab, and the page
 * then scrolls to the Teams card (`id="teams"` in `TeamsManager`).
 */
export const SECTION_ALIASES: Readonly<Record<string, OrgSection>> = {
  structure: "departments",
  teams: "departments",
}

/** The tab a URL hash (`#departments`, `departments`, or an alias) opens, or `null` for any other. */
export function sectionFromHash(hash: string): OrgSection | null {
  const k = hash.replace(/^#/, "")
  if (ORG_SECTIONS.some((s) => s.key === k)) return k as OrgSection
  return Object.prototype.hasOwnProperty.call(SECTION_ALIASES, k) ? SECTION_ALIASES[k] : null
}
