"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { useOrgCurrency } from "@/hooks/use-org";
import { formatCurrency } from "@/lib/currency";
import { formatHours } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { getMyPayslips, type MyPayslip } from "../services/payslips.service";

/**
 * Where an employee's payslips are: `/time-tracking#payslips` (UX audit 2026-10-16, TIME-19).
 *
 * Exported so every link to it — the "My payslips" button at the top of Time Tracking, and any
 * search or access-wall link the shell adds — uses the one id. A hand-typed copy keeps working
 * right up until someone renames this, and then silently lands at the top of the page.
 */
export const PAYSLIPS_ANCHOR = "payslips";
export const PAYSLIPS_HREF = `/time-tracking#${PAYSLIPS_ANCHOR}`;

/**
 * "My payslips" — an in-page link to the card, for the top of Time Tracking. A real link (it goes
 * somewhere), so it is announced as one; styled by the caller.
 */
export function PayslipsLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={`#${PAYSLIPS_ANCHOR}`}
      className={className}
      onClick={(e) => {
        const el = document.getElementById(PAYSLIPS_ANCHOR);
        if (!el) return;
        e.preventDefault();
        window.history.replaceState(null, "", `#${PAYSLIPS_ANCHOR}`);
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      {children}
    </a>
  );
}

/** `2026-09` → "September 2026"; anything else as given. */
function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return period;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Personal pay, beside the weekly-hours chart on the personal Time Tracking view: the employee's own
 * **finalized** payslips (`GET /v1/me/payslips`), newest first.
 *
 * Until the owner's decision of 2026-10-09 there was no self-service payslip route, so this card
 * could only say "ask HR" (QA audit 2026-10-08, WP-376 / WP-424). Drafts never appear — the server
 * serves a slip only once its run is final — and nothing is estimated.
 *
 * It sits at the foot of the page, so it is a named section with an anchor (`#payslips`) that the
 * page header links to, and that it scrolls itself to once loaded (TIME-19).
 */
export function PayrollWidget() {
  const currency = useOrgCurrency() ?? undefined;
  const [slips, setSlips] = useState<MyPayslip[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let live = true;
    setError(null);
    getMyPayslips().then(
      (s) => live && setSlips(s),
      (e: unknown) =>
        live &&
        setError(e instanceof ApiError ? e.message : "Couldn't load your payslips."),
    );
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => load(), [load]);

  // Honour `#payslips` (a link from elsewhere — search, the payroll wall). The browser's own hash
  // scroll fires on navigation, while this is a spinner at the foot of a page whose sections above
  // (today's sessions, history, the chart) are still loading and growing — so one scroll lands and
  // is then pushed off screen. Follow the card for a few seconds until the layout settles, and stop
  // the moment the reader scrolls, taps or types. Once per mount.
  const settled = slips !== undefined || error !== null;
  const scrolled = useRef(false);
  useEffect(() => {
    if (!settled || scrolled.current) return;
    if (window.location.hash !== `#${PAYSLIPS_ANCHOR}`) return;
    const el = document.getElementById(PAYSLIPS_ANCHOR);
    if (!el) return;
    scrolled.current = true;
    let lastTop = Number.NaN;
    const follow = () => {
      const top = Math.round(el.getBoundingClientRect().top);
      if (top !== lastTop) el.scrollIntoView({ block: "start" });
      lastTop = Math.round(el.getBoundingClientRect().top);
    };
    follow();
    const timer = window.setInterval(follow, 250);
    const stop = () => {
      window.clearInterval(timer);
      for (const ev of ["wheel", "touchstart", "keydown", "pointerdown"] as const) {
        window.removeEventListener(ev, stop);
      }
    };
    for (const ev of ["wheel", "touchstart", "keydown", "pointerdown"] as const) {
      window.addEventListener(ev, stop, { passive: true });
    }
    const end = window.setTimeout(stop, 5000);
    return () => {
      window.clearTimeout(end);
      stop();
    };
  }, [settled]);

  const money = (n: number) => formatCurrency(n, currency);

  let body: React.ReactNode;
  if (error) {
    body = (
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-muted-foreground text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>
          Retry
        </Button>
      </CardContent>
    );
  } else if (slips === undefined) {
    body = (
      <CardContent className="flex flex-1 items-center justify-center">
        <Loader label="Loading payslips…" />
      </CardContent>
    );
  } else if (slips === null || slips.length === 0) {
    body = (
      <CardContent className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={Wallet}
          title="No payslips yet"
          description={
            slips === null
              ? "Payslips aren't available on this server yet. Ask your HR or payroll team for yours."
              : "Your payslip appears here once payroll for a month is finalized. You'll get a notification when it's ready."
          }
          className="border-0"
        />
      </CardContent>
    );
  } else {
    const [latest, ...earlier] = slips;
    body = (
      <CardContent className="flex flex-1 flex-col gap-4">
        <div>
          <p className="text-muted-foreground text-xs">
            {monthLabel(latest.period)} · net pay
          </p>
          <p className="text-2xl font-semibold tabular-nums">{money(latest.net)}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Gross</dt>
            <dd className="text-right tabular-nums">{money(latest.gross)}</dd>
            <dt className="text-muted-foreground">Deductions</dt>
            <dd className="text-right tabular-nums">−{money(latest.deductions)}</dd>
            {/* Every tracked hour is paid since 2026-10-18 (TIME-06); older slips were paid on
                billable hours, which is what they carry. */}
            {latest.pay_type === "hourly" &&
            typeof (latest.worked_secs ?? latest.billable_secs) === "number" ? (
              <>
                <dt className="text-muted-foreground">Hours paid</dt>
                <dd className="text-right tabular-nums">
                  {formatHours((latest.worked_secs ?? latest.billable_secs ?? 0) / 3600)} ×{" "}
                  {money(latest.rate)}
                </dd>
              </>
            ) : null}
          </dl>
        </div>
        {earlier.length > 0 ? (
          <ul className="divide-y border-t text-sm" aria-label="Earlier payslips">
            {earlier.slice(0, 5).map((s) => (
              <li key={s.period} className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">{monthLabel(s.period)}</span>
                <span className="tabular-nums">{money(s.net)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    );
  }

  return (
    <section
      id={PAYSLIPS_ANCHOR}
      aria-labelledby="payslips-title"
      className="h-full scroll-mt-24"
    >
      <Card className="flex h-full flex-col">
        {/* Titled in every state, so the section the header links to always says what it is. */}
        <CardHeader className="pb-2">
          <CardTitle id="payslips-title" className="flex items-center gap-2 text-sm font-medium">
            <Wallet className="text-muted-foreground size-4" />
            My payslips
          </CardTitle>
        </CardHeader>
        {body}
      </Card>
    </section>
  );
}
