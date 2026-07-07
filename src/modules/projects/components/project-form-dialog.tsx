"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Search, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { UserMini } from "../lib";
import type { ProjectFormValues } from "@/stores/projects.store";

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
  name: z.string().min(2, "Give the project a name"),
  description: z.string().max(500, "Keep it under 500 characters").optional(),
  department: z.string().min(1, "Pick a department"),
  leadUserId: z.string().min(1, "Pick a lead"),
  managerId: z.string().min(1, "Pick a manager"),
  memberIds: z.array(z.string()).min(1, "Select at least one member"),
  dueDate: z.string().min(1, "Pick a deadline"),
});

type FormShape = z.infer<typeof schema>;

const fieldClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const EMPTY: FormShape = {
  name: "",
  description: "",
  department: "",
  leadUserId: "",
  managerId: "",
  memberIds: [],
  dueDate: "",
};

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
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<FormShape>({
    resolver: zodResolver(schema),
    defaultValues: { ...EMPTY, ...initial },
  });

  // Re-seed the form whenever it (re)opens so edit mode reflects the latest data.
  useEffect(() => {
    if (open) reset({ ...EMPTY, ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isEdit = mode === "edit";
  const memberIds = watch("memberIds");

  const submit = handleSubmit((data) => {
    onSubmit({
      ...data,
      description: data.description ?? "",
    });
    onOpenChange(false);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset({ ...EMPTY, ...initial });
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
                    value={field.value || undefined}
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
              <Input
                type="date"
                aria-invalid={!!errors.dueDate}
                {...register("dueDate")}
              />
            </Field>
          </div>

          <Field
            label={`Team members${memberIds.length ? ` (${memberIds.length})` : ""}`}
            error={errors.memberIds?.message}
          >
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
  const selected = new Set(value);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.jobTitle.toLowerCase().includes(q),
      )
    : users;

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

      {/* Search */}
      <div className="relative border-b border-input">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people…"
          className="h-9 w-full bg-transparent pr-2.5 pl-8 text-sm outline-none"
        />
      </div>

      {/* Directory list */}
      <ul className="max-h-44 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <li className="px-2 py-4 text-center text-xs text-muted-foreground">
            No people match “{query}”.
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
                    <AvatarFallback />
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
      value={value || undefined}
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
                  <AvatarFallback />
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
                <AvatarFallback />
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
  children,
}: {
  label: string;
  error?: string;
  optional?: boolean;
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
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
