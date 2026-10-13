"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard"
import { updateOrgCache } from "@/hooks/use-org"
import { AlertCircle, Building2, Lock } from "lucide-react"
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
import { SettingsSaveBar } from "@/components/shared/settings-save-bar"
import { DepartmentsManager } from "./departments-manager"
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

// Local, self-contained timezone options (no mock import). IANA zones the picker offers.
const TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const

/**
 * The picker's zones, with the org's saved one first when it is not among them. Sign-up stores
 * fixed-offset labels (`(GMT+05:30) India Standard`) that this list does not contain; without this
 * the select showed an empty placeholder for every such org, inviting an admin to "set" a timezone
 * that was already set. The server reads both forms (`wp_platform::tz`, QA audit WP-028).
 */
function timezoneOptions(saved: string): readonly string[] {
  const current = saved.trim()
  return current && !(TIMEZONE_OPTIONS as readonly string[]).includes(current)
    ? [current, ...TIMEZONE_OPTIONS]
    : TIMEZONE_OPTIONS
}

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
 * save bar — splitting it into three cards would imply three independent saves, which is exactly
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

export function OrganizationTab() {
  const { can } = usePermissions()
  const canManage = can("settings:manage")

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

      {loading ? (
        <Loader label="Loading organization settings…" />
      ) : (
      <>
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
              <Label>Primary timezone</Label>
              <Select
                value={draft.timezone}
                onValueChange={(v) => update({ timezone: v as string })}
                disabled={!canManage}
              >
                <SelectTrigger className="w-full" aria-label="Primary timezone">
                  <SelectValue placeholder="Select a timezone…" />
                </SelectTrigger>
                <SelectContent>
                  {timezoneOptions(saved.timezone).map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        </CardContent>
      </Card>
      ) : null}

      {/* Each of these is its own live-backend CRUD, independent of the org-profile save bar. */}
      {/* `BrandingManager` was here. Removed from the page 2026-08-22 and deleted 2026-10-09:
          **nothing in the app reads any of it.** `logo_url` is never rendered and the stored brand
          colours are read by nothing either (the `accentColor` uses elsewhere are CSS on checkboxes,
          bound to `var(--primary)`). It was a form that saved three values into a void. The server
          routes (`GET`/`PATCH /v1/org/branding`) still exist if branding is ever wired up for real. */}
      <TrackingModeCard />
      {/* Productivity first: it is the setting that changes what every other number on the product
          means, so it should not sit buried between two roster editors. Then the structures those
          numbers are grouped by — departments, then the teams that span them. */}
      <OrgProductivityWeightsCard />
      <DepartmentsManager />
      <TeamsManager />
      <LocationsManager />
      <OfficePerimeterCard />
      <WorkingDaysManager />
      <WorkingHoursManager />
      <HolidaysManager />
      <PoliciesManager />

      {canManage && (
        <SettingsSaveBar
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
          onReset={handleReset}
        />
      )}
      </>
      )}
    </div>
  )
}
