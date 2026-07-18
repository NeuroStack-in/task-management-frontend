"use client"

import { useMemo, useState } from "react"
import { Info, Lock } from "lucide-react"
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
import { usePermissions } from "@/hooks/use-permissions"
import { ApiError } from "@/lib/api"
import {
  updateOrg,
  type OrgView,
  type UpdateOrgRequest,
} from "@/modules/settings/services/org.service"

/**
 * Organization profile — the real backend (`PATCH /v1/org`, LLD §14).
 *
 * **No read endpoint exists yet** (`GET /v1/org` is 404), so this pane cannot pre-fill the org's
 * current values. It is an honest **save form**: fields start empty, and after the first successful
 * save we reflect the server's returned `OrgView` (and keep its `version` for the next optimistic-
 * locked write). Only the four fields the API accepts are editable here — name, timezone, website,
 * and employee-id prefix. Legal name, industry, size, departments, locations, holidays and policies
 * were mock-only and are intentionally not shown until endpoints back them.
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

interface OrgProfileForm {
  name: string
  timezone: string
  website: string
  empIdPrefix: string
}

const EMPTY_FORM: OrgProfileForm = {
  name: "",
  timezone: "",
  website: "",
  empIdPrefix: "",
}

/** Turn an OrgView into the editable form shape. */
function formFromView(v: OrgView): OrgProfileForm {
  return {
    name: v.name ?? "",
    timezone: v.timezone ?? "",
    website: v.website ?? "",
    empIdPrefix: v.emp_id_prefix ?? "",
  }
}

export function OrganizationTab() {
  const { can } = usePermissions()
  const canManage = can("settings:manage")

  // No GET → we start blank. `saved` is the last server-confirmed state (null until first save).
  const [saved, setSaved] = useState<OrgProfileForm>(EMPTY_FORM)
  const [draft, setDraft] = useState<OrgProfileForm>(EMPTY_FORM)
  const [version, setVersion] = useState<number | undefined>(undefined)
  const [everSaved, setEverSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  )

  const update = (patch: Partial<OrgProfileForm>) =>
    setDraft((d) => ({ ...d, ...patch }))

  /** Build the PATCH body from the non-empty draft fields (empty ⇒ omit; the API needs ≥1 field). */
  function buildBody(): UpdateOrgRequest {
    const body: UpdateOrgRequest = {}
    if (draft.name.trim()) body.name = draft.name.trim()
    if (draft.timezone.trim()) body.timezone = draft.timezone.trim()
    if (draft.website.trim()) body.website = draft.website.trim()
    if (draft.empIdPrefix.trim()) body.emp_id_prefix = draft.empIdPrefix.trim()
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
      body.emp_id_prefix === undefined
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
      setEverSaved(true)
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
        description="Manage your organization's name, timezone, website, and employee-ID prefix."
      />

      {!canManage && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          You can view these settings, but saving requires the{" "}
          <span className="font-medium text-foreground">Manage Settings</span>{" "}
          permission.
        </div>
      )}

      {/* Honest note: there is no read endpoint, so we can't show current values yet. */}
      {!everSaved && (
        <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/60 px-5 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            Current values aren&apos;t shown yet — there&apos;s no read endpoint
            for organization settings. Enter the values you want and save; the
            saved state will appear here once a read endpoint lands.
          </span>
        </div>
      )}

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

      {canManage && (
        <SettingsSaveBar
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
