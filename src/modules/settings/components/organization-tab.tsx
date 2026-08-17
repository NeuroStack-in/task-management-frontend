"use client"

import { useEffect, useMemo, useState } from "react"
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard"
import { AlertCircle, Lock } from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import {
  getOrg,
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

export function OrganizationTab() {
  const { can } = usePermissions()
  const canManage = can("settings:manage")

  // `saved` is the last server-confirmed state; seeded from GET /v1/org on mount.
  const [saved, setSaved] = useState<OrgProfileForm>(EMPTY_FORM)
  const [draft, setDraft] = useState<OrgProfileForm>(EMPTY_FORM)
  const [version, setVersion] = useState<number | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Seed the form from the org's current server-side meta. A 404 = org not provisioned yet;
  // that's not an error — just start from an empty, editable form.
  useEffect(() => {
    let alive = true
    setLoading(true)
    getOrg()
      .then((view) => {
        if (!alive) return
        const next = formFromView(view)
        setSaved(next)
        setDraft(next)
        setVersion(view.version)
        setLoadError(null)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError && e.status === 404) {
          setLoadError(null)
        } else {
          setLoadError(
            e instanceof ApiError
              ? e.message
              : "Couldn't load organization settings.",
          )
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

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
      const view = await updateOrg(body)
      const next = formFromView(view)
      setSaved(next)
      setDraft(next)
      setVersion(view.version)
      toast.success("Organization saved", {
        description: `Changes are live${
          view.slug ? ` for ${view.slug}` : ""
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
      <Card>
        <CardHeader>
          <CardTitle>Organization profile</CardTitle>
          <CardDescription>
            Basic profile used across the platform and in exported reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid content-start gap-4 sm:grid-cols-2">
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
          </div>
        </CardContent>
      </Card>

      {/* Each of these is its own live-backend CRUD, independent of the org-profile save bar. */}
      <TrackingModeCard />
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
