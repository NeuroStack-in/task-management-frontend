"use client";

/**
 * Set an employee's compensation — `PUT /v1/payroll/comp/{user_id}`.
 *
 * This writes salary data, so it is rendered only for `payroll:manage` holders (the caller gates it
 * too). The server has **no comp read**, so the form deliberately starts empty for every employee:
 * showing a "current rate" would mean inventing one.
 */
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
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
import { ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/mock-billing";
import type { ApiEmployee } from "@/modules/employees/services/employees.service";
import {
  PAY_TYPES,
  type ApiEmployeeComp,
  type SetCompRequest,
} from "../services/payroll.service";

// Mirrors the server's validation (`employee_comp::handler`): pay_type ∈ {hourly, salaried} and a
// non-negative rate. The server is still the real gate; this just avoids a pointless round trip.
const schema = z.object({
  userId: z.string().min(1, "Select an employee."),
  payType: z.enum(PAY_TYPES),
  rate: z
    .string()
    .min(1, "Enter a rate.")
    .refine((v) => Number.isFinite(Number(v)), "Enter a number.")
    .refine((v) => Number(v) >= 0, "Rate must be zero or more."),
});

type FormValues = z.infer<typeof schema>;

export function EmployeeCompDialog({
  open,
  onOpenChange,
  employees,
  employeesLoading,
  employeesError,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: ApiEmployee[];
  employeesLoading: boolean;
  employeesError: string | null;
  onSave: (userId: string, req: SetCompRequest) => Promise<ApiEmployeeComp>;
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
    defaultValues: { userId: "", payType: "salaried", rate: "" },
  });

  useEffect(() => {
    if (open) reset({ userId: "", payType: "salaried", rate: "" });
  }, [open, reset]);

  const payType = watch("payType");
  const rate = Number(watch("rate"));

  const onSubmit = handleSubmit(async (data) => {
    const name = employees.find((e) => e.user_id === data.userId)?.name ?? "Employee";
    try {
      const saved = await onSave(data.userId, {
        pay_type: data.payType,
        rate: Number(data.rate),
      });
      toast.success(`Compensation set for ${name}`, {
        description: `${saved.pay_type} · ${formatCurrency(saved.rate)}${
          saved.pay_type === "hourly" ? " /hr" : ""
        }`,
      });
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        toast.error("That employee no longer exists.", {
          description: "Refresh the list and try again.",
        });
      } else {
        toast.error(
          e instanceof ApiError ? e.message : "Couldn't save compensation. Try again.",
        );
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set compensation</DialogTitle>
          <DialogDescription>
            Pay type and rate are what a draft pay run computes its totals from.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Employee" error={errors.userId?.message}>
            <Controller
              control={control}
              name="userId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={employeesLoading || employees.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        employeesLoading ? "Loading employees…" : "Select an employee"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.user_id} value={e.user_id}>
                        {e.name}
                        {e.emp_id ? ` · ${e.emp_id}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {employeesError ? (
            <p className="text-xs text-destructive">{employeesError}</p>
          ) : null}

          <Field label="Pay type" error={errors.payType?.message}>
            <Controller
              control={control}
              name="payType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        <span className="capitalize">{t}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Rate" error={errors.rate?.message}>
            <Input
              inputMode="decimal"
              placeholder={payType === "hourly" ? "e.g. 45" : "e.g. 90000"}
              {...register("rate")}
            />
          </Field>

          {Number.isFinite(rate) && watch("rate") !== "" ? (
            <p className="text-sm text-muted-foreground">
              {formatCurrency(rate)}
              {payType === "hourly" ? " per hour" : " per year"}.
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            This overwrites whatever is stored. The server serves no compensation read, so the
            employee&apos;s current rate can&apos;t be shown here.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Wallet className="size-4" /> {isSubmitting ? "Saving…" : "Save compensation"}
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
