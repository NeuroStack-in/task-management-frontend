"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { membersLabel, tierOf } from "@/modules/billing/lib/plans";

/* ----------------------------- options ------------------------------- */

/**
 * The exact strings Settings → Organization offers for the same two fields. Sign-up had its own
 * ("Software / SaaS", "11–50" with an en dash), so an org's industry and size came back from the
 * server as values the Settings pickers didn't list (QA audit 2026-10-08, WP-392). Keep in step with
 * `INDUSTRY_OPTIONS` / `SIZE_OPTIONS` in `settings/components/organization-tab.tsx`.
 */
export const INDUSTRIES = [
  "Software", "Technology", "Finance", "Healthcare", "Education", "Retail",
  "Manufacturing", "Media", "Consulting", "Non-profit", "Government", "Other",
];
export const SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"];
export const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "India",
  "Germany", "France", "Singapore", "United Arab Emirates", "Other",
];
export const CURRENCIES = [
  "USD — US Dollar", "EUR — Euro", "GBP — British Pound", "INR — Indian Rupee",
  "AUD — Australian Dollar", "SGD — Singapore Dollar", "AED — UAE Dirham", "CAD — Canadian Dollar",
];
export const TIMEZONES = [
  "(GMT−08:00) Pacific Time", "(GMT−05:00) Eastern Time", "(GMT+00:00) London / GMT",
  "(GMT+01:00) Central Europe", "(GMT+04:00) Gulf Standard", "(GMT+05:30) India Standard",
  "(GMT+08:00) Singapore", "(GMT+10:00) Sydney",
];
export const COUNTRY_CURRENCY: Record<string, string> = {
  "United States": "USD — US Dollar",
  "United Kingdom": "GBP — British Pound",
  Canada: "CAD — Canadian Dollar",
  Australia: "AUD — Australian Dollar",
  India: "INR — Indian Rupee",
  Germany: "EUR — Euro",
  France: "EUR — Euro",
  Singapore: "SGD — Singapore Dollar",
  "United Arab Emirates": "AED — UAE Dirham",
};

/**
 * The `id`s here are the contract — they're what gets sent to the server, which accepts
 * exactly `free | starter | enterprise` (`Plan` in `crates/wp-contracts/src/plans.rs`,
 * serialized lowercase). They were `free | pro | max`: two of the three would have been
 * rejected outright once signup talks to a real API.
 */
export const PLANS = [
  {
    id: "free",
    name: "Free",
    monthly: tierOf("free").pricePerSeat,
    annual: tierOf("free").annualPerSeat,
    tagline: "For individuals and very small teams getting started.",
    features: [
      "Time tracking, timesheets & attendance",
      "Leave, approvals & projects",
      "Basic reports",
      membersLabel("free"),
    ],
    featured: false,
  },
  {
    id: "starter",
    name: "Starter",
    monthly: tierOf("starter").pricePerSeat,
    annual: tierOf("starter").annualPerSeat,
    tagline: "For growing teams that need real insight.",
    features: [
      "Everything in Free",
      "Activity & productivity analytics",
      "Slack integration",
      membersLabel("starter"),
    ],
    featured: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthly: tierOf("enterprise").pricePerSeat,
    annual: tierOf("enterprise").annualPerSeat,
    tagline: "For organizations operating at scale.",
    features: [
      "Everything in Starter",
      "Screenshot review",
      "AI insights, assistant & PDF reports",
      "Anomaly detection",
      membersLabel("enterprise"),
    ],
    featured: true,
  },
];

/* ------------------------------ MModal ------------------------------- */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MModal({
  open,
  onClose,
  children,
  maxW = "max-w-lg",
  dismissable = true,
  backdropClose = true,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxW?: string;
  dismissable?: boolean;
  backdropClose?: boolean;
  /** Id of the element that names the dialog — its title. */
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Latest `onClose` without re-running the effect: callers pass a fresh arrow every render, and a
  // re-run would yank focus back to the panel mid-use.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    // Focus moves in, stays in, and goes back. The dialog had the role but none of this, so a
    // keyboard user kept tabbing through the page behind it (QA audit 2026-10-08, WP-389).
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    panel?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) onCloseRef.current();
      if (e.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener?.focus();
    };
  }, [open, dismissable]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgb(22 32 43 / 0.45)", backdropFilter: "blur(6px)" }}
        onClick={dismissable && backdropClose ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`m-card m-root m-enter-scale relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden outline-none ${maxW}`}
        style={{ boxShadow: "0 50px 110px -40px rgb(18 28 40 / 0.5)" }}
      >
        {dismissable ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 z-20 flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-[color-mix(in_srgb,var(--m-text)_8%,transparent)]"
            style={{ color: "var(--m-muted)" }}
          >
            <X className="size-4" />
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/* ---------------------- Custom dropdown (themed) --------------------- *
 *  Native <select> popups are OS-drawn and unthemeable. This menu is     *
 *  portalled to <body> (escapes the modal transform), repositions on     *
 *  scroll/resize (instead of closing), flips up near the viewport edge,  *
 *  and adds type-ahead search for longer lists.                          */

export function MSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  ariaLabel,
}: {
  /** Put on the trigger, so a label or an error-summary link can point at the control. */
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  ariaLabel?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{
    left: number;
    width: number;
    maxH: number;
    up: boolean;
    top?: number;
    bottom?: number;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchable = options.length > 7;

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const up = below < 240 && above > below;
      const maxH = Math.max(160, Math.min(300, up ? above : below));
      setPos({
        left: r.left,
        width: r.width,
        maxH,
        up,
        top: up ? undefined : r.bottom + 6,
        bottom: up ? window.innerHeight - r.top + 6 : undefined,
      });
    };
    place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true); // reposition, do NOT close
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Into the menu once it is placed: the selected option, else the first. A searchable menu focuses
  // its search box instead (`autoFocus`). The short lists left focus on the trigger, so the keyboard
  // never reached the portalled options (WP-389). Keyed on `placed`, not `pos`, so repositioning
  // on scroll doesn't drag focus back while someone is arrowing through.
  const placed = open && pos !== null;
  useEffect(() => {
    if (!placed || searchable) return;
    const opts = menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    const selected = menuRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    (selected ?? opts?.[0])?.focus();
  }, [placed, searchable]);

  /** Arrow keys, Home and End move between options; Tab closes back to the trigger. */
  const onMenuKey = (e: React.KeyboardEvent) => {
    const opts = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
    );
    if (e.key === "Tab") {
      e.preventDefault();
      setOpen(false);
      btnRef.current?.focus();
      return;
    }
    if (opts.length === 0) return;
    const at = opts.indexOf(document.activeElement as HTMLElement);
    // In the search box (`at` is -1) only ArrowDown leaves it — Home/End still move the caret.
    if (at === -1 && e.key !== "ArrowDown") return;
    const to =
      e.key === "ArrowDown" ? Math.min(at + 1, opts.length - 1)
      : e.key === "ArrowUp" ? Math.max(at - 1, 0)
      : e.key === "Home" ? 0
      : e.key === "End" ? opts.length - 1
      : null;
    if (to === null) return;
    e.preventDefault();
    opts[to]?.focus();
  };

  const filtered =
    searchable && query.trim()
      ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
      : options;

  return (
    <>
      <button
        ref={btnRef}
        id={id}
        type="button"
        className="m-trigger"
        data-open={open}
        data-placeholder={!value}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className="size-4" />
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="m-menu m-root"
              onKeyDown={onMenuKey}
              style={{
                left: pos.left,
                width: pos.width,
                maxHeight: pos.maxH,
                top: pos.top,
                bottom: pos.bottom,
                transformOrigin: pos.up ? "bottom center" : "top center",
              }}
            >
              {searchable ? (
                <div className="m-menu-search">
                  <Search className="size-4 shrink-0" style={{ color: "var(--m-faint)" }} />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    aria-label="Search options"
                  />
                </div>
              ) : null}
              {/* The listbox is the options alone — the search box beside them is not an option. */}
              <div className="m-menu-list" role="listbox" id={listId} aria-label={ariaLabel}>
                {filtered.length ? (
                  filtered.map((o) => (
                    <button
                      key={o}
                      type="button"
                      role="option"
                      aria-selected={o === value}
                      data-on={o === value}
                      className="m-menu-item"
                      onClick={() => {
                        onChange(o);
                        setOpen(false);
                        btnRef.current?.focus();
                      }}
                    >
                      <span>{o}</span>
                      {o === value ? <Check className="size-3.5 shrink-0" /> : null}
                    </button>
                  ))
                ) : (
                  <p className="m-menu-empty">No matches</p>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
