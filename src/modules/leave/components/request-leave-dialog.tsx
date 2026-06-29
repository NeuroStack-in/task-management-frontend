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
import { useAuthStore } from "@/stores/auth.store";
import {
  useLeaveStore,
  LEAVE_TYPES,
  LEAVE_TYPE_LABEL,
} from "@/stores/leave-requests.store";

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

const schema = z
  .object({
    type: z.enum(["vacation", "sick", "personal", "unpaid"]),
    startDate: z.string().min(1, "Select a start date."),
    endDate: z.string().min(1, "Select an end date."),
    reason: z.string().trim().min(3, "Add a short reason."),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date can't be before the start date.",
    path: ["endDate"],
  });

type FormValues = z.infer<typeof schema>;

export function RequestLeaveDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const addRequest = useLeaveStore((s) => s.addRequest);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "vacation", startDate: "", endDate: "", reason: "" },
  });

  const start = watch("startDate");
  const end = watch("endDate");
  const days = useMemo(() => workingDays(start, end), [start, end]);

  function close() {
    reset();
    onOpenChange(false);
  }

  const onSubmit = handleSubmit((data) => {
    if (!user) return;
    const d = workingDays(data.startDate, data.endDate);
    addRequest({
      userId: user.id,
      userName: user.name,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      days: d,
      reason: data.reason,
    });
    toast.success("Leave request submitted", {
      description: `${LEAVE_TYPE_LABEL[data.type]} · ${d} day${d === 1 ? "" : "s"} — pending approval`,
    });
    close();
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request leave</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Leave type" error={errors.type?.message}>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
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
                    min={start || undefined}
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
