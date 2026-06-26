"use client";

import { useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
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
import { useRolesStore } from "@/stores/roles.store";
import { useEmployeesStore } from "@/stores/employees.store";
import { SYSTEM_ROLES } from "@/constants/roles";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
] as const;

export function CreateEmployeeDialog({
  open,
  onOpenChange,
  departments,
  existingEmails,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: string[];
  existingEmails: string[];
}) {
  // Select the raw custom roles (a stable reference) — calling getAllRoles()
  // inside the selector returns a new array each render and loops forever.
  const customRoles = useRolesStore((s) => s.customRoles);
  const createEmployee = useEmployeesStore((s) => s.createEmployee);

  // Selectable roles exclude the singleton Organization Owner.
  const assignableRoles = useMemo(
    () =>
      [...SYSTEM_ROLES, ...customRoles].filter((r) => r.id !== "role-owner"),
    [customRoles],
  );

  const taken = useMemo(
    () => new Set(existingEmails.map((e) => e.toLowerCase())),
    [existingEmails],
  );

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, "Enter the employee's full name."),
        email: z
          .string()
          .trim()
          .email("Enter a valid email address.")
          .refine((e) => !taken.has(e.toLowerCase()), "That email is already in use."),
        jobTitle: z.string().trim().min(2, "Enter a job title."),
        department: z.string().min(1, "Select a department."),
        team: z.string().trim().min(1, "Enter a team."),
        roleId: z.string().min(1, "Select a role."),
        status: z.enum(["active", "invited"]),
      }),
    [taken],
  );

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      jobTitle: "",
      department: "",
      team: "",
      roleId: "",
      status: "active",
    },
  });

  function close() {
    reset();
    onOpenChange(false);
  }

  const onSubmit = handleSubmit((data) => {
    const role = assignableRoles.find((r) => r.id === data.roleId);
    const created = createEmployee({
      ...data,
      roleName: role?.name ?? "Member",
    });
    toast.success("Employee account created", {
      description: `${created.name} · ${created.email}`,
    });
    close();
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create employee account</DialogTitle>
          <DialogDescription>
            Add a new member to your organization. Invited accounts receive access
            once they accept; active accounts are enabled immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={errors.name?.message}>
              <Input placeholder="Jordan Lee" {...register("name")} />
            </Field>
            <Field label="Work email" error={errors.email?.message}>
              <Input
                type="email"
                placeholder="jordan@acme.test"
                {...register("email")}
              />
            </Field>
            <Field label="Job title" error={errors.jobTitle?.message}>
              <Input placeholder="Product Designer" {...register("jobTitle")} />
            </Field>
            <Field label="Team" error={errors.team?.message}>
              <Input placeholder="Design" {...register("team")} />
            </Field>

            <Field label="Department" error={errors.department?.message}>
              <Controller
                control={control}
                name="department"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Role" error={errors.roleId?.message}>
              <Controller
                control={control}
                name="roleId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <Field label="Account status" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <UserPlus className="size-4" /> Create account
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
