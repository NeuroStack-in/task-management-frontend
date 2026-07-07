"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  type TaskPriority,
  type TaskStatus,
} from "../types";
import { toneDot, type UserMini } from "../lib";
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

const PRIORITY_ORDER: TaskPriority[] = ["high", "medium", "low"];

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
    control,
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
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "Add task"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the task’s details, status, or assignee."
              : "Add a task to this project."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-1">
            <Field label="Task title" error={errors.title?.message}>
              <Input
                placeholder="e.g. Wire up the checkout API"
                aria-invalid={!!errors.title}
                {...register("title")}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as TaskStatus)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v) => (
                            <TonePill
                              tone={TASK_STATUS_META[v as TaskStatus]?.tone}
                              label={TASK_STATUS_META[v as TaskStatus]?.label}
                            />
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUS_ORDER.map((s) => (
                          <SelectItem key={s} value={s}>
                            <TonePill
                              tone={TASK_STATUS_META[s].tone}
                              label={TASK_STATUS_META[s].label}
                            />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Priority">
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as TaskPriority)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v) => (
                            <TonePill
                              tone={TASK_PRIORITY_META[v as TaskPriority]?.tone}
                              label={TASK_PRIORITY_META[v as TaskPriority]?.label}
                            />
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_ORDER.map((p) => (
                          <SelectItem key={p} value={p}>
                            <TonePill
                              tone={TASK_PRIORITY_META[p].tone}
                              label={TASK_PRIORITY_META[p].label}
                            />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <Field label="Assignee">
              <Controller
                control={control}
                name="assigneeId"
                render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={(v) =>
                      field.onChange(v === "none" ? "" : (v as string))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v) => {
                          const u =
                            v && v !== "none"
                              ? members.find((m) => m.id === v)
                              : null;
                          if (!u)
                            return (
                              <span className="text-muted-foreground">
                                Unassigned
                              </span>
                            );
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
                      <SelectItem value="none">Unassigned</SelectItem>
                      {members.map((u) => (
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
                )}
              />
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
          </div>

          <DialogFooter>
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

function TonePill({ tone, label }: { tone?: string; label?: string }) {
  return (
    <span className="flex items-center gap-2">
      {tone ? <span className={cn("size-2 rounded-full", toneDot[tone as keyof typeof toneDot])} /> : null}
      {label ?? "Select"}
    </span>
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
