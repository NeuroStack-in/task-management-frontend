"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { COUNTRIES, countryFromDial, type Country } from "@/lib/countries";
import { useAnchoredPopup } from "./anchored-popup";
import { ScrollArea } from "./scroll-area";

const PANEL_W = 288;
const PANEL_H = 320;

/**
 * A country's flag.
 *
 * **Not an emoji flag, deliberately.** `🇮🇳` is the obvious zero-dependency answer and it does not
 * work for the people using this: Windows ships no flag glyphs in Segoe UI Emoji, so Chrome on
 * Windows renders the regional-indicator pair as the bare letters "IN". Every screenshot from this
 * team is Windows 11, so emoji would have shipped a flag picker with no flags in it.
 *
 * The image is decorative — the country name and dial code are always beside it — so a failed load
 * is not a broken control. `onError` swaps in the ISO letters, which is what an offline client, a
 * blocked CDN, or a country we have wrong will show.
 */
function Flag({ iso, className }: { iso: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className={cn(
          "text-muted-foreground inline-flex w-5 shrink-0 justify-center font-mono text-[10px]",
          className,
        )}
      >
        {iso}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a 20px flag needs no optimisation pass,
    // and next/image would require configuring a remote pattern for a purely decorative asset.
    <img
      src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`}
      alt=""
      width={20}
      height={15}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("h-[15px] w-5 shrink-0 rounded-[2px] object-cover", className)}
    />
  );
}

/** Split a stored value into a country and the national part, without ever guessing. */
export function parse(value: string): { country: Country | null; national: string } {
  const raw = (value ?? "").trim();
  if (!raw) return { country: null, national: "" };
  if (!raw.startsWith("+")) {
    // **No country code stored, so no country is claimed.** Existing rows hold bare local numbers
    // (`9384603229`) alongside real E.164 (`+2348169048886`). Defaulting the picker to the org's
    // country would silently relabel that Nigerian number as Indian the moment someone opened the
    // form — and saving would then write the lie back. An unset country is the honest state.
    return { country: null, national: raw.replace(/[^\d]/g, "") };
  }
  const digits = raw.replace(/[^\d]/g, "");
  const country = countryFromDial(digits);
  return {
    country,
    national: country ? digits.slice(country.dial.length) : digits,
  };
}

/**
 * A phone number with its country code and flag.
 *
 * Emits **E.164** (`+919876543210`) once a country is chosen, which is the only format that means
 * the same thing to everyone. Before that it emits the digits as typed, because refusing to hold a
 * half-entered number would make the field unusable — and because the server accepts free text, so
 * the old bare-local values must stay editable rather than being rejected by a control that arrived
 * after them.
 */
export function PhoneInput({
  value,
  onChange,
  id,
  disabled = false,
  placeholder = "Phone number",
  className,
  /**
   * Classes for the two visible boxes.
   *
   * The auth pages are a SEPARATE design system — `--m-*` variables, 2.75rem controls, a border
   * colour chosen to clear WCAG 1.4.11 against that surface. A control styled in app tokens sits
   * visibly wrong there: shorter, different radius, a hairline that fails the contrast rule the
   * page was built around. These let the caller hand over that page's own classes instead of
   * forking the component.
   */
  triggerClassName,
  inputClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  inputClassName?: string;
}) {
  const { open, setOpen, toggle, triggerRef, panelRef, pos } = useAnchoredPopup(
    PANEL_W,
    PANEL_H,
  );
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const { country, national } = parse(value);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    // Focus the search on open: 172 countries is a scroll, and typing two letters beats it.
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase().startsWith(q) ||
        c.dial.startsWith(q.replace(/^\+/, "")),
    );
  }, [query]);

  const emit = (c: Country | null, nat: string) => {
    const digits = nat.replace(/[^\d]/g, "");
    onChange(c ? (digits ? `+${c.dial}${digits}` : `+${c.dial}`) : digits);
  };

  return (
    <div className={cn("flex", className)}>
      <div ref={triggerRef} className="relative">
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          aria-label={country ? `Country: ${country.name}` : "Select country code"}
          className={cn(
            "border-input bg-background hover:bg-muted/40 focus-visible:ring-ring/40 flex h-9 items-center gap-1.5 rounded-l-md border border-r-0 px-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
            disabled && "cursor-not-allowed opacity-50",
            triggerClassName,
          )}
        >
          {country ? (
            <>
              <Flag iso={country.iso} />
              <span className="font-mono text-xs">+{country.dial}</span>
            </>
          ) : (
            <span className="text-muted-foreground text-xs">Code</span>
          )}
          <ChevronDown className="text-muted-foreground size-3.5" />
        </button>

        {open && pos
          ? createPortal(
              <div
                ref={panelRef}
                className="bg-popover text-popover-foreground ring-foreground/10 fixed z-[60] rounded-lg border p-1.5 shadow-lg ring-1"
                style={{ top: pos.top, left: pos.left, width: PANEL_W }}
              >
                <div className="relative mb-1.5">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search country or code"
                    className="border-input bg-background focus-visible:ring-ring/40 h-8 w-full rounded-md border pl-7 pr-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  />
                </div>
                <ScrollArea className="h-64">
                  <div className="space-y-0.5 pr-1.5">
                    {results.length === 0 ? (
                      <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                        No country matches “{query}”.
                      </p>
                    ) : (
                      results.map((c) => (
                        <button
                          key={c.iso}
                          type="button"
                          onClick={() => {
                            emit(c, national);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                            country?.iso === c.iso
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted",
                          )}
                        >
                          <Flag iso={c.iso} />
                          <span className="flex-1 truncate">{c.name}</span>
                          <span
                            className={cn(
                              "font-mono text-xs",
                              country?.iso === c.iso
                                ? "text-primary-foreground/80"
                                : "text-muted-foreground",
                            )}
                          >
                            +{c.dial}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>,
              document.body,
            )
          : null}
      </div>

      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        disabled={disabled}
        placeholder={placeholder}
        value={national}
        // Digits only. A pasted "+91 98765 43210" would otherwise land in the national part and
        // save as "+91+919876543210"; stripping here means paste does the obvious thing.
        onChange={(e) => emit(country, e.target.value)}
        className={cn(
          "border-input bg-background focus-visible:ring-ring/40 h-9 w-full min-w-0 rounded-r-md border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
          disabled && "cursor-not-allowed opacity-50",
          inputClassName,
        )}
      />
    </div>
  );
}
