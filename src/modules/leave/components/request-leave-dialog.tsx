"use client";

import { useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
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

  function close() {
    reset();
    onOpenChange(false);
  }

  const onSubmit = handleSubmit(async (data) => {
    const label = types.find((t) => t.type_id === data.type)?.name ?? "Leave";
    try {
      await submitRequest({
        type_id: data.type,
        from: data.startDate,
        to: data.endDate,
        reason: data.reason,
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
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
