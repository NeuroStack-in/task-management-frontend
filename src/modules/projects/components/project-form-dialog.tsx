"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ChevronsUpDown, Search, TriangleAlert, Users, X } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { teamWithRoles, type TaskLoad, type UserMini } from "../lib";
import {
  PROJECT_STATUS_META,
  PROJECT_STATUS_ORDER,
  type ProjectStatus,
} from "../types";
import type { ProjectFormValues } from "@/modules/projects/forms";
import { AddFromTeam } from "./add-from-team";
import {
  listTeamMembers,
  listTeams,
  type ApiTeam,
} from "@/modules/employees/services/employees.service";

/** The Department picker's "none" choice — a Select value can't be the empty string. */
const NO_DEPARTMENT = "__none__";

const STATUS_ITEMS = Object.fromEntries(
  PROJECT_STATUS_ORDER.map((s) => [s, PROJECT_STATUS_META[s].label]),
);

const schema = z.object({
  name: z.string().trim().min(2, "Give the project a name"),
  description: z
    .string()
    .trim()
    .max(500, "Keep it under 500 characters")
    .optional(),
  // Optional, as on the server, and picked from the organization's own departments. It was a
  // required choice among eight hard-coded names, so an org whose departments were "Platform" and
  // "QA" filed every project under one it doesn't have (QA audit 2026-10-08, WP-314).
  department: z.string(),
  // Edit only — see `ProjectFormValues`.
  status: z.enum(["active", "on_hold", "completed"]).optional(),
  key: z
    .string()
    .trim()
    .refine((k) => !k || /^[A-Za-z0-9]{2,8}$/.test(k), "Use 2–8 letters or digits, e.g. WP")
    .optional(),
  // Required, like the manager, and someone else (owner request 2026-10-16) — see `schemaFor`.
  leadUserId: z.string().min(1, "Pick a project lead"),
  managerId: z.string().min(1, "Pick a manager"),
  // **Not required** (UX audit PROJ-10): the manager and lead are on the team by construction
  // (`teamWithRoles`), so a project always has people on it. Demanding one more was a rule with no
  // reason behind it.
  memberIds: z.array(z.string()),
  startDate: z.string(),
  // **Optional** (UX audit PROJ-09): the server takes a project with no end date, and ongoing work
  // has none. It was required here, so a deadline once set could never be removed from the form.
  dueDate: z.string(),
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
function schemaFor(minDue: string, isCreate: boolean) {
  return schema
    .refine((v) => !isCreate || Boolean(v.startDate), {
      path: ["startDate"],
      message: "Pick a start date",
    })
    .refine((v) => !v.dueDate || v.dueDate >= minDue, {
      path: ["dueDate"],
      message: "Deadline can't be in the past",
    })
    // The server refuses it too ("end_date precedes start_date"); saying so on the field beats a toast.
    .refine((v) => !v.dueDate || !v.startDate || v.dueDate >= v.startDate, {
      path: ["dueDate"],
      message: "Deadline can't be before the start date",
    })
    // Two people, not one in both seats. Only the project's own lead or manager signs a task off, and
    // never on work they're assigned to — so each reviews the other's, and a project where one person
    // held both roles could never have that person's tasks signed off. It also keeps the lead from
    // landing on the manager's own membership row (WP-024).
    .refine((v) => !v.leadUserId || v.leadUserId !== v.managerId, {
      path: ["leadUserId"],
      message: "Pick someone other than the manager",
    });
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

// `billable` is intentionally absent: it has no default, so an unanswered form fails
// validation instead of quietly creating a non-billable project (LLD §4). A function, not a
// constant: the start date defaults to *today*, read when the form opens rather than at page load.
function blank(): Omit<FormShape, "billable"> {
  return {
    name: "",
    description: "",
    department: "",
    leadUserId: "",
    managerId: "",
    memberIds: [],
    startDate: todayIso(),
    dueDate: "",
  };
}

/** The id of the message under a field — its error, else its hint — for `aria-describedby`. */
function describedBy(id: string, error: unknown, hint?: unknown): string | undefined {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

interface ProjectFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The org directory members can be picked from. */
  leads: UserMini[];
  /** The organization's departments; `null` when they couldn't be read, absent while loading. */
  departments?: string[] | null;
  /**
   * Shown under the team picker when the list is short for a reason the person can't see — the
   * directory refused them, so only people they already work with are listed (WP-308).
   */
  peopleNote?: string;
  /** Pre-fill for edit mode; in create mode, just the defaults (the manager — UX audit PROJ-10). */
  initial?: Partial<ProjectFormValues>;
  /**
   * Edit only: the tasks each person is on, so unticking someone says what the save will do to their
   * work before it does it (UX audit PROJ-15).
   */
  taskLoad?: Record<string, TaskLoad>;
  /**
   * Save. **The dialog stays open until this resolves** and does not close itself — the caller
   * closes it on success, so a refused save keeps everything typed. It used to close straight after
   * an un-awaited call, and a failed save discarded the whole form (QA audit 2026-10-08, WP-300).
   */
  onSubmit: (values: ProjectFormValues) => Promise<void>;
}

export function ProjectFormDialog({
  mode,
  open,
  onOpenChange,
  leads,
  departments,
  peopleNote,
  initial,
  taskLoad,
  onSubmit,
}: ProjectFormDialogProps) {
  const uid = useId();
  const id = (field: string) => `${uid}-${field}`;
  const [submitting, setSubmitting] = useState(false);
  // The org's departments, plus the project's own label when it isn't (or is no longer) one of
  // them — an Edit must still show what is stored, rather than a value no option matches.
  const departmentOptions = useMemo(() => {
    const all = new Set(departments ?? []);
    if (initial?.department) all.add(initial.department);
    return [...all].sort((a, b) => a.localeCompare(b));
  }, [departments, initial?.department]);
  const departmentItems = useMemo(
    () => ({
      [NO_DEPARTMENT]: "No department",
      ...Object.fromEntries(departmentOptions.map((d) => [d, d])),
    }),
    [departmentOptions],
  );
  // The domain model carries `billable` as a boolean; the form as an enum, so that
  // "unanswered" is representable and a new project can't default to non-billable.
  // Convert on the way in — the submit handler converts back. Only when it is *given*: create mode
  // passes defaults without it, and mapping `undefined` to "no" would default every project to
  // non-billable — the very guess the enum exists to prevent.
  const initialForm = useMemo(() => {
    if (!initial) return undefined;
    const { billable, ...rest } = initial;
    return billable === undefined
      ? rest
      : { ...rest, billable: (billable ? "yes" : "no") as "yes" | "no" };
  }, [initial]);

  // The deadline floor: today, so a new project can't be created already overdue. An existing
  // project whose deadline has passed keeps its own value as the floor, so editing its other fields
  // isn't blocked by a date nobody can now change to something valid.
  const minDue = useMemo(() => {
    const t = todayIso();
    return initial?.dueDate && initial.dueDate < t ? initial.dueDate : t;
  }, [initial?.dueDate]);

  const isEdit = mode === "edit";

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<FormShape>({
    resolver: zodResolver(schemaFor(minDue, !isEdit)),
    defaultValues: { ...blank(), ...initialForm },
  });

  // Re-seed the form whenever it (re)opens so edit mode reflects the latest data.
  useEffect(() => {
    if (open) reset({ ...blank(), ...initialForm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const memberIds = watch("memberIds");
  const managerId = watch("managerId");
  const leadUserId = watch("leadUserId");
  const startDate = watch("startDate");
  // Who the save puts on the team: the ticked people plus the manager and lead (PROJ-08).
  const team = teamWithRoles(memberIds, managerId, leadUserId);
  const locked: Record<string, string> = {
    ...(leadUserId ? { [leadUserId]: "Lead" } : {}),
    ...(managerId ? { [managerId]: "Manager" } : {}),
  };
  // The deadline can't precede the start, nor (as before) be in the past.
  const dueFloor = startDate && startDate > minDue ? startDate : minDue;

  const nameOf = (userId: string) => leads.find((u) => u.id === userId)?.name;
  // PROJ-15: who unticking takes off the team, and what happens to their tasks. Removals run before
  // a hand-over (see `saveTeam`), so a leaver's only-assignee tasks pass to the *current* manager —
  // except the outgoing manager's own, which go to the new one once they hand over.
  const removalNote = (() => {
    if (!isEdit || !taskLoad) return null;
    const before = initial?.memberIds ?? [];
    const prevManager = initial?.managerId ?? "";
    const leaving = before.filter((u) => !team.includes(u));
    const withWork = leaving
      .map((u) => ({ id: u, load: taskLoad[u] ?? { total: 0, solo: 0 } }))
      .filter((x) => x.load.total > 0);
    if (withWork.length === 0) return null;
    const parts = withWork.map(
      (x) =>
        `${nameOf(x.id) ?? "someone"} off ${x.load.total} ${x.load.total === 1 ? "task" : "tasks"}`,
    );
    const list =
      parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
    const solo = withWork.reduce((s, x) => s + x.load.solo, 0);
    const heirs = new Set(
      withWork.filter((x) => x.load.solo > 0).map((x) => (x.id === prevManager ? managerId : prevManager)),
    );
    const heir = heirs.size === 1 ? nameOf([...heirs][0]) : undefined;
    return `Saving takes ${list}.${
      solo > 0
        ? ` ${solo === 1 ? "The 1 task" : `The ${solo} tasks`} nobody else is on will pass to ${heir ?? "the project manager"}.`
        : ""
    }`;
  })();

  const submit = handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      await onSubmit({
        ...data,
        memberIds: teamWithRoles(data.memberIds, data.managerId, data.leadUserId),
        description: data.description ?? "",
        // The form models this as an enum so "unanswered" can fail validation; the domain
        // model is a boolean. Map at the boundary.
        billable: data.billable === "yes",
      });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Not while a save is in flight: closing then would lose the form if the save fails.
        if (!o && submitting) return;
        if (!o) reset({ ...blank(), ...initialForm });
        onOpenChange(o);
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the project’s details, people, and timeline."
              : "Name the project, pick who runs it, and set its dates."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4" noValidate>
          <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-1">
          <Field label="Project name" htmlFor={id("name")} error={errors.name?.message}>
            <Input
              id={id("name")}
              placeholder="e.g. Atlas Migration"
              aria-invalid={!!errors.name}
              aria-describedby={describedBy(id("name"), errors.name)}
              {...register("name")}
            />
          </Field>

          <Field
            label="Description"
            htmlFor={id("description")}
            error={errors.description?.message}
            optional
          >
            <textarea
              id={id("description")}
              rows={3}
              placeholder="What is this project about? Goals, scope, anything worth knowing."
              aria-invalid={!!errors.description}
              aria-describedby={describedBy(id("description"), errors.description)}
              className={cn(fieldClass, "h-auto resize-none py-2 leading-relaxed")}
              {...register("description")}
            />
          </Field>

          {/* Edit only: a new project is always created active, and its key is derived from its
              name. Neither could be changed anywhere in the app — a finished project could only be
              deleted, and a renamed one kept its old key (QA audit 2026-10-08, WP-312). */}
          {isEdit ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Status"
                htmlFor={id("status")}
                hint="Completed and On hold keep the project’s tasks and history. A hold you set stays until someone resumes it."
              >
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? null}
                      onValueChange={(v) => field.onChange(v as ProjectStatus)}
                      items={STATUS_ITEMS}
                    >
                      <SelectTrigger
                        id={id("status")}
                        aria-describedby={`${id("status")}-hint`}
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_STATUS_ORDER.map((s) => (
                          <SelectItem key={s} value={s}>
                            {PROJECT_STATUS_META[s].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field
                label="Key"
                htmlFor={id("key")}
                error={errors.key?.message}
                hint="The short badge on cards — 2 to 8 letters or digits."
              >
                <Input
                  id={id("key")}
                  maxLength={8}
                  autoComplete="off"
                  className="font-mono uppercase"
                  aria-invalid={!!errors.key}
                  aria-describedby={describedBy(id("key"), errors.key, true)}
                  {...register("key")}
                />
              </Field>
            </div>
          ) : null}

          {/* One column on a phone: two pickers side by side were ~170 px each (UX audit PROJ-10). */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Editable again: `POST /v1/projects/{id}/transfer-manager` exists as of 2026-09-01. */}
            <Field
              label="Project manager"
              htmlFor={id("manager")}
              error={errors.managerId?.message}
              hint={
                isEdit
                  ? "Someone new joins the team and takes over. The current manager stays on the team unless you untick them below."
                  : "Runs the project and its team."
              }
            >
              <Controller
                control={control}
                name="managerId"
                render={({ field }) => (
                  <PersonPicker
                    id={id("manager")}
                    users={leads}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select manager"
                    invalid={!!errors.managerId}
                    describedBy={describedBy(id("manager"), errors.managerId, true)}
                  />
                )}
              />
            </Field>
            <Field
              label="Project lead"
              htmlFor={id("lead")}
              error={errors.leadUserId?.message}
              hint="Signs work off with the manager — someone other than the manager."
            >
              <Controller
                control={control}
                name="leadUserId"
                render={({ field }) => (
                  <PersonPicker
                    id={id("lead")}
                    users={leads}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select lead"
                    invalid={!!errors.leadUserId}
                    describedBy={describedBy(id("lead"), errors.leadUserId, true)}
                  />
                )}
              />
            </Field>
          </div>

          {/* The dates. A start date is chosen at creation — it used to be today, silently — and the
              deadline is optional (UX audit PROJ-09). */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Start date" htmlFor={id("start")} error={errors.startDate?.message}>
              {/* Movable in an edit too — the PATCH takes `start_date` (PROJ-09); the deadline check
                  below keeps it on or before the end. */}
              <Controller
                control={control}
                name="startDate"
                render={({ field }) => (
                  <DatePicker
                    id={id("start")}
                    value={field.value}
                    onChange={field.onChange}
                    aria-describedby={describedBy(id("start"), errors.startDate)}
                    className={cn("w-full", errors.startDate && "border-destructive")}
                  />
                )}
              />
            </Field>
            <Field
              label="Deadline"
              htmlFor={id("deadline")}
              error={errors.dueDate?.message}
              optional
              hint="Leave it empty for ongoing work."
            >
              <Controller
                control={control}
                name="dueDate"
                render={({ field }) => (
                  <div className="flex items-center gap-1.5">
                    <div className="min-w-0 flex-1">
                      <DatePicker
                        id={id("deadline")}
                        value={field.value}
                        onChange={field.onChange}
                        min={dueFloor}
                        placeholder="No end date"
                        aria-describedby={describedBy(id("deadline"), errors.dueDate, true)}
                        className={cn("w-full", errors.dueDate && "border-destructive")}
                      />
                    </div>
                    {field.value ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0"
                        onClick={() => field.onChange("")}
                        aria-label="Remove the deadline"
                        title="Remove the deadline"
                      >
                        <X className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                )}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Department"
              htmlFor={id("department")}
              error={errors.department?.message}
              optional
              hint={
                departments === null
                  ? "The organization’s department list couldn’t be loaded."
                  : undefined
              }
            >
              <Controller
                control={control}
                name="department"
                render={({ field }) => (
                  <Select
                    value={field.value || NO_DEPARTMENT}
                    onValueChange={(v) =>
                      field.onChange(v === NO_DEPARTMENT ? "" : (v as string))
                    }
                    items={departmentItems}
                  >
                    <SelectTrigger
                      id={id("department")}
                      aria-describedby={describedBy(
                        id("department"),
                        errors.department,
                        departments === null,
                      )}
                      className={cn("w-full", errors.department && "border-destructive")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_DEPARTMENT}>No department</SelectItem>
                      {departmentOptions.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field
              label="Billing"
              htmlFor={id("billing")}
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
                      id={id("billing")}
                      aria-invalid={!!errors.billable}
                      aria-describedby={describedBy(id("billing"), errors.billable, true)}
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
          </div>

          <Field
            label={`Team members (${team.length})`}
            htmlFor={id("team")}
            error={errors.memberIds?.message}
            hint="The manager and lead are always on the team."
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
              searchId={id("team")}
              describedBy={describedBy(id("team"), errors.memberIds, true)}
              users={leads}
              value={team}
              locked={locked}
              onChange={(ids) =>
                setValue("memberIds", ids, { shouldValidate: true })
              }
            />
            {peopleNote ? (
              <p className="mt-1.5 text-xs text-muted-foreground">{peopleNote}</p>
            ) : null}
            {removalNote ? (
              // Before the save, not after it: unticking someone used to reassign their work with no
              // word at all (UX audit PROJ-15).
              <p
                role="status"
                className="border-warning/40 bg-warning/10 text-foreground mt-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
              >
                <TriangleAlert className="text-warning mt-px size-3.5 shrink-0" aria-hidden="true" />
                <span>{removalNote}</span>
              </p>
            ) : null}
          </Field>

          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save changes"
                  : "Create project"}
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
  locked,
  onChange,
  searchId,
  describedBy,
}: {
  users: UserMini[];
  value: string[];
  /**
   * People who are on the team because of their role (`id → "Manager" | "Lead"`): ticked, labelled,
   * and not removable here — change the role picker instead.
   */
  locked: Record<string, string>;
  onChange: (ids: string[]) => void;
  /** The search box's id, so the field's label names it. */
  searchId?: string;
  describedBy?: string;
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
    if (locked[id]) return;
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  /**
   * Add everyone the list is currently showing.
   *
   * It unions with what is already picked rather than replacing it — the same rule the filter obeys
   * ("narrows what is listed, never what is selected"). Replacing would turn a view control into a
   * data-loss control, which is exactly what that rule exists to prevent.
   *
   * Paired with the team filter this is the useful shape: pick a team, add all of it — the same
   * outcome as `AddFromTeam` beside it, reached from the directory the person is already looking at.
   */
  const unselectedShown = filtered.filter((u) => !selected.has(u.id));
  const selectAllShown = () => onChange([...value, ...unselectedShown.map((u) => u.id)]);
  /** True when a filter is on, so the control can promise only what it will actually do. */
  const narrowed = Boolean(q) || Boolean(inTeam);
  /** "Clear all" keeps the manager and lead — they are on the team by role, not by tick. */
  const removable = value.filter((id) => !locked[id]);

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
              className={cn(
                "inline-flex items-center gap-1 rounded-full bg-accent py-0.5 pl-1.5 text-xs font-medium text-accent-foreground",
                locked[u.id] ? "pr-2" : "pr-1",
              )}
            >
              {u.name.split(" ")[0]}
              {locked[u.id] ? (
                <span className="text-[0.65rem] font-normal opacity-80">· {locked[u.id]}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(u.id)}
                  aria-label={`Remove ${u.name}`}
                  className="rounded-full p-0.5 transition-colors hover:bg-foreground/10"
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      ) : null}

      {/* Search + team filter */}
      <div className="flex items-center border-b border-input">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id={searchId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            aria-describedby={describedBy}
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

      {/* Bulk actions. Only while there is more than one person to act on — a "select all" over a
          single row is noise, and over an empty list is a control that can only disappoint. */}
      {!loadingTeam && filtered.length > 1 ? (
        <div className="flex items-center justify-between gap-2 border-b border-input px-2.5 py-1.5 text-xs">
          <span className="text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "person" : "people"}
            {narrowed ? " shown" : ""}
            {value.length ? ` · ${value.length} on the team` : ""}
          </span>
          <span className="flex items-center gap-3">
            {unselectedShown.length > 0 ? (
              <button
                type="button"
                onClick={selectAllShown}
                className="font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {narrowed ? `Select all ${filtered.length} shown` : "Select all"}
              </button>
            ) : null}
            {removable.length > 0 ? (
              <button
                type="button"
                onClick={() => onChange(value.filter((id) => locked[id]))}
                className="font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear all
              </button>
            ) : null}
          </span>
        </div>
      ) : null}

      {/* Directory list — each row a checkbox to assistive tech; its state was a styled square
          only (UX audit PROJ-18). */}
      <ul className="max-h-44 overflow-y-auto p-1" aria-label="People">
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
            const role = locked[u.id];
            return (
              <li key={u.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isOn}
                  aria-disabled={role ? true : undefined}
                  title={role ? `On the team as ${role.toLowerCase()}` : undefined}
                  onClick={() => toggle(u.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                    role ? "cursor-default" : "hover:bg-muted",
                    isOn && "bg-muted/60",
                  )}
                >
                  <Avatar size="sm" className="size-7">
                    {u.avatarUrl ? (
                      <AvatarImage src={u.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback>{initials(u.name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-medium">
                      {u.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {role ? `${role}${u.jobTitle ? ` · ${u.jobTitle}` : ""}` : u.jobTitle}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-[5px] border",
                      isOn
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input",
                      role && "opacity-60",
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

/**
 * One person from the directory, **searchable** once the list is long enough to need it (UX audit
 * PROJ-10). It was a plain select over the whole organization: finding someone in a long list meant
 * scrolling it. A menu of radio items rather than a `<Select>` because a select's type-ahead would
 * swallow the search box's keystrokes.
 */
function PersonPicker({
  id,
  users,
  value,
  onChange,
  placeholder,
  invalid,
  describedBy,
}: {
  /** For the field's label. */
  id?: string;
  users: UserMini[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [query, setQuery] = useState("");
  const searchable = users.length > 6;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter(
        (u) => u.name.toLowerCase().includes(q) || u.jobTitle.toLowerCase().includes(q),
      )
    : users;
  const current = users.find((u) => u.id === value);

  return (
    <DropdownMenu onOpenChange={(o) => !o && setQuery("")}>
      <DropdownMenuTrigger
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          "border-input flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border bg-transparent px-2.5 text-left text-sm outline-none transition-colors dark:bg-input/30",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          invalid && "border-destructive",
        )}
      >
        {current ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <Avatar className="size-5">
              {current.avatarUrl ? <AvatarImage src={current.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-[0.55rem]">{initials(current.name)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{current.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground flex-1 truncate">{placeholder}</span>
        )}
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72">
        {searchable ? (
          <div className="px-1 pt-0.5 pb-1.5">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people…"
              aria-label="Search people"
              className="h-8"
              // Typing must reach the input rather than being swallowed as menu type-ahead.
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        ) : null}
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            {users.length === 0 ? "Nobody to choose from." : `No one matches “${query}”.`}
          </p>
        ) : (
          <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as string)}>
            {filtered.map((u) => (
              <DropdownMenuRadioItem key={u.id} value={u.id} closeOnClick>
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar className="size-6">
                    {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt="" /> : null}
                    <AvatarFallback className="text-[0.6rem]">{initials(u.name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm">{u.name}</span>
                    {u.jobTitle ? (
                      <span className="truncate text-xs text-muted-foreground">{u.jobTitle}</span>
                    ) : null}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Field({
  label,
  htmlFor,
  error,
  optional,
  hint,
  children,
}: {
  label: string;
  /** The control's id, so the label names it and a click on the label focuses it (WP-508). */
  htmlFor?: string;
  error?: string;
  optional?: boolean;
  /** Explains a consequence the control can't show. Hidden while an error is up. */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
        {label}
        {optional ? (
          <span className="text-xs font-normal text-muted-foreground">
            optional
          </span>
        ) : null}
      </Label>
      {children}
      {/* Ids the control points at with `aria-describedby`, so a screen reader hears the error with
          the field rather than never (UX audit PROJ-18). */}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
