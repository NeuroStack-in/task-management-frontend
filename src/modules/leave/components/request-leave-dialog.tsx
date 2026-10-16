"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarPlus, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";
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
import { DatePicker, TimePicker } from "@/components/ui/date-picker";
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

/** `days` ago as a local `YYYY-MM-DD` (0 = today). */
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The leave type that may be requested for days already past — the platform's default id. */
export const SICK_TYPE_ID = "sick";
/** How far back sick leave may start (owner decision 2026-10-17, UX audit TIME-04; the server's
 *  `SICK_BACKDATE_DAYS`). A sick day is only known afterwards. */
export const SICK_BACKDATE_DAYS = 7;

/** The earliest day a request of this type may start: today, or a week back for sick leave. */
export function earliestStart(typeId: string): string {
  return isoDaysAgo(typeId === SICK_TYPE_ID ? SICK_BACKDATE_DAYS : 0);
}

/**
 * Inclusive **calendar**-day count between two ISO dates — exactly what the server stores and, at
 * approval, debits (`shared::leave::days_inclusive`).
 *
 * This used to preview Mon–Fri working days, so a Fri→Mon request read "2 days" and cost 4; a
 * Saturday-only request read nothing and cost 1; and with `new Date("YYYY-MM-DD")` parsed as UTC, a
 * viewer west of UTC saw a Monday as Sunday (QA audit 2026-10-08, WP-072). The preview must match
 * the balance. Whether leave *should* skip weekends and holidays is a product rule for the server —
 * change it there, and this follows.
 */
export function requestDays(startIso: string, endIso: string): number {
  const dayOf = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000 : null;
  };
  const from = dayOf(startIso);
  const to = dayOf(endIso);
  if (from === null || to === null || to < from) return 0;
  return to - from + 1;
}

// `type` is a server-configured id (not a fixed enum), so it's validated as a non-empty string and
// the picker is populated from the org's types. The server recomputes the authoritative day count;
// the preview below follows the same rule (`requestDays`: inclusive calendar days).
/** One working day, in minutes — the divisor the server uses (docs/LEAVE.md §2). */
const WORKDAY_MINUTES = 8 * 60;

/** Minutes between two `HH:MM` values; `0` when either is unparseable or the range is backwards. */
function minutesBetween(from: string, to: string): number {
  const mins = (v: string) => {
    const [h, m] = v.split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
  };
  const a = mins(from);
  const b = mins(to);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, b - a) : 0;
}

const schema = z
  .object({
    type: z.string().min(1, "Select a leave type."),
    startDate: z.string().min(1, "Select a start date."),
    endDate: z.string().min(1, "Select an end date."),
    reason: z.string().trim().min(3, "Add a short reason."),
    kind: z.enum(["full_day", "permission"]).default("full_day"),
    fromTime: z.string().default(""),
    toTime: z.string().default(""),
  })
  // Every rule below mirrors the server (docs/LEAVE.md §6) rather than trusting it, so the message
  // arrives before the round-trip instead of as a 400.
  .refine((d) => d.kind !== "permission" || d.startDate === d.endDate, {
    message: "A permission is time off within one day — pick a single date.",
    path: ["endDate"],
  })
  .refine((d) => d.kind !== "permission" || (!!d.fromTime && !!d.toTime), {
    message: "Enter the start and end time.",
    path: ["fromTime"],
  })
  .refine(
    (d) =>
      d.kind !== "permission" ||
      !d.fromTime ||
      !d.toTime ||
      minutesBetween(d.fromTime, d.toTime) > 0,
    { message: "The end time must be after the start time.", path: ["toTime"] },
  )
  .refine(
    (d) =>
      d.kind !== "permission" ||
      !d.fromTime ||
      !d.toTime ||
      minutesBetween(d.fromTime, d.toTime) >= 30,
    { message: "A permission is at least 30 minutes.", path: ["toTime"] },
  )
  .refine(
    (d) =>
      d.kind !== "permission" ||
      !d.fromTime ||
      !d.toTime ||
      minutesBetween(d.fromTime, d.toTime) <= 240,
    {
      message: "Longer than 4 hours? Request a full day instead.",
      path: ["toTime"],
    },
  )
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date can't be before the start date.",
    path: ["endDate"],
  })
  .refine((d) => !d.startDate || d.type !== SICK_TYPE_ID || d.startDate >= earliestStart(d.type), {
    message: `Sick leave can start at most ${SICK_BACKDATE_DAYS} days ago.`,
    path: ["startDate"],
  })
  .refine((d) => !d.startDate || d.type === SICK_TYPE_ID || d.startDate >= earliestStart(d.type), {
    message: `Leave can't start in the past — only sick leave can, up to ${SICK_BACKDATE_DAYS} days back.`,
    path: ["startDate"],
  });

type FormValues = z.infer<typeof schema>;

export function RequestLeaveDialog({
  open,
  onOpenChange,
  types,
  onSubmit: submitRequest,
  employees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: ApiLeaveType[];
  /** `forUserId` is set when recording on someone's behalf (`employees` given). */
  onSubmit: (req: NewLeaveRequest, forUserId?: string) => Promise<void>;
  /**
   * Record leave **for one of these people** instead of for yourself — the `leave:manage` path
   * (owner decision 2026-10-17). Adds an Employee picker and drops Documents, which only the
   * employee can attach.
   */
  employees?: { id: string; name: string }[];
}) {
  const onBehalf = employees !== undefined;
  const [employeeId, setEmployeeId] = useState("");
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "",
      startDate: "",
      endDate: "",
      reason: "",
      kind: "full_day",
      fromTime: "",
      toTime: "",
    },
  });

  const start = watch("startDate");
  const end = watch("endDate");
  const kind = watch("kind");
  const fromTime = watch("fromTime");
  const toTime = watch("toTime");
  const type = watch("type");
  const isPermission = kind === "permission";
  const permissionMinutes = isPermission ? minutesBetween(fromTime, toTime) : 0;
  const wholeDays = useMemo(() => requestDays(start, end), [start, end]);
  // What will actually be deducted, so the preview matches the balance rather than the calendar.
  const days = isPermission
    ? permissionMinutes / WORKDAY_MINUTES
    : wholeDays;
  // Earliest selectable day: today, or a week back for sick leave (client-local; the server re-checks).
  const earliest = useMemo(() => earliestStart(type), [type]);

  // Documents are uploaded as they are picked, not on submit: the bytes go straight to S3 against
  // a presigned URL, so by the time the form posts there is nothing left to wait for. The cost is
  // an orphaned S3 object if the dialog is abandoned — the bucket lifecycle sweeps those.
  const [docs, setDocs] = useState<ApiLeaveAttachment[]>([]);
  const [uploading, setUploading] = useState<string[]>([]);
  // Bumped on every close. This component stays mounted while the dialog is shut, so an upload
  // still in flight when Cancel was pressed used to land in the reset state and pre-attach itself
  // to the *next* request (QA audit 2026-10-08, WP-477). A late upload from an older generation is
  // dropped instead (its S3 object is swept like any abandoned one).
  const generation = useRef(0);
  // Label ↔ control ids, so every field is announced by its label (WP-478).
  const fieldId = useId();

  function close() {
    generation.current += 1;
    reset();
    setDocs([]);
    setUploading([]);
    setEmployeeId("");
    setEmployeeError(null);
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
    const gen = generation.current;
    const slots = LEAVE_DOC_MAX_COUNT - docs.length - uploading.length;
    if (slots <= 0) {
      toast.error(`You can attach at most ${LEAVE_DOC_MAX_COUNT} documents.`);
      return;
    }
    if (files.length > slots) {
      toast.error(`Only ${LEAVE_DOC_MAX_COUNT} documents per request — some were skipped.`);
    }
    for (const file of files.slice(0, slots)) {
      // Closed meanwhile: don't start uploading the rest into a request that no longer exists.
      if (gen !== generation.current) return;
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
          file.size,
        );
        await uploadFileToPresignedUrl(upload_url, file);
        if (gen !== generation.current) continue;
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
        if (gen === generation.current) toast.error(`Couldn't upload “${file.name}”. Try again.`);
      } finally {
        // Remove by first match rather than by name equality across the whole list, so two files
        // with the same name don't clear each other's spinner. A closed dialog already cleared it.
        if (gen === generation.current) {
          setUploading((u) => {
            const i = u.indexOf(file.name);
            return i < 0 ? u : [...u.slice(0, i), ...u.slice(i + 1)];
          });
        }
      }
    }
  }

  const onSubmit = handleSubmit(async (data) => {
    if (onBehalf && !employeeId) {
      setEmployeeError("Pick the employee this leave is for.");
      return;
    }
    const label = types.find((t) => t.type_id === data.type)?.name ?? "Leave";
    const who = onBehalf ? employees?.find((e) => e.id === employeeId)?.name : undefined;
    try {
      await submitRequest({
        type_id: data.type,
        from: data.startDate,
        // A permission is one day; the picker below already forces this, and sending the real
        // start twice is clearer than relying on the user not to have moved the end date.
        to: data.kind === "permission" ? data.startDate : data.endDate,
        ...(data.kind === "permission"
          ? {
              kind: "permission" as const,
              from_time: data.fromTime,
              to_time: data.toTime,
            }
          : {}),
        reason: data.reason,
        ...(docs.length && !onBehalf ? { attachments: docs } : {}),
      }, onBehalf ? employeeId : undefined);
      const mins =
        data.kind === "permission" ? minutesBetween(data.fromTime, data.toTime) : 0;
      const what =
        mins > 0
          ? `permission ${data.fromTime}–${data.toTime}`
          : (() => {
              const d = requestDays(data.startDate, data.endDate);
              return `${d} day${d === 1 ? "" : "s"}`;
            })();
      toast.success(
        who ? `Leave recorded for ${who}` : mins > 0 ? "Permission requested" : "Leave request submitted",
        { description: `${label} · ${what} — pending approval` },
      );
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
          <DialogTitle>{onBehalf ? "Record leave for an employee" : "Request leave"}</DialogTitle>
          <DialogDescription>
            {onBehalf
              ? "For leave someone reported to you — a sick day phoned in, say. It goes into the approval queue like any request."
              : "Submit a leave request — it goes to your manager for approval."}{" "}
            Sick leave can be back-dated up to {SICK_BACKDATE_DAYS} days.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {onBehalf ? (
            <Field label="Employee" htmlFor={`${fieldId}-employee`} error={employeeError ?? undefined}>
              <Select
                value={employeeId || null}
                onValueChange={(v) => {
                  setEmployeeId((v as string) ?? "");
                  setEmployeeError(null);
                }}
                items={Object.fromEntries((employees ?? []).map((e) => [e.id, e.name]))}
              >
                <SelectTrigger id={`${fieldId}-employee`} className="w-full">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {(employees ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {/* The two kinds, chosen first — everything below reads differently depending on this,
              so it cannot be a detail tucked underneath the dates. Picking Permission collapses the
              request to one day, because that is what a permission is. */}
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <div className="bg-muted/60 grid grid-cols-2 gap-1 rounded-lg p-1">
                {(
                  [
                    ["full_day", "Full day", "One or more whole days"],
                    ["permission", "Permission", "A few hours within a day"],
                  ] as const
                ).map(([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={field.value === value}
                    onClick={() => {
                      field.onChange(value);
                      // A permission is a single date. Collapsing the range here means the user
                      // never sees a validation error for a state the UI let them build.
                      if (value === "permission" && start) setValue("endDate", start);
                    }}
                    className={cn(
                      "rounded-md px-3 py-2 text-left transition-colors",
                      field.value === value
                        ? "bg-background shadow-soft"
                        : "hover:bg-background/60",
                    )}
                  >
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="text-muted-foreground block text-xs">
                      {hint}
                    </span>
                  </button>
                ))}
              </div>
            )}
          />

          <Field label="Leave type" htmlFor={`${fieldId}-type`} error={errors.type?.message}>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={Object.fromEntries(types.map((t) => [t.type_id, t.name]))}
                >
                  <SelectTrigger id={`${fieldId}-type`} className="w-full">
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
            <Field label="Start date" htmlFor={`${fieldId}-start`} error={errors.startDate?.message}>
              <Controller
                control={control}
                name="startDate"
                render={({ field }) => (
                  <DatePicker
                    id={`${fieldId}-start`}
                    value={field.value}
                    onChange={field.onChange}
                    min={earliest}
                    className="w-full"
                  />
                )}
              />
            </Field>
            <Field label="End date" htmlFor={`${fieldId}-end`} error={errors.endDate?.message}>
              <Controller
                control={control}
                name="endDate"
                render={({ field }) => (
                  <DatePicker
                    id={`${fieldId}-end`}
                    value={field.value}
                    onChange={field.onChange}
                    min={start || earliest}
                    className="w-full"
                  />
                )}
              />
            </Field>
          </div>

          {/* The permission window. Shown only in permission mode, so a full-day request never has
              to look at time fields it will ignore. */}
          {/* The app's own picker, not `<input type="time">`: the native control rendered the OS
              spinner — its own typeface, its own palette, a scroll list that ignored the dialog.
              `stepMinutes={15}` keeps a usable granularity; the native input allowed five-minute
              steps, so half-hours would have been a regression. */}
          {isPermission ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="From" htmlFor={`${fieldId}-from`} error={errors.fromTime?.message}>
                <Controller
                  control={control}
                  name="fromTime"
                  render={({ field }) => (
                    <TimePicker
                      id={`${fieldId}-from`}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      stepMinutes={15}
                    />
                  )}
                />
              </Field>
              <Field label="To" htmlFor={`${fieldId}-to`} error={errors.toTime?.message}>
                <Controller
                  control={control}
                  name="toTime"
                  render={({ field }) => (
                    <TimePicker
                      id={`${fieldId}-to`}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      stepMinutes={15}
                    />
                  )}
                />
              </Field>
            </div>
          ) : null}

          {/* What it costs, stated before they submit. A fraction on its own ("0.25 days") is not
              something anyone can sanity-check, so the hours lead and the deduction follows. */}
          {isPermission && permissionMinutes > 0 ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {formatMinutes(permissionMinutes)}
              </span>{" "}
              of permission &mdash; deducts{" "}
              <span className="font-medium text-foreground">
                {+days.toFixed(3)}
              </span>{" "}
              of a day from your balance.
            </p>
          ) : !isPermission && days > 0 ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{days}</span> day
              {days === 1 ? "" : "s"} requested (calendar days, as your balance counts them).
            </p>
          ) : null}

          <Field label="Reason" htmlFor={`${fieldId}-reason`} error={errors.reason?.message}>
            <Input
              id={`${fieldId}-reason`}
              placeholder="e.g. Family vacation"
              {...register("reason")}
            />
          </Field>

          {/* Documents are the employee's to add: an upload is stored under the uploader's id and
              could never be opened from someone else's request. */}
          <div className={cn("space-y-2", onBehalf && "hidden")}>
            <Label htmlFor={`${fieldId}-docs`}>
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
              id={`${fieldId}-docs`}
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
              <CalendarPlus className="size-4" /> {onBehalf ? "Record leave" : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  /** The control's id — ties the label to it, so a screen reader names the field (WP-478). */
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm" htmlFor={htmlFor}>
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
