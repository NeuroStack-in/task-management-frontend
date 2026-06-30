"use client";

import { useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Camera,
  Mail,
  Building2,
  Users as UsersIcon,
  Clock,
  CheckSquare,
  CalendarCheck,
  ImagePlus,
  Hash,
  ShieldCheck,
  Briefcase,
  MapPin,
  TrendingUp,
  UserRound,
  Pencil,
  Lock,
  Phone,
  Cake,
  Building,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentRole } from "@/hooks/use-permissions";
import { isManagement } from "@/lib/rbac";
import { organization } from "@/lib/data";
import { initials } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { Sparkline } from "@/components/shared/sparkline";
import { Gauge } from "@/components/shared/gauge";
import { Loader } from "@/components/shared/loader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PhotoEditor } from "@/modules/profile/components/photo-editor";
import type { User } from "@/types/user";
import { cn } from "@/lib/utils";

const LOCATIONS = [
  "San Francisco, CA",
  "New York, NY",
  "Austin, TX",
  "Seattle, WA",
  "Remote",
];
const WORK_MODES = ["On-site", "Hybrid", "Remote"];

interface DetailRow {
  icon: LucideIcon;
  label: string;
  value: string;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "1994-03-14" → "Mar 14, 1994" (no Date, so no timezone drift). */
function formatDob(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** Deterministic personal facts seeded from the user id (no randomness). */
function personalFacts(user: User) {
  const seed = [...user.id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    seed,
    avgHours: (7 + (seed % 20) / 10).toFixed(1),
    tasksDone: 40 + (seed % 60),
    attendance: 88 + (seed % 12),
    location: LOCATIONS[seed % LOCATIONS.length],
    workMode: WORK_MODES[seed % WORK_MODES.length],
    employeeId: `EMP-${String(1000 + (seed % 9000))}`,
    phone: `+1 (${200 + (seed % 700)}) 555-${String(1000 + (seed % 9000))}`,
    dobISO: `${1985 + (seed % 15)}-${pad((seed % 12) + 1)}-${pad((seed % 27) + 1)}`,
  };
}

export function ProfileView() {
  const user = useAuthStore((s) => s.user);
  const role = useCurrentRole();

  if (!user) return <Loader label="Loading profile…" />;

  return isManagement(role) ? (
    <ManagerProfile user={user} roleName={role?.name ?? "—"} />
  ) : (
    <EmployeeProfile user={user} roleName={role?.name ?? "—"} />
  );
}

/* ──────────────────────────── Employee ──────────────────────────── */

/**
 * The employee's own profile — a single compact card: personal details in one
 * section plus the org-managed Employment block. Editing happens in a dialog,
 * and the photo is changed by clicking the avatar. No banner, no productivity or
 * attendance widgets — minimal, fits on screen.
 */
function EmployeeProfile({ user, roleName }: { user: User; roleName: string }) {
  const updateUser = useAuthStore((s) => s.updateUser);
  const facts = personalFacts(user);
  const fileRef = useRef<HTMLInputElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  // Fields with no backing user record yet live here (self-edited, in-session).
  const [local, setLocal] = useState({
    phone: facts.phone,
    dob: facts.dobISO,
    location: facts.location,
    workMode: facts.workMode,
  });
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: facts.phone,
    dob: facts.dobISO,
    location: facts.location,
    workMode: facts.workMode,
  });
  // Pending photo: undefined = unchanged, string = new data URL, null = removed.
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const set = (k: keyof typeof form) => (v: string) =>
    setForm((s) => ({ ...s, [k]: v }));

  const openEdit = () => {
    setForm({
      name: user.name,
      email: user.email,
      phone: local.phone,
      dob: local.dob,
      location: local.location,
      workMode: local.workMode,
    });
    setPhoto(undefined);
    setEditOpen(true);
  };
  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };
  const save = () => {
    const patch: Partial<User> = {
      name: form.name.trim() || user.name,
      email: form.email.trim() || user.email,
    };
    if (photo !== undefined) patch.avatarUrl = photo ?? undefined;
    updateUser(patch);
    setLocal({
      phone: form.phone,
      dob: form.dob,
      location: form.location,
      workMode: form.workMode,
    });
    setEditOpen(false);
  };

  // Avatar shown inside the dialog reflects the pending choice.
  const previewSrc = photo === undefined ? user.avatarUrl : (photo ?? undefined);

  const personal: DetailRow[] = [
    { icon: UserRound, label: "Full name", value: user.name },
    { icon: Mail, label: "Email", value: user.email },
    { icon: Phone, label: "Contact number", value: local.phone },
    { icon: Cake, label: "Date of birth", value: formatDob(local.dob) },
    { icon: MapPin, label: "Location", value: local.location },
    { icon: Briefcase, label: "Work mode", value: local.workMode },
  ];
  const organization_: DetailRow[] = [
    { icon: Building, label: "Organization", value: organization.name },
    { icon: Briefcase, label: "Job title", value: user.jobTitle },
    { icon: Building2, label: "Department", value: user.department },
    { icon: UsersIcon, label: "Team", value: user.team },
    { icon: ShieldCheck, label: "Role", value: roleName },
    { icon: Hash, label: "Employee ID", value: facts.employeeId },
    { icon: CalendarCheck, label: "Member since", value: "Jan 2024" },
  ];

  return (
    <div className="flex flex-col gap-5 pb-2">
      <PageHeader title="Profile" description="Your account and personal details." />

      <Card
        className="animate-in fade-in slide-in-from-bottom-3 p-6 duration-500 sm:p-7"
        style={{ animationFillMode: "backwards" } as CSSProperties}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <h3 className="font-heading text-base font-medium">Account details</h3>
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="size-4" /> Edit profile
          </Button>
        </div>

        {/* Personal: big avatar left, two-column details right */}
        <div className="grid gap-8 sm:grid-cols-[auto_1fr] sm:gap-10">
          <div className="flex flex-col items-center gap-3 sm:pr-2">
            <button
              type="button"
              onClick={openEdit}
              className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Change profile photo"
            >
              <Avatar className="size-32 ring-2 ring-border ring-offset-2 ring-offset-background sm:size-36">
                <AvatarImage src={user.avatarUrl} alt={user.name} />
                <AvatarFallback className="text-4xl font-semibold">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="size-6 text-white" />
              </span>
            </button>
            <button
              type="button"
              onClick={openEdit}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              <ImagePlus className="size-3.5" /> Change photo
            </button>
          </div>

          <div className="min-w-0 sm:border-l sm:border-border/70 sm:pl-10">
            <GroupLabel>Personal details</GroupLabel>
            <dl className="grid gap-x-10 gap-y-3.5 sm:grid-cols-2">
              {personal.map((d) => (
                <InfoRow key={d.label} {...d} />
              ))}
            </dl>
          </div>
        </div>

        <div className="my-5 h-px bg-border" />

        {/* Organization details — org-managed (lock only here) */}
        <GroupLabel>
          Organization details
          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-normal normal-case tracking-normal text-muted-foreground/80">
            <Lock className="size-3" /> managed by your organization
          </span>
        </GroupLabel>
        <dl className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
          {organization_.map((d) => (
            <InfoRow key={d.label} muted {...d} />
          ))}
        </dl>
      </Card>

      {/* Edit dialog — photo + fields */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
          </DialogHeader>

          {/* Photo */}
          <div className="flex items-center gap-4">
            <Avatar className="size-16 ring-2 ring-border">
              <AvatarImage src={previewSrc} alt="" />
              <AvatarFallback className="text-lg font-semibold">
                {initials(form.name || user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="size-4" /> Change photo
                </Button>
                {previewSrc ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPhoto(null)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPG or GIF, up to 10 MB.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={onPickPhoto}
            />
          </div>

          <div className="h-px bg-border" />

          {/* Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <DialogField label="Full name">
              <Input value={form.name} onChange={(e) => set("name")(e.target.value)} />
            </DialogField>
            <DialogField label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email")(e.target.value)}
              />
            </DialogField>
            <DialogField label="Contact number">
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone")(e.target.value)}
              />
            </DialogField>
            <DialogField label="Date of birth">
              <Input
                type="date"
                value={form.dob}
                onChange={(e) => set("dob")(e.target.value)}
              />
            </DialogField>
            <DialogField label="Location">
              <Input value={form.location} onChange={(e) => set("location")(e.target.value)} />
            </DialogField>
            <DialogField label="Work mode">
              <Select value={form.workMode} onValueChange={(v) => set("workMode")(v as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DialogField>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 flex items-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </p>
  );
}

/** A read-only detail row. `muted` uses the neutral chip (org-managed fields). */
function InfoRow({
  icon: Icon,
  label,
  value,
  muted,
}: DetailRow & { muted?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          muted ? "bg-muted text-muted-foreground" : "bg-feature-tint text-primary",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="truncate text-sm font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function DialogField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

/* ──────────────────────────── Management ──────────────────────────── */

/** Richer profile for oversight roles — identity + productivity + attendance. */
function ManagerProfile({ user, roleName }: { user: User; roleName: string }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const facts = personalFacts(user);
  const productivity = user.productivityScore;

  const presentDays = Math.round((facts.attendance / 100) * 30);
  const lateDays = Math.round((30 - presentDays) * 0.6);
  const absentDays = Math.max(0, 30 - presentDays - lateDays);
  const prodTrend = [62, 65, 63, 70, 72, 69, productivity];

  const contact: DetailRow[] = [
    { icon: Mail, label: "Email", value: user.email },
    { icon: MapPin, label: "Location", value: facts.location },
    { icon: Briefcase, label: "Work mode", value: facts.workMode },
  ];
  const employment: DetailRow[] = [
    { icon: Hash, label: "Employee ID", value: facts.employeeId },
    { icon: Building2, label: "Department", value: user.department },
    { icon: UsersIcon, label: "Team", value: user.team },
    { icon: ShieldCheck, label: "Role", value: roleName },
    { icon: CalendarCheck, label: "Member since", value: "Jan 2024" },
  ];

  return (
    <div className="flex flex-col gap-5 pb-2">
      <PageHeader
        title="Profile"
        description="Your account, role, and personal productivity."
      />

      {/* Hero identity band */}
      <section
        className="relative overflow-hidden rounded-2xl bg-feature p-6 text-feature-foreground shadow-soft animate-in fade-in slide-in-from-bottom-3 duration-500 sm:p-7"
        style={{ animationFillMode: "backwards" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(130% 120% at 12% -10%, rgb(255 255 255 / 0.18), transparent 55%), radial-gradient(90% 120% at 100% 120%, rgb(0 0 0 / 0.22), transparent 60%)",
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-[0.14]">
          <Sparkline
            data={[18, 42, 30, 58, 40, 72, 55, 84, 66, 92]}
            area
            height={120}
            strokeWidth={2}
            className="text-white"
          />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="group relative shrink-0">
              <Avatar className="size-24 ring-4 ring-white/25">
                <AvatarImage src={user.avatarUrl} alt={user.name} />
                <AvatarFallback className="bg-white/15 text-2xl font-semibold text-white">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                  aria-label="Edit profile photo"
                >
                  <Camera className="size-5 text-white drop-shadow" />
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start" sideOffset={8} className="min-w-44">
                  <DropdownMenuItem onClick={() => setUploadOpen(true)}>
                    <ImagePlus className="size-4" />
                    {user.avatarUrl ? "Replace photo" : "Upload photo"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="min-w-0 space-y-2">
              <div>
                <h2 className="font-display text-[1.7rem] font-semibold leading-tight tracking-tight">
                  {user.name}
                </h2>
                <p className="text-sm text-feature-foreground/80">
                  {user.jobTitle} · {user.department} · {user.team}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-white/20 bg-white/15 text-white">{roleName}</Badge>
                <Badge className="border-white/20 bg-white/15 capitalize text-white">
                  <span className="mr-1 inline-block size-1.5 rounded-full bg-white" />
                  {user.status}
                </Badge>
              </div>
            </div>
          </div>

          <div className="shrink-0 rounded-xl bg-white/10 p-4 ring-1 ring-inset ring-white/15 backdrop-blur-sm sm:min-w-60">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-feature-foreground/75">
                  <TrendingUp className="size-3.5" /> Productivity
                </p>
                <p className="mt-1 font-display text-4xl font-semibold leading-none tabular-nums">
                  {productivity}%
                </p>
                <p className="mt-1 text-xs text-feature-foreground/70">this week</p>
              </div>
              <Sparkline
                data={prodTrend}
                area
                showDot
                width={92}
                height={48}
                strokeWidth={2}
                className="text-white"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card
          className="animate-in fade-in slide-in-from-bottom-3 p-6 duration-500 sm:p-7"
          style={{ animationDelay: "80ms", animationFillMode: "backwards" } as CSSProperties}
        >
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-heading text-base font-medium">Account details</h3>
            <span className="font-mono text-xs text-muted-foreground">{facts.employeeId}</span>
          </div>
          <ManagerGroup label="Contact" rows={contact} />
          <div className="my-5 h-px bg-border" />
          <ManagerGroup label="Employment" rows={employment} />
        </Card>

        <Card
          className="animate-in fade-in slide-in-from-bottom-3 flex flex-col gap-5 p-6 duration-500 sm:p-7"
          style={{ animationDelay: "160ms", animationFillMode: "backwards" } as CSSProperties}
        >
          <div className="flex items-baseline justify-between">
            <h3 className="font-heading text-base font-medium">Attendance</h3>
            <span className="text-xs text-muted-foreground">last 30 days</span>
          </div>
          <div className="flex justify-center">
            <Gauge value={facts.attendance} label="present" size={168} />
          </div>
          <div className="space-y-3">
            <div className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-muted">
              <span className="bg-success" style={{ width: `${(presentDays / 30) * 100}%` }} />
              <span className="bg-warning" style={{ width: `${(lateDays / 30) * 100}%` }} />
              <span className="bg-destructive" style={{ width: `${(absentDays / 30) * 100}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Present", value: presentDays, tone: "bg-success", text: "text-success" },
                { label: "Late", value: lateDays, tone: "bg-warning", text: "text-warning" },
                { label: "Absent", value: absentDays, tone: "bg-destructive", text: "text-destructive" },
              ].map((s) => (
                <div key={s.label}>
                  <p className={cn("text-lg font-semibold tabular-nums", s.text)}>{s.value}</p>
                  <span className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn("size-1.5 rounded-full", s.tone)} />
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="h-px bg-border" />
          <div className="grid grid-cols-2 gap-3">
            <MiniStat icon={Clock} label="Avg. hours / day" value={facts.avgHours} hint="last 30 days" />
            <MiniStat icon={CheckSquare} label="Tasks done" value={String(facts.tasksDone)} hint="this quarter" />
          </div>
        </Card>
      </div>

      <PhotoEditor open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}

function ManagerGroup({ label, rows }: { label: string; rows: DetailRow[] }) {
  return (
    <div>
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {rows.map((d) => (
          <div
            key={d.label}
            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-feature-tint text-primary">
              <d.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {d.label}
              </dt>
              <dd className="truncate text-sm font-medium text-foreground">{d.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="truncate text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
