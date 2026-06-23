"use client";

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
import type { UserMini } from "../lib";

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
  key: z
    .string()
    .min(2, "2–4 characters")
    .max(4, "2–4 characters")
    .regex(/^[A-Za-z0-9]+$/, "Letters and numbers only"),
  department: z.string().min(1, "Pick a department"),
  status: z.enum(["active", "on_hold"]),
  leadUserId: z.string().min(1, "Pick a lead"),
  budget: z.coerce.number().min(0, "Must be ≥ 0"),
  dueDate: z.string().min(1, "Pick a due date"),
});

export type NewProjectInput = z.infer<typeof schema>;

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function deriveKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const base =
    words.length >= 2
      ? words[0][0] + words[1][0]
      : (words[0] ?? "").slice(0, 3);
  return base.toUpperCase().slice(0, 4);
}

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: UserMini[];
  onCreate: (input: NewProjectInput) => void;
}

export function NewProjectDialog({
  open,
  onOpenChange,
  leads,
  onCreate,
}: NewProjectDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<NewProjectInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      key: "",
      department: "",
      status: "active",
      leadUserId: "",
      budget: 50000,
      dueDate: "",
    },
  });

  const status = watch("status");
  const nameReg = register("name");

  const submit = handleSubmit((data) => {
    onCreate({ ...data, key: data.key.toUpperCase() });
    reset();
    onOpenChange(false);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Spin up a project workspace. This is simulated — it’s added to your
            board for the session.
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
                if (!getValues("key"))
                  setValue("key", deriveKey(e.target.value), {
                    shouldValidate: false,
                  });
              }}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Key" error={errors.key?.message}>
              <Input
                placeholder="ATL"
                className="font-mono uppercase"
                aria-invalid={!!errors.key}
                {...register("key")}
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Department" error={errors.department?.message}>
              <select
                className={cn(selectClass)}
                aria-invalid={!!errors.department}
                defaultValue=""
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
            <Field label="Due date" error={errors.dueDate?.message}>
              <Input
                type="date"
                aria-invalid={!!errors.dueDate}
                {...register("dueDate")}
              />
            </Field>
          </div>

          <Field label="Project lead" error={errors.leadUserId?.message}>
            <select
              className={cn(selectClass)}
              aria-invalid={!!errors.leadUserId}
              defaultValue=""
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

          <Field label="Status">
            <div className="inline-flex items-center gap-1 rounded-xl bg-muted p-1">
              {(["active", "on_hold"] as ProjectStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setValue("status", s as "active" | "on_hold")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    status === s
                      ? "shadow-soft bg-background text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s === "active" ? "Active" : "On hold"}
                </button>
              ))}
            </div>
          </Field>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create project</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
