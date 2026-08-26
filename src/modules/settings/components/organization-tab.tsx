"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard"
import { AlertCircle, Building2, Lock } from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
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
import { TrackingModeCard } from "./org/tracking-mode-card"
import { WorkingDaysManager } from "./org/working-days-manager"
import { WorkingHoursManager } from "./org/working-hours-manager"
import { HolidaysManager } from "./org/holidays-manager"
import { PoliciesManager } from "./org/policies-manager"
import { Loader } from "@/components/shared/loader"
import { usePermissions } from "@/hooks/use-permissions"
import { ApiError } from "@/lib/api"
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
 * sub-managers below (branding, departments, teams, locations, holidays, policies) each have their
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
  const { view, version, status, error: loadError, load, applyPatchResult } = useOrgMetaStore()
  const loading = status === "idle" || status === "loading"

  // `saved` is the last server-confirmed profile state; seeded from the shared meta below.
  const [saved, setSaved] = useState<OrgProfileForm>(EMPTY_FORM)
  const [draft, setDraft] = useState<OrgProfileForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // One shared fetch (deduped inside the store).
  useEffect(() => {
    void load()
  }, [load])

  // Seed the profile form from the shared meta **once**. Deliberately not on every `view` change:
  // the tracking-mode card also writes `view` (a mode save bumps the shared version), and reseeding
  // then would wipe any unsaved profile edits sitting in `draft`. A 404 leaves `view` null ⇒ the
  // empty editable form, which is not an error.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || status !== "ready") return
    const next = view ? formFromView(view) : EMPTY_FORM
    setSaved(next)
    setDraft(next)
    seeded.current = true
  }, [status, view])

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  )
  // Leaving via the settings rail now asks before discarding this draft.
  useUnsavedGuard(dirty)

  const update = (patch: Partial<OrgProfileForm>) =>
    setDraft((d) => ({ ...d, ...patch }))

  /** Build the PATCH body from the non-empty draft fields (empty ⇒ omit; the API needs ≥1 field). */
  function buildBody(): UpdateOrgRequest {
    const body: UpdateOrgRequest = {}
    if (draft.name.trim()) body.name = draft.name.trim()
    if (draft.timezone.trim()) body.timezone = draft.timezone.trim()
    if (draft.website.trim()) body.website = draft.website.trim()
    if (draft.empIdPrefix.trim()) body.emp_id_prefix = draft.empIdPrefix.trim()
    if (draft.industry.trim()) body.industry = draft.industry.trim()
    if (draft.size.trim()) body.size = draft.size.trim()
    if (version !== undefined) body.version = version
    return body
  }

  async function handleSave() {
    if (!dirty || saving) return
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
      const next = formFromView(updated)
      setSaved(next)
      setDraft(next)
      toast.success("Organization saved", {
        description: `Changes are live${
          updated.slug ? ` for ${updated.slug}` : ""
        }.`,
      })
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error("Someone else changed these settings", {
          description:
            "Your version is stale. Reload the page to pick up the latest, then reapply.",
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
        description="Manage your organization's profile, branding, structure, locations, holidays, and policies."
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
          <span>{loadError}</span>
        </div>
      )}

      {loading ? (
        <Loader label="Loading organization settings…" />
      ) : (
      <>
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
              <Label>Organization name</Label>
              <Input
                value={draft.name}
                disabled={!canManage}
                placeholder="Acme Inc."
                onChange={(e) => update({ name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input
                type="url"
                value={draft.website}
                disabled={!canManage}
                placeholder="https://acme.example.com"
                onChange={(e) => update({ website: e.target.value })}
              />
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
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a timezone…" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((tz) => (
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
                <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
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
              <Label>Employee-ID prefix</Label>
              <Input
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

      {/* Each of these is its own live-backend CRUD, independent of the org-profile save bar. */}
      {/* `BrandingManager` was here. Removed 2026-08-22: **nothing in the app reads any of it.**
          `logo_url` is never rendered — the only other reference is an unused field on the `User`
          type — and the stored brand colours are read by nothing either (the `accentColor` uses
          elsewhere are CSS on checkboxes, bound to `var(--primary)`, not to these). It was a form
          that saved three values into a void. The component and its endpoints still exist, so
          restoring it is one import and one line if branding is ever wired up for real. */}
      <TrackingModeCard />
      {/* Productivity first: it is the setting that changes what every other number on the product
          means, so it should not sit buried between two roster editors. Then the structures those
          numbers are grouped by — departments, then the teams that span them. */}
      <OrgProductivityWeightsCard />
      <DepartmentsManager />
      <TeamsManager />
      {/* Perimeter now lives inside LocationsManager — one card, since "where the offices
          are" and "which circle counts as on-site" were the same question split in two. */}
      <LocationsManager />
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
