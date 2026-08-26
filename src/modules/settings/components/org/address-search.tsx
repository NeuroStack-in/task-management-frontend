"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { geocode, GEOCODE_DEBOUNCE_MS, type GeoResult } from "@/lib/geocode";

/**
 * Type an address, pick a match, move the pin.
 *
 * An **addition** to dragging the pin, never a replacement: the map stays draggable and the radius
 * stays adjustable. Typing is faster when you know the address; dragging is the only option when
 * you don't, and neither should require the other.
 *
 * Debounced and abortable because Nominatim's usage policy caps us at roughly one request per
 * second — see `lib/geocode`.
 */
export function AddressSearch({
  onPick,
  disabled,
  placeholder = "Search an address to move the pin…",
}: {
  onPick: (r: GeoResult) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const abort = useRef<AbortController | null>(null);
  /** Set when a suggestion is chosen, so echoing its label back doesn't re-trigger a search. */
  const justPicked = useRef(false);

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    if (q.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(() => {
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      setBusy(true);
      geocode(q, ctl.signal)
        .then((r) => {
          setResults(r);
          setOpen(true);
        })
        .finally(() => setBusy(false));
    }, GEOCODE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  // Abort anything in flight when this unmounts — a resolved fetch setting state afterwards is the
  // classic "state update on an unmounted component" warning.
  useEffect(() => () => abort.current?.abort(), []);

  return (
    <div className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
      <Input
        value={q}
        disabled={disabled}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        // A click on a suggestion blurs the input first, so closing must wait for it to land.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="h-9 pl-8"
        aria-label="Search an address"
      />
      {busy ? (
        <Loader2 className="text-muted-foreground absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin" />
      ) : null}

      {open ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-md">
          {results.length === 0 ? (
            <p className="text-muted-foreground p-3 text-xs">
              No match. You can still drag the pin on the map.
            </p>
          ) : (
            results.map((r) => (
              <button
                key={`${r.lat},${r.lng},${r.label}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  justPicked.current = true;
                  setQ(r.label);
                  setOpen(false);
                  onPick(r);
                }}
                className={cn(
                  "block w-full px-3 py-2 text-left text-xs hover:bg-muted",
                  "border-b last:border-b-0",
                )}
              >
                {r.label}
              </button>
            ))
          )}
          <p className="text-muted-foreground border-t px-3 py-1.5 text-[0.65rem]">
            Search by OpenStreetMap
          </p>
        </div>
      ) : null}
    </div>
  );
}
