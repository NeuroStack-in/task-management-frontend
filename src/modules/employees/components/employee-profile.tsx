"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  FileText,
  FolderKanban,
  MapPin,
  Sheet,
  BarChart2,
  Pencil,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { initials, isUuid } from "@/lib/format";
import { downloadBlob } from "@/lib/download";
import { usePageTitle } from "@/stores/page-header.store";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { listRoles, assignRole, type ApiRole } from "@/modules/roles/services/roles.service";
import {
  listDepartments,
  listTeams,
  updateEmployee,
  type ApiDepartment,
  type ApiTeam,
  type UpdateEmployeeBody,
} from "../services/employees.service";
import { EmployeeRecapCard } from "./employee-recap-card";
import { useEmployeeProfile, type EmployeeProfileData } from "../use-employee-profile";
import { EmployeeManageMenu } from "./employee-manage-menu";

const STATUS_META: Record<EmployeeProfileData["status"], string> = {
  active: "bg-success/12 text-success",
  inactive: "bg-muted text-muted-foreground",
  invited: "bg-warning/15 text-warning",
  suspended: "bg-destructive/12 text-destructive",
};

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
    ["Team", d.team],
    ["Status", d.status],
    ["Email", d.email],
    ["Phone", d.phone],
    ["Date of birth", d.dob],
    ["Hire date", d.hireDate],
    ["Address", `${d.address}, ${d.cityState}, ${d.country} ${d.postcode}`],
    // An unmeasured score exports as "—", never as 0 — a spreadsheet cell reading `0` is
    // indistinguishable from a real zero once it leaves the app, and this file gets forwarded.
    ["Productivity %", d.productivityScore ?? "—"],
    ["Avg. completion %", d.avgCompletion],
    ["Total tasks", d.totalTasks],
    ["Projects", d.projects.length],
    ["Active projects", activeCount],
    [],
    ["Project", "Key", "Progress %", "Tasks", "Teammates", "Active"],
    ...d.projects.map((p) => [
      p.name, p.key, p.progress, p.tasks, p.teammates, p.active ? "Yes" : "No",
    ]),
  ];
  downloadBlob(
    new Blob([Papa.unparse(rows)], { type: "text/csv;charset=utf-8;" }),
    `${fileCode(d.empCode)}-report.csv`,
  );
  toast.success("Report exported", { description: `${fileCode(d.empCode)}-report.csv` });
}

function exportEmployeePdf(d: EmployeeProfileData) {
  const activeCount = d.projects.filter((p) => p.active).length;
  const doc = new jsPDF();
  let y = 18;
  doc.setFontSize(18);
  doc.text(d.name, 14, y);
  doc.setFontSize(10);
  doc.setTextColor(120);
  y += 6;
  doc.text(`${d.jobTitle} · ${d.department} · ${d.empCode}`, 14, y);

  const section = (title: string) => {
    y += 10;
    doc.setTextColor(20);
    doc.setFontSize(13);
    doc.text(title, 14, y);
    doc.setDrawColor(210);
    doc.line(14, y + 2, 196, y + 2);
    y += 8;
    doc.setFontSize(10);
  };
  const kv = (k: string, v: string) => {
    doc.setTextColor(120);
    doc.text(k, 14, y);
    doc.setTextColor(20);
    doc.text(v, 60, y);
    y += 6;
  };

  section("Profile");
  kv("Role", d.roleName);
  kv("Status", d.status);
  kv("Email", d.email);
  kv("Phone", d.phone);
  kv("Date of birth", d.dob);
  kv("Hire date", d.hireDate);
  kv("Address", `${d.address}, ${d.cityState}, ${d.country} ${d.postcode}`);

  section("Performance");
  kv("Productivity", d.productivityScore == null ? "—" : `${d.productivityScore}%`);
  kv("Avg. completion", `${d.avgCompletion}%`);
  kv("Total tasks", String(d.totalTasks));
  kv("Projects", `${d.projects.length} (${activeCount} active)`);

  section("Projects");
  if (d.projects.length === 0) {
    doc.text("No projects.", 14, y);
  } else {
    for (const p of d.projects) {
      doc.setTextColor(20);
      doc.text(`${p.key}  ${p.name}${p.active ? "  (active)" : ""}`, 14, y);
      doc.text(`${p.progress}%`, 196, y, { align: "right" });
      y += 6;
      if (y > 282) {
        doc.addPage();
        y = 18;
      }
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("WorkPulse · employee report", 14, 292);
  doc.save(`${fileCode(d.empCode)}-report.pdf`);
  toast.success("Report exported", { description: `${fileCode(d.empCode)}-report.pdf` });
}

/**
 * Change this employee's RBAC role — the one reassignment WorkPulse actually has an endpoint for
 * (`PUT /v1/users/{id}/role`). Department/team moves have no backend route yet, so only the role is
 * persisted on save. The server enforces the caller's authority.
 */
function ReassignDialog({
  open,
  onOpenChange,
  employeeId,
  name,
  currentRoleName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employeeId: string;
  name: string;
  currentRoleName: string;
  onSaved: () => void;
}) {
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [roleId, setRoleId] = useState("");
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoadingRoles(true);
    listRoles()
      .then((rs) => {
        if (!live) return;
        setRoles(rs);
        // Pre-select the role matching the current role name, if we can find it.
        setRoleId(rs.find((r) => r.name === currentRoleName)?.id ?? "");
      })
      .catch(() => toast.error("Couldn't load roles"))
      .finally(() => {
        if (live) setLoadingRoles(false);
      });
    return () => {
      live = false;
    };
  }, [open, currentRoleName]);

  async function save() {
    if (!roleId) {
      toast.error("Pick a role");
      return;
    }
    setSaving(true);
    try {
      await assignRole(employeeId, roleId);
      const roleName = roles.find((r) => r.id === roleId)?.name ?? roleId;
      toast.success("Role updated", { description: `${name} → ${roleName}` });
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("Couldn't update role", {
        description: "You may not have permission, or the server rejected it.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign {name}</DialogTitle>
          <DialogDescription>
            Change this employee&apos;s access role. Department and team moves aren&apos;t available
            yet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={roleId}
              onValueChange={(v) => setRoleId(v as string)}
              items={Object.fromEntries(roles.map((r) => [r.id, r.name]))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loadingRoles ? "Loading roles…" : "Select a role"} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || loadingRoles}>
            {saving ? "Saving…" : "Save changes"}
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
  const [teams, setTeams] = useState<ApiTeam[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    title: "",
    departmentId: "",
    teamId: "",
    location: "",
    phone: "",
  });

  useEffect(() => {
    if (!open) return;
    // Re-seed from the freshest profile every time the dialog opens.
    setForm({
      name: data.name,
      title: data.jobTitle,
      departmentId: data.departmentId,
      teamId: data.teamId,
      location: data.cityState,
      phone: data.phone,
    });
    let live = true;
    setLoadingOpts(true);
    Promise.all([listDepartments().catch(() => []), listTeams().catch(() => [])])
      .then(([d, t]) => {
        if (!live) return;
        setDepts(d);
        setTeams(t);
      })
      .finally(() => {
        if (live) setLoadingOpts(false);
      });
    return () => {
      live = false;
    };
  }, [open, data]);

  // Teams follow the chosen department; teams without a department are always offered.
  const teamOptions = form.departmentId
    ? teams.filter((t) => !t.department_id || t.department_id === form.departmentId)
    : teams;

  const setField = (k: keyof typeof form) => (v: string) =>
    setForm((s) => ({ ...s, [k]: v }));

  const onDepartmentChange = (v: string) => {
    const departmentId = v === NONE ? "" : v;
    setForm((s) => {
      const team = teams.find((t) => t.id === s.teamId);
      const teamStillValid =
        !departmentId || !team?.department_id || team.department_id === departmentId;
      return { ...s, departmentId, teamId: teamStillValid ? s.teamId : "" };
    });
  };

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
    if (form.teamId !== data.teamId) body.team_id = form.teamId;
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
            Update this employee&apos;s details. Access role is changed via Reassign.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={form.name} onChange={(e) => setField("name")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Job title</Label>
            <Input value={form.title} onChange={(e) => setField("title")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select
              value={form.departmentId || NONE}
              onValueChange={(v) => onDepartmentChange(v as string)}
              items={{
                [NONE]: "— None —",
                ...Object.fromEntries(depts.map((d) => [d.id, d.name])),
              }}
            >
              <SelectTrigger className="w-full">
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
            <Label>Team</Label>
            <Select
              value={form.teamId || NONE}
              onValueChange={(v) => setField("teamId")(v === NONE ? "" : (v as string))}
              items={{
                [NONE]: "— None —",
                ...Object.fromEntries(teamOptions.map((t) => [t.id, t.name])),
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loadingOpts ? "Loading…" : "Select a team"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {teamOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input
              placeholder="City, State"
              value={form.location}
              onChange={(e) => setField("location")(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setField("phone")(e.target.value)}
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

  return <ProfileView data={data} reload={reload} />;
}

/* ============================ presentational view (verbatim preview) ============================ */

function ProfileView({ data, reload }: { data: EmployeeProfileData; reload: () => void }) {
  const router = useRouter();
  const { can } = usePermissions();
  const canManage = can("employees:manage");
  const canViewLocations = can("locations:view");

  const department = data.department;
  const team = data.team;
  const [reassignOpen, setReassignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Surface the employee's name + role in the top navbar for this detail route.
  usePageTitle(data.name, `${data.jobTitle} · ${department}`);

  const chartData = data.kpi.months.map((m, i) => ({
    month: m,
    current: data.kpi.current[i],
    previous: data.kpi.previous[i],
  }));
  // Whether anything in either window was actually measured. A chart of all-nulls has no series to
  // draw and no axis domain to draw it against; before nulls existed it drew a flat line on 0h,
  // which claimed six months of measured idleness from an agent that had never reported.
  const kpiMeasured = [...data.kpi.current, ...data.kpi.previous].some((v) => v != null);

  // Projects list paginates so a heavily-staffed employee doesn't run a wall of
  // bars down the card.
  const PROJECTS_PER_PAGE = 5;
  const [projectPage, setProjectPage] = useState(0);
  const projectPageCount = Math.max(
    1,
    Math.ceil(data.projects.length / PROJECTS_PER_PAGE),
  );
  const safeProjectPage = Math.min(projectPage, projectPageCount - 1);
  const pagedProjects = data.projects.slice(
    safeProjectPage * PROJECTS_PER_PAGE,
    safeProjectPage * PROJECTS_PER_PAGE + PROJECTS_PER_PAGE,
  );

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/employees"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All employees
        </Link>
        <div className="flex items-center gap-3">
          <nav className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
            <Link href="/employees" className="transition-colors hover:text-foreground">Employees</Link>
            <span className="text-muted-foreground/50">/</span>
            <span className="font-medium text-foreground">{data.name}</span>
          </nav>
          {canViewLocations ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/insights/locations?emp=${data.id}`)}
              title="View live location"
            >
              <MapPin className="size-4" /> Location
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <Download className="size-4" /> Download
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportEmployeePdf(data)}>
                <FileText className="size-4" /> PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportEmployeeCsv(data)}>
                <Sheet className="size-4" /> CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canManage ? (
            <EmployeeManageMenu
              id={data.id}
              name={data.name}
              status={data.status}
              onChanged={reload}
            />
          ) : null}
        </div>
      </div>

      {canManage ? (
        <>
          <ReassignDialog
            open={reassignOpen}
            onOpenChange={setReassignOpen}
            employeeId={data.id}
            name={data.name}
            currentRoleName={data.roleName}
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

      {/* 2-column layout on lg+: left = identity + projects, right = stats + chart + AI */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-4">
          {/* Employee — identity, contact & address in ONE card */}
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center">
              <Avatar className="size-16 shrink-0 ring-4 ring-feature-tint">
                <AvatarImage src={data.avatarUrl} alt={data.name} />
                <AvatarFallback className="text-lg">
                  {initials(data.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h1 className="font-display text-xl font-semibold tracking-tight">
                    {data.name}
                  </h1>
                  <span className="font-mono text-xs text-muted-foreground">
                    {dash(data.empCode)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {data.jobTitle} · {department}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge className="bg-feature-tint text-primary">
                    {data.roleName}
                  </Badge>
                  <Badge className={STATUS_META[data.status]}>{data.status}</Badge>
                </div>
              </div>
              {canManage ? (
                <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                    <Pencil className="size-4" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setReassignOpen(true)}>
                    <ShieldCheck className="size-4" /> Reassign
                  </Button>
                </div>
              ) : null}
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5">
              <Detail label="Department" value={department} />
              <Detail label="Team" value={team} />
              <Detail label="Phone" value={data.phone} />
              <Detail label="Email" value={data.email} />
              <Detail label="Hire date" value={data.hireDate} />
              <Detail label="City / State" value={data.cityState} />
              <Detail label="Country" value={data.country} />
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
                Not assigned to any project yet.
              </p>
            ) : (
              <>
                <ul className="space-y-4">
                {pagedProjects.map((p) => (
                  <li key={p.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        <span className="rounded bg-accent px-1 font-mono text-[0.65rem] font-semibold text-accent-foreground">
                          {p.key}
                        </span>
                        <span className="truncate">{p.name}</span>
                        {p.active ? (
                          <Badge className="bg-success/12 text-[0.65rem] text-success">
                            Active
                          </Badge>
                        ) : null}
                      </span>
                      <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                        {p.progress}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="wp-meter-fill h-full rounded-full bg-primary"
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.tasks} tasks · {p.teammates} teammates
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

        {/* ── RIGHT COLUMN ── */}
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
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Productivity
              </p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                {data.productivityScore == null ? "—" : `${data.productivityScore}%`}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.productivityScore == null
                  ? "no activity reported yet"
                  : "overall score"}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Avg. completion
              </p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                {data.avgCompletion}%
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">task delivery rate</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Total tasks
              </p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                {data.totalTasks}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">across all projects</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Active projects
              </p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                {data.projects.filter((p) => p.active).length}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                of {data.projects.length} total
              </p>
            </div>
          </div>

          {/* KPI chart — capped so it never balloons to match a taller left column */}
          <div className="flex max-h-[360px] flex-1 flex-col rounded-xl border bg-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-feature-tint text-primary">
                  <BarChart2 className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Productivity
                  </p>
                  <p className="text-xs text-muted-foreground/80">
                    Avg. productive hours / day
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <Legend className="bg-primary" label="Last 6 months" />
                <Legend className="bg-muted-foreground/50" label="Previous 6 months" dashed />
              </div>
            </div>
            {!kpiMeasured ? (
              // The honest empty state. Says which of the two possible zeros this is, and names the
              // cause, so nobody reads a blank chart as a verdict on the person.
              <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center gap-1 text-center">
                <p className="text-sm font-medium">No productive time recorded yet</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  This chart is built from activity the desktop agent classifies. Nothing has
                  been classified for this employee in the last 12 months — which is not the
                  same as a productive time of zero.
                </p>
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={220} className="flex-1">
              <AreaChart
                data={chartData}
                margin={{ top: 6, right: 8, bottom: 0, left: -16 }}
              >
                <defs>
                  <linearGradient id="kpi-current" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  dy={6}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => `${v}h`}
                />
                <Tooltip
                  cursor={{ stroke: "var(--border)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                  // A gap in the series is "not measured", and must not read as "0h".
                  formatter={(v) => (typeof v === "number" ? `${v}h` : "not measured")}
                />
                <Area
                  type="monotone"
                  dataKey="previous"
                  name="Previous 6 months"
                  stroke="var(--muted-foreground)"
                  strokeDasharray="5 5"
                  strokeOpacity={0.55}
                  strokeWidth={2}
                  fill="transparent"
                  dot={false}
                  activeDot={false}
                />
                <Area
                  type="monotone"
                  dataKey="current"
                  name="Last 6 months"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#kpi-current)"
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- atoms -------------------------------- */

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.7rem] font-medium tracking-wide text-muted-foreground/70 uppercase">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium" title={value}>
        {dash(value)}
      </dd>
    </div>
  );
}

function Legend({
  className,
  label,
  dashed,
}: {
  className: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {dashed ? (
        // Dashed swatch — mirrors the chart's dashed "previous period" stroke.
        <span className="inline-flex w-4 items-center justify-between">
          <span className={cn("h-0.5 w-1 rounded-full", className)} />
          <span className={cn("h-0.5 w-1 rounded-full", className)} />
          <span className={cn("h-0.5 w-1 rounded-full", className)} />
        </span>
      ) : (
        <span className={cn("h-0.5 w-4 rounded-full", className)} />
      )}
      {label}
    </span>
  );
}
