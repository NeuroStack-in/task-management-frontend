"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Paperclip, X, type LucideIcon } from "lucide-react";
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
import { toneDot, toneText, type UserMini } from "../lib";
import { AssigneePicker } from "./assignees";
import { DIM_UNDER_PROMPT, DiscardChangesDialog, useDiscardGuard } from "./discard-changes";
import { PRIORITY_ICON, TASK_STATUS_ICON } from "./parts";
import {
  presignTaskAttachment,
  uploadFileToPresignedUrl,
  type ApiAttachment,
} from "../services/projects.service";
import type { TaskFormValues } from "@/modules/projects/forms";

/** The server's limits (`create_task::dto`, `assignment::MAX_ASSIGNEES`), counted the way it counts. */
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 10_000;
const MAX_ASSIGNEES = 10;
/** Characters as the server counts them (Unicode scalar values), not UTF-16 units. */
const chars = (s: string) => Array.from(s).length;

const schema = z.object({
  // Limits mirrored from the server so the message lands on the field rather than in a toast after a
  // refused save (QA audit 2026-10-08, WP-307).
  title: z
    .string()
    .trim()
    .min(2, "Give the task a title")
    .refine((t) => chars(t) <= MAX_TITLE, `Keep the title to ${MAX_TITLE} characters or fewer`),
  description: z
    .string()
    .refine(
      (d) => chars(d) <= MAX_DESCRIPTION,
      `Keep the description to ${MAX_DESCRIPTION.toLocaleString("en-US")} characters or fewer`,
    ),
  // All five columns; which of them this person may pick is the `statuses` prop (see
  // `settableStatuses`), because that depends on who they are, not on the value.
  status: z.enum(["todo", "in_progress", "in_review", "done", "blocked"]),
  // **At least one assignee** (owner decision, 2026-09-01) **and at most ten**. Both are refused by
  // the server (`assignment::require_someone`, `MAX_ASSIGNEES`); catching them here means the message
  // lands on the field rather than as a toast after a round-trip that was never going to succeed.
  assigneeIds: z
    .array(z.string())
    .min(1, "Assign this task to at least one person")
    .max(MAX_ASSIGNEES, `A task can have at most ${MAX_ASSIGNEES} assignees`),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: z.string(),
  // Empty is "no estimate" (`null`), not zero; any non-negative number of hours, halves included —
  // the server takes an f64 (QA audit 2026-10-08, WP-505).
  estimateHours: z
    .number({ invalid_type_error: "Enter the estimate in hours, e.g. 1.5" })
    .min(0, "Must be 0 or more")
    .nullable(),
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
  // Not 4: a guess the person never made would be saved as their estimate.
  estimateHours: null,
};

/* ---------------------------- attachments ----------------------------- */

const MAX_FILES = 8;
const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

/** The MIME types the backend accepts (`attachment::is_allowed_type`) — the only thing it checks. */
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
]);
/** The type each allowed extension stands for, when the browser reports none or another name for it. */
const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};
const ACCEPT =
  ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,image/png,image/jpeg";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

/**
 * The type to declare for a file: the browser's when the server accepts it, otherwise the one its
 * extension stands for. The file used to pass on either, then go out under the raw `file.type` — so
 * a `.md` the OS reports as `""` or `text/x-markdown` passed here and was refused at presign, every
 * time (QA audit 2026-10-08, WP-306). `null` = not a type the server takes.
 */
function contentTypeOf(file: File): string | null {
  if (ALLOWED_MIME.has(file.type)) return file.type;
  return MIME_BY_EXT[extOf(file.name)] ?? null;
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
  if (!contentTypeOf(file)) return `“${file.name}” isn’t an allowed file type.`;
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
  /** The statuses this person may pick (`settableStatuses`); every column when omitted. */
  statuses?: TaskStatus[];
  /**
   * Under the assignee picker: who can be picked and what to do about someone missing (UX audit
   * PROJ-11). The picker lists project members only, and nothing said so.
   */
  assigneeHint?: string;
  /** `attachments` (in wire shape) seeds the attachment list when editing. */
  initial?: Partial<FormShape> & { attachments?: ApiAttachment[] };
  /**
   * Save. **The dialog stays open until this resolves** and does not close itself: the caller
   * closes it on success, so a refused save leaves everything typed (and uploaded) in place. It
   * used to close straight after an un-awaited call, and a failed write took the whole form with it
   * (QA audit 2026-10-08, WP-300).
   */
  onSubmit: (values: TaskFormValues) => Promise<void>;
}

export function TaskFormDialog({
  mode,
  open,
  onOpenChange,
  projectId,
  members,
  statuses = TASK_STATUS_ORDER,
  assigneeHint = "Only people on this project can be assigned.",
  initial,
  onSubmit,
}: TaskFormDialogProps) {
  // The attachment list (wire shape) and the names of files still uploading. Kept outside RHF —
  // uploads are async side effects, not form values, and only fold into the submit at the end.
  const [attachments, setAttachments] = useState<ApiAttachment[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const uid = useId();
  /** The message under a field, for its control's `aria-describedby` (UX audit PROJ-18). */
  const errorId = (field: string, error: unknown) => (error ? `${uid}-${field}-error` : undefined);

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
    formState: { errors, isDirty },
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

  /**
   * Has anything been edited since the form opened? The fields, or the files — which live outside
   * the form — added, removed or still uploading. Esc, an outside click or the X then ask before
   * throwing it away (UX audit PROJ-19).
   */
  const initialFileIds = (initial?.attachments ?? []).map((a) => a.id).sort().join(",");
  const edited =
    isDirty ||
    uploading ||
    attachments.map((a) => a.id).sort().join(",") !== initialFileIds;
  const guard = useDiscardGuard(open, edited, () => {
    reset({ ...EMPTY, ...formInitial });
    onOpenChange(false);
  });

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
        // `rejectReason` has passed it, so it has a type the server accepts. The bytes go up under
        // that same type, so the stored object, the presign and the task record all agree.
        const type = contentTypeOf(file) as string;
        const { attachment_id, upload_url } = await presignTaskAttachment(
          projectId,
          file.name,
          type,
        );
        await uploadFileToPresignedUrl(
          upload_url,
          file.type === type ? file : new File([file], file.name, { type }),
        );
        setAttachments((a) => [
          ...a,
          {
            id: attachment_id,
            filename: file.name,
            content_type: type,
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
    // Text pasted into a text field stays text. Excel and Word put a picture of the selection on the
    // clipboard beside the text, and pasting into Title or Description uploaded "image.png" and
    // inserted nothing (QA audit 2026-10-08, WP-506). A screenshot carries no text, so it still
    // attaches from anywhere in the form.
    const target = e.target;
    const intoText =
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    if (intoText && Array.from(e.clipboardData.types).includes("text/plain")) return;
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

  const submit = handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      await onSubmit({
        title: data.title,
        description: data.description,
        status: data.status,
        assigneeIds: data.assigneeIds,
        priority: data.priority,
        dueDate: data.dueDate || null,
        estimateHours: data.estimateHours,
        attachments,
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
        // Esc, an outside click and the X: straight closed when untouched, asked first when not.
        if (!o) guard.requestClose();
        else onOpenChange(o);
      }}
    >
      <DialogContent className={cn("flex max-h-[90vh] flex-col sm:max-w-md", DIM_UNDER_PROMPT)}>
        {/* Inside the content, so it nests: Esc closes the question, not the form (PROJ-19). */}
        <DiscardChangesDialog {...guard.prompt} />
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
            <Field label="Task title" htmlFor={`${uid}-title`} error={errors.title?.message}>
              <Input
                id={`${uid}-title`}
                placeholder="e.g. Wire up the checkout API"
                aria-invalid={!!errors.title}
                aria-describedby={errorId("title", errors.title)}
                {...register("title")}
              />
            </Field>

            <Field
              label="Description"
              htmlFor={`${uid}-description`}
              error={errors.description?.message}
            >
              <Textarea
                id={`${uid}-description`}
                placeholder="Add any detail, context, or acceptance criteria…"
                rows={3}
                aria-invalid={!!errors.description}
                aria-describedby={errorId("description", errors.description)}
                {...register("description")}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Status" htmlFor={`${uid}-status`}>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as TaskStatus)}
                    >
                      <SelectTrigger id={`${uid}-status`} className="w-full">
                        <SelectValue>
                          {(v) => (
                            <TonePill
                              tone={TASK_STATUS_META[v as TaskStatus]?.tone}
                              label={TASK_STATUS_META[v as TaskStatus]?.label}
                              icon={TASK_STATUS_ICON[v as TaskStatus]}
                            />
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s} value={s}>
                            <TonePill
                              tone={TASK_STATUS_META[s].tone}
                              label={TASK_STATUS_META[s].label}
                              icon={TASK_STATUS_ICON[s]}
                            />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Priority" htmlFor={`${uid}-priority`}>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as TaskPriority)}
                    >
                      <SelectTrigger id={`${uid}-priority`} className="w-full">
                        <SelectValue>
                          {(v) => (
                            <TonePill
                              tone={TASK_PRIORITY_META[v as TaskPriority]?.tone}
                              label={TASK_PRIORITY_META[v as TaskPriority]?.label}
                              icon={PRIORITY_ICON[v as TaskPriority]}
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
                              icon={PRIORITY_ICON[p]}
                            />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <Field
              label="Assignees"
              htmlFor={`${uid}-assignees`}
              error={errors.assigneeIds?.message}
            >
              <Controller
                control={control}
                name="assigneeIds"
                render={({ field }) => (
                  <AssigneePicker
                    id={`${uid}-assignees`}
                    members={members}
                    value={field.value}
                    onChange={field.onChange}
                    max={MAX_ASSIGNEES}
                    invalid={!!errors.assigneeIds}
                    describedBy={
                      errorId("assignees", errors.assigneeIds) ?? `${uid}-assignees-hint`
                    }
                  />
                )}
              />
              {/* This said "Leave empty to offer this task to everyone on the project" — the
                  unclaimed-picker behaviour, retired on 2026-09-01 along with unassigned tasks
                  themselves. Now it says who the list holds and what to do about someone missing
                  from it (UX audit PROJ-11). */}
              <p id={`${uid}-assignees-hint`} className="mt-1.5 text-xs text-muted-foreground">
                {assigneeHint}
              </p>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Due date" htmlFor={`${uid}-due`} error={errors.dueDate?.message}>
                <Controller
                  control={control}
                  name="dueDate"
                  render={({ field }) => (
                    <DatePicker
                      id={`${uid}-due`}
                      value={field.value}
                      onChange={field.onChange}
                      min={minDue}
                      placeholder="No due date"
                      aria-describedby={errorId("due", errors.dueDate)}
                      className={cn("w-full", errors.dueDate && "border-destructive")}
                    />
                  )}
                />
              </Field>
              <Field
                label="Estimate (hrs)"
                htmlFor={`${uid}-estimate`}
                error={errors.estimateHours?.message}
              >
                <Input
                  id={`${uid}-estimate`}
                  type="number"
                  min={0}
                  step="any"
                  placeholder="No estimate"
                  aria-invalid={!!errors.estimateHours}
                  aria-describedby={errorId("estimate", errors.estimateHours)}
                  {...register("estimateHours", {
                    setValueAs: (v: unknown) =>
                      v === "" || v === null || v === undefined ? null : Number(v),
                  })}
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
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={uploading || submitting}>
              {uploading
                ? "Uploading…"
                : submitting
                  ? "Saving…"
                  : isEdit
                    ? "Save task"
                    : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TonePill({
  tone,
  label,
  icon: Icon,
}: {
  tone?: string;
  label?: string;
  /** Blocked's stop sign, a priority's arrow — so the option isn't told by colour alone (PROJ-21). */
  icon?: LucideIcon;
}) {
  return (
    <span className="flex items-center gap-2">
      {Icon ? (
        <Icon
          className={cn("size-3.5 shrink-0", toneText[tone as keyof typeof toneText])}
          aria-hidden="true"
        />
      ) : tone ? (
        <span className={cn("size-2 rounded-full", toneDot[tone as keyof typeof toneDot])} />
      ) : null}
      {label ?? "Select"}
    </span>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  /** The control's id, so the label names it and a click on the label focuses it (WP-508). */
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className={cn(error && "text-destructive")}>
        {label}
      </Label>
      {children}
      {/* Its id is what the control's `aria-describedby` names (UX audit PROJ-18). */}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
