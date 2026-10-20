"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard"
import { updateOrgCache } from "@/hooks/use-org"
import { AlertCircle, AlertTriangle, Building2, Lock } from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/shared/page-header"
import { cn } from "@/lib/utils"
import { DepartmentsManager } from "./departments-manager"
import { CardSaveFooter } from "./save-footer"
import { TimezonePicker } from "./org/timezone-picker"
import { SectionDirtyContext, withOwner, type SectionDirtyReporter } from "../lib/card-guard"
import { browserZone, pickerZones, serverResolves, zoneParts } from "../lib/timezones"
import { OrgProductivityWeightsCard } from "./org/org-productivity-weights-card"
import { TeamsManager } from "./org/teams-manager"
import { LocationsManager } from "./org/locations-manager"
import { OfficePerimeterCard } from "./org/office-perimeter-card"
import { TrackingModeCard } from "./org/tracking-mode-card"
import { WorkingDaysManager } from "./org/working-days-manager"
import { WorkingHoursManager } from "./org/working-hours-manager"
import { HolidaysManager } from "./org/holidays-manager"
import { PoliciesManager } from "./org/policies-manager"
import { Loader } from "@/components/shared/loader"
import { usePermissions } from "@/hooks/use-permissions"
import { ApiError } from "@/lib/api"
import { toWebUrl } from "@/lib/validation"
import { useOrgMetaStore } from "@/stores/org-meta.store"
import {
  updateOrg,
  type OrgView,
  type UpdateOrgRequest,
} from "@/modules/settings/services/org.service"

/**
 * Organization profile — the real backend (`GET` + `PATCH /v1/org`, LLD §14).
 *
 * On mount we `getOrg()` and seed the form with the org's current server-side values, keeping the
 * returned `version` for the next optimistic-locked write. Every field shown is persisted: name,
 * timezone, website, employee-id prefix, industry and size all ride `PATCH /v1/org`, and the
 * sub-managers below (departments, teams, locations, schedule, holidays, policies) each have their
 * own live endpoints. *(A previous version of this comment said industry/size/locations/etc. were
 * "mock-only, not shown until endpoints back them" — long false; kept as a warning that stale
 * comments here have hidden real features before.)* A 404 means the org isn't provisioned yet ⇒
 * keep an empty editable form.
 */

// The timezone picker's zones live in `lib/timezones.ts` — the ones the server can resolve, searchable
// (UX audit SET-16). It used to be a fixed list of fifteen here.

// Industry + company-size pickers. `__none__` is the "unset" sentinel (Base UI selects need a value).
const INDUSTRY_OPTIONS = [
  "Software",
  "Technology",
  "Finance",
  "Healthcare",
  "Education",
  "Retail",
  "Manufacturing",
  "Media",
  "Consulting",
  "Non-profit",
  "Government",
  "Other",
] as const

const SIZE_OPTIONS = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5000+",
] as const

const UNSET = "__none__"

interface OrgProfileForm {
  name: string
  timezone: string
  website: string
  empIdPrefix: string
  industry: string
  size: string
}

const EMPTY_FORM: OrgProfileForm = {
  name: "",
  timezone: "",
  website: "",
  empIdPrefix: "",
  industry: "",
  size: "",
}

/** Turn an OrgView into the editable form shape. */
function formFromView(v: OrgView): OrgProfileForm {
  return {
    name: v.name ?? "",
    timezone: v.timezone ?? "",
    website: v.website ?? "",
    empIdPrefix: v.emp_id_prefix ?? "",
    industry: v.industry ?? "",
    size: v.size ?? "",
  }
}

const sameProfile = (a: OrgProfileForm, b: OrgProfileForm) =>
  JSON.stringify(a) === JSON.stringify(b)

/**
 * A titled band of related fields.
 *
 * Six inputs under one heading is a form; three named groups of two is a profile. The label is a
 * small-caps rule rather than a second card so the whole thing still reads as one object with one
 * Save — splitting it into three cards would imply three independent saves, which is exactly
 * what the rest of this page does mean and this section does not.
 */
function FieldGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <span className="bg-border h-px flex-1" aria-hidden />
      </div>
      <div className="grid content-start gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

/**
 * The page's sections (UX audit 2026-10-16, SET-06). It was one 4,400 px column of eleven cards with
 * no way to jump between them. Each card still saves on its own; the tabs only decide which are on
 * screen.
 */
const ORG_SECTIONS = [
  { key: "profile", label: "Profile", intro: "Who the organization is, and how it tracks work." },
  { key: "structure", label: "Structure", intro: "Departments, and the teams that span them." },
  { key: "schedule", label: "Schedule", intro: "The working week, working hours and holidays." },
  { key: "places", label: "Places", intro: "Office locations and the office perimeter." },
  {
    key: "policies",
    label: "Policies",
    intro: "How work is scored, and the policies your people can read.",
  },
] as const

type OrgSection = (typeof ORG_SECTIONS)[number]["key"]

const sectionFromHash = (hash: string): OrgSection | null => {
  const k = hash.replace(/^#/, "")
  return ORG_SECTIONS.some((s) => s.key === k) ? (k as OrgSection) : null
}

export function OrganizationTab() {
  const { can } = usePermissions()
  const canManage = can("settings:manage")

  /**
   * The section on screen, mirrored to the URL hash so a section can be linked to and survives a
   * reload. A hash keeps the same pathname, so switching never trips the unsaved-changes prompt.
   */
  const [section, setSection] = useState<OrgSection>("profile")
  /**
   * Sections opened so far. A section mounts on its first visit and then **stays mounted, hidden**
   * while another is shown: unmounting would throw away a half-edited card (working hours, a
   * perimeter) on a tab switch, with no prompt — the guard only asks when leaving the page. Mounting
   * on first visit also means the perimeter map is first drawn in a visible box.
   */
  const [visited, setVisited] = useState<ReadonlySet<OrgSection>>(() => new Set(["profile"]))
  const tabRefs = useRef<Partial<Record<OrgSection, HTMLButtonElement | null>>>({})
  const tabIds = useId()

  const show = useCallback((k: OrgSection) => {
    setSection(k)
    setVisited((v) => (v.has(k) ? v : new Set(v).add(k)))
  }, [])

  useEffect(() => {
    const follow = () => {
      const k = sectionFromHash(window.location.hash)
      if (k) show(k)
    }
    follow()
    window.addEventListener("hashchange", follow)
    return () => window.removeEventListener("hashchange", follow)
  }, [show])

  const select = (k: OrgSection, focus = false) => {
    show(k)
    window.history.replaceState(window.history.state, "", `#${k}`)
    if (focus) tabRefs.current[k]?.focus()
  }

  /** Arrow keys, Home and End move between tabs (the ARIA tabs pattern). */
  const onTabKey = (e: React.KeyboardEvent) => {
    const i = ORG_SECTIONS.findIndex((s) => s.key === section)
    const last = ORG_SECTIONS.length - 1
    const to =
      e.key === "ArrowRight"
        ? i === last ? 0 : i + 1
        : e.key === "ArrowLeft"
          ? i === 0 ? last : i - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null
    if (to === null) return
    e.preventDefault()
    select(ORG_SECTIONS[to].key, true)
  }

  /**
   * The cards on each tab that hold unsaved edits, reported by `useCardGuard` through the panel's
   * {@link SectionDirtyContext}. Only the Profile tab used to carry the unsaved dot — a half-edited
   * card on any other tab was invisible from the rest of the page (UX audit XC-11 / SET-14).
   */
  const [dirtyCards, setDirtyCards] = useState<Record<OrgSection, string[]>>(() => ({
    profile: [],
    structure: [],
    schedule: [],
    places: [],
    policies: [],
  }))
  const reporters = useMemo(
    () =>
      Object.fromEntries(
        ORG_SECTIONS.map((s) => [
          s.key,
          ((owner, isDirty) =>
            setDirtyCards((prev) => {
              const next = withOwner(prev[s.key], owner, isDirty)
              return next === prev[s.key] ? prev : { ...prev, [s.key]: next }
            })) satisfies SectionDirtyReporter,
        ]),
      ) as Record<OrgSection, SectionDirtyReporter>,
    [],
  )

  const panelProps = (k: OrgSection) => ({
    mounted: visited.has(k),
    active: section === k,
    labelledBy: `${tabIds}-tab-${k}`,
    panelId: `${tabIds}-panel-${k}`,
    intro: ORG_SECTIONS.find((s) => s.key === k)?.intro ?? "",
    report: reporters[k],
  })

  // The org meta + optimistic-lock `version` live in ONE shared store, read by both this profile
  // card and the tracking-mode card below. A single fetch, a single version: after either card
  // saves, the version here updates too, so the other card never sends a stale version and gets a
  // spurious 409. See stores/org-meta.store.ts.
  const { view, status, error: loadError, load, applyPatchResult } = useOrgMetaStore()
  const loading = status === "idle" || status === "loading"

  // `saved` is the last server-confirmed profile state; seeded from the shared meta below.
  const [saved, setSaved] = useState<OrgProfileForm>(EMPTY_FORM)
  const [draft, setDraft] = useState<OrgProfileForm>(EMPTY_FORM)
  /**
   * The `version` that `saved` was read at — what a save sends as its lock. Never the store's
   * latest: on a second visit the form seeded from the store's cached view, the re-fetch then moved
   * the store's version on, and a save sent the old field values under the new version — so another
   * admin's change in between was silently overwritten instead of refused with a 409
   * (QA audit 2026-10-08, WP-344).
   */
  const [baseVersion, setBaseVersion] = useState<number | undefined>(undefined)
  /** The form has been filled from a real read — until then there is no profile to edit. */
  const [seeded, setSeeded] = useState(false)
  const [saving, setSaving] = useState(false)
  const ids = useId()

  // One shared fetch (deduped inside the store).
  useEffect(() => {
    void load()
  }, [load])

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  )
  // Leaving now asks before discarding this draft.
  useUnsavedGuard(dirty)

  // Follow the shared meta without ever trampling a draft:
  //  - first read → seed the form (a 404 leaves `view` null ⇒ the empty editable form, not an error);
  //  - a read or save that leaves the profile fields as they are (the tracking-mode card bumps the
  //    version) → adopt its version, nothing visible changes;
  //  - the fields changed on the server and nothing is typed here → show the fresh values;
  //  - they changed *and* something is typed here → keep the edits and the old version, so the save
  //    is refused (409) rather than writing over the other change.
  useEffect(() => {
    if (status !== "ready") return
    const next = view ? formFromView(view) : EMPTY_FORM
    if (!seeded) {
      setSaved(next)
      setDraft(next)
      setBaseVersion(view?.version)
      setSeeded(true)
    } else if (sameProfile(next, saved)) {
      setBaseVersion(view?.version)
    } else if (!dirty) {
      setSaved(next)
      setDraft(next)
      setBaseVersion(view?.version)
    }
  }, [status, view, seeded, saved, dirty])

  // Checked before the request, because the server stores any string and the pages that show it
  // use it as a link (WP-356).
  const websiteInvalid = draft.website.trim() !== "" && toWebUrl(draft.website) === null

  /**
   * What a missing or unreadable timezone actually does (UX audit SET-16): the server closes the
   * org's days on UTC (`wp_platform::tz`), so "which day was this" and "was this late" are answered
   * in the wrong timezone for any org away from Greenwich.
   */
  const tz = draft.timezone.trim()
  const tzWarning = serverResolves(tz)
    ? null
    : tz
      ? `WorkPulse doesn't recognise “${tz}”, so it uses UTC. Choose a timezone from the list.`
      : "No timezone set, so WorkPulse uses UTC. Attendance, lateness and reports decide which day something happened — and who was late — in this timezone."
  // Offered in the warning: the browser's own zone, when the server can resolve it. Read after
  // mount (the server render has no browser zone).
  const [browserTz, setBrowserTz] = useState<string | null>(null)
  useEffect(() => setBrowserTz(browserZone()), [])
  const suggestedZone = browserTz && pickerZones().includes(browserTz) ? browserTz : null

  const update = (patch: Partial<OrgProfileForm>) =>
    setDraft((d) => ({ ...d, ...patch }))

  /** Build the PATCH body from the non-empty draft fields (empty ⇒ omit; the API needs ≥1 field). */
  function buildBody(): UpdateOrgRequest {
    const body: UpdateOrgRequest = {}
    if (draft.name.trim()) body.name = draft.name.trim()
    if (draft.empIdPrefix.trim()) body.emp_id_prefix = draft.empIdPrefix.trim()
    // Optional fields go whenever they changed — **including to empty**, which the server reads as
    // "clear". Omitting an emptied field meant the save succeeded, the old value came back, and the
    // toast said "saved" while the field snapped back (WP-102).
    const changed = (k: "timezone" | "website" | "industry" | "size") =>
      draft[k].trim() !== saved[k].trim()
    if (changed("timezone") || draft.timezone.trim()) body.timezone = draft.timezone.trim()
    // Stored as an absolute link (`acme.com` → `https://acme.com`); `""` clears it.
    if (changed("website") || draft.website.trim()) {
      body.website = draft.website.trim() ? (toWebUrl(draft.website) ?? "") : ""
    }
    if (changed("industry") || draft.industry.trim()) body.industry = draft.industry.trim()
    if (changed("size") || draft.size.trim()) body.size = draft.size.trim()
    if (baseVersion !== undefined) body.version = baseVersion
    return body
  }

  async function handleSave() {
    if (!dirty || saving) return
    if (websiteInvalid) {
      toast.error("Check the website", {
        description: "Enter a web address, like acme.com or https://acme.com.",
      })
      return
    }
    const body = buildBody()
    // The API rejects an empty body ("nothing to update"); guard before the round-trip.
    if (
      body.name === undefined &&
      body.timezone === undefined &&
      body.website === undefined &&
      body.emp_id_prefix === undefined &&
      body.industry === undefined &&
      body.size === undefined
    ) {
      toast.error("Enter at least one value before saving.")
      return
    }

    setSaving(true)
    try {
      const updated = await updateOrg(body)
      // Thread the fresh version back into the shared store so the tracking-mode card's next save
      // uses it (and vice-versa) — no false 409 for a single user editing both cards.
      applyPatchResult(updated)
      // And into the cache the sidebar header and the Company rail item read (WP-534).
      updateOrgCache(updated)
      const next = formFromView(updated)
      setSaved(next)
      setDraft(next)
      setBaseVersion(updated.version)
      toast.success("Organization saved", {
        description: `Changes are live${
          updated.slug ? ` for ${updated.slug}` : ""
        }.`,
      })
    } catch (e) {
      // `PATCH /v1/org` answers 409 for two unrelated reasons; every one used to read as "someone
      // else changed these settings", so a taken prefix sent the admin round a reload loop for good
      // (QA audit 2026-10-08, WP-345).
      if (e instanceof ApiError && e.code === "emp_prefix_taken") {
        toast.error("That employee-ID prefix is taken", {
          description:
            "Another organization already uses it, and prefixes are unique. Choose a different one.",
        })
      } else if (e instanceof ApiError && e.status === 409) {
        // Fetch the other change now; the edits here stay. Reset then shows the latest (see the
        // follow effect above), ready to reapply on top of it.
        void load()
        toast.error("Someone else changed these settings", {
          description:
            "Your edits are still here. Press Reset to load the latest version, then reapply them.",
        })
      } else if (e instanceof ApiError && e.status === 400) {
        toast.error("Check your entries", { description: e.message })
      } else if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to change organization settings.")
      } else {
        toast.error(
          e instanceof ApiError ? e.message : "Couldn't save. Try again.",
        )
      }
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setDraft(saved)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization"
        description="Manage your organization's profile, structure, schedule, locations, holidays, and policies."
      />

      {!canManage && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          You can view these settings, but saving requires the{" "}
          <span className="font-medium text-foreground">Manage Settings</span>{" "}
          permission.
        </div>
      )}

      {loadError && (
        <div className="flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/10 px-5 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1">{loadError}</span>
          {/* A failed load is never retried behind the user's back (see the store), so the retry is
              theirs to ask for. */}
          <Button
            variant="outline"
            size="sm"
            className="-my-1 shrink-0"
            onClick={() => void load()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* ── Section tabs (UX audit SET-06) ── */}
      <div
        role="tablist"
        aria-label="Organization sections"
        onKeyDown={onTabKey}
        // Tight padding below `sm` so all five fit a 390px phone without a hidden scroll.
        className="flex overflow-x-auto overflow-y-hidden border-b sm:gap-1"
      >
        {ORG_SECTIONS.map((s) => {
          const active = section === s.key
          // The profile form lives in this component; every other card reports through its panel.
          const unsaved = dirtyCards[s.key].length > 0 || (s.key === "profile" && dirty)
          return (
            <button
              key={s.key}
              ref={(el) => {
                tabRefs.current[s.key] = el
              }}
              type="button"
              role="tab"
              id={`${tabIds}-tab-${s.key}`}
              aria-selected={active}
              // Only once the panel exists — an unvisited section isn't mounted yet.
              aria-controls={visited.has(s.key) ? `${tabIds}-panel-${s.key}` : undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => select(s.key)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-t-lg px-2 py-2.5 text-sm font-medium transition-colors sm:px-4",
                active
                  ? "border-primary text-foreground -mb-px border-b-2"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
              {/* Any card on this tab with unsaved edits — each card shows its own Save. */}
              {unsaved ? (
                <>
                  <span className="bg-warning size-1.5 rounded-full" aria-hidden />
                  <span className="sr-only">(unsaved changes)</span>
                </>
              ) : null}
            </button>
          )
        })}
      </div>

      {loading ? (
        <Loader label="Loading organization settings…" />
      ) : (
      <>
      <OrgPanel id="profile" {...panelProps("profile")}>
      {/* Only once a read has filled it. After a failed first load this used to be an empty,
          editable form under the error — and saving it sent whatever was typed with no lock
          (QA audit 2026-10-08, WP-357). The banner above carries the Retry. */}
      {seeded ? (
      <Card className="overflow-hidden p-0">
        {/* The org's own name leads the card rather than sitting as the first of six identical
            inputs. This page is *about* this organisation; six flat fields under one heading read
            as a form to fill in, not a profile you already have. */}
        <div className="from-feature-tint/60 via-card to-card flex flex-wrap items-center gap-4 border-b bg-gradient-to-br p-5 sm:p-6">
          <span className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
            <Building2 className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading truncate text-xl font-semibold">
              {draft.name.trim() || "Your organization"}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Used across the platform and on every exported report.
            </p>
          </div>
          {/* Says plainly why the fields below are inert, instead of leaving a reader to discover
              it by clicking one. */}
          {!canManage ? (
            <span className="text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
              <Lock className="size-3" /> Read-only
            </span>
          ) : null}
        </div>

        <CardContent className="space-y-6 p-5 sm:p-6">
          <FieldGroup label="Identity">
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-name`}>Organization name</Label>
              <Input
                id={`${ids}-name`}
                value={draft.name}
                disabled={!canManage}
                placeholder="Acme Inc."
                onChange={(e) => update({ name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-website`}>Website</Label>
              <Input
                id={`${ids}-website`}
                type="url"
                value={draft.website}
                disabled={!canManage}
                placeholder="https://acme.example.com"
                aria-invalid={websiteInvalid || undefined}
                aria-describedby={websiteInvalid ? `${ids}-website-error` : undefined}
                onChange={(e) => update({ website: e.target.value })}
              />
              {websiteInvalid ? (
                <p id={`${ids}-website-error`} className="text-destructive text-xs">
                  Enter a web address, like acme.com or https://acme.com.
                </p>
              ) : null}
            </div>
          </FieldGroup>

          <FieldGroup label="Locale">
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-timezone`}>Primary timezone</Label>
              <TimezonePicker
                id={`${ids}-timezone`}
                value={draft.timezone}
                onChange={(tz) => update({ timezone: tz })}
                disabled={!canManage}
                warn={tzWarning !== null}
                aria-describedby={tzWarning ? `${ids}-timezone-warning` : undefined}
              />
              {/* An unset (or unrecognised) timezone used to sit there as "Select a timezone…" with
                  no hint that every org-local day was quietly running on UTC (UX audit SET-16). */}
              {tzWarning ? (
                <div
                  id={`${ids}-timezone-warning`}
                  className="bg-warning/10 text-warning flex items-start gap-2 rounded-md px-3 py-2 text-xs"
                >
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    {tzWarning}{" "}
                    {canManage && suggestedZone ? (
                      <button
                        type="button"
                        onClick={() => update({ timezone: suggestedZone })}
                        className="font-medium underline underline-offset-2 hover:no-underline"
                      >
                        Use {zoneParts(suggestedZone).city}, this browser&apos;s timezone
                      </button>
                    ) : null}
                  </span>
                </div>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Select
                value={draft.industry || UNSET}
                onValueChange={(v) =>
                  update({ industry: v === UNSET ? "" : (v as string) })
                }
                disabled={!canManage}
                items={{
                  [UNSET]: "Not set",
                  ...Object.fromEntries(INDUSTRY_OPTIONS.map((ind) => [ind, ind])),
                }}
              >
                <SelectTrigger className="w-full" aria-label="Industry">
                  <SelectValue placeholder="Select an industry…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>Not set</SelectItem>
                  {INDUSTRY_OPTIONS.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FieldGroup>

          <FieldGroup label="Details">
            <div className="space-y-1.5">
              <Label>Company size</Label>
              <Select
                value={draft.size || UNSET}
                onValueChange={(v) =>
                  update({ size: v === UNSET ? "" : (v as string) })
                }
                disabled={!canManage}
                items={{
                  [UNSET]: "Not set",
                  ...Object.fromEntries(SIZE_OPTIONS.map((s) => [s, `${s} employees`])),
                }}
              >
                <SelectTrigger className="w-full" aria-label="Company size">
                  <SelectValue placeholder="Select a size…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>Not set</SelectItem>
                  {SIZE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s} employees
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-prefix`}>Employee-ID prefix</Label>
              <Input
                id={`${ids}-prefix`}
                value={draft.empIdPrefix}
                disabled={!canManage}
                placeholder="EMP"
                onChange={(e) => update({ empIdPrefix: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Prefix for generated employee IDs, e.g.{" "}
                <span className="tabular-nums">
                  {(draft.empIdPrefix.trim() || "EMP").toUpperCase()}-0001
                </span>
                .
              </p>
            </div>
          </FieldGroup>

          {/* The profile's own Save, inside its card like every other card on this page
              (UX audit SET-06). A floating "Save changes" used to hover over the whole page, over
              cards that each have their own Save, and never said which one it saved. */}
          <CardSaveFooter
            dirty={canManage && dirty}
            saving={saving}
            onSave={() => void handleSave()}
            onCancel={handleReset}
            saveLabel="Save profile"
            hint="Saves the fields in this card only."
          />
        </CardContent>
      </Card>
      ) : null}

      {/* `BrandingManager` was here. Removed from the page 2026-08-22 and deleted 2026-10-09:
          **nothing in the app reads any of it.** `logo_url` is never rendered and the stored brand
          colours are read by nothing either (the `accentColor` uses elsewhere are CSS on checkboxes,
          bound to `var(--primary)`). It was a form that saved three values into a void. The server
          routes (`GET`/`PATCH /v1/org/branding`) still exist if branding is ever wired up for real. */}
      <TrackingModeCard />
      </OrgPanel>

      {/* Each of these is its own live-backend CRUD with its own Save. */}
      <OrgPanel id="structure" {...panelProps("structure")}>
        <DepartmentsManager />
        <TeamsManager />
      </OrgPanel>
      <OrgPanel id="schedule" {...panelProps("schedule")}>
        <WorkingDaysManager />
        <WorkingHoursManager />
        <HolidaysManager />
      </OrgPanel>
      <OrgPanel id="places" {...panelProps("places")}>
        <LocationsManager />
        <OfficePerimeterCard />
      </OrgPanel>
      {/* Productivity weights lead here: they change what every score on the product means. */}
      <OrgPanel id="policies" {...panelProps("policies")}>
        <OrgProductivityWeightsCard />
        <PoliciesManager />
      </OrgPanel>
      </>
      )}
    </div>
  )
}

/**
 * One section's cards. Rendered once visited and then kept, hidden while another is shown — see
 * `visited` in `OrganizationTab`.
 */
function OrgPanel({
  id,
  mounted,
  active,
  labelledBy,
  panelId,
  intro,
  report,
  children,
}: {
  id: OrgSection
  mounted: boolean
  active: boolean
  labelledBy: string
  panelId: string
  intro: string
  /** Where this panel's cards report unsaved edits — the tab's marker. */
  report: SectionDirtyReporter
  children: React.ReactNode
}) {
  if (!mounted) return null
  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={labelledBy}
      hidden={!active}
      data-section={id}
      className="space-y-6"
    >
      <p className="text-muted-foreground -mt-2 text-sm">{intro}</p>
      <SectionDirtyContext.Provider value={report}>{children}</SectionDirtyContext.Provider>
    </div>
  )
}
