"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEmployeeProfile } from "@/modules/employees/services/employees.service";
import { EMP_PARAM } from "../lib/employee-scope";

/** Names already read this session, so switching tabs doesn't re-fetch the same profile. */
const names = new Map<string, string>();

/** What a viewer who can't read the profile sees in place of the name — never a raw id. */
const UNKNOWN_NAME = "this employee";

/**
 * The display name of the employee the hub is scoped to: `null` while it loads, then the name, or
 * "this employee" when the viewer can't read profiles.
 */
export function useEmployeeName(emp: string | null): string | null {
  const [name, setName] = useState<string | null>(emp ? (names.get(emp) ?? null) : null);
  useEffect(() => {
    if (!emp) {
      setName(null);
      return;
    }
    const cached = names.get(emp);
    if (cached) {
      setName(cached);
      return;
    }
    let live = true;
    setName(null);
    getEmployeeProfile(emp)
      .then((p) => {
        names.set(emp, p.name);
        if (live) setName(p.name);
      })
      .catch(() => {
        // No profile access (or the read failed): settle on a neutral label rather than load forever.
        if (live) setName(UNKNOWN_NAME);
      });
    return () => {
      live = false;
    };
  }, [emp]);
  return name;
}

/** The `?emp=` the hub is scoped to, or `null`. */
export function useScopedEmployee(): string | null {
  return useSearchParams().get(EMP_PARAM);
}

/**
 * "Viewing analytics for <name>" — shown above the Analytics tabs while the hub is scoped to one
 * employee, so it is never unclear whose data the tabs show, with the way back to the whole
 * organization one click away.
 */
export function EmployeeScopeBar() {
  const emp = useScopedEmployee();
  const pathname = usePathname();
  const name = useEmployeeName(emp);
  if (!emp) return null;

  return (
    <section
      aria-label="Analytics scope"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserRound className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Viewing analytics for</p>
          <p className="truncate font-semibold">{name ?? "Loading…"}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/employees/${encodeURIComponent(emp)}`} />}
          nativeButton={false}
        >
          Open profile
        </Button>
        {/* Same tab, no `?emp=` — every tab then shows the organization again. */}
        <Button variant="ghost" size="sm" render={<Link href={pathname} />} nativeButton={false}>
          <X className="size-4" aria-hidden="true" /> Whole organization
        </Button>
      </div>
    </section>
  );
}
