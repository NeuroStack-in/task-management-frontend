"use client";

/**
 * The organization's primary timezone — a searchable picker (UX audit 2026-10-16, SET-16).
 *
 * It was a plain select of fifteen zones. Every IANA zone is offered now, with its current UTC offset,
 * searchable by city, zone or offset, plus a one-click "use this browser's zone" (`lib/timezones.ts`).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, LocateFixed, Search } from "lucide-react";
import { useAnchoredPopup } from "@/components/ui/anchored-popup";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  browserZone,
  canonicalZone,
  currentOffsetMinutes,
  formatOffset,
  pickerZones,
  searchZones,
  zoneParts,
} from "../../lib/timezones";

const PANEL_W = 340;
const PANEL_H = 380;

export function TimezonePicker({
  value,
  onChange,
  disabled = false,
  id,
  "aria-describedby": describedBy,
  warn = false,
}: {
  value: string;
  onChange: (tz: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
  /** Outline the trigger — the value needs attention (the field's own message says why). */
  warn?: boolean;
}) {
  const { open, setOpen, toggle, triggerRef, panelRef, pos } = useAnchoredPopup(PANEL_W, PANEL_H);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // Read after mount: the server render has no browser zone, and reading it during render would
  // differ between the two.
  const [mine, setMine] = useState<string | null>(null);
  useEffect(() => setMine(browserZone()), []);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const results = useMemo(() => (open ? searchZones(query) : []), [open, query]);
  const current = value.trim();
  const listed = pickerZones().includes(canonicalZone(current));
  const mineSupported = mine !== null && pickerZones().includes(mine);

  const pick = (tz: string) => {
    onChange(tz);
    setOpen(false);
  };

  const label = (() => {
    if (!current) return null;
    if (!listed) return current; // a sign-up fixed-offset label, shown as stored
    const z = canonicalZone(current);
    const { city, region } = zoneParts(z);
    const off = formatOffset(currentOffsetMinutes(z));
    return `${city}${region && z !== "UTC" ? ` (${region})` : ""}${off && z !== "UTC" ? ` · ${off}` : ""}`;
  })();

  return (
    <div ref={triggerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
        className={cn(
          "border-input bg-background hover:bg-muted/40 focus-visible:ring-ring/40 flex h-9 w-full items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
          warn && "border-warning",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !label && "text-muted-foreground")}>
          {label ?? "Select a timezone…"}
        </span>
        <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Choose the organization's timezone"
              className="bg-popover text-popover-foreground ring-foreground/10 fixed z-[60] flex flex-col rounded-lg border p-1.5 shadow-lg ring-1"
              style={{
                top: pos.top,
                left: pos.left,
                width: `min(${PANEL_W}px, calc(100vw - 16px))`,
              }}
            >
              <div className="relative mb-1.5">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
                <input
                  ref={searchRef}
                  data-autofocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search by city, timezone or UTC offset"
                  placeholder="Search city, zone or offset (+5:30)"
                  className="border-input bg-background focus-visible:ring-ring/40 h-8 w-full rounded-md border pr-2 pl-7 text-sm focus-visible:ring-2 focus-visible:outline-none"
                />
              </div>

              {mineSupported && mine !== canonicalZone(current) && !query ? (
                <button
                  type="button"
                  onClick={() => pick(mine)}
                  className="hover:bg-muted mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                >
                  <LocateFixed className="text-primary size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    Use this browser&apos;s timezone · {zoneParts(mine).city}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {formatOffset(currentOffsetMinutes(mine))}
                  </span>
                </button>
              ) : null}

              <ScrollArea className="h-72">
                <ul className="space-y-0.5 pr-1.5">
                  {/* A stored label the list doesn't hold (sign-up's fixed offsets) stays visible and
                      selected, so opening the picker never implies it is unset. */}
                  {current && !listed && !query ? (
                    <li>
                      <span className="bg-primary text-primary-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                        <Check className="size-3.5 shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{current}</span>
                        <span className="text-xs opacity-80">Current</span>
                      </span>
                    </li>
                  ) : null}
                  {results.length === 0 ? (
                    <li className="text-muted-foreground px-2 py-6 text-center text-sm">
                      No timezone matches “{query}”.
                    </li>
                  ) : (
                    results.map((o) => {
                      const selected = canonicalZone(current) === o.id;
                      return (
                        <li key={o.id}>
                          <button
                            type="button"
                            aria-pressed={selected}
                            onClick={() => pick(o.id)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                              selected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{o.city}</span>
                              <span
                                className={cn(
                                  "block truncate text-xs",
                                  selected ? "text-primary-foreground/80" : "text-muted-foreground",
                                )}
                              >
                                {o.id === "UTC" ? o.region : o.id}
                              </span>
                            </span>
                            <span
                              className={cn(
                                "shrink-0 text-xs tabular-nums",
                                selected ? "text-primary-foreground/80" : "text-muted-foreground",
                              )}
                            >
                              {formatOffset(o.offset)}
                            </span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </ScrollArea>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
