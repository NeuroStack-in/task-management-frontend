"use client";

import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarPlus, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { DatePicker } from "@/components/ui/date-picker";
import { ApiError } from "@/lib/api";
import { uploadFileToPresignedUrl } from "@/lib/upload";
import {
  presignLeaveDocument,
  LEAVE_DOC_TYPES,
  LEAVE_DOC_MAX_BYTES,
  LEAVE_DOC_MAX_COUNT,
  type ApiLeaveAttachment,
} from "../services/leave.service";
import type {
  ApiLeaveType,
  NewLeaveRequest,
} from "../services/leave.service";

/** Today as a local `YYYY-MM-DD` — the earliest a leave request may start. */
function isoToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Inclusive working-day (Mon–Fri) count between two ISO dates. */
export function workingDays(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (end < start) return 0;
  let n = 0;
  const d = new Date(start);
  while (d <= end) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) n += 1;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

// `type` is a server-configured id (not a fixed enum), so it's validated as a non-empty string and
// the picker is populated from the org's types. The server recomputes the authoritative day count;
// the `days` shown here is a working-day preview only.
const schema = z
  .object({
    type: z.string().min(1, "Select a leave type."),
    startDate: z.string().min(1, "Select a start date."),
    endDate: z.string().min(1, "Select an end date."),
    reason: z.string().trim().min(3, "Add a short reason."),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date can't be before the start date.",
    path: ["endDate"],
  })
  .refine((d) => !d.startDate || d.startDate >= isoToday(), {
    message: "Leave can't start in the past.",
    path: ["startDate"],
  });

type FormValues = z.infer<typeof schema>;

export function RequestLeaveDialog({
  open,
  onOpenChange,
  types,
  onSubmit: submitRequest,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: ApiLeaveType[];
  onSubmit: (req: NewLeaveRequest) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "", startDate: "", endDate: "", reason: "" },
  });

  const start = watch("startDate");
  const end = watch("endDate");
  const days = useMemo(() => workingDays(start, end), [start, end]);
  // Earliest selectable day — leave can't start in the past (computed once, client-local).
  const today = useMemo(() => isoToday(), []);

  // Documents are uploaded as they are picked, not on submit: the bytes go straight to S3 against
  // a presigned URL, so by the time the form posts there is nothing left to wait for. The cost is
  // an orphaned S3 object if the dialog is abandoned — the bucket lifecycle sweeps those.
  const [docs, setDocs] = useState<ApiLeaveAttachment[]>([]);
  const [uploading, setUploading] = useState<string[]>([]);

  function close() {
    reset();
    setDocs([]);
    setUploading([]);
    onOpenChange(false);
  }

  /** Why this file can't be attached, or null. The server re-checks — this is just a faster no. */
  function rejectReason(file: File): string | null {
    if (!(LEAVE_DOC_TYPES as readonly string[]).includes(file.type)) {
      return `“${file.name}” isn't a supported type — use PDF, Word, text or an image.`;
    }
    if (file.size > LEAVE_DOC_MAX_BYTES) {
      return `“${file.name}” is over ${LEAVE_DOC_MAX_BYTES / (1024 * 1024)} MB.`;
    }
    return null;
  }

  async function addFiles(files: File[]) {
    const slots = LEAVE_DOC_MAX_COUNT - docs.length - uploading.length;
    if (slots <= 0) {
      toast.error(`You can attach at most ${LEAVE_DOC_MAX_COUNT} documents.`);
      return;
    }
    if (files.length > slots) {
      toast.error(`Only ${LEAVE_DOC_MAX_COUNT} documents per request — some were skipped.`);
    }
    for (const file of files.slice(0, slots)) {
      const reason = rejectReason(file);
      if (reason) {
        toast.error(reason);
        continue;
      }
      setUploading((u) => [...u, file.name]);
      try {
        const { attachment_id, upload_url } = await presignLeaveDocument(
          file.name,
          file.type,
        );
        await uploadFileToPresignedUrl(upload_url, file);
        setDocs((d) => [
          ...d,
          {
            id: attachment_id,
            filename: file.name,
            content_type: file.type,
            size: file.size,
          },
        ]);
      } catch {
        toast.error(`Couldn't upload “${file.name}”. Try again.`);
      } finally {
        // Remove by first match rather than by name equality across the whole list, so two files
        // with the same name don't clear each other's spinner.
        setUploading((u) => {
          const i = u.indexOf(file.name);
          return i < 0 ? u : [...u.slice(0, i), ...u.slice(i + 1)];
        });
      }
    }
  }

  const onSubmit = handleSubmit(async (data) => {
    const label = types.find((t) => t.type_id === data.type)?.name ?? "Leave";
    try {
      await submitRequest({
        type_id: data.type,
        from: data.startDate,
        to: data.endDate,
        reason: data.reason,
        ...(docs.length ? { attachments: docs } : {}),
      });
      const d = workingDays(data.startDate, data.endDate);
      toast.success("Leave request submitted", {
        description: `${label} · ${d} day${d === 1 ? "" : "s"} — pending approval`,
      });
      close();
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Couldn't submit your request. Try again.";
      toast.error(msg);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request leave</DialogTitle>
          <DialogDescription>
            Submit a leave request — it goes to your manager for approval.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Leave type" error={errors.type?.message}>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={Object.fromEntries(types.map((t) => [t.type_id, t.name]))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t.type_id} value={t.type_id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" error={errors.startDate?.message}>
              <Controller
                control={control}
                name="startDate"
                render={({ field }) => (
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    min={today}
                    className="w-full"
                  />
                )}
              />
            </Field>
            <Field label="End date" error={errors.endDate?.message}>
              <Controller
                control={control}
                name="endDate"
                render={({ field }) => (
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    min={start || today}
                    className="w-full"
                  />
                )}
              />
            </Field>
          </div>

          {days > 0 ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{days}</span> working
              day{days === 1 ? "" : "s"} requested.
            </p>
          ) : null}

          <Field label="Reason" error={errors.reason?.message}>
            <Input placeholder="e.g. Family vacation" {...register("reason")} />
          </Field>

          <div className="space-y-2">
            <Label>
              Documents <span className="text-muted-foreground">optional</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              A certificate or booking, if it helps your approver. PDF, Word, text or image —
              up to {LEAVE_DOC_MAX_COUNT} files, {LEAVE_DOC_MAX_BYTES / (1024 * 1024)} MB each.
            </p>

            {docs.length || uploading.length ? (
              <ul className="space-y-1">
                {docs.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                  >
                    <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{d.filename}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${d.filename}`}
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setDocs((list) => list.filter((x) => x.id !== d.id))}
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
                {uploading.map((name, i) => (
                  <li
                    key={`${name}-${i}`}
                    className="flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-1.5 text-sm text-muted-foreground"
                  >
                    <Paperclip className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    <span className="text-xs">Uploading…</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <Input
              type="file"
              multiple
              accept={LEAVE_DOC_TYPES.join(",")}
              className="cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
              onChange={(e) => {
                const picked = e.target.files ? Array.from(e.target.files) : [];
                // Reset so picking the same file again still fires change.
                e.target.value = "";
                void addFiles(picked);
              }}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            {/* Submitting mid-upload would post a request missing the document the person just
                chose, with no sign anything was lost. */}
            <Button type="submit" disabled={isSubmitting || uploading.length > 0}>
              <CalendarPlus className="size-4" /> Submit request
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
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
