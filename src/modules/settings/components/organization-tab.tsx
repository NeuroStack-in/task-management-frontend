"use client"

import { useRef, useState } from "react"
import { Check, ImagePlus, Lock, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/shared/page-header"
import { SettingsSaveBar } from "@/components/shared/settings-save-bar"
import { usePermissions } from "@/hooks/use-permissions"
import { organization } from "@/lib/data"
import {
  ALL_WORK_DAYS,
  COMMON_TIMEZONES,
  COMPANY_SIZE_OPTIONS,
  DEFAULT_HOLIDAYS,
  DEFAULT_LOCATIONS,
  DEFAULT_WORKING_HOURS,
  INDUSTRY_OPTIONS,
  PTO_ACCRUAL_OPTIONS,
  TEAMS_BY_DEPT,
  type OrgHoliday,
  type OrgLocation,
  type WorkDay,
} from "@/lib/mock-org"
import { cn } from "@/lib/utils"

// ── Lifted form state ─────────────────────────────────────────────────────────
// Every section feeds one draft/saved baseline, so any change surfaces the
// dirty-aware save bar and nothing persists until Save.

interface CompanyForm {
  name: string
  legalName: string
  website: string
  industry: string
  size: string
  timezone: string
}

interface BrandingForm {
  logo: string | null
}

interface Department {
  name: string
  teams: string[]
}

interface WorkingHoursForm {
  days: Record<WorkDay, boolean>
  startTime: string
  endTime: string
  timezone: string
}

interface PoliciesForm {
  overtimeEnabled: boolean
  ptoAccrual: string
  idleAsBreak: boolean
}

interface OrgFormState {
  company: CompanyForm
  branding: BrandingForm
  structure: Department[]
  locations: OrgLocation[]
  workingHours: WorkingHoursForm
  holidays: OrgHoliday[]
  policies: PoliciesForm
}

const INITIAL_ORG_FORM: OrgFormState = {
  company: {
    name: organization.name,
    legalName: "Acme Corporation Inc.",
    website: "https://acme.example.com",
    industry: "Technology",
    size: "201–500",
    timezone: organization.timezone,
  },
  branding: { logo: null },
  structure: Object.entries(TEAMS_BY_DEPT).map(([name, teams]) => ({
    name,
    teams: [...teams],
  })),
  locations: DEFAULT_LOCATIONS.map((l) => ({ ...l })),
  workingHours: { ...DEFAULT_WORKING_HOURS },
  holidays: DEFAULT_HOLIDAYS.map((h) => ({ ...h })),
  policies: { overtimeEnabled: true, ptoAccrual: "monthly", idleAsBreak: false },
}

// ── Shared styled select ──────────────────────────────────────────────────────

interface SelectOption {
  value: string
  label: string
}

function StyledSelect({
  value,
  onChange,
  disabled,
  options,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  options: readonly SelectOption[]
  placeholder?: string
  className?: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as string)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const INDUSTRY_SELECT_OPTIONS: SelectOption[] = INDUSTRY_OPTIONS.map((o) => ({
  value: o,
  label: o,
}))
const COMPANY_SIZE_SELECT_OPTIONS: SelectOption[] = COMPANY_SIZE_OPTIONS.map(
  (o) => ({ value: o, label: o }),
)

// ── Company Information ───────────────────────────────────────────────────────

function CompanyInfoSection({
  value,
  onChange,
  branding,
  onBrandingChange,
  canManage,
}: {
  value: CompanyForm
  onChange: (patch: Partial<CompanyForm>) => void
  branding: BrandingForm
  onBrandingChange: (patch: Partial<BrandingForm>) => void
  canManage: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function acceptFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return
    onBrandingChange({ logo: URL.createObjectURL(file) })
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    acceptFile(e.target.files?.[0])
    e.target.value = ""
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (!canManage) return
    acceptFile(e.dataTransfer.files?.[0])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Information</CardTitle>
        <CardDescription>
          Basic profile shown across the platform and used in exported reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Logo + brand identity */}
        <div className="space-y-2">
          <Label>Company logo</Label>
          <div className="flex flex-wrap items-center gap-4">
            {/* Clickable drag-and-drop upload zone (doubles as the preview) */}
            <button
              type="button"
              disabled={!canManage}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                if (canManage) setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              aria-label={
                branding.logo ? "Replace company logo" : "Upload company logo"
              }
              className={cn(
                "group relative flex h-20 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/40 transition-colors",
                canManage
                  ? "cursor-pointer hover:border-primary/60 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  : "cursor-default",
                dragging && "border-primary bg-feature-tint",
              )}
            >
              {branding.logo ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={branding.logo}
                    alt="Company logo preview"
                    className="h-full w-full object-contain p-3"
                  />
                  {canManage && (
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-foreground/55 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100">
                      <ImagePlus className="size-4" />
                      Replace
                    </span>
                  )}
                </>
              ) : (
                <span className="flex flex-col items-center gap-1.5 px-3 text-center text-muted-foreground">
                  <ImagePlus className="size-5" />
                  <span className="text-xs font-medium text-foreground">
                    Upload logo
                  </span>
                  <span className="text-[11px]">Click or drag &amp; drop</span>
                </span>
              )}
            </button>

            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                PNG, SVG or JPG · recommended 200 × 50 px · up to 2 MB.
              </p>
              {canManage && branding.logo && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onBrandingChange({ logo: null })}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <X className="size-3.5" />
                  Remove logo
                </Button>
              )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleLogoChange}
          />
        </div>

        <div className="h-px bg-border" />

        {/* Company details */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Company name</Label>
            <Input
              value={value.name}
              disabled={!canManage}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Legal name</Label>
            <Input
              value={value.legalName}
              disabled={!canManage}
              onChange={(e) => onChange({ legalName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input
              type="url"
              value={value.website}
              disabled={!canManage}
              onChange={(e) => onChange({ website: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Industry</Label>
            <StyledSelect
              value={value.industry}
              onChange={(v) => onChange({ industry: v })}
              disabled={!canManage}
              className="w-full"
              options={INDUSTRY_SELECT_OPTIONS}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Company size</Label>
            <StyledSelect
              value={value.size}
              onChange={(v) => onChange({ size: v })}
              disabled={!canManage}
              className="w-full"
              options={COMPANY_SIZE_SELECT_OPTIONS}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Primary timezone</Label>
            <StyledSelect
              value={value.timezone}
              onChange={(v) => onChange({ timezone: v })}
              disabled={!canManage}
              className="w-full"
              options={COMMON_TIMEZONES}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Departments & Teams ───────────────────────────────────────────────────────

function DepartmentsTeamsSection({
  value,
  onChange,
  canManage,
}: {
  value: Department[]
  onChange: (next: Department[]) => void
  canManage: boolean
}) {
  const [addingDept, setAddingDept] = useState(false)
  const [newDept, setNewDept] = useState("")
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  // Inline "add team" only opens for the department being edited (no persistent
  // input box on every row) — keeps the section quiet until you act.
  const [addingTeamFor, setAddingTeamFor] = useState<string | null>(null)
  const [teamDraft, setTeamDraft] = useState("")

  const exists = (name: string) =>
    value.some((d) => d.name.toLowerCase() === name.trim().toLowerCase())

  function addDept() {
    const name = newDept.trim()
    if (!name || exists(name)) return
    onChange([...value, { name, teams: [] }])
    setNewDept("")
    setAddingDept(false)
  }

  function removeDept(name: string) {
    onChange(value.filter((d) => d.name !== name))
  }

  function commitRename(oldName: string) {
    const name = renameDraft.trim()
    if (name && (name === oldName || !exists(name))) {
      onChange(value.map((d) => (d.name === oldName ? { ...d, name } : d)))
    }
    setRenaming(null)
    setRenameDraft("")
  }

  function addTeam(deptName: string) {
    const team = teamDraft.trim()
    const dept = value.find((d) => d.name === deptName)
    if (
      !team ||
      !dept ||
      dept.teams.some((t) => t.toLowerCase() === team.toLowerCase())
    )
      return
    onChange(
      value.map((d) =>
        d.name === deptName ? { ...d, teams: [...d.teams, team] } : d,
      ),
    )
    setTeamDraft("") // keep the input open for quick successive adds
  }

  function removeTeam(deptName: string, team: string) {
    onChange(
      value.map((d) =>
        d.name === deptName
          ? { ...d, teams: d.teams.filter((t) => t !== team) }
          : d,
      ),
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Departments &amp; Teams</CardTitle>
        <CardDescription>
          Organize employees into departments and teams. Used to filter reports
          and attendance.
        </CardDescription>
        {canManage && !addingDept && (
          <CardAction>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setAddingDept(true)}
            >
              <Plus className="size-4" />
              Add department
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="divide-y p-0">
        {/* Inline add-department row */}
        {addingDept && (
          <div className="flex gap-2 px-6 py-4">
            <Input
              autoFocus
              placeholder="Department name"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addDept()
                if (e.key === "Escape") {
                  setAddingDept(false)
                  setNewDept("")
                }
              }}
              className="text-sm"
            />
            <Button size="sm" onClick={addDept} disabled={!newDept.trim()}>
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAddingDept(false)
                setNewDept("")
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        {value.length === 0 && !addingDept ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No departments yet. Add one to start organising teams.
          </p>
        ) : (
          value.map((dept) => (
            <div key={dept.name} className="group/dept px-6 py-3.5">
              {/* Department header */}
              {renaming === dept.name ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(dept.name)
                      if (e.key === "Escape") {
                        setRenaming(null)
                        setRenameDraft("")
                      }
                    }}
                    className="h-8 max-w-xs text-sm"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => commitRename(dept.name)}
                    aria-label="Save name"
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => {
                      setRenaming(null)
                      setRenameDraft("")
                    }}
                    aria-label="Cancel rename"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex min-h-8 items-center gap-2.5">
                  <p className="text-sm font-medium">{dept.name}</p>
                  <span className="text-xs text-muted-foreground">
                    {dept.teams.length} {dept.teams.length === 1 ? "team" : "teams"}
                  </span>
                  {canManage && (
                    <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/dept:opacity-100 focus-within:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground"
                        onClick={() => {
                          setRenaming(dept.name)
                          setRenameDraft(dept.name)
                        }}
                        aria-label={`Rename ${dept.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeDept(dept.name)}
                        aria-label={`Delete ${dept.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Teams — soft pills in one row, ending with the add affordance */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {dept.teams.map((team) => (
                  <span
                    key={team}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground"
                  >
                    {team}
                    {canManage && (
                      <button
                        onClick={() => removeTeam(dept.name, team)}
                        className="-mr-0.5 rounded-full text-muted-foreground/60 transition-colors hover:text-foreground"
                        aria-label={`Remove ${team}`}
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </span>
                ))}

                {canManage ? (
                  addingTeamFor === dept.name ? (
                    <Input
                      autoFocus
                      placeholder="Team name"
                      value={teamDraft}
                      onChange={(e) => setTeamDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addTeam(dept.name)
                        if (e.key === "Escape") {
                          setAddingTeamFor(null)
                          setTeamDraft("")
                        }
                      }}
                      onBlur={() => {
                        if (!teamDraft.trim()) setAddingTeamFor(null)
                      }}
                      className="h-7 w-32 rounded-full px-3 text-xs"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddingTeamFor(dept.name)
                        setTeamDraft("")
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                    >
                      <Plus className="size-3" /> Add team
                    </button>
                  )
                ) : dept.teams.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No teams</span>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

// ── Locations ─────────────────────────────────────────────────────────────────

let locationCounter = 10

function LocationsSection({
  value,
  onChange,
  canManage,
}: {
  value: OrgLocation[]
  onChange: (next: OrgLocation[]) => void
  canManage: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ name: "", city: "", timezone: "America/New_York" })

  function addLocation() {
    if (!draft.name.trim() || !draft.city.trim()) return
    locationCounter += 1
    onChange([...value, { id: `loc-${locationCounter}`, ...draft }])
    setDraft({ name: "", city: "", timezone: "America/New_York" })
    setOpen(false)
  }

  function removeLocation(id: string) {
    onChange(value.filter((l) => l.id !== id))
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
          <CardDescription>Office locations used for attendance and scheduling.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Timezone</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {value.map((loc) => (
                <TableRow key={loc.id}>
                  <TableCell className="font-medium">{loc.name}</TableCell>
                  <TableCell>{loc.city}</TableCell>
                  <TableCell className="text-muted-foreground">{loc.timezone}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove ${loc.name}`}
                        onClick={() => removeLocation(loc.id)}
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        {canManage && (
          <div className="px-5 pb-4 pt-3">
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Add location
            </Button>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Office name</Label>
              <Input
                placeholder="e.g. HQ"
                value={draft.name}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input
                placeholder="e.g. New York"
                value={draft.city}
                onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <StyledSelect
                value={draft.timezone}
                onChange={(v) => setDraft((p) => ({ ...p, timezone: v }))}
                className="w-full"
                options={COMMON_TIMEZONES}
              />
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={addLocation} disabled={!draft.name.trim() || !draft.city.trim()}>
              Add location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Working Hours ─────────────────────────────────────────────────────────────

function WorkingHoursSection({
  value,
  onChange,
  canManage,
}: {
  value: WorkingHoursForm
  onChange: (patch: Partial<WorkingHoursForm>) => void
  canManage: boolean
}) {
  function toggleDay(day: WorkDay) {
    onChange({ days: { ...value.days, [day]: !value.days[day] } })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Working Hours</CardTitle>
        <CardDescription>
          Default schedule used for utilization calculations and overtime alerts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Day toggles */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Working days</p>
          <div className="flex gap-2">
            {ALL_WORK_DAYS.map((day) => {
              const active = value.days[day]
              return (
                <button
                  key={day}
                  disabled={!canManage}
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                    !canManage && "cursor-default opacity-60",
                  )}
                >
                  {day[0]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Start / end time */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Start time</Label>
            <Input
              type="time"
              value={value.startTime}
              disabled={!canManage}
              onChange={(e) => onChange({ startTime: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>End time</Label>
            <Input
              type="time"
              value={value.endTime}
              disabled={!canManage}
              onChange={(e) => onChange({ endTime: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <StyledSelect
              value={value.timezone}
              onChange={(v) => onChange({ timezone: v })}
              disabled={!canManage}
              className="w-full"
              options={COMMON_TIMEZONES}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Holidays ──────────────────────────────────────────────────────────────────

let holidayCounter = 20

function HolidaysSection({
  value,
  onChange,
  canManage,
}: {
  value: OrgHoliday[]
  onChange: (next: OrgHoliday[]) => void
  canManage: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ name: "", date: "" })

  function addHoliday() {
    if (!draft.name.trim() || !draft.date) return
    holidayCounter += 1
    onChange([...value, { id: `h-${holidayCounter}`, ...draft }])
    setDraft({ name: "", date: "" })
    setOpen(false)
  }

  function removeHoliday(id: string) {
    onChange(value.filter((h) => h.id !== id))
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Holidays</CardTitle>
          <CardDescription>
            Public holidays excluded from utilization and attendance calculations.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Holiday</TableHead>
                <TableHead>Date</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {value.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {h.date}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove ${h.name}`}
                        onClick={() => removeHoliday(h.id)}
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        {canManage && (
          <div className="px-5 pb-4 pt-3">
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Add holiday
            </Button>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add holiday</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Holiday name</Label>
              <Input
                placeholder="e.g. Founders Day"
                value={draft.name}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button
              onClick={addHoliday}
              disabled={!draft.name.trim() || !draft.date}
            >
              Add holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Policies ──────────────────────────────────────────────────────────────────

function PoliciesSection({
  value,
  onChange,
  canManage,
}: {
  value: PoliciesForm
  onChange: (patch: Partial<PoliciesForm>) => void
  canManage: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Policies</CardTitle>
        <CardDescription>
          Organization-wide rules for overtime, PTO, and time classification.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        <div className="flex items-center justify-between gap-6 py-3">
          <div>
            <p className="text-sm font-medium">Track overtime</p>
            <p className="text-xs text-muted-foreground">
              Flag hours logged beyond the daily expected threshold as overtime.
            </p>
          </div>
          <Switch
            checked={value.overtimeEnabled}
            disabled={!canManage}
            onCheckedChange={(v) => onChange({ overtimeEnabled: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-6 py-3">
          <div>
            <p className="text-sm font-medium">PTO accrual method</p>
            <p className="text-xs text-muted-foreground">
              How paid time-off entitlement accumulates for employees.
            </p>
          </div>
          <StyledSelect
            value={value.ptoAccrual}
            onChange={(v) => onChange({ ptoAccrual: v })}
            disabled={!canManage}
            className="w-48"
            options={PTO_ACCRUAL_OPTIONS}
          />
        </div>
        <div className="flex items-center justify-between gap-6 py-3">
          <div>
            <p className="text-sm font-medium">Count idle time as break</p>
            <p className="text-xs text-muted-foreground">
              Automatically log idle periods as break time in reports.
            </p>
          </div>
          <Switch
            checked={value.idleAsBreak}
            disabled={!canManage}
            onCheckedChange={(v) => onChange({ idleAsBreak: v })}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ── Root export ───────────────────────────────────────────────────────────────

export function OrganizationTab() {
  const { can } = usePermissions()
  const canManage = can("settings:manage")

  const [saved, setSaved] = useState<OrgFormState>(INITIAL_ORG_FORM)
  const [draft, setDraft] = useState<OrgFormState>(INITIAL_ORG_FORM)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  const updateCompany = (patch: Partial<CompanyForm>) =>
    setDraft((d) => ({ ...d, company: { ...d.company, ...patch } }))
  const updateBranding = (patch: Partial<BrandingForm>) =>
    setDraft((d) => ({ ...d, branding: { ...d.branding, ...patch } }))
  const updateStructure = (next: Department[]) =>
    setDraft((d) => ({ ...d, structure: next }))
  const updateLocations = (next: OrgLocation[]) =>
    setDraft((d) => ({ ...d, locations: next }))
  const updateWorkingHours = (patch: Partial<WorkingHoursForm>) =>
    setDraft((d) => ({ ...d, workingHours: { ...d.workingHours, ...patch } }))
  const updateHolidays = (next: OrgHoliday[]) =>
    setDraft((d) => ({ ...d, holidays: next }))
  const updatePolicies = (patch: Partial<PoliciesForm>) =>
    setDraft((d) => ({ ...d, policies: { ...d.policies, ...patch } }))

  function handleSave() {
    if (!dirty || saving) return
    const next = draft
    setSaving(true)
    // Simulated persistence latency (Phase 1 is frontend-only).
    setTimeout(() => {
      setSaved(next)
      setSaving(false)
      toast.success("Organization settings saved")
    }, 500)
  }

  function handleReset() {
    setDraft(saved)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization"
        description="Manage your company profile, departments, teams, working hours, and policies."
      />

      {!canManage && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          You can view these settings, but saving requires the{" "}
          <span className="font-medium text-foreground">Manage Settings</span>{" "}
          permission.
        </div>
      )}

      <div className="space-y-6">
        <CompanyInfoSection
          value={draft.company}
          onChange={updateCompany}
          branding={draft.branding}
          onBrandingChange={updateBranding}
          canManage={canManage}
        />
        <DepartmentsTeamsSection
          value={draft.structure}
          onChange={updateStructure}
          canManage={canManage}
        />
        <LocationsSection
          value={draft.locations}
          onChange={updateLocations}
          canManage={canManage}
        />
        <WorkingHoursSection
          value={draft.workingHours}
          onChange={updateWorkingHours}
          canManage={canManage}
        />
        <HolidaysSection
          value={draft.holidays}
          onChange={updateHolidays}
          canManage={canManage}
        />
        <PoliciesSection
          value={draft.policies}
          onChange={updatePolicies}
          canManage={canManage}
        />

        {canManage && (
          <SettingsSaveBar
            dirty={dirty}
            saving={saving}
            onSave={handleSave}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  )
}
