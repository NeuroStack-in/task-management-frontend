"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, EyeOff, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { useScreenshots } from "../use-screenshots";
import type { ShotRow } from "../services/insights.service";

/**
 * Screenshot gallery — the pii-gated monitoring grid (`GET /v1/insights/screenshots`, LLD §14).
 * Each shot is a presigned image tile ordered by capture time (so the grid doubles as the day's
 * timeline). Shots the privacy gate withheld (`redacted` / empty `url`) render a placeholder, never
 * an image. **Real, monitoring-fed:** the day is empty until the desktop agent captures — an honest
 * empty state, never fabricated frames. The mock's per-shot "risk analysis"/scoring is dropped: the
 * server exposes no such field, and inventing one would be fiction.
 */

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + days));
}
function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
/** A short, stable label for a raw user id (no name field on the shot row). */
function shortUser(id: string): string {
  return id.length > 12 ? `${id.slice(0, 12)}…` : id;
}

const ALL_USERS = "__all__";

export function ScreenshotsTab() {
  // Default to yesterday (a completed capture day); client-side to avoid an SSR date mismatch.
  const [date, setDate] = useState<string>("");
  const [userId, setUserId] = useState<string>(ALL_USERS);
  useEffect(() => setDate(shiftIso(isoOf(new Date()), -1)), []);

  const today = isoOf(new Date());
  const filterUser = userId === ALL_USERS ? undefined : userId;
  const { shots, loading, loadingMore, error, hasMore, loadMore } = useScreenshots(
    date,
    filterUser,
  );

  // Accumulate every user id ever seen so the filter options stay stable even
  // after a filter collapses the visible set to a single user.
  const [knownUsers, setKnownUsers] = useState<string[]>([]);
  useEffect(() => {
    if (shots.length === 0) return;
    setKnownUsers((prev) => {
      const set = new Set(prev);
      for (const s of shots) set.add(s.user_id);
      const next = [...set].sort();
      return next.length === prev.length ? prev : next;
    });
  }, [shots]);

  const withheld = useMemo(
    () => shots.filter((s) => s.redacted || !s.url).length,
    [shots],
  );

  return (
    <div className="space-y-5">
      {/* Controls: day nav + optional per-person filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous day"
            disabled={!date}
            onClick={() => setDate((d) => (d ? shiftIso(d, -1) : d))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 w-36"
            aria-label="Capture date"
          />
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next day"
            disabled={!date || date >= today}
            onClick={() => setDate((d) => (d && d < today ? shiftIso(d, 1) : d))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {knownUsers.length > 0 ? (
          <Select value={userId} onValueChange={(v) => setUserId(v as string)}>
            <SelectTrigger className="h-8 w-52" aria-label="Filter by person">
              <SelectValue>
                {(v) =>
                  v == null || v === ALL_USERS
                    ? "All people"
                    : shortUser(String(v))
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL_USERS}>All people</SelectItem>
              {knownUsers.map((u) => (
                <SelectItem key={u} value={u}>
                  {shortUser(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {shots.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{shots.length}</span>{" "}
          {shots.length === 1 ? "screenshot" : "screenshots"}
          {withheld > 0 ? ` · ${withheld} withheld by privacy policy` : ""}
          {hasMore ? " · more available" : ""}
        </p>
      ) : null}

      {loading ? (
        <div className="flex min-h-[16rem] items-center justify-center">
          <Loader label="Loading screenshots…" />
        </div>
      ) : error ? (
        <EmptyState
          icon={ShieldOff}
          title="Couldn't load screenshots"
          description={error}
        />
      ) : shots.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No screenshots for this day"
          description="Screenshots appear here once the desktop agent captures them. Nothing was reported for the selected day."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shots.map((shot) => (
              <ShotCard key={shot.shot_id} shot={shot} />
            ))}
          </div>

          {hasMore ? (
            <div className="flex justify-center pt-1">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ShotCard({ shot }: { shot: ShotRow }) {
  const withheld = shot.redacted || !shot.url;
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {withheld ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted p-4 text-center">
            <EyeOff className="size-5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Withheld by privacy policy
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shot.url}
            alt={`${shot.app} screenshot`}
            loading="lazy"
            className="size-full max-w-full object-cover"
          />
        )}
        <div className="absolute left-2 top-2 max-w-[70%] truncate rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
          {shot.app || "Unknown app"}
        </div>
        {withheld ? (
          <Badge className="absolute right-2 top-2 border-transparent bg-muted text-muted-foreground shadow-sm">
            Redacted
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center justify-between px-3 py-2.5 text-sm">
        <span className="truncate text-xs text-muted-foreground">
          {shortUser(shot.user_id)}
        </span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {formatTime(shot.captured_at)}
        </span>
      </div>
    </Card>
  );
}
