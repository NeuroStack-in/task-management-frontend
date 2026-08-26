"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Search, Users, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { initials, todayIso } from "@/lib/format";
import type { UserMini } from "../lib";
import type { ProjectFormValues } from "@/modules/projects/forms";

export const PROJECT_DEPARTMENTS = [
  "Engineering",
  "Product",
  "Design",
  "Sales",
  "Marketing",
  "Customer Success",
  "Finance",
  "People Ops",
] as const;

const schema = z.object({
  name: z.string().trim().min(2, "Give the project a name"),
  description: z
    .string()
    .trim()
    .max(500, "Keep it under 500 characters")
    .optional(),
  department: z.string().min(1, "Pick a department"),
  leadUserId: z.string().min(1, "Pick a lead"),
  managerId: z.string().min(1, "Pick a manager"),
  memberIds: z.array(z.string()).min(1, "Select at least one member"),
  dueDate: z.string().min(1, "Pick a deadline"),
  // Required at creation (LLD §4) — deliberately a choice with no default rather than a
  // checkbox, which would silently default every project to non-billable. Modelled as an
  // enum, not a boolean, precisely so "unanswered" is representable and fails validation.
  billable: z.enum(["yes", "no"], {
    errorMap: () => ({ message: "Choose whether this project is billable" }),
  }),
});

type FormShape = z.infer<typeof schema>;

/**
 * The schema, closed over the earliest deadline this form will accept — a deadline that has already
 * passed is not a deadline. Enforced here as well as on the picker, because the picker only stops
 * *clicking* a past day; the value can still arrive pre-filled from `initial`.
 *
 * `minDue` is normally today, but in edit mode it relaxes to a project's own already-past deadline
 * (see `minDue` below) so that editing anything *else* on an overdue project isn't blocked by it.
 */
function schemaWithMinDue(minDue: string) {
  return schema.refine((v) => !v.dueDate || v.dueDate >= minDue, {
    path: ["dueDate"],
    message: "Deadline can't be in the past",
  });
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

// `billable` is intentionally absent: it has no default, so an unanswered form fails
// validation instead of quietly creating a non-billable project (LLD §4).
const EMPTY: Omit<FormShape, "billable"> = {
  name: "",
  description: "",
  department: "",
  leadUserId: "",
  managerId: "",
  memberIds: [],
  dueDate: "",
};

import { AddFromTeam } from "./add-from-team";
import {
  listTeamMembers,
  listTeams,
  type ApiTeam,
} from "@/modules/employees/services/employees.service";

interface ProjectFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The org directory members can be picked from. */
  leads: UserMini[];
  /** Pre-fill for edit mode. */
  initial?: Partial<ProjectFormValues>;
  onSubmit: (values: ProjectFormValues) => void;
}

export function ProjectFormDialog({
  mode,
  open,
  onOpenChange,
  leads,
  initial,
  onSubmit,
}: ProjectFormDialogProps) {
  // The domain model carries `billable` as a boolean; the form as an enum, so that
  // "unanswered" is representable and a new project can't default to non-billable.
  // Convert on the way in — the submit handler converts back.
  const initialForm = useMemo(
    () =>
      initial
        ? { ...initial, billable: (initial.billable ? "yes" : "no") as "yes" | "no" }
        : undefined,
    [initial],
  );

  // The deadline floor: today, so a new project can't be created already overdue. An existing
  // project whose deadline has passed keeps its own value as the floor, so editing its other fields
  // isn't blocked by a date nobody can now change to something valid.
  const minDue = useMemo(() => {
    const t = todayIso();
    return initial?.dueDate && initial.dueDate < t ? initial.dueDate : t;
  }, [initial?.dueDate]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<FormShape>({
    resolver: zodResolver(schemaWithMinDue(minDue)),
    defaultValues: { ...EMPTY, ...initialForm },
  });

  // Re-seed the form whenever it (re)opens so edit mode reflects the latest data.
  useEffect(() => {
    if (open) reset({ ...EMPTY, ...initialForm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isEdit = mode === "edit";
  const memberIds = watch("memberIds");

  const submit = handleSubmit((data) => {
    onSubmit({
      ...data,
      description: data.description ?? "",
      // The form models this as an enum so "unanswered" can fail validation; the domain
      // model is a boolean. Map at the boundary.
      billable: data.billable === "yes",
    });
    onOpenChange(false);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset({ ...EMPTY, ...initialForm });
        onOpenChange(o);
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the project’s details, people, and timeline."
              : "Name the project, assign its people, and set a deadline."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-1">
          <Field label="Project name" error={errors.name?.message}>
            <Input
              placeholder="e.g. Atlas Migration"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
          </Field>

          <Field label="Description" error={errors.description?.message} optional>
            <textarea
              rows={3}
              placeholder="What is this project about? Goals, scope, anything worth knowing."
              aria-invalid={!!errors.description}
              className={cn(fieldClass, "h-auto resize-none py-2 leading-relaxed")}
              {...register("description")}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Project lead" error={errors.leadUserId?.message}>
              <Controller
                control={control}
                name="leadUserId"
                render={({ field }) => (
                  <PersonSelect
                    users={leads}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select lead"
                    invalid={!!errors.leadUserId}
                  />
                )}
              />
            </Field>
            <Field label="Project manager" error={errors.managerId?.message}>
              <Controller
                control={control}
                name="managerId"
                render={({ field }) => (
                  <PersonSelect
                    users={leads}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select manager"
                    invalid={!!errors.managerId}
                  />
                )}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Department" error={errors.department?.message}>
              <Controller
                control={control}
                name="department"
                render={({ field }) => (
                  <Select
                    value={field.value || null}
                    onValueChange={(v) => field.onChange(v as string)}
                  >
                    <SelectTrigger
                      className={cn("w-full", errors.department && "border-destructive")}
                    >
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Deadline" error={errors.dueDate?.message}>
              <Controller
                control={control}
                name="dueDate"
                render={({ field }) => (
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    min={minDue}
                    className={cn("w-full", errors.dueDate && "border-destructive")}
                  />
                )}
              />
            </Field>
          </div>

          <Field
            label="Billing"
            error={errors.billable?.message}
            hint="Every task inherits this. Time already logged keeps its original billing."
          >
            <Controller
              control={control}
              name="billable"
              render={({ field }) => (
                <Select
                  value={field.value || null}
                  onValueChange={(v) => field.onChange(v as string)}
                  items={{ yes: "Billable", no: "Non-billable" }}
                >
                  <SelectTrigger
                    className={cn("w-full", errors.billable && "border-destructive")}
                  >
                    <SelectValue placeholder="Billable or non-billable?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Billable</SelectItem>
                    <SelectItem value="no">Non-billable</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field
            label={`Team members${memberIds.length ? ` (${memberIds.length})` : ""}`}
            error={errors.memberIds?.message}
          >
            {/* Snapshot a whole team in: adds its current members to the list below (union — nobody
                already picked is duplicated or removed). A one-time add, not a live link, so later
                team changes don't touch this project. */}
            <AddFromTeam
              knownUserIds={new Set(leads.map((l) => l.id))}
              onAdd={(ids) =>
                setValue(
                  "memberIds",
                  Array.from(new Set([...memberIds, ...ids])),
                  { shouldValidate: true },
                )
              }
            />
            <MemberMultiSelect
              users={leads}
              value={memberIds}
              onChange={(ids) =>
                setValue("memberIds", ids, { shouldValidate: true })
              }
            />
          </Field>

          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {isEdit ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------- member multi-select ------------------------- */

/**
 * The whole directory, narrowable by team.
 *
 * The team filter fetches membership on demand rather than reading it off each person:
 * `GET /v1/employees` deliberately omits team (it lives on the full profile), so there is nothing
 * to filter on client-side. One request per team, cached for the life of the dialog, which is the
 * same shape `AddFromTeam` beside it already uses.
 *
 * Filtering **narrows what is listed, never what is selected** — switching teams doesn't drop
 * people already picked, and the chips above stay put. A filter that silently deselected people
 * would be a data-loss control disguised as a view control.
 */
/** Sentinel for "don't filter" — `<select>` values are strings, so this can't be `null`. */
const ALL_TEAMS = "__all__";

function MemberMultiSelect({
  users,
  value,
  onChange,
}: {
  users: UserMini[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState<ApiTeam[]>([]);
  const [teamId, setTeamId] = useState<string>(ALL_TEAMS);
  /** `team_id → member ids`. Cached so re-picking a team is instant and costs nothing. */
  const [teamMembers, setTeamMembers] = useState<Record<string, Set<string>>>({});
  const [loadingTeam, setLoadingTeam] = useState(false);
  const selected = new Set(value);

  // Best-effort: a role without team visibility gets a 403, and the picker simply shows no filter
  // rather than an error — the directory list below is the feature, the filter is an aid.
  useEffect(() => {
    let live = true;
    listTeams()
      .then((t) => live && setTeams(t))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (teamId === ALL_TEAMS || teamMembers[teamId]) return;
    let live = true;
    setLoadingTeam(true);
    listTeamMembers(teamId)
      .then((ms) => {
        if (!live) return;
        setTeamMembers((prev) => ({
          ...prev,
          [teamId]: new Set(ms.map((m) => m.user_id)),
        }));
      })
      // An unreadable team falls back to an empty set, which shows "nobody in this team" rather
      // than silently reverting to the full list and implying the filter did nothing.
      .catch(() => live && setTeamMembers((prev) => ({ ...prev, [teamId]: new Set() })))
      .finally(() => live && setLoadingTeam(false));
    return () => {
      live = false;
    };
  }, [teamId, teamMembers]);

  const q = query.trim().toLowerCase();
  const inTeam = teamId === ALL_TEAMS ? null : teamMembers[teamId];
  const filtered = users.filter((u) => {
    if (inTeam && !inTeam.has(u.id)) return false;
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) || u.jobTitle.toLowerCase().includes(q)
    );
  });

  const toggle = (id: string) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const chosen = value
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean) as UserMini[];

  return (
    <div className="rounded-lg border border-input">
      {/* Selected chips */}
      {chosen.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-b border-input p-2">
          {chosen.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1 rounded-full bg-accent py-0.5 pr-1 pl-1.5 text-xs font-medium text-accent-foreground"
            >
              {u.name.split(" ")[0]}
              <button
                type="button"
                onClick={() => toggle(u.id)}
                aria-label={`Remove ${u.name}`}
                className="rounded-full p-0.5 transition-colors hover:bg-foreground/10"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {/* Search + team filter */}
      <div className="flex items-center border-b border-input">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            className="h-9 w-full bg-transparent pr-2.5 pl-8 text-sm outline-none"
          />
        </div>
        {/* Hidden entirely when the org has no teams, or the caller can't read them — an empty
            filter is a control that can only disappoint. */}
        {teams.length > 0 ? (
          <div className="flex shrink-0 items-center gap-1.5 border-l border-input pr-2 pl-2.5">
            <Users className="size-3.5 shrink-0 text-muted-foreground" />
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              aria-label="Filter people by team"
              className="h-9 max-w-[9rem] cursor-pointer truncate bg-transparent text-xs outline-none"
            >
              <option value={ALL_TEAMS}>All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.member_count !== undefined ? ` (${t.member_count})` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {/* Directory list */}
      <ul className="max-h-44 overflow-y-auto p-1">
        {loadingTeam ? (
          <li className="px-2 py-4 text-center text-xs text-muted-foreground">
            Loading team…
          </li>
        ) : filtered.length === 0 ? (
          // Naming the active constraint matters: "no people match" over an empty list is
          // indistinguishable from a broken directory when a team filter is the real cause.
          <li className="px-2 py-4 text-center text-xs text-muted-foreground">
            {query && inTeam
              ? `No one in this team matches “${query}”.`
              : inTeam
                ? "Nobody in this team is available to add."
                : `No people match “${query}”.`}
          </li>
        ) : (
          filtered.map((u) => {
            const isOn = selected.has(u.id);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => toggle(u.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted",
                    isOn && "bg-muted/60",
                  )}
                >
                  <Avatar size="sm" className="size-7">
                    {u.avatarUrl ? (
                      <AvatarImage src={u.avatarUrl} alt={u.name} />
                    ) : null}
                    <AvatarFallback>{initials(u.name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-medium">
                      {u.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {u.jobTitle}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-[5px] border",
                      isOn
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input",
                    )}
                  >
                    {isOn ? <Check className="size-3" /> : null}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

/* --------------------- person picker (lead / manager) ---------------------- */

function PersonSelect({
  users,
  value,
  onChange,
  placeholder,
  invalid,
}: {
  users: UserMini[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  invalid?: boolean;
}) {
  return (
    <Select
      value={value || null}
      onValueChange={(v) => onChange(v as string)}
    >
      <SelectTrigger className={cn("w-full", invalid && "border-destructive")}>
        <SelectValue placeholder={placeholder}>
          {(v) => {
            const u = users.find((x) => x.id === v);
            if (!u) return placeholder;
            return (
              <span className="flex min-w-0 items-center gap-2">
                <Avatar className="size-5">
                  {u.avatarUrl ? (
                    <AvatarImage src={u.avatarUrl} alt={u.name} />
                  ) : null}
                  <AvatarFallback className="text-[0.55rem]">
                    {initials(u.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{u.name}</span>
              </span>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {users.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            <span className="flex items-center gap-2">
              <Avatar className="size-6">
                {u.avatarUrl ? (
                  <AvatarImage src={u.avatarUrl} alt={u.name} />
                ) : null}
                <AvatarFallback className="text-[0.6rem]">
                  {initials(u.name)}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm">{u.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {u.jobTitle}
                </span>
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Field({
  label,
  error,
  optional,
  hint,
  children,
}: {
  label: string;
  error?: string;
  optional?: boolean;
  /** Explains a consequence the control can't show. Hidden while an error is up. */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {label}
        {optional ? (
          <span className="text-xs font-normal text-muted-foreground">
            optional
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
