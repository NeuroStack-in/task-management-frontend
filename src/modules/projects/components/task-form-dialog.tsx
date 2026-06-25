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
import {
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
} from "../types";
import type { UserMini } from "../lib";
import type { TaskFormValues } from "@/stores/tasks.store";

const schema = z.object({
  title: z.string().min(2, "Give the task a title"),
  status: z.enum(["todo", "in_progress", "in_review", "done"]),
  assigneeId: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: z.string(),
  estimateHours: z.coerce.number().min(0, "Must be ≥ 0").max(400),
});

type FormShape = z.infer<typeof schema>;

const fieldClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const EMPTY: FormShape = {
  title: "",
  status: "todo",
  assigneeId: "",
  priority: "medium",
  dueDate: "",
  estimateHours: 4,
};

interface TaskFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: UserMini[];
  initial?: Partial<FormShape>;
  onSubmit: (values: TaskFormValues) => void;
}

export function TaskFormDialog({
  mode,
  open,
  onOpenChange,
  members,
  initial,
  onSubmit,
}: TaskFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormShape>({
    resolver: zodResolver(schema),
    defaultValues: { ...EMPTY, ...initial },
  });

  useEffect(() => {
    if (open) reset({ ...EMPTY, ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isEdit = mode === "edit";

  const submit = handleSubmit((data) => {
    onSubmit({
      title: data.title,
      status: data.status,
      assigneeId: data.assigneeId || null,
      priority: data.priority,
      dueDate: data.dueDate || null,
      estimateHours: data.estimateHours,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "Add task"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the task’s details, status, or assignee."
              : "Add a task to this project."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3.5">
          <Field label="Task title" error={errors.title?.message}>
            <Input
              placeholder="e.g. Wire up the checkout API"
              aria-invalid={!!errors.title}
              {...register("title")}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select className={fieldClass} {...register("status")}>
                {TASK_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select className={fieldClass} {...register("priority")}>
                {(["high", "medium", "low"] as const).map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_META[p].label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Assignee">
            <select className={fieldClass} {...register("assigneeId")}>
              <option value="">Unassigned</option>
              {members.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.jobTitle}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date">
              <Input type="date" {...register("dueDate")} />
            </Field>
            <Field label="Estimate (hrs)" error={errors.estimateHours?.message}>
              <Input
                type="number"
                min={0}
                step={1}
                aria-invalid={!!errors.estimateHours}
                {...register("estimateHours")}
              />
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
            <Button type="submit">{isEdit ? "Save task" : "Add task"}</Button>
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
      <Label className={cn(error && "text-destructive")}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
