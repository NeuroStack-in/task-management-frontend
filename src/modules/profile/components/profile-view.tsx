"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Camera,
  Mail,
  Building,
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
  Phone,
  Cake,
  Pencil,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentRole } from "@/hooks/use-permissions";
import { initials } from "@/lib/format";
import { isEmail, isWithinSize, MB } from "@/lib/validation";
import { PageHeader } from "@/components/shared/page-header";
import { Sparkline } from "@/components/shared/sparkline";
import {
  BannerBackground,
  BannerPatternPicker,
  type BannerPattern,
} from "@/components/shared/banner-pattern";
import { Gauge } from "@/components/shared/gauge";
import { Loader } from "@/components/shared/loader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PhotoEditor } from "@/modules/profile/components/photo-editor";
import { getOrg } from "@/modules/settings/services/org.service";
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

  // One unified profile pattern for every role — identity hero, productivity,
  // and (for tracked roles) attendance. Org leadership (Owner/Admin/HR/Finance)
  // aren't time-tracked, so the personal attendance card is dropped for them.
  const showAttendance = role?.scope !== "org";
  return (
    <RichProfile
      user={user}
      roleName={role?.name ?? "—"}
      showAttendance={showAttendance}
    />
  );
}

/* ──────────────────────────── Profile ──────────────────────────── */

/** The full profile — identity band + productivity + (optionally) attendance.
 *  Personal details are editable in-session via the Edit profile dialog. */
function RichProfile({
  user,
  roleName,
  showAttendance,
}: {
  user: User;
  roleName: string;
  showAttendance: boolean;
}) {
  const updateUser = useAuthStore((s) => s.updateUser);
  const [uploadOpen, setUploadOpen] = useState(false);
  // Temporary control to preview the banner patterns.
  const [pattern, setPattern] = useState<BannerPattern>("grid");
  const facts = personalFacts(user);
  const productivity = user.productivityScore;

  // The org's display name (GET /v1/org). Absent/failed (e.g. 404) → omit gracefully, never a placeholder.
  const [orgName, setOrgName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getOrg()
      .then((org) => {
        if (alive) setOrgName(org.name?.trim() || null);
      })
      .catch(() => {
        // No read / not provisioned → simply don't show an organization row.
      });
    return () => {
      alive = false;
    };
  }, []);

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
    if (!isWithinSize(file, 10 * MB)) {
      toast.error("Image must be 10 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };
  const save = () => {
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name) {
      toast.error("Name can't be empty.");
      return;
    }
    if (!isEmail(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    const patch: Partial<User> = { name, email };
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

  const presentDays = Math.round((facts.attendance / 100) * 30);
  const lateDays = Math.round((30 - presentDays) * 0.6);
  const absentDays = Math.max(0, 30 - presentDays - lateDays);
  const prodTrend = [62, 65, 63, 70, 72, 69, productivity];

  const contact: DetailRow[] = [
    { icon: Mail, label: "Email", value: user.email },
    { icon: Phone, label: "Contact number", value: local.phone },
    { icon: Cake, label: "Date of birth", value: formatDob(local.dob) },
    { icon: MapPin, label: "Location", value: local.location },
    { icon: Building, label: "Work mode", value: local.workMode },
  ];
  const employment: DetailRow[] = [
    { icon: Hash, label: "Employee ID", value: facts.employeeId },
    ...(orgName
      ? [{ icon: Building2, label: "Organization", value: orgName }]
      : []),
    { icon: Briefcase, label: "Job title", value: user.jobTitle },
    { icon: Building2, label: "Department", value: user.department },
    { icon: UsersIcon, label: "Team", value: user.team },
    { icon: ShieldCheck, label: "Role", value: roleName },
    { icon: CalendarCheck, label: "Member since", value: "Jan 2024" },
  ];
  const onTime =
    presentDays + lateDays > 0
      ? Math.round((presentDays / (presentDays + lateDays)) * 100)
      : 100;

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
        <BannerBackground pattern={pattern} />
        <BannerPatternPicker value={pattern} onChange={setPattern} />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="group relative shrink-0">
              <Avatar className="size-24 ring-4 ring-white/25">
                <AvatarImage src={user.avatarUrl} alt={user.name} />
                <AvatarFallback className="text-2xl">
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
                areaOpacity={0.3}
                showDot
                width={104}
                height={56}
                strokeWidth={2.5}
                className="text-white"
              />
            </div>
          </div>
        </div>
      </section>

      <div
        className={cn(
          "grid gap-5",
          showAttendance && "lg:grid-cols-[1.6fr_1fr]",
        )}
      >
        <Card
          className="animate-in fade-in slide-in-from-bottom-3 p-6 duration-500 sm:p-7 [--card-spacing:--spacing(3)]"
          style={{ animationDelay: "80ms", animationFillMode: "backwards" } as CSSProperties}
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="font-heading text-base font-medium">Account details</h3>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground">{facts.employeeId}</span>
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="size-4" /> Edit profile
              </Button>
            </div>
          </div>
          <ManagerGroup label="Contact" rows={contact} />
          <div className="my-5 h-px bg-border" />
          <ManagerGroup label="Employment" rows={employment} />
        </Card>

        {showAttendance ? (
          <Card
            className="animate-in fade-in slide-in-from-bottom-3 flex flex-col gap-5 p-6 duration-500 sm:p-7 [--card-spacing:--spacing(3)]"
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
              <MiniStat icon={CalendarCheck} label="On-time rate" value={`${onTime}%`} hint="last 30 days" />
              <MiniStat icon={TrendingUp} label="Productivity" value={`${productivity}%`} hint="this week" />
            </div>
          </Card>
        ) : null}
      </div>

      {/* Edit dialog — photo + personal fields (available to every role) */}
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
