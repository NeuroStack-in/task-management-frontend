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
  Trash2,
  Hash,
  ShieldCheck,
  Briefcase,
  MapPin,
  Phone,
  Cake,
  ListTodo,
  Pencil,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentRole } from "@/hooks/use-permissions";
import { initials, todayIso } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { ApiError } from "@/lib/api";
import {
  getAvatarUrl,
  getMyProfile,
  updateMyProfile,
  uploadAvatar,
  type ApiMyFullProfile,
  type UpdateMyProfileBody,
} from "@/modules/profile/services/profile.service";
import { getMyAttendance } from "@/modules/attendance/services/attendance.service";
import { getRange, todayLocal } from "@/modules/time-tracking/services/timesheet.service";
import { listMyTasks } from "@/modules/projects/services/projects.service";
import { departmentMap, teamMap } from "@/modules/employees/services/employees.service";
import { PageHeader } from "@/components/shared/page-header";
import { BannerBackground } from "@/components/shared/banner-pattern";
import { Gauge } from "@/components/shared/gauge";
import { Loader } from "@/components/shared/loader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { DatePicker } from "@/components/ui/date-picker";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhotoEditor } from "@/modules/profile/components/photo-editor";
import { getOrg } from "@/modules/settings/services/org.service";
import type { User } from "@/types/user";
import { cn } from "@/lib/utils";

interface DetailRow {
  icon: LucideIcon;
  label: string;
  value: string;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Epoch ms → "Jul 2026" — the honest "member since", from the account's real creation time. */
function memberSince(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "1994-03-14" → "Mar 14, 1994" (string math, no Date — no timezone drift). */
function formatDob(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** The server's `work_mode` enum, with display labels. */
const WORK_MODES = [
  { value: "on-site", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
] as const;

/** The work-mode picker's "Not set" — Base UI's Select can't carry `""` as an item value. */
const WORK_MODE_UNSET = "__none__";

const workModeLabel = (v: string | undefined) =>
  WORK_MODES.find((m) => m.value === v)?.label ?? "—";

/** Local `YYYY-MM-DD` for `daysAgo` days back — same calendar rule as `todayLocal`. */
function dayLocal(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return todayLocal(d);
}

/**
 * The real last-30-days stats, each independently best-effort. Everything here used to be
 * *fabricated from a hash of the user id* (`personalFacts`) — plausible-looking numbers that
 * contradicted the admin's Employees page, which reads the live API. Now both screens read the
 * same backend; a failed or empty read renders "—", never an invented value.
 */
function useMyStats() {
  const [attendance, setAttendance] = useState<{
    present: number;
    partial: number;
    absent: number;
    rate: number | null;
  } | null>(null);
  const [avgHours, setAvgHours] = useState<string | null>(null);
  const [tasks, setTasks] = useState<{ open: number; done: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const from = dayLocal(29);
    const to = todayLocal();

    getMyAttendance(from, to)
      .then((r) => {
        if (!alive) return;
        const s = r.summary;
        // The rate counts every worked/on-leave day against the days that could have been worked
        // (`counted` excludes non-workdays).
        //
        // The breakdown below reports **statuses**, so it takes `partial` — not `late`. `late` is a
        // *qualifier on a present day* (LLD §7: five statuses, and late is not one of them), so
        // showing it beside Present double-counted the same day in two tiles and left genuinely
        // partial days — worked, but under `min_present_minutes` — invisible.
        const rate =
          s.counted > 0
            ? Math.round(((s.present + s.partial + s.leave) / s.counted) * 100)
            : null;
        setAttendance({
          present: s.present,
          partial: s.partial,
          absent: s.absent,
          rate,
        });
      })
      .catch(() => {
        /* card shows its empty state */
      });

    getRange(from, to)
      .then((r) => {
        if (!alive) return;
        const workedDays = r.days.filter((d) => d.total_secs > 0).length;
        setAvgHours(
          workedDays > 0 ? (r.total_secs / 3600 / workedDays).toFixed(1) : null,
        );
      })
      .catch(() => {
        /* tile shows "—" */
      });

    listMyTasks()
      .then((ts) => {
        if (!alive) return;
        const done = ts.filter((t) => t.status === "done").length;
        setTasks({ open: ts.length - done, done });
      })
      .catch(() => {
        /* tiles show "—" */
      });

    return () => {
      alive = false;
    };
  }, []);

  return { attendance, avgHours, tasks };
}

export function ProfileView() {
  const user = useAuthStore((s) => s.user);
  const role = useCurrentRole();

  if (!user) return <Loader label="Loading profile…" />;

  // One unified profile pattern for every role — identity hero, productivity, and (for tracked
  // roles) the time-based panels. Org leadership (Owner/Admin/HR/Finance) aren't time-tracked, so
  // both the attendance card **and** the "avg. hours / day" tile are dropped for them: neither can
  // ever be anything but a dash, and an owner's profile led with an empty statistic reading "no
  // tracked time yet" as though something were missing.
  //
  // Scope, not role name: a team-scoped Manager still tracks their own time and keeps both.
  const tracksTime = role?.scope !== "org";
  return <RichProfile user={user} roleName={role?.name ?? "—"} tracksTime={tracksTime} />;
}

/* ──────────────────────────── Profile ──────────────────────────── */

/** The full profile — identity band + productivity + (optionally) attendance.
 *  Identity comes from `GET /v1/me/profile`; edits persist via `PATCH /v1/me/profile`. */
function RichProfile({
  user,
  roleName,
  tracksTime,
}: {
  user: User;
  roleName: string;
  /** Whether this role logs time at all — gates every panel built from tracked hours. */
  tracksTime: boolean;
}) {
  const updateUser = useAuthStore((s) => s.updateUser);
  const [uploadOpen, setUploadOpen] = useState(false);

  // The profile carries `department_id`/`team_id` (raw `dept-…`/`team-…` ULIDs) — never show those.
  // Resolve them to names the same way the Employees pages do; leave blank on miss so the "—"
  // placeholder shows rather than an id.
  const [deptName, setDeptName] = useState("");
  const [teamName, setTeamName] = useState("");

  // Real avatar (`GET /v1/me/avatar`) — presigned view URLs expire, so never trust a stored one:
  // re-fetch on mount and push the fresh URL into the auth store (the navbar reads it from there).
  useEffect(() => {
    let alive = true;
    getAvatarUrl()
      .then((url) => {
        if (alive) updateUser({ avatarUrl: url ?? undefined });
      })
      .catch(() => {
        /* transient — keep the current avatar */
      });
    return () => {
      alive = false;
    };
  }, [updateUser]);

  // The stored profile (`GET /v1/me/profile`) — emp id, phone, location, title, department, team,
  // member-since. This is the same `USER#` record the admin's Employees page reads, which is what
  // keeps the two screens agreeing. `null` until loaded; absent fields render "—".
  const [profile, setProfile] = useState<ApiMyFullProfile | null>(null);
  /**
   * The read failed. Said, with a retry: swallowed, every field read "—", indistinguishable from an
   * empty profile — and a later save never showed, since the patch only applies to a loaded one
   * (QA audit 2026-10-08, WP-524).
   */
  const [profileFailed, setProfileFailed] = useState(false);
  const [profileAttempt, setProfileAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setProfileFailed(false);
    getMyProfile()
      .then((p) => {
        if (!alive) return;
        setProfile(p);
        // The store's name may be derived from the email at login; the stored one is authoritative.
        if (p.name && p.name !== user.name) updateUser({ name: p.name });
      })
      .catch(() => {
        // Identity rows still fall back to token facts + "—", now under a notice that says why.
        if (alive) setProfileFailed(true);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per mount (and per retry)
  }, [profileAttempt]);

  // Resolve the profile's department/team ids → names (best-effort; blank on miss, never the id).
  useEffect(() => {
    let alive = true;
    const deptId = profile?.department_id;
    const teamId = profile?.team_id;
    // Only resolve client-side when the server didn't already provide the name — an Employee viewing
    // their own profile 403s on `GET /v1/departments`, so calling it when `department_name` is present
    // is both wasteful and pointless.
    if (deptId && !profile?.department_name) {
      departmentMap()
        .then((m) => alive && setDeptName(m.get(deptId) ?? ""))
        .catch(() => {});
    } else setDeptName("");
    if (teamId && !profile?.team_name) {
      teamMap()
        .then((m) => alive && setTeamName(m.get(teamId) ?? ""))
        .catch(() => {});
    } else setTeamName("");
    return () => {
      alive = false;
    };
  }, [
    profile?.department_id,
    profile?.team_id,
    profile?.department_name,
    profile?.team_name,
  ]);

  const stats = useMyStats();

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

  // The edit dialog's own cropper. Separate from `uploadOpen` (the hero menu's) because the two
  // differ in what they do with the result: the hero uploads immediately, this one STAGES the file
  // so it lands with the rest of the form on Save. Sharing one flag would have quietly turned the
  // dialog's staged edit into an instant write.
  const [cropOpen, setCropOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Values shown when the edit dialog opened — the diff baseline, so only changes are PATCHed.
  const baseline = useRef({
    name: user.name,
    phone: "",
    location: "",
    dob: "",
    workMode: "",
  });
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: "",
    location: "",
    dob: "",
    workMode: "",
  });
  // Pending photo: undefined = unchanged, {file, preview} = new pick (uploaded on save),
  // null = removed. The data URL is preview-only — the File is what gets uploaded.
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null | undefined>(
    undefined,
  );
  const set = (k: keyof typeof form) => (v: string) => setForm((s) => ({ ...s, [k]: v }));

  const openEdit = () => {
    const phone = profile?.phone ?? "";
    const location = profile?.location ?? "";
    const dob = profile?.date_of_birth ?? "";
    const workMode = profile?.work_mode ?? "";
    baseline.current = { name: user.name, phone, location, dob, workMode };
    setForm({ name: user.name, email: user.email, phone, location, dob, workMode });
    setPhoto(undefined);
    setEditOpen(true);
  };
  const save = async () => {
    const name = form.name.trim();
    const phone = form.phone.trim();
    const location = form.location.trim();
    const dob = form.dob.trim();
    const workMode = form.workMode.trim();
    if (!name) {
      toast.error("Name can't be empty.");
      return;
    }
    // Persist changed backend-backed fields via `PATCH /v1/me/profile` — omitted keeps, "" clears.
    const body: UpdateMyProfileBody = {};
    if (name !== baseline.current.name) body.name = name;
    if (phone !== baseline.current.phone) body.phone = phone;
    if (location !== baseline.current.location) body.location = location;
    if (dob !== baseline.current.dob) body.date_of_birth = dob;
    if (workMode !== baseline.current.workMode) body.work_mode = workMode;
    // Photo removed → clear `avatar_s3_key` ("" clears, per the PATCH contract).
    if (photo === null) body.avatar_s3_key = "";
    if (Object.keys(body).length > 0) {
      setSaving(true);
      try {
        const p = await updateMyProfile(body);
        updateUser({ name: p.name });
        // Only what was sent (the PATCH echo carries name/phone/location; the other two are ours).
        // Patching every field from the form blanked a stored date of birth and work mode on screen
        // when the dialog had opened before the profile loaded and only the name changed (WP-524).
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                name: p.name,
                phone: p.phone,
                location: p.location,
                ...("date_of_birth" in body
                  ? { date_of_birth: body.date_of_birth || undefined }
                  : {}),
                ...("work_mode" in body
                  ? { work_mode: body.work_mode || undefined }
                  : {}),
              }
            : prev,
        );
        // The profile never loaded: read it now, so the saved values show instead of "—".
        if (!profile) setProfileAttempt((n) => n + 1);
        if (photo === null) updateUser({ avatarUrl: undefined });
        toast.success("Profile updated");
      } catch (e) {
        toast.error("Couldn't update profile", {
          description:
            e instanceof ApiError ? e.message : "The server rejected the change.",
        });
        setSaving(false);
        return; // keep the dialog open so nothing looks saved when it wasn't
      }
      setSaving(false);
    }
    // New photo → the real flow: resize/WebP → presigned PUT → PATCH avatar_s3_key → fresh view
    // URL into the auth store (navbar + hero read it from there).
    if (photo) {
      setSaving(true);
      try {
        const freshUrl = await uploadAvatar(photo.file);
        updateUser({ avatarUrl: freshUrl ?? undefined });
        toast.success("Profile photo updated");
      } catch (e) {
        toast.error("Couldn't upload photo", {
          description: friendlyError(
            e,
            "The upload didn't finish. Try again with a smaller image.",
          ),
        });
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    setEditOpen(false);
  };

  // Avatar shown inside the dialog reflects the pending choice.
  const previewSrc = photo === undefined ? user.avatarUrl : (photo?.preview ?? undefined);

  // Standalone upload dialog (hero dropdown) — same real flow, progress via toast.promise.
  const onUploadPhoto = (file: File) => {
    void toast.promise(
      uploadAvatar(file).then((freshUrl) =>
        updateUser({ avatarUrl: freshUrl ?? undefined }),
      ),
      {
        loading: "Uploading photo…",
        success: "Profile photo updated",
        error: (e: unknown) => friendlyError(e, "Couldn't upload the photo. Try again."),
      },
    );
  };

  /**
   * Remove the photo from the hero menu — a real save, not a staged edit.
   *
   * The staged `setPhoto(null)` in the edit dialog only takes effect when that form is submitted;
   * the hero menu has no submit, so it PATCHes directly. `avatar_s3_key: ""` is the documented
   * clear (`set_or_clear` in identity::update_my_profile removes the attribute on an empty string) —
   * sending `undefined` would mean "leave it alone" and silently do nothing.
   */
  const onRemovePhoto = () => {
    void toast.promise(
      updateMyProfile({ avatar_s3_key: "" }).then(() =>
        updateUser({ avatarUrl: undefined }),
      ),
      {
        loading: "Removing photo…",
        success: "Profile photo removed",
        error: (e: unknown) => friendlyError(e, "Couldn't remove the photo. Try again."),
      },
    );
  };

  const dash = (v: string | undefined | null) => v?.trim() || "—";
  const empId = dash(profile?.emp_id);
  const jobTitle = profile?.title ?? user.jobTitle;
  // Names, never the raw `department_id`/`team_id`. Prefer the server-resolved names (which work
  // for a self-viewing Employee, who can't read the org-wide department/team lists); fall back to
  // the client-side `departmentMap()` resolution, then the token's already-a-name `user.*`.
  const department = profile?.department_name || deptName || user.department;
  const team = profile?.team_name || teamName || user.team;

  const contact: DetailRow[] = [
    { icon: Mail, label: "Email", value: user.email },
    { icon: Phone, label: "Contact number", value: dash(profile?.phone) },
    {
      icon: Cake,
      label: "Date of birth",
      value: profile?.date_of_birth ? formatDob(profile.date_of_birth) : "—",
    },
    { icon: MapPin, label: "Location", value: dash(profile?.location) },
    { icon: Building, label: "Work mode", value: workModeLabel(profile?.work_mode) },
  ];
  const employment: DetailRow[] = [
    { icon: Hash, label: "Employee ID", value: empId },
    ...(orgName ? [{ icon: Building2, label: "Organization", value: orgName }] : []),
    { icon: Briefcase, label: "Job title", value: dash(jobTitle) },
    { icon: Building2, label: "Department", value: dash(department) },
    { icon: UsersIcon, label: "Team", value: dash(team) },
    { icon: ShieldCheck, label: "Role", value: roleName },
    {
      icon: CalendarCheck,
      label: "Member since",
      value: profile?.created_at ? memberSince(profile.created_at) : "—",
    },
  ];

  // The identity subtitle only names what the org actually recorded — no placeholder words.
  const subtitle = [jobTitle, department, team].filter((v) => v?.trim()).join(" · ");

  return (
    <div className="flex flex-col gap-5 pb-2">
      <PageHeader
        title="Profile"
        description="Your account, role, and personal productivity."
      />

      {profileFailed ? (
        <div
          role="status"
          className="border-warning/40 bg-warning/10 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-sm"
        >
          <span>
            Your profile details couldn&apos;t be loaded, so fields below may show “—”.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setProfileAttempt((n) => n + 1)}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {/* Hero identity band */}
      <section
        className="bg-feature text-feature-foreground shadow-soft animate-in fade-in slide-in-from-bottom-3 relative overflow-hidden rounded-2xl p-6 duration-500 sm:p-7"
        style={{ animationFillMode: "backwards" }}
      >
        {/* Grid lines. The pattern is fixed rather than pickable: `BannerPatternPicker` was a
            temporary preview control, not a product feature. The `"dots"` variant is deliberately
            KEPT in `components/shared/banner-pattern.tsx`; to switch, change the literal below. */}
        <BannerBackground pattern="grid" />

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
                <DropdownMenuContent
                  side="bottom"
                  align="start"
                  sideOffset={8}
                  className="min-w-44"
                >
                  <DropdownMenuItem onClick={() => setUploadOpen(true)}>
                    <ImagePlus className="size-4" />
                    {user.avatarUrl ? "Replace photo" : "Upload photo"}
                  </DropdownMenuItem>
                  {user.avatarUrl ? (
                    <DropdownMenuItem
                      onClick={onRemovePhoto}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      Remove photo
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="min-w-0 space-y-2">
              <div>
                <h2 className="font-display text-[1.7rem] leading-tight font-semibold tracking-tight">
                  {user.name}
                </h2>
                {subtitle ? (
                  <p className="text-feature-foreground/80 text-sm">{subtitle}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-white/20 bg-white/15 text-white">
                  {roleName}
                </Badge>
                <Badge className="border-white/20 bg-white/15 text-white capitalize">
                  <span className="mr-1 inline-block size-1.5 rounded-full bg-white" />
                  {user.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Only for roles that actually log time. An Owner or Admin has no timer, so this could
              only ever read "—  no tracked time yet" — an empty statistic given hero billing, which
              reads as broken rather than inapplicable. Same rule as the attendance card below. */}
          {tracksTime ? (
            <div className="shrink-0 rounded-xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm ring-inset sm:min-w-60">
              <p className="text-feature-foreground/75 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                <Clock className="size-3.5" /> Avg. hours / day
              </p>
              <p className="font-display mt-1 text-4xl leading-none font-semibold tabular-nums">
                {stats.avgHours ?? "—"}
              </p>
              <p className="text-feature-foreground/70 mt-1 text-xs">
                {stats.avgHours ? "tracked, last 30 days" : "no tracked time yet"}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <div className={cn("grid gap-5", tracksTime && "lg:grid-cols-[1.6fr_1fr]")}>
        <Card
          className="animate-in fade-in slide-in-from-bottom-3 p-6 duration-500 [--card-spacing:--spacing(3)] sm:p-7"
          style={
            { animationDelay: "80ms", animationFillMode: "backwards" } as CSSProperties
          }
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="font-heading text-base font-medium">Account details</h3>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground font-mono text-xs">{empId}</span>
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="size-4" /> Edit profile
              </Button>
            </div>
          </div>
          <ManagerGroup label="Contact" rows={contact} />
          <div className="bg-border my-5 h-px" />
          <ManagerGroup label="Employment" rows={employment} />
        </Card>

        {tracksTime ? (
          <Card
            className="animate-in fade-in slide-in-from-bottom-3 flex flex-col gap-5 p-6 duration-500 [--card-spacing:--spacing(3)] sm:p-7"
            style={
              { animationDelay: "160ms", animationFillMode: "backwards" } as CSSProperties
            }
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-heading text-base font-medium">Attendance</h3>
              <span className="text-muted-foreground text-xs">last 30 days</span>
            </div>
            {stats.attendance && stats.attendance.rate !== null ? (
              <>
                <div className="flex justify-center">
                  <Gauge value={stats.attendance.rate} label="present" size={168} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    {
                      label: "Present",
                      value: stats.attendance.present,
                      tone: "bg-success",
                      text: "text-success",
                      hint: "Worked a full day.",
                    },
                    {
                      label: "Partial",
                      value: stats.attendance.partial,
                      tone: "bg-warning",
                      text: "text-warning",
                      hint: "Present, but worked less than the expected hours for the day.",
                    },
                    {
                      label: "Absent",
                      value: stats.attendance.absent,
                      tone: "bg-destructive",
                      text: "text-destructive",
                      hint: "No working time recorded on a scheduled day.",
                    },
                  ].map((s) => (
                    <div key={s.label} title={s.hint}>
                      <p className={cn("text-lg font-semibold tabular-nums", s.text)}>
                        {s.value}
                      </p>
                      <span className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
                        <span className={cn("size-1.5 rounded-full", s.tone)} />
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No attendance recorded yet — days appear after the agent tracks your first
                working day.
              </p>
            )}
            <div className="bg-border h-px" />
            <div className="grid grid-cols-2 gap-3">
              <MiniStat
                icon={Clock}
                label="Avg. hours / day"
                value={stats.avgHours ?? "—"}
                hint="last 30 days"
              />
              <MiniStat
                icon={CheckSquare}
                label="Tasks done"
                value={stats.tasks ? String(stats.tasks.done) : "—"}
                hint="assigned to you"
              />
              <MiniStat
                icon={ListTodo}
                label="Open tasks"
                value={stats.tasks ? String(stats.tasks.open) : "—"}
                hint="assigned to you"
              />
              <MiniStat
                icon={TrendingUp}
                label="Attendance"
                value={
                  stats.attendance?.rate !== null && stats.attendance?.rate !== undefined
                    ? `${stats.attendance.rate}%`
                    : "—"
                }
                hint="last 30 days"
              />
            </div>
          </Card>
        ) : null}
      </div>

      {/* Edit dialog — photo + the backend-backed personal fields */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
          </DialogHeader>

          {/* Photo */}
          <div className="flex items-center gap-4">
            <Avatar className="ring-border size-16 ring-2">
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
                  // Opens the SAME cropper the hero menu uses. It used to trigger a bare
                  // `<input type=file>`, so which entry point you happened to take decided whether
                  // you could adjust the photo at all — one path cropped, the other uploaded
                  // whatever you picked and let `object-cover` centre-crop it.
                  onClick={() => setCropOpen(true)}
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
              <p className="text-muted-foreground text-xs">
                PNG, JPG or GIF, up to 10 MB.
              </p>
            </div>
            {/* No hidden file input here any more: nothing opened it, but it was still an invisible
                tab stop that staged an un-cropped file (WP-524). The cropper above is the way in. */}
          </div>

          <div className="bg-border h-px" />

          {/* Fields — exactly what `PATCH /v1/me/profile` accepts, all persisted server-side. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <DialogField label="Full name">
              <Input value={form.name} onChange={(e) => set("name")(e.target.value)} />
            </DialogField>
            <DialogField label="Email">
              {/* Sign-in identity — not self-editable (`PATCH /v1/me/profile` doesn't accept it). */}
              <Input type="email" value={form.email} disabled />
            </DialogField>
            <DialogField label="Contact number">
              <PhoneInput value={form.phone} onChange={set("phone")} />
            </DialogField>
            <DialogField label="Date of birth">
              <DatePicker
                value={form.dob}
                onChange={set("dob")}
                max={todayIso()}
                className="w-full"
              />
            </DialogField>
            <DialogField label="Location">
              <Input
                value={form.location}
                onChange={(e) => set("location")(e.target.value)}
              />
            </DialogField>
            <DialogField label="Work mode">
              {/* `items`, so the trigger shows "On-site" rather than the raw `on-site`; and a "Not
                  set" option, so a work mode can be cleared ("" clears, per the PATCH contract) —
                  once set, it couldn't be (WP-524). */}
              <Select
                value={form.workMode || WORK_MODE_UNSET}
                onValueChange={(v) =>
                  set("workMode")(v === WORK_MODE_UNSET ? "" : (v as string))
                }
                items={{
                  [WORK_MODE_UNSET]: "Not set",
                  ...Object.fromEntries(WORK_MODES.map((m) => [m.value, m.label])),
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={WORK_MODE_UNSET}>Not set</SelectItem>
                  {WORK_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DialogField>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit-dialog cropper: same component, but `onApply` STAGES rather than uploads, so the
          photo is saved with the form instead of jumping ahead of it. */}
      <PhotoEditor
        open={cropOpen}
        onClose={() => setCropOpen(false)}
        hasPhoto={Boolean(previewSrc)}
        onRemove={() => setPhoto(null)}
        onApply={(file) => {
          const reader = new FileReader();
          reader.onload = () => setPhoto({ file, preview: reader.result as string });
          reader.readAsDataURL(file);
        }}
      />

      <PhotoEditor
        onRemove={onRemovePhoto}
        hasPhoto={Boolean(user.avatarUrl)}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onApply={onUploadPhoto}
      />
    </div>
  );
}

function ManagerGroup({ label, rows }: { label: string; rows: DetailRow[] }) {
  return (
    <div>
      <p className="text-muted-foreground mb-2.5 text-[11px] font-semibold tracking-[0.12em] uppercase">
        {label}
      </p>
      {/* A `<dl>` may hold `<div>` groups whose **direct** children are `<dt>`/`<dd>`. The term and
          value sat one `<div>` deeper beside a bare icon `<span>`, which screen readers and axe read
          as a broken list (QA audit 2026-10-08, WP-116). The icon now lives inside the `<dt>`,
          positioned where it always was, and is hidden from assistive tech. */}
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {rows.map((d) => (
          <div
            key={d.label}
            className="hover:bg-muted/50 relative -mx-2 min-w-0 rounded-lg py-2 pr-2 pl-14 transition-colors"
          >
            <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              <span
                aria-hidden="true"
                className="bg-feature-tint text-primary absolute top-1/2 left-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-xl"
              >
                <d.icon className="size-4" />
              </span>
              {d.label}
            </dt>
            <dd className="text-foreground truncate text-sm font-medium">{d.value}</dd>
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
    <div className="bg-muted/30 rounded-xl border p-3.5">
      <div className="text-muted-foreground flex items-center gap-2">
        <Icon className="size-4" />
        <span className="truncate text-xs font-medium">{label}</span>
      </div>
      <p className="font-display mt-2 text-2xl leading-none font-semibold tabular-nums">
        {value}
      </p>
      <p className="text-muted-foreground mt-1.5 text-xs">{hint}</p>
    </div>
  );
}
