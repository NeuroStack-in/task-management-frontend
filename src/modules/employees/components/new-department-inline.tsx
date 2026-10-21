"use client";

/**
 * "+ New department", inside the invite dialog's department picker.
 *
 * A department is required to invite anyone, so an organization with none could invite nobody: the
 * picker read "No departments yet" with no way to make one and no word on where to go (UX audit
 * 2026-10-16, PEOPLE-02). Whoever can manage departments now adds one here and it is picked at once;
 * anyone else is told who can.
 *
 * Same `POST /v1/departments` the Departments settings card sends.
 */
import { useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/use-permissions";
import { friendlyError } from "@/lib/errors";
import { DEPARTMENTS_HREF } from "@/modules/settings/lib/org-sections";
import { createDepartment, type ApiDepartment } from "../services/employees.service";

export function NewDepartmentInline({
  noneYet,
  onCreated,
}: {
  /** The organization has no departments at all — open the form straight away. */
  noneYet: boolean;
  onCreated: (d: ApiDepartment) => void;
}) {
  const { can } = usePermissions();
  const canCreate = can("departments:manage");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!canCreate) {
    return noneYet ? (
      <p className="text-muted-foreground text-xs">
        No departments yet. An admin can add one in{" "}
        {/* A link for whoever can open the page (UX audit SET-15). */}
        {can("settings:view") ? (
          <Link
            href={DEPARTMENTS_HREF}
            className="text-foreground font-medium underline-offset-2 hover:underline"
          >
            Settings → Organization → Departments
          </Link>
        ) : (
          "Settings → Organization → Departments"
        )}
        .
      </p>
    ) : null;
  }

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const created = await createDepartment(trimmed);
      onCreated(created);
      toast.success(`${created.name} added`, {
        description: "It's selected for this invite.",
      });
      setName("");
      setOpen(false);
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't add the department."));
    } finally {
      setBusy(false);
    }
  }

  if (!open && !noneYet) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
      >
        <Plus className="size-3.5" aria-hidden="true" /> New department
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      {noneYet ? (
        <p className="text-muted-foreground text-xs">
          No departments yet — add the first one to invite people into it.
        </p>
      ) : null}
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          placeholder="e.g. Engineering"
          aria-label="New department name"
          maxLength={80}
          className="h-8"
          disabled={busy}
        />
        <Button type="button" size="sm" onClick={add} disabled={busy || !name.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Add
        </Button>
        {!noneYet ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
