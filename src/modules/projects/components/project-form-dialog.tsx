"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "../types";
import { PROJECT_STATUS_META, PROJECT_STATUS_ORDER } from "../types";
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
  key: z
    .string()
    .min(2, "2–4 characters")
    .max(4, "2–4 characters")
    .regex(/^[A-Za-z0-9]+$/, "Letters and numbers only"),
  department: z.string().min(1, "Pick a department"),
  status: z.enum(["active", "on_hold", "completed", "archived"]),
  leadUserId: z.string().min(1, "Pick a lead"),
  teamSize: z.coerce.number().int().min(1, "At least 1").max(60, "Max 60"),
  budget: z.coerce.number().min(0, "Must be ≥ 0"),
  dueDate: z.string().min(1, "Pick a deadline"),
});

type FormShape = z.infer<typeof schema>;

const fieldClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function deriveKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const base =
    words.length >= 2
      ? words[0][0] + words[1][0]
      : (words[0] ?? "").slice(0, 3);
  return base.toUpperCase().slice(0, 4);
}

const EMPTY: FormShape = {
  name: "",
  description: "",
  key: "",
  department: "",
  status: "active",
  leadUserId: "",
  teamSize: 5,
  budget: 50000,
  dueDate: "",
};

interface ProjectFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  const defaults: FormShape = { ...EMPTY, ...initial };
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<FormShape>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  // Re-seed the form whenever it (re)opens so edit mode reflects the latest data.
  useEffect(() => {
    if (open) reset({ ...EMPTY, ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const status = watch("status");
  const nameReg = register("name");
  const isEdit = mode === "edit";

  const submit = handleSubmit((data) => {
    onSubmit({
      ...data,
      description: data.description ?? "",
      key: data.key.toUpperCase(),
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the project’s details, lead, or status."
              : "Capture the essentials. This is simulated — it’s added for the session."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3.5">
          <Field label="Project name" error={errors.name?.message}>
            <Input
              placeholder="e.g. Atlas Migration"
              aria-invalid={!!errors.name}
              {...nameReg}
              onChange={(e) => {
                nameReg.onChange(e);
                if (!isEdit && !getValues("key"))
                  setValue("key", deriveKey(e.target.value));
              }}
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
              <select
                className={fieldClass}
                aria-invalid={!!errors.leadUserId}
                {...register("leadUserId")}
              >
                <option value="" disabled>
                  Select…
                </option>
                {leads.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.jobTitle}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department" error={errors.department?.message}>
              <select
                className={fieldClass}
                aria-invalid={!!errors.department}
                {...register("department")}
              >
                <option value="" disabled>
                  Select…
                </option>
                {PROJECT_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Team size" error={errors.teamSize?.message}>
              <Input
                type="number"
                min={1}
                max={60}
                aria-invalid={!!errors.teamSize}
                {...register("teamSize")}
              />
            </Field>
            <Field label="Budget (USD)" error={errors.budget?.message}>
              <Input
                type="number"
                min={0}
                step={1000}
                aria-invalid={!!errors.budget}
                {...register("budget")}
              />
            </Field>
            <Field label="Key" error={errors.key?.message}>
              <Input
                placeholder="ATL"
                className="font-mono uppercase"
                aria-invalid={!!errors.key}
                {...register("key")}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Deadline" error={errors.dueDate?.message}>
              <Input
                type="date"
                aria-invalid={!!errors.dueDate}
                {...register("dueDate")}
              />
            </Field>
            <Field label="Status">
              <select
                className={fieldClass}
                value={status}
                onChange={(e) =>
                  setValue("status", e.target.value as ProjectStatus)
                }
              >
                {PROJECT_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <DialogFooter className="mt-2">
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
