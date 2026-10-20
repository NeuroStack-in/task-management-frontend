"use client";

/**
 * The employee picker on Enrol a device (UX audit SET-13).
 *
 * It was a plain dropdown of the whole directory — no search, so finding one person in 150 meant
 * scrolling — and nothing said who already had a device, so IT found out from a refused mint after
 * walking to the laptop. This one searches name, employee ID and title, and marks each person:
 *
 * - **Has a managed device** — a live managed agent is bound to them; the server refuses a second
 *   code until it is released (`employee_already_has_device`).
 * - **Uses the desktop app** — informational: the interactive app doesn't block a managed device.
 * - **Code pending** — a code was minted and not yet installed.
 *
 * Same construction as the owner picker in Settings → Ownership: a menu with a search box at the
 * top, typing kept out of the menu's own type-ahead.
 */
import { useMemo, useState } from "react";
import { ChevronsUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import type { ApiEmployee } from "@/modules/employees/services/employees.service";

/** Most people listed at once — typing narrows the rest. */
const PICKER_LIMIT = 50;

export interface PickerMarks {
  /** user id → the managed device's name. */
  managed: ReadonlyMap<string, string>;
  /** People running the interactive desktop app on a live device. */
  app: ReadonlySet<string>;
  /** People with a code minted and not yet used. */
  pending: ReadonlySet<string>;
}

export function EmployeePicker({
  id,
  employees,
  value,
  onChange,
  marks,
  loading,
}: {
  id: string;
  employees: ApiEmployee[];
  value: string;
  onChange: (userId: string) => void;
  marks: PickerMarks;
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const chosen = employees.find((e) => e.user_id === value) ?? null;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...employees].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter((e) =>
      [e.name, e.emp_id ?? "", e.title ?? "", e.email ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [employees, query]);
  const shown = matches.slice(0, PICKER_LIMIT);

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenuTrigger
        id={id}
        disabled={loading && employees.length === 0}
        className={cn(
          "border-input bg-background flex h-9 w-full items-center gap-2 rounded-md border px-3 text-left text-sm",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {chosen ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <UserAvatar
              userId={chosen.user_id}
              name={chosen.name}
              className="size-5"
              fallbackClassName="text-[0.55rem]"
            />
            <span className="truncate">{chosen.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground flex-1 truncate">
            {loading ? "Loading…" : "Pick an employee"}
          </span>
        )}
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto max-w-[calc(100vw-2rem)] min-w-72">
        <div className="relative px-1.5 pt-0.5 pb-1.5">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, ID or title"
            aria-label="Search employees"
            className="h-8 pl-7"
            // Typing must reach the input, not the menu's type-ahead.
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-72 overflow-y-auto">
          {employees.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-center text-xs">
              {loading ? "Loading the directory…" : "No active employees to enrol."}
            </p>
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-center text-xs">No one matches.</p>
          ) : (
            shown.map((e) => {
              const managed = marks.managed.get(e.user_id);
              const tags = [
                managed ? { text: `Has a managed device · ${managed}`, tone: "text-warning" } : null,
                !managed && marks.app.has(e.user_id)
                  ? { text: "Uses the desktop app", tone: "text-muted-foreground" }
                  : null,
                marks.pending.has(e.user_id) ? { text: "Code pending", tone: "text-primary" } : null,
              ].filter((t): t is { text: string; tone: string } => t !== null);
              return (
                <DropdownMenuItem
                  key={e.user_id}
                  onClick={() => onChange(e.user_id)}
                  className="gap-2"
                >
                  <UserAvatar
                    userId={e.user_id}
                    name={e.name}
                    className="size-6"
                    fallbackClassName="text-[0.6rem]"
                  />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm">{e.name}</span>
                    {e.title || e.emp_id ? (
                      <span className="text-muted-foreground truncate text-xs">
                        {[e.emp_id, e.title].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                    {tags.map((t) => (
                      <span key={t.text} className={cn("truncate text-xs font-medium", t.tone)}>
                        {t.text}
                      </span>
                    ))}
                  </span>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
        {matches.length > shown.length ? (
          <p className="text-muted-foreground border-t px-2 pt-1.5 pb-1 text-center text-xs">
            Showing {shown.length} of {matches.length} — type to narrow the list.
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
