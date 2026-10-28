"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkdays } from "@/hooks/use-working-hours";
import { isWorkday } from "@/lib/workdays";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  FileText,
  FolderKanban,
  Sheet,
  BarChart2,
  Pencil,
  ShieldCheck,
  BarChart3,
  Loader2,
  MonitorSmartphone,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_MARGIN_WITH_LEGEND,
  xAxisLabel,
  yAxisLabel,
} from "@/components/shared/chart-axis";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablePagination } from "@/components/shared/table-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { isUuid } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { useQueryState } from "@/modules/projects/use-query-state";
import { useRolesStore } from "@/stores/roles.store";
import { SYSTEM_ROLES } from "@/constants/roles";
import { downloadBlob } from "@/lib/download";
import { usePageTitle } from "@/stores/page-header.store";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api";
import {
  assignRole,
  getPermissionCatalog,
  listRoles,
  TIME_TRACK_SELF,
  type ApiPermissionCatalog,
  type ApiRole,
} from "@/modules/roles/services/roles.service";
import { roleChange, scopeLabel } from "@/modules/roles/lib/role-change";
import { helpFor, isSensitive } from "@/modules/roles/lib/permission-help";
import { RoleChangeSummary } from "@/modules/roles/components/role-change-summary";
import { connMeta, lastSeen } from "@/modules/agents/components/fleet-view";
import { deviceStateLabel, isLiveDevice } from "@/modules/agents/lib/device-state";
import {
  listDepartments,
  updateEmployee,
  type ApiDepartment,
  type UpdateEmployeeBody,
} from "../services/employees.service";
import { EmployeeRecapCard } from "./employee-recap-card";
import { EmployeeAppUsageCard } from "./employee-app-usage-card";
import { withEmp } from "@/modules/insights/lib/employee-scope";
import { formatHours, isoDay } from "@/lib/format";
import { useEmployeeProfile, type EmployeeProfileData } from "../use-employee-profile";
import { NO_ATTENDANCE } from "../lib/hours-chart";
import {
  useEmployeeDevices,
  useEmployeeLeave,
  type EmployeeLeave,
  type ExtraState,
} from "../use-employee-extras";
import { collectEmployeeReport } from "../lib/employee-report-data";
import {
  renderEmployeeReportPdf,
  reportFileName,
} from "../lib/employee-report-pdf";
import { EmployeeManageMenu } from "./employee-manage-menu";
import { RefreshButton } from "@/components/shared/refresh-button";
import { PageActions } from "@/components/shared/page-actions";
import { toCsv } from "@/lib/csv";

const STATUS_META: Record<EmployeeProfileData["status"], string> = {
  active: "bg-success/12 text-success",
  inactive: "bg-muted text-muted-foreground",
  invited: "bg-warning/15 text-warning",
  suspended: "bg-destructive/12 text-destructive",
};

/** Employment states are shown capitalised; the raw lowercase server value is not a label. */
const EMPLOYMENT_LABEL: Record<EmployeeProfileData["status"], string> = {
  active: "Active",
  // The profile's "inactive" is a deactivated leaver — named as such, not as the roster's bench.
  inactive: "Deactivated",
  invited: "Invited",
  suspended: "Suspended",
};

/**
 * Attendance badge tones for the identity header.
 *
 * Deliberately separate from `ATTENDANCE_META` further down, which colours the hours-worked chart
 * and maps `absent` into its neutral "not yet closed" bucket **on purpose** — an absent day has no
 * bar to colour. A badge has the opposite job: absence is exactly what it must be able to say.
 */
const ATTENDANCE_BADGE: Record<string, { label: string; className: string }> = {
  present: { label: "Present", className: "bg-success/12 text-success" },
  partial: { label: "Partial", className: "bg-warning/15 text-warning" },
  late: { label: "Late", className: "bg-warning/15 text-warning" },
  leave: { label: "On leave", className: "bg-primary/12 text-primary" },
  absent: { label: "Absent", className: "bg-destructive/12 text-destructive" },
  non_workday: { label: "Non-working day", className: "bg-muted text-muted-foreground" },
};

/**
 * What the header badge says about this person **today**.
 *
 * For anyone **not active** it is the employment state, full stop — an inactive employee has no
 * meaningful attendance, and saying "Absent" about someone who has left would be wrong.
 *
 * For an **active** employee it is today's attendance, because "Active" restated the employment
 * field shown two lines below and told a manager nothing.
 *
 * **Today, not the last closed day.** An earlier version read the last entry of `kpi.days`, which
 * comes from the activity rollup and *includes today* — and today's stored attendance is `absent`
 * until the 00:15 close resolves it. So it confidently labelled someone "Absent" on a day they were
 * sitting at their desk. `todayAttendance` is derived from live timer sessions and approved leave
 * instead, the same way the Attendance page derives its live Today column.
 *
 * A non-workday is named as such rather than reported as an absence — nobody is absent on a Sunday.
 */
function headerBadge(
  data: EmployeeProfileData,
  todayIsWorkday: boolean,
  /**
   * Whether this person personally tracks time — their role holds `time-tracking:self`
   * (wp-contracts bit 110, the contributor-only bit `is_owner` deliberately does not grant).
   */
  isTracked: boolean,
): { label: string; className: string; title: string } {
  if (data.status !== "active") {
    return {
      label: EMPLOYMENT_LABEL[data.status],
      className: STATUS_META[data.status],
      title: `This employee is ${EMPLOYMENT_LABEL[data.status].toLowerCase()}`,
    };
  }
  // Benched: still signs in, but excluded from tracking and attendance — no verdict to show.
  if (data.benched) {
    return {
      label: "Not tracked",
      className: "bg-warning/15 text-warning",
      title: "This person is excluded from time tracking and attendance",
    };
  }
  // An Owner or Admin is not tracked, so a "Today" attendance verdict is true and meaningless — it
  // reads as a performance judgement on someone the product never asked to run a timer. Show the
  // employment state instead. Gated on the contributor bit rather than a role id, so an admin who
  // genuinely also contributes keeps their real attendance badge.
  if (!isTracked) {
    return {
      label: EMPLOYMENT_LABEL.active,
      className: STATUS_META.active,
      title: "This role doesn't track time, so there's no daily attendance to show",
    };
  }
  if (!todayIsWorkday) {
    return {
      label: "Today · Non-working day",
      className: "bg-muted text-muted-foreground",
      title: "Today is not a scheduled working day for this organization",
    };
  }
  if (data.todayAttendance === null) {
    // Reading attendance needs `AttendanceReadTeam`. Fall back to the employment state rather than
    // guessing at a status we were not allowed to see.
    return {
      label: EMPLOYMENT_LABEL.active,
      className: STATUS_META.active,
      title: "Today's attendance isn't visible to you",
    };
  }
  const meta = ATTENDANCE_BADGE[data.todayAttendance] ?? {
    label: data.todayAttendance,
    className: "bg-muted text-muted-foreground",
  };
  return {
    label: `Today · ${meta.label}`,
    className: meta.className,
    title: `Attendance today, from live timer sessions and approved leave`,
  };
}

/** Empty backend fields render as an em dash, never as a blank or a fabricated value. */
const dash = (s: string) => (s.trim() === "" ? "—" : s);

/** Safe filename stem from an employee code (e.g. "#EMP357148" → "EMP357148"). */
const fileCode = (code: string) => code.replace(/[^\w-]/g, "") || "employee";

function exportEmployeeCsv(d: EmployeeProfileData) {
  const activeCount = d.projects.filter((p) => p.active).length;
  const rows: (string | number)[][] = [
    ["Field", "Value"],
    ["Employee", d.name],
    ["Employee ID", isUuid(d.empCode) ? "—" : d.empCode],
    ["Role", d.roleName],
    ["Title", d.jobTitle],
    ["Department", d.department],
    ["Status", d.status],
    ["Email", d.email],
    ["Phone", d.phone],
    ["Hire date", d.hireDate],
    // Location only. Date of birth and a street address aren't on the server's profile, so those
    // rows were always blank — the Address row read ", <city>, " (QA audit 2026-10-08, WP-456).
    ["Location", d.cityState],
    // An unmeasured score exports as "—", never as 0 — a spreadsheet cell reading `0` is
    // indistinguishable from a real zero once it leaves the app, and this file gets forwarded.
    ["Productivity %", d.productivityScore ?? "—"],
    // Project-wide figures, named as such — they are not this person's own tasks (WP-234).
    ["Avg. completion of their projects %", d.avgCompletion ?? "—"],
    ["Tasks in their projects (all assignees)", d.totalTasks],
    ["Projects", d.projects.length],
    ["Active projects", activeCount],
    [],
    ["Project", "Key", "Project progress %", "Project tasks", "Teammates", "Active"],
    ...d.projects.map((p) => [
      p.name, p.key, p.progress ?? "—", p.tasks ?? "—", p.teammates, p.active ? "Yes" : "No",
    ]),
  ];
  downloadBlob(
    new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" }),
    `${fileCode(d.empCode)}-report.csv`,
  );
  toast.success("Report exported", { description: `${fileCode(d.empCode)}-report.csv` });
}

/**
 * Change this employee's role (`PUT /v1/users/{id}/role`). The server enforces the caller's
 * authority.
 *
 * Called "Change role", as on the Roles page — this dialog said "Reassign" there and "Change role"
 * here for the same action, and it changed the role on one click with no word about what the person
 * would gain (UX audit PEOPLE-09). The pick now shows what changes — permissions gained and lost,
 * sensitive ones named — before the button commits it. Department and team are edited under Edit;
 * the stale "Department moves aren't available yet" line is gone (PEOPLE-15).
 */
function ChangeRoleDialog({
  open,
  onOpenChange,
  employeeId,
  name,
  currentRoleId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employeeId: string;
  name: string;
  currentRoleId: string;
  onSaved: () => void;
}) {
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [catalog, setCatalog] = useState<ApiPermissionCatalog | null>(null);
  const [roleId, setRoleId] = useState("");
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [saving, setSaving] = useState(false);
  const callerId = useAuthStore((s) => s.user?.id);
  const isSelf = callerId === employeeId;

  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoadingRoles(true);
    setRoleId(currentRoleId);
    listRoles()
      .then((rs) => {
        // Every role, Owner included, so the summary can read the current one — Owner is filtered
        // out of the choices below: ownership is granted from Settings → Ownership, and the role
        // route refuses it (WP-228).
        if (live) setRoles(rs);
      })
      .catch(() => toast.error("Couldn't load roles"))
      .finally(() => {
        if (live) setLoadingRoles(false);
      });
    // Labels for the summary only — without it the summary falls back to permission ids.
    getPermissionCatalog()
      .then((c) => live && setCatalog(c))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open, currentRoleId]);

  const choices = roles.filter((r) => r.id !== "role-owner");
  const from = roles.find((r) => r.id === currentRoleId) ?? null;
  const to = roles.find((r) => r.id === roleId) ?? null;
  const changed = Boolean(to && roleId !== currentRoleId);
  const change = changed && to ? roleChange(from, to) : null;
  const labelById = useMemo(
    () =>
      new Map(
        (catalog?.groups ?? []).flatMap((g) => g.permissions.map((p) => [p.id, p.label] as const)),
      ),
    [catalog],
  );

  async function save() {
    if (!to || !changed) return;
    setSaving(true);
    try {
      await assignRole(employeeId, to.id);
      toast.success(`${name}'s role is now ${to.name}`, {
        description: "Their own view updates the next time they sign in.",
      });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error("Couldn't change the role", {
        description:
          e instanceof ApiError && e.status === 403
            ? "You can't grant this role — it carries permissions you don't hold, or you can't manage roles."
            : friendlyError(e, "Check your connection and try again."),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change {name}&apos;s role</DialogTitle>
          <DialogDescription>
            A person holds one role, so the new one replaces {from ? from.name : "their current one"}.
            It applies on the server now; their own view updates at their next sign-in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="change-role-select">Role</Label>
            <Select
              value={roleId || null}
              onValueChange={(v) => setRoleId(v as string)}
              items={Object.fromEntries(choices.map((r) => [r.id, r.name]))}
            >
              <SelectTrigger id="change-role-select" className="w-full">
                <SelectValue placeholder={loadingRoles ? "Loading roles…" : "Select a role"} />
              </SelectTrigger>
              <SelectContent>
                {choices.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                    {r.id === currentRoleId ? " (current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {to?.description ? (
              <p className="text-xs text-muted-foreground">{to.description}</p>
            ) : null}
          </div>
          {change && to ? (
            <RoleChangeSummary
              change={change}
              labelOf={(id) => labelById.get(id) ?? id}
              fromName={from?.name ?? "their current role"}
            />
          ) : null}
          {changed && isSelf ? (
            <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
              <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" />
              This is your own role. From your next sign-in you&apos;ll have only what{" "}
              {to?.name ?? "it"} grants — if that doesn&apos;t include managing roles, you
              can&apos;t change it back yourself.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving || loadingRoles || !changed}
            variant={changed && isSelf ? "destructive" : "default"}
          >
            {saving ? "Saving…" : isSelf ? "Change my role" : "Change role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Sentinel for "no department/team" — Base UI Select can't carry `""` as an item value. */
const NONE = "__none__";

/**
 * Edit the admin-managed fields (`PATCH /v1/employees/{id}`, LLD §17): name, title, department,
 * team, location, phone. **Only changed fields are sent** — the server keeps omitted fields and
 * clears a field set to `""`. Role changes live in the Reassign dialog, not here.
 */
function EditEmployeeDialog({
  open,
  onOpenChange,
  data,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: EmployeeProfileData;
  onSaved: () => void;
}) {
  const [depts, setDepts] = useState<ApiDepartment[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    title: "",
    departmentId: "",
    location: "",
    phone: "",
  });

  // The freshest profile, read when the dialog opens — not on every change to `data` while it is
  // open, which re-seeded the form and wiped what was being typed (QA audit 2026-10-08, WP-454).
  const latest = useRef(data);
  useEffect(() => {
    latest.current = data;
  });
  useEffect(() => {
    if (!open) return;
    const d = latest.current;
    setForm({
      name: d.name,
      title: d.jobTitle,
      departmentId: d.departmentId,
      location: d.cityState,
      phone: d.phone,
    });
    let live = true;
    setLoadingOpts(true);
    listDepartments()
      .then((depts) => {
        if (live) setDepts(depts);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setLoadingOpts(false);
      });
    return () => {
      live = false;
    };
  }, [open]);


  const setField = (k: keyof typeof form) => (v: string) =>
    setForm((s) => ({ ...s, [k]: v }));

  const onDepartmentChange = (v: string) =>
    setForm((s) => ({ ...s, departmentId: v === NONE ? "" : v }));

  async function save() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name can't be empty.");
      return;
    }
    // Diff against what the profile currently shows — omitted keeps, "" clears (server contract).
    const body: UpdateEmployeeBody = {};
    if (name !== data.name) body.name = name;
    if (form.title.trim() !== data.jobTitle) body.title = form.title.trim();
    if (form.departmentId !== data.departmentId) body.department_id = form.departmentId;
    if (form.location.trim() !== data.cityState) body.location = form.location.trim();
    if (form.phone.trim() !== data.phone) body.phone = form.phone.trim();
    if (Object.keys(body).length === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await updateEmployee(data.id, body);
      toast.success("Employee updated", { description: name });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error("Couldn't update employee", {
        description:
          e instanceof ApiError ? e.message : "The server rejected the change. Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {data.name}</DialogTitle>
          <DialogDescription>
            Update this employee&apos;s details. Their role is changed with Change role.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-emp-name">Full name</Label>
            <Input
              id="edit-emp-name"
              value={form.name}
              onChange={(e) => setField("name")(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-emp-title">Job title</Label>
            <Input
              id="edit-emp-title"
              value={form.title}
              onChange={(e) => setField("title")(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-emp-dept">Department</Label>
            <Select
              value={form.departmentId || NONE}
              onValueChange={(v) => onDepartmentChange(v as string)}
              items={{
                [NONE]: "— None —",
                ...Object.fromEntries(depts.map((d) => [d.id, d.name])),
              }}
            >
              <SelectTrigger id="edit-emp-dept" className="w-full">
                <SelectValue placeholder={loadingOpts ? "Loading…" : "Select a department"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {depts.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-emp-location">Location</Label>
            <Input
              id="edit-emp-location"
              placeholder="City, State"
              value={form.location}
              onChange={(e) => setField("location")(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <PhoneInput
              value={form.phone}
              onChange={(v) => setField("phone")(v)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ page-level wrapper ============================ */

export function EmployeeProfile({ id }: { id: string }) {
  const { data, loading, error, notFound, reload } = useEmployeeProfile(id);

  if (loading && !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader label="Loading profile…" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="py-16">
        <EmptyState
          icon={Users}
          title="Employee not found"
          description="This person may have left the organization or the link is out of date."
          action={
            <Button render={<Link href="/employees" />} nativeButton={false}>
              Back to employees
            </Button>
          }
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">{error ?? "Profile unavailable."}</p>
        <Button variant="outline" size="sm" onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }

  return <ProfileView data={data} reload={reload} refreshing={loading} />;
}

/* ============================ presentational view (verbatim preview) ============================ */

/** Attendance status → the colour and label the hours-worked bars use. Unknown/absent/non-workday
 *  (and any future status) fall through to the neutral "not yet closed" bucket. A timesheet day the
 *  page has no verdict for (AI-63 — the hours come from the timesheet, the verdicts from the activity
 *  read) is said as exactly that, not given one. */
const ATTENDANCE_META: Record<string, { label: string; color: string }> = {
  present: { label: "Present", color: "var(--success)" },
  late: { label: "Late", color: "var(--warning)" },
  partial: { label: "Partial", color: "var(--chart-4)" },
  leave: { label: "On leave", color: "var(--primary)" },
  [NO_ATTENDANCE]: { label: "Attendance not shown", color: "var(--chart-2)" },
};
const ATTENDANCE_FALLBACK = { label: "Not yet closed", color: "var(--muted-foreground)" };
const attendanceMeta = (status: string) => ATTENDANCE_META[status] ?? ATTENDANCE_FALLBACK;

/** Tooltip for the hours-worked chart: the day, hours on the clock, and the attendance verdict. */
function HoursTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { label: string; hours: number; status: string } }>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const meta = attendanceMeta(row.status);
  return (
    <div className="bg-popover text-popover-foreground border-border rounded-xl border px-3 py-2 text-xs shadow-md">
      <div className="text-muted-foreground mb-1 font-medium">{row.label}</div>
      <div className="flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden />
        <span className="tabular-nums">{formatHours(row.hours)} worked</span>
        <span className="text-muted-foreground">· {meta.label}</span>
      </div>
    </div>
  );
}

/**
 * The window the app-usage panel shows: the last 14 days, ending today. Two weeks is wide enough to
 * show a pattern and inside the endpoint's range cap.
 *
 * Worked out after mount, each time a profile loads — not in render (`new Date()` there can disagree
 * between the server and client pass, frontend/CLAUDE.md) and not at module load, which pinned it to
 * whenever the tab first loaded the code: a tab opened Monday showed every profile's fortnight
 * ending Monday on Wednesday (QA audit 2026-10-08, WP-464). Calendar days, not 24-hour steps, so a
 * clock change can't shift it by one.
 */
function appUsageWindow(): { from: string; to: string } {
  const now = new Date();
  return {
    from: isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13)),
    to: isoDay(now),
  };
}

/**
 * The profile's tabs (UX audit PEOPLE-15). The profile was one long page that left out time,
 * attendance, leave and devices entirely and sent screenshots and locations to other pages without
 * saying so. It now groups what it knows about the person, and says where a fuller view lives.
 * The tab is in the URL, so Back from a linked page returns to it.
 */
const PROFILE_TABS = ["overview", "time", "activity", "access"] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];

function ProfileView({
  data,
  reload,
  refreshing,
}: {
  data: EmployeeProfileData;
  reload: () => void;
  /** True while a refetch is in flight — spins the refresh button. */
  refreshing?: boolean;
}) {
  const { can } = usePermissions();
  const canManage = can("employees:manage");
  // The PDF is built on demand, so the click has to say so: the trigger becomes "Preparing PDF…"
  // and the toast names the step being fetched. Without it the gap between click and file (a
  // dozen reads, several seconds on a busy profile) reads as a dead button and invites a re-click.
  const [preparingPdf, setPreparingPdf] = useState(false);
  const downloadPdf = useCallback(async () => {
    setPreparingPdf(true);
    const toastId = toast.loading("Preparing PDF…", {
      description: "Collecting this employee's latest records",
    });
    try {
      // Fetched now, not reused from this page's state: an exported file carries a timestamp and
      // gets forwarded, so it must reflect the data at the moment of the request.
      const report = await collectEmployeeReport(data.id, (p) =>
        toast.loading("Preparing PDF…", {
          id: toastId,
          description: `Fetching ${p.label} (${p.done + 1}/${p.total + 1})`,
        }),
      );
      const doc = await renderEmployeeReportPdf(report);
      const name = reportFileName(report);
      doc.save(name);
      toast.success("Report downloaded", { id: toastId, description: name });
    } catch (e) {
      toast.error("Could not build the report", {
        id: toastId,
        description: e instanceof ApiError ? e.message : "Please try again.",
      });
    } finally {
      setPreparingPdf(false);
    }
  }, [data.id]);
  // Any Analytics tab this viewer can open for a person — the hub hides the rest.
  const canViewAnalytics =
    can("activity:view") || can("screenshots:view") || can("locations:view") || can("ai:view");
  // Separate from `activity:view` on purpose — see the card's own note. The server is the
  // real gate; this keeps a 403 card off a page the viewer is otherwise entitled to.
  const canSeeAppUsage = can("activity:apps:person");
  const canChangeRole = canManage && can("roles:manage") && data.roleId !== "role-owner";

  const [tab, setTab] = useQueryState<ProfileTab>("tab", "overview", PROFILE_TABS);

  // Whether *today* is a scheduled working day, so a Sunday isn't reported as an absence.
  //
  // Resolved after mount rather than during render: `new Date()` in a render path can disagree
  // between the server and client pass (the repo hits this elsewhere and guards it the same way).
  // Until it resolves, assume a workday — the common case, and it only ever downgrades to the
  // quieter "Non-working day" label.
  const workdays = useWorkdays();
  const [todayIsWorkday, setTodayIsWorkday] = useState(true);
  const [appUsage, setAppUsage] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => {
    setAppUsage(appUsageWindow());
  }, [data]);
  // Does THIS employee personally track time? Resolved from their role's permission list, not from
  // a role-id comparison: an Owner or Admin who is also a contributor holds `time-tracking:self`
  // explicitly, and must keep the attendance badge that a name check would have taken away.
  // Unknown role (not yet loaded, or a role the store hasn't seen) ⇒ treat as tracked, so a loading
  // race never silently blanks a real employee's badge.
  //
  // Select the STABLE `customRoles` slice and merge here — never `useRolesStore(s =>
  // s.getAllRoles())`. That helper returns `[...SYSTEM_ROLES, ...customRoles]`, a fresh array on
  // every call, and zustand compares selector output with `Object.is` — so the selector reported a
  // change on every render, re-rendered, and looped until React gave up and showed the error
  // boundary. It took down the whole employee profile page.
  const customRoles = useRolesStore((st) => st.customRoles);
  // The server's roles: which of them run a timer (bit 110), custom roles included — the local store
  // knows only the built-ins, so a custom non-tracking role (an "HR Manager") read as tracked and
  // showed a red "Today · Absent" every working day (QA audit 2026-10-08, WP-227) — and this
  // person's own role, for the Access tab.
  const [serverRoles, setServerRoles] = useState<ApiRole[] | null>(null);
  useEffect(() => {
    let live = true;
    listRoles()
      .then((rs) => live && setServerRoles(rs))
      .catch(() => {
        /* no roles access — fall back to the built-in lookup below */
      });
    return () => {
      live = false;
    };
  }, [data.roleId]);
  const role = serverRoles?.find((r) => r.id === data.roleId) ?? null;
  const isTracked = useMemo(() => {
    const roleId = data?.roleId;
    if (!roleId) return true;
    if (serverRoles) {
      const r = serverRoles.find((x) => x.id === roleId);
      return r ? r.permissions.includes(TIME_TRACK_SELF) : true;
    }
    const local =
      SYSTEM_ROLES.find((r) => r.id === roleId) ??
      customRoles.find((r) => r.id === roleId);
    return local ? local.permissions.includes("time-tracking:self") : true;
  }, [serverRoles, customRoles, data?.roleId]);
  useEffect(() => {
    setTodayIsWorkday(isWorkday(new Date(), workdays));
  }, [workdays]);

  const department = data.department;
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Job title and department, with a separator only BETWEEN values: an empty title or department
  // left a lone "·" under the name in the top bar (UX audit 2026-10-16, PEOPLE-19).
  const roleLine = [data.jobTitle.trim(), department.trim()].filter(Boolean).join(" · ");

  // Surface the employee's name + role in the top navbar for this detail route.
  usePageTitle(data.name, roleLine || null);

  // The browser tab names the person. Every profile shared the app's generic title, so a row of
  // open profiles was indistinguishable (PEOPLE-19). Put back on the way out only if it is still
  // ours — the next route may already have set its own.
  useEffect(() => {
    const previous = document.title;
    const mine = `${data.name} · WorkPulse`;
    document.title = mine;
    return () => {
      if (document.title === mine) document.title = previous;
    };
  }, [data.name]);

  const badge = headerBadge(data, todayIsWorkday, isTracked);
  const tabs: { key: ProfileTab; label: string; short: string }[] = [
    { key: "overview", label: "Overview", short: "Overview" },
    { key: "time", label: "Time & attendance", short: "Time" },
    { key: "activity", label: "Activity", short: "Activity" },
    { key: "access", label: can("agents:manage") ? "Access & devices" : "Access", short: "Access" },
  ];
  const tabRefs = useRef<Partial<Record<ProfileTab, HTMLButtonElement | null>>>({});
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : i + step;
    if (to === i || (step === 0 && e.key !== "Home" && e.key !== "End")) return;
    e.preventDefault();
    const next = tabs[(to + tabs.length) % tabs.length].key;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    // Bottom room for the floating assistant button, which covered the recap's Regenerate and the
    // last card's controls on a phone (UX audit PEOPLE-13).
    <div className="space-y-4 pb-24">
      {/* Top bar. Wraps on a phone — the action row didn't, so "Manage" sat off-screen behind a
          sideways scroll (UX audit PEOPLE-13). */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {/* The one way back. A breadcrumb ("Employees / <name>") repeated it on wide screens and
            said the name yet again under the top bar's title, just above the card's (UX audit
            2026-10-16, PEOPLE-19); the back link is the one that also exists on a phone. */}
        <Link
          href="/employees"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All employees
        </Link>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {canViewAnalytics ? (
            // One way into this person's analytics (owner request 2026-10-16): it replaced the
            // separate Location and Screenshots buttons. `?emp=` scopes the whole Analytics hub to
            // them, so every tab — Activity, Screenshots, Locations, AI reports — shows this person.
            <Button
              variant="outline"
              size="sm"
              render={<Link href={withEmp("/insights", data.id)} />}
              nativeButton={false}
              title={`Open ${data.name}'s analytics`}
            >
              <BarChart3 className="size-4" /> Analytics
            </Button>
          ) : null}
          {/* Refetch this profile in place — the page stays put instead of a full reload. Refresh
              sits in the top-navbar action slot (the app-wide fixed spot); the profile-specific
              actions below stay in this bar. */}
          <PageActions>
            <RefreshButton onRefresh={reload} refreshing={refreshing} />
          </PageActions>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" disabled={preparingPdf} />}
            >
              {preparingPdf ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Preparing PDF…
                </>
              ) : (
                <>
                  <Download className="size-4" /> Download
                </>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={preparingPdf} onClick={downloadPdf}>
                <FileText className="size-4" /> PDF — full report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportEmployeeCsv(data)}>
                <Sheet className="size-4" /> CSV — summary
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canManage ? (
            <EmployeeManageMenu
              id={data.id}
              name={data.name}
              status={data.status}
              roleId={data.roleId}
              onChanged={reload}
            />
          ) : null}
        </div>
      </div>

      {canManage ? (
        <>
          <ChangeRoleDialog
            open={changeRoleOpen}
            onOpenChange={setChangeRoleOpen}
            employeeId={data.id}
            name={data.name}
            currentRoleId={data.roleId}
            onSaved={reload}
          />
          <EditEmployeeDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            data={data}
            onSaved={reload}
          />
        </>
      ) : null}

      {/* Identity — who this is, above every tab. */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center">
        {/* From the shared avatar store: one cache, refreshed before the presign expires,
            and no late patch into `data` to disturb an open Edit dialog (WP-454). */}
        <UserAvatar
          userId={data.id}
          name={data.name}
          className="size-16 shrink-0 ring-4 ring-feature-tint"
          fallbackClassName="text-lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* Wraps rather than truncating — a long name is the one thing this page must show
                whole (PEOPLE-13). */}
            <h1 className="font-display text-xl font-semibold tracking-tight break-words">
              {data.name}
            </h1>
            {/* Only when there is a code: a bare "–" beside the name read as a stray dash
                ("Acme Owner –", PEOPLE-19). */}
            {data.empCode.trim() ? (
              <span className="font-mono text-xs text-muted-foreground">{data.empCode}</span>
            ) : null}
          </div>
          {/* No line at all when there is neither a title nor a department — a lone placeholder
              under the name looked like a rendering fault. The Details card still says "—". */}
          {roleLine ? <p className="mt-0.5 text-sm text-muted-foreground">{roleLine}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className="bg-feature-tint text-primary">{data.roleName || "No role"}</Badge>
            <Badge className={badge.className} title={badge.title}>
              {badge.label}
            </Badge>
          </div>
        </div>
        {canManage ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-center">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> Edit
            </Button>
            {/* The role route needs `roles:manage`, not `employees:manage`, and an owner's role
                is changed through ownership, not here (WP-228). */}
            {canChangeRole ? (
              <Button variant="outline" size="sm" onClick={() => setChangeRoleOpen(true)}>
                <ShieldCheck className="size-4" /> Change role
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label={`${data.name}'s profile`}
        className="flex gap-1 overflow-x-auto border-b"
      >
        {tabs.map((t, i) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              ref={(el) => {
                tabRefs.current[t.key] = el;
              }}
              type="button"
              role="tab"
              id={`profile-tab-${t.key}`}
              aria-selected={active}
              aria-controls={`profile-panel-${t.key}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.key)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`profile-panel-${tab}`}
        aria-labelledby={`profile-tab-${tab}`}
        className="focus-visible:outline-none"
      >
        {tab === "overview" ? (
          <OverviewTab data={data} />
        ) : tab === "time" ? (
          <TimeTab data={data} isTracked={isTracked} />
        ) : tab === "activity" ? (
          <ActivityTab
            data={data}
            appUsage={canSeeAppUsage ? appUsage : null}
          />
        ) : (
          <AccessTab
            data={data}
            role={role}
            rolesRead={serverRoles !== null}
            isTracked={isTracked}
            onChangeRole={canChangeRole ? () => setChangeRoleOpen(true) : undefined}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------- tabs -------------------------------- */

/** Who they are, what they work on, and the AI recap of how it's going. */
function OverviewTab({ data }: { data: EmployeeProfileData }) {
  // Projects list paginates so a heavily-staffed employee doesn't run a wall of
  // bars down the card.
  const PROJECTS_PER_PAGE = 5;
  const [projectPage, setProjectPage] = useState(0);
  const projectPageCount = Math.max(1, Math.ceil(data.projects.length / PROJECTS_PER_PAGE));
  const safeProjectPage = Math.min(projectPage, projectPageCount - 1);
  const pagedProjects = data.projects.slice(
    safeProjectPage * PROJECTS_PER_PAGE,
    safeProjectPage * PROJECTS_PER_PAGE + PROJECTS_PER_PAGE,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border bg-card">
          <p className="border-b px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Details
          </p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 p-5 min-[420px]:grid-cols-2">
            <Detail label="Department" value={data.department} />
            {/* Team was loaded and never shown (PEOPLE-15). */}
            <Detail label="Team" value={data.team} />
            <Detail label="Email" value={data.email} />
            <Detail label="Phone" value={data.phone} />
            <Detail label="Hire date" value={data.hireDate} />
            <Detail label="Location" value={data.cityState} />
            {/* No Country row: the server's profile has no country, so it read "—" for everyone
                (PEOPLE-15). The location above is the place the server does keep. */}
          </dl>
        </div>

        {/* Projects — all projects, single accent bar, Active badge when active */}
        <div className="flex-1 rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-feature-tint text-primary">
              <FolderKanban className="size-4" />
            </span>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Projects
            </p>
            <Badge className="bg-muted font-normal text-muted-foreground">
              {data.projects.length}
            </Badge>
          </div>
          {data.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {/* A failed read is not "no projects" (WP-229). */}
              {data.projectsFailed
                ? "Couldn't load this person's projects. Refresh to try again."
                : "Not assigned to any project yet."}
            </p>
          ) : (
            <>
              <ul className="space-y-4">
                {pagedProjects.map((p) => (
                  <li key={p.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <Link
                        href={`/projects/${p.id}`}
                        className="flex min-w-0 items-center gap-2 font-medium hover:underline"
                      >
                        <span className="rounded bg-accent px-1 font-mono text-[0.65rem] font-semibold text-accent-foreground">
                          {p.key}
                        </span>
                        <span className="truncate">{p.name}</span>
                        {p.active ? (
                          <Badge className="bg-success/12 text-[0.65rem] text-success">
                            Active
                          </Badge>
                        ) : null}
                      </Link>
                      <span
                        className="shrink-0 font-mono tabular-nums text-muted-foreground"
                        title="The project's completion, across everyone's tasks"
                      >
                        {p.progress === null ? "—" : `${p.progress}%`}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="wp-meter-fill h-full rounded-full bg-primary"
                        style={{ width: `${p.progress ?? 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.tasks === null ? "—" : p.tasks} project tasks · {p.teammates} teammates
                    </p>
                  </li>
                ))}
              </ul>
              {data.projects.length > PROJECTS_PER_PAGE ? (
                <TablePagination
                  page={safeProjectPage}
                  pageCount={projectPageCount}
                  total={data.projects.length}
                  pageSize={PROJECTS_PER_PAGE}
                  onPageChange={setProjectPage}
                  className="mt-4"
                />
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* The AI summary leads the column, and it is the *only* summary here now.
            A second card used to sit above it, styled as an AI insight but composed
            client-side from a sentence template — "{first} is a {tier} performer" and
            "Reliable output — small focus gains could lift them into the top tier". Those read
            as a model's judgement of a named colleague and were nothing of the kind. Every
            figure it recited (productivity, completion, tasks, active projects) is already in
            the stat cards below, so removing it costs no fact — only a verdict nothing had
            earned the right to make. */}
        <EmployeeRecapCard userId={data.id} name={data.name} />

        {/* Stat cards row */}
        <div className="grid grid-cols-2 gap-4">
          <ProductivityStat data={data} />
          {/* Both of these are the projects' figures — everyone's tasks — and are labelled so. As
              "Avg. completion · task delivery rate" and "Total tasks", a new hire on three big
              projects read as having 412 tasks on day one (QA audit 2026-10-08, WP-234). */}
          <Stat
            label="Project completion"
            value={data.avgCompletion === null ? "—" : `${data.avgCompletion}%`}
            hint="average of their projects"
          />
          <Stat label="Project tasks" value={String(data.totalTasks)} hint="in their projects, all assignees" />
          <Stat
            label="Active projects"
            value={String(data.projects.filter((p) => p.active).length)}
            hint={`of ${data.projects.length} total`}
          />
        </div>
      </div>
    </div>
  );
}

/** Hours on the clock, this year's leave, and where the full attendance and time views live. */
function TimeTab({ data, isTracked }: { data: EmployeeProfileData; isTracked: boolean }) {
  const { can } = usePermissions();
  const canSeeLeave = can("leave:manage");
  const leave = useEmployeeLeave(data.id, canSeeLeave);

  const chartData = data.kpi.days;
  // A day only appears here if time was recorded on it, so any bars at all means real work to show;
  // no days means nothing recorded (an honest empty state, never a flat line of measured zeros).
  const kpiMeasured = chartData.length > 0;
  // The timesheet, unless the viewer can't read it (AI-63).
  const fromActivity = data.kpi.source === "activity";
  // The attendance statuses actually present in the window, in a stable order — the chart legend.
  const seenStatuses = new Set(chartData.map((d) => d.status));
  const legendStatuses = [
    ...["present", "late", "partial", "leave", NO_ATTENDANCE].filter((s) => seenStatuses.has(s)),
    ...([...seenStatuses].some((s) => !ATTENDANCE_META[s]) ? ["_other"] : []),
  ];
  const totalHours = chartData.reduce((s, d) => s + d.hours, 0);

  const links = [
    can("attendance:view") ? { href: "/attendance", label: "Attendance", note: "daily status and history" } : null,
    can("time-tracking:view") ? { href: "/time-tracking", label: "Time tracking", note: "timesheets, session by session" } : null,
    canSeeLeave ? { href: "/leave-requests", label: "Leave", note: "requests and balances" } : null,
  ].filter((l): l is { href: string; label: string; note: string } => l !== null);

  return (
    <div className="space-y-4">
      {!isTracked ? (
        <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          {data.name}&apos;s role doesn&apos;t track time, so there are no hours or daily attendance
          to show for them.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* KPI chart — capped so it never balloons */}
        <div className="flex max-h-[380px] flex-col rounded-xl border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-feature-tint text-primary">
                <BarChart2 className="size-4" />
              </span>
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Hours worked
                </p>
                <p className="text-xs text-muted-foreground">
                  {kpiMeasured
                    ? `${formatHours(totalHours)} over ${chartData.length} ${chartData.length === 1 ? "day" : "days"} · last 30 days`
                    : "Total hours on the clock · last 30 days"}
                  {/* Said only when it isn't the timesheet — the one case a reader could be misled. */}
                  {kpiMeasured && fromActivity ? " · from desktop-app activity" : ""}
                </p>
              </div>
            </div>
            {/* Legend reflects the attendance verdicts actually present in the window. */}
            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {legendStatuses.map((s) => {
                const meta = s === "_other" ? ATTENDANCE_FALLBACK : attendanceMeta(s);
                return (
                  <span key={s} className="flex items-center gap-1.5">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: meta.color }}
                      aria-hidden
                    />
                    {meta.label}
                  </span>
                );
              })}
            </div>
          </div>
          {!kpiMeasured ? (
            // The honest empty state. Says which of the possible blanks this is, and names the
            // cause, so nobody reads a blank chart as a verdict on the person — including when
            // the read itself was refused or failed, which used to say "nothing recorded" (WP-229).
            <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center gap-1 text-center">
              {data.kpi.source === null &&
              data.timeStatus === "forbidden" &&
              data.activityStatus === "forbidden" ? (
                <>
                  <p className="text-sm font-medium">Hours aren&apos;t visible to you</p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    Seeing a person&apos;s hours needs access to their team&apos;s timesheets,
                    which your role doesn&apos;t have.
                  </p>
                </>
              ) : data.kpi.source === null ? (
                <>
                  <p className="text-sm font-medium">Couldn&apos;t load hours</p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    This isn&apos;t a sign that nothing was recorded. Refresh to try again.
                  </p>
                </>
              ) : fromActivity ? (
                <>
                  <p className="text-sm font-medium">No work recorded in the last 30 days</p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    The timesheet isn&apos;t visible to you, so this chart is built from activity
                    the desktop app reports. None was reported for this employee in the last 30
                    days — which is not the same as no time worked.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">No time recorded in the last 30 days</p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    This chart is built from the timesheet: time from the desktop app&apos;s timer
                    and approved corrections. None was recorded for this employee in the last 30
                    days.
                  </p>
                </>
              )}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={220} className="flex-1">
              <BarChart data={chartData} margin={CHART_MARGIN_WITH_LEGEND}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  {...xAxisLabel("Day")}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  // 30 daily ticks would overlap — thin them but always keep the first and last.
                  interval="preserveStartEnd"
                  minTickGap={16}
                  dy={6}
                />
                <YAxis
                  {...yAxisLabel("Hours")}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => `${v}h`}
                />
                <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<HoursTooltip />} />
                {/* One bar per worked day: height is hours on the clock, colour is that day's
                    attendance verdict (present / late / partial / leave). */}
                <Bar dataKey="hours" name="Hours worked" radius={[3, 3, 0, 0]} maxBarSize={40}>
                  {chartData.map((d) => (
                    <Cell key={d.date} fill={attendanceMeta(d.status).color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {canSeeLeave ? <LeaveCard state={leave} /> : null}
          {links.length ? (
            <div className="rounded-xl border bg-card p-5">
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Full views
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                These pages cover everyone; find {data.name.split(" ")[0]} there.
              </p>
              <ul className="space-y-1.5">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                    >
                      {l.label}
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </Link>
                    <span className="text-xs text-muted-foreground"> — {l.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Days with a half are possible (half-day leave), so one decimal when it isn't whole. */
const days = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} ${n === 1 ? "day" : "days"}`;

function LeaveCard({ state }: { state: ExtraState<EmployeeLeave> }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Leave{state.status === "ready" ? ` · ${state.value.year}` : ""}
      </p>
      {state.status === "loading" || state.status === "idle" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading balances…
        </p>
      ) : state.status === "forbidden" ? (
        <p className="text-sm text-muted-foreground">Leave balances aren&apos;t visible to you.</p>
      ) : state.status === "failed" ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Couldn&apos;t load leave balances.
          <Button variant="outline" size="sm" onClick={state.retry}>
            Retry
          </Button>
        </p>
      ) : state.value.balances.length === 0 ? (
        <p className="text-sm text-muted-foreground">No leave balances for this person this year.</p>
      ) : (
        <ul className="divide-y text-sm">
          {state.value.balances.map((b) => (
            <li key={b.type_id} className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate">{b.name}</span>
              <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {b.allowance > 0 ? (
                  <>
                    <span className="font-medium text-foreground">{days(b.remaining)} left</span> of{" "}
                    {b.allowance} · {days(b.used)} used
                  </>
                ) : (
                  `${days(b.used)} used`
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Where their time went, and the way into the screenshots, locations and AI reports — which live
 * in Analytics, scoped to this person. They opened other pages without warning (PEOPLE-15); now
 * each link says where it goes.
 */
function ActivityTab({
  data,
  appUsage,
}: {
  data: EmployeeProfileData;
  /** `null` when the viewer can't see per-person app usage (or the window isn't resolved yet). */
  appUsage: { from: string; to: string } | null;
}) {
  const { can } = usePermissions();
  const links = [
    can("activity:view") ? { href: "/insights/activity", label: "Activity", note: "scores and time, day by day" } : null,
    can("screenshots:view") ? { href: "/insights/screenshots", label: "Screenshots", note: "with their AI review" } : null,
    can("locations:view") ? { href: "/insights/locations", label: "Locations", note: "map and daily trail" } : null,
    can("ai:view") ? { href: "/insights/ai-reports", label: "AI reports", note: "written summaries" } : null,
  ].filter((l): l is { href: string; label: string; note: string } => l !== null);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-4">
        {/* Where the time actually went — the evidence the AI recap narrates. Gated on its own
            permission rather than the page's: an individual's application history is a narrower
            privilege an org can withhold from a manager who still needs the rest of this page. The
            server enforces it (`AppUsageReadPerson`); this only avoids rendering a card that would
            403. */}
        {appUsage ? (
          <EmployeeAppUsageCard userId={data.id} from={appUsage.from} to={appUsage.to} />
        ) : (
          <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            Which apps and websites a person used needs the “See one person&apos;s app history”
            permission, which your role doesn&apos;t have.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <ProductivityStat data={data} />
        {links.length ? (
          <div className="rounded-xl border bg-card p-5">
            <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              In Analytics
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Opens the Analytics page showing only {data.name.split(" ")[0]}.
            </p>
            <ul className="space-y-1.5">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={withEmp(l.href, data.id)}
                    className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                  >
                    {l.label}
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                  <span className="text-xs text-muted-foreground"> — {l.note}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Their role and what it reaches, whether they're tracked, and the devices attributed to them. */
function AccessTab({
  data,
  role,
  rolesRead,
  isTracked,
  onChangeRole,
}: {
  data: EmployeeProfileData;
  role: ApiRole | null;
  /** The roles list was read — so a missing `role` means an unknown role, not "still loading". */
  rolesRead: boolean;
  isTracked: boolean;
  onChangeRole?: () => void;
}) {
  const { can } = usePermissions();
  const canSeeDevices = can("agents:manage");
  const devices = useEmployeeDevices(data.id, canSeeDevices);
  const sensitive = role ? role.permissions.filter(isSensitive) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Role</p>
          {onChangeRole ? (
            <Button variant="outline" size="sm" onClick={onChangeRole}>
              <ShieldCheck className="size-4" /> Change role
            </Button>
          ) : null}
        </div>
        <p className="font-medium">{data.roleName || "No role"}</p>
        {role?.is_owner ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Owners have full, unrestricted access to the whole organization.
          </p>
        ) : role ? (
          <>
            {role.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
            ) : null}
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
              <Detail label="Data they can see" value={scopeLabel(role.scope)} />
              <Detail label="Permissions" value={String(role.permissions.length)} />
            </dl>
            {sensitive.length ? (
              <p className="mt-3 text-xs text-muted-foreground">
                <span className="font-medium text-warning">
                  {sensitive.length} sensitive:
                </span>{" "}
                {sensitive
                  .map((id) => helpFor(id)?.sensitive?.reason)
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </>
        ) : rolesRead ? (
          <p className="mt-1 text-sm text-muted-foreground">
            This role&apos;s details couldn&apos;t be read.
          </p>
        ) : null}
        {can("roles:view") && !role?.is_owner ? (
          <Link
            href="/settings/roles"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            See every role&apos;s permissions
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
        <div className="mt-4 border-t pt-3">
          <Detail
            label="Tracking"
            value={
              data.benched
                ? "Not tracked — excluded from attendance and time tracking"
                : isTracked
                  ? "Tracked — their time, activity and screenshots are recorded"
                  : "Their role doesn't track time"
            }
            wrap
          />
        </div>
      </div>

      {canSeeDevices ? (
        <div className="rounded-xl border bg-card p-5">
          <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Devices
          </p>
          {devices.status === "loading" || devices.status === "idle" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading devices…
            </p>
          ) : devices.status === "forbidden" ? (
            <p className="text-sm text-muted-foreground">Devices aren&apos;t visible to you.</p>
          ) : devices.status === "failed" ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              Couldn&apos;t load devices.
              <Button variant="outline" size="sm" onClick={devices.retry}>
                Retry
              </Button>
            </p>
          ) : devices.value.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No device reports for {data.name.split(" ")[0]} yet.{" "}
              <Link href="/settings/agents" className="font-medium text-foreground hover:underline">
                Device agents
              </Link>{" "}
              lists every enrolled computer.
            </p>
          ) : (
            <ul className="divide-y">
              {devices.value.map((d) => {
                const live = isLiveDevice(d.state);
                const conn = connMeta(d.connectivity);
                return (
                  <li key={d.agent_id} className="flex items-center gap-3 py-2">
                    <MonitorSmartphone className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/settings/agents/${encodeURIComponent(d.agent_id)}`}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {d.hostname || "Unnamed device"}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {d.variant === "service" ? "Managed service" : "Desktop app"}
                        {d.agent_version ? ` · v${d.agent_version}` : ""} · last seen{" "}
                        {lastSeen(d.last_heartbeat)}
                      </p>
                    </div>
                    <Badge className={cn("shrink-0 font-medium", live ? conn.badge : "bg-muted text-muted-foreground")}>
                      {live ? conn.label : deviceStateLabel(d.state)}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------- atoms -------------------------------- */

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ProductivityStat({ data }: { data: EmployeeProfileData }) {
  return (
    <Stat
      label="Productivity"
      value={data.productivityScore == null ? "—" : `${data.productivityScore}%`}
      hint={
        data.productivityScore != null
          ? "overall score, last 30 days"
          : data.activityStatus === "forbidden"
            ? "activity isn't visible to you"
            : data.activityStatus === "failed"
              ? "couldn't load activity"
              : "no activity reported yet"
      }
    />
  );
}

function Detail({ label, value, wrap = false }: { label: string; value: string; wrap?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className={cn("mt-1 text-sm font-medium", wrap ? "break-words" : "truncate")} title={value}>
        {dash(value)}
      </dd>
    </div>
  );
}
