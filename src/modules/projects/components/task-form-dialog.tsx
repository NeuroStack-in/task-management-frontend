"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Paperclip, X } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { todayIso } from "@/lib/format";
import {
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  type TaskPriority,
  type TaskStatus,
} from "../types";
import { toneDot, type UserMini } from "../lib";
import { AssigneePicker } from "./assignees";
import {
  presignTaskAttachment,
  uploadFileToPresignedUrl,
  type ApiAttachment,
} from "../services/projects.service";
import type { TaskFormValues } from "@/modules/projects/forms";

const schema = z.object({
  title: z.string().trim().min(2, "Give the task a title"),
  description: z.string(),
  // Mirrors TASK_STATUS_SETTABLE, which deliberately omits `closed`: that state is reached by
  // reviewing the task, not by editing it. A form that offered it would let the assignee mark their
  // own work approved — and the server would refuse the write anyway.
  status: z.enum(["todo", "in_progress", "in_review", "done", "blocked"]),
  assigneeIds: z.array(z.string()),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: z.string(),
  estimateHours: z.coerce.number().min(0, "Must be ≥ 0").max(400),
});

type FormShape = z.infer<typeof schema>;

/**
 * The schema, closed over the earliest due date this form accepts. `dueDate` is optional here (a
 * task can be undated), so the rule is only "if set, not already past" — enforced alongside the
 * picker bound because a pre-filled `initial` never passes through the picker.
 */
function schemaWithMinDue(minDue: string) {
  return schema.refine((v) => !v.dueDate || v.dueDate >= minDue, {
    path: ["dueDate"],
    message: "Due date can't be in the past",
  });
}

const PRIORITY_ORDER: TaskPriority[] = ["high", "medium", "low"];

const EMPTY: FormShape = {
  title: "",
  description: "",
  status: "todo",
  assigneeIds: [],
  priority: "medium",
  dueDate: "",
  estimateHours: 4,
};

/* ---------------------------- attachments ----------------------------- */

const MAX_FILES = 8;
const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

/** Extensions and MIME types the backend accepts. Either match passes a file. */
const ALLOWED_EXT = new Set([
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".png",
  ".jpg",
  ".jpeg",
]);
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
]);
const ACCEPT =
  ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,image/png,image/jpeg";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

/** Human file size, e.g. "812 B", "2.3 MB". */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Null when the file is acceptable, otherwise a human reason to show in a toast. */
function rejectReason(file: File): string | null {
  const ok = ALLOWED_MIME.has(file.type) || ALLOWED_EXT.has(extOf(file.name));
  if (!ok) return `“${file.name}” isn’t an allowed file type.`;
  if (file.size > MAX_SIZE) return `“${file.name}” is larger than 15 MB.`;
  return null;
}

interface TaskFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Needed to presign attachment uploads against the project. */
  projectId: string;
  members: UserMini[];
  /** `attachments` (in wire shape) seeds the attachment list when editing. */
  initial?: Partial<FormShape> & { attachments?: ApiAttachment[] };
  onSubmit: (values: TaskFormValues) => void;
}

export function TaskFormDialog({
  mode,
  open,
  onOpenChange,
  projectId,
  members,
  initial,
  onSubmit,
}: TaskFormDialogProps) {
  // The attachment list (wire shape) and the names of files still uploading. Kept outside RHF —
  // uploads are async side effects, not form values, and only fold into the submit at the end.
  const [attachments, setAttachments] = useState<ApiAttachment[]>([]);
  const [pending, setPending] = useState<string[]>([]);

  // Form defaults, minus `attachments` (not a form field — it lives in its own state above).
  const formInitial = useMemo<Partial<FormShape>>(() => {
    const { attachments: _a, ...rest } = initial ?? {};
    void _a;
    return rest;
  }, [initial]);

  // Today, except for an existing task already past due — which keeps its own date as the floor so
  // editing its status or assignee isn't blocked by a deadline that can no longer be met.
  const minDue = useMemo(() => {
    const t = todayIso();
    return formInitial.dueDate && formInitial.dueDate < t ? formInitial.dueDate : t;
  }, [formInitial.dueDate]);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormShape>({
    resolver: zodResolver(schemaWithMinDue(minDue)),
    defaultValues: { ...EMPTY, ...formInitial },
  });

  useEffect(() => {
    if (open) {
      reset({ ...EMPTY, ...formInitial });
      setAttachments(initial?.attachments ?? []);
      setPending([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isEdit = mode === "edit";
  const uploading = pending.length > 0;

  /** Validate, presign, and upload each file, then record it. Enforces the per-task file cap. */
  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const slots = MAX_FILES - attachments.length - pending.length;
    if (slots <= 0) {
      toast.error(`You can attach at most ${MAX_FILES} files.`);
      return;
    }
    const accepted = files.slice(0, slots);
    if (accepted.length < files.length) {
      toast.error(`Only ${MAX_FILES} files per task — some were skipped.`);
    }
    for (const file of accepted) {
      const reason = rejectReason(file);
      if (reason) {
        toast.error(reason);
        continue;
      }
      setPending((p) => [...p, file.name]);
      try {
        const { attachment_id, upload_url } = await presignTaskAttachment(
          projectId,
          file.name,
          file.type,
        );
        await uploadFileToPresignedUrl(upload_url, file);
        setAttachments((a) => [
          ...a,
          {
            id: attachment_id,
            filename: file.name,
            content_type: file.type,
            size: file.size,
          },
        ]);
      } catch {
        toast.error(`Couldn’t upload “${file.name}”. Try again.`);
      } finally {
        setPending((p) => {
          const i = p.indexOf(file.name);
          if (i < 0) return p;
          return [...p.slice(0, i), ...p.slice(i + 1)];
        });
      }
    }
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    // Reset the input so picking the same file again re-fires change.
    e.target.value = "";
    void processFiles(files);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const collected: File[] = [];
    for (const f of Array.from(e.clipboardData.files)) collected.push(f);
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        // De-dupe against `files` above, which already carries most pasted files.
        if (f && !collected.some((c) => c.name === f.name && c.size === f.size)) {
          collected.push(f);
        }
      }
    }
    if (collected.length > 0) {
      e.preventDefault();
      void processFiles(collected);
    }
  };

  const removeAttachment = (id: string) =>
    setAttachments((a) => a.filter((x) => x.id !== id));

  const submit = handleSubmit((data) => {
    onSubmit({
      title: data.title,
      description: data.description,
      status: data.status,
      assigneeIds: data.assigneeIds,
      priority: data.priority,
      dueDate: data.dueDate || null,
      estimateHours: data.estimateHours,
      attachments,
    });
    onOpenChange(false);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset({ ...EMPTY, ...formInitial });
        onOpenChange(o);
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "Add task"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the task’s details, status, or assignees."
              : "Add a task to this project."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={submit}
          onPaste={onPaste}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-1">
            <Field label="Task title" error={errors.title?.message}>
              <Input
                placeholder="e.g. Wire up the checkout API"
                aria-invalid={!!errors.title}
                {...register("title")}
              />
            </Field>

            <Field label="Description">
              <Textarea
                placeholder="Add any detail, context, or acceptance criteria…"
                rows={3}
                {...register("description")}
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

            <Field label="Assignees">
              <Controller
                control={control}
                name="assigneeIds"
                render={({ field }) => (
                  <AssigneePicker
                    members={members}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {/* Said out loud because it is no longer merely "nobody chose": leaving this empty
                  publishes the task to the project, and someone would otherwise discover that by
                  seeing their card in a colleague's desktop picker. */}
              <p className="mt-1.5 text-xs text-muted-foreground">
                Leave empty to offer this task to everyone on the project.
              </p>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Due date">
                <Controller
                  control={control}
                  name="dueDate"
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      min={minDue}
                      className="w-full"
                    />
                  )}
                />
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

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Attachments</Label>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {attachments.length}/{MAX_FILES}
                </span>
              </div>

              <label
                className={cn(
                  "border-input hover:border-primary/40 hover:bg-muted/40 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-4 text-sm transition-colors",
                  (uploading || attachments.length >= MAX_FILES) &&
                    "pointer-events-none opacity-60",
                )}
              >
                <Paperclip className="text-muted-foreground size-4" />
                <span className="text-muted-foreground">
                  Click to add files, or paste a screenshot
                </span>
                <input
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="sr-only"
                  disabled={uploading || attachments.length >= MAX_FILES}
                  onChange={onPickFiles}
                />
              </label>
              <p className="text-muted-foreground text-xs">
                PDF, DOCX, TXT, MD, PNG, JPG · up to 15 MB each.
              </p>

              {attachments.length > 0 || pending.length > 0 ? (
                <ul className="space-y-1.5 pt-1">
                  {attachments.map((a) => (
                    <li
                      key={a.id}
                      className="bg-muted/40 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
                    >
                      <Paperclip className="text-muted-foreground size-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{a.filename}</span>
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {humanSize(a.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(a.id)}
                        aria-label={`Remove ${a.filename}`}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex size-6 shrink-0 items-center justify-center rounded-md"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                  {pending.map((name, i) => (
                    <li
                      key={`pending-${i}-${name}`}
                      className="bg-muted/40 text-muted-foreground flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
                    >
                      <Loader2 className="size-3.5 shrink-0 animate-spin" />
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      <span className="shrink-0 text-xs">Uploading…</span>
                    </li>
                  ))}
                </ul>
              ) : null}
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
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading…" : isEdit ? "Save task" : "Add task"}
            </Button>
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
