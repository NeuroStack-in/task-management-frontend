"use client";

import { useMemo, useState } from "react";
import { Camera, EyeOff, Flag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { initials } from "@/lib/format";
import { SCREENSHOTS, type Screenshot } from "@/lib/mock-insights";
import { cn } from "@/lib/utils";

type Filter = "all" | "flagged" | "productive" | "low";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "flagged", label: "Flagged" },
  { key: "productive", label: "Productive" },
  { key: "low", label: "Low activity" },
];

function matches(shot: Screenshot, filter: Filter): boolean {
  switch (filter) {
    case "flagged":
      return shot.flagged;
    case "productive":
      return shot.activity >= 60;
    case "low":
      return shot.activity < 40;
    default:
      return true;
  }
}

/** Why a capture was flagged for review. */
function flagReason(shot: Screenshot): string | null {
  if (!shot.flagged) return null;
  if (shot.app === "YouTube" || shot.app === "Reddit")
    return `Distracting application (${shot.app})`;
  return `Low activity — ${shot.activity}% active`;
}

function activityTone(activity: number): string {
  if (activity >= 60) return "text-success";
  if (activity >= 40) return "text-warning";
  return "text-destructive";
}

export function ScreenshotsTab() {
  const [blur, setBlur] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Screenshot | null>(null);

  const flaggedCount = SCREENSHOTS.filter((s) => s.flagged).length;
  const avgActivity = Math.round(
    SCREENSHOTS.reduce((a, s) => a + s.activity, 0) / SCREENSHOTS.length,
  );
  const shots = useMemo(
    () => SCREENSHOTS.filter((s) => matches(s, filter)),
    [filter],
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Captured today"
          value={SCREENSHOTS.length * 107}
          icon={Camera}
          hint="across all agents"
          trend={[180, 210, 240, 220, 260, 250, 284]}
          featured
        />
        <StatCard
          label="Every"
          value="10 min"
          icon={Camera}
          hint="capture frequency"
        />
        <StatCard
          label="Flagged"
          value={flaggedCount}
          icon={Flag}
          hint="need review"
          delta={-2}
          trend={[6, 5, 7, 4, 6, 5, flaggedCount]}
        />
        <StatCard
          label="Avg activity"
          value={`${avgActivity}%`}
          icon={EyeOff}
          delta={3}
          trend={[62, 58, 66, 70, 61, 68, avgActivity]}
        />
      </div>

      {/* Controls: risk filter + privacy blur */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-card px-5 py-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{shots.length}</span>{" "}
            captures
          </span>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={blur} onCheckedChange={setBlur} />
            Privacy blur
          </label>
        </div>
      </div>

      {shots.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No captures match this filter"
          description="Try a different filter — “All” shows every recent capture."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shots.map((shot) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              blur={blur}
              onOpen={() => setSelected(shot)}
            />
          ))}
        </div>
      )}

      <Lightbox shot={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/** The faux capture surface (no real images in Phase 1). */
function FauxCapture({ blur }: { blur: boolean }) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col gap-1.5 bg-gradient-to-br from-feature-tint to-muted p-3 transition",
        blur && "blur-[6px] saturate-75",
      )}
      aria-hidden="true"
    >
      <div className="h-2 w-1/3 rounded-full bg-primary/30" />
      <div className="h-2 w-3/4 rounded-full bg-foreground/10" />
      <div className="h-2 w-2/3 rounded-full bg-foreground/10" />
      <div className="mt-auto flex gap-1.5">
        <div className="h-6 w-12 rounded-md bg-primary/25" />
        <div className="h-6 w-12 rounded-md bg-foreground/10" />
      </div>
    </div>
  );
}

function ShotCard({
  shot,
  blur,
  onOpen,
}: {
  shot: Screenshot;
  blur: boolean;
  onOpen: () => void;
}) {
  return (
    <Card
      className={cn(
        "group cursor-pointer gap-0 overflow-hidden p-0 transition hover:ring-1 hover:ring-primary/40",
        shot.flagged && "ring-1 ring-destructive/40",
      )}
      onClick={onOpen}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <FauxCapture blur={blur} />
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
          {shot.app}
        </div>
        {shot.flagged ? (
          <Badge
            variant="destructive"
            className="absolute right-2 top-2 backdrop-blur-sm"
          >
            <Flag className="size-3" /> Flagged
          </Badge>
        ) : null}
        <span className="absolute bottom-2 right-2 rounded-full bg-background/85 px-2 py-0.5 font-mono text-[11px] tabular-nums backdrop-blur-sm">
          {shot.activity}%
        </span>
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5">
        <Avatar className="size-7">
          <AvatarImage src={shot.user.avatarUrl} alt={shot.user.name} />
          <AvatarFallback className="text-[10px]">
            {initials(shot.user.name)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {shot.user.name}
        </span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {shot.time}
        </span>
      </div>
    </Card>
  );
}

function Lightbox({
  shot,
  onClose,
}: {
  shot: Screenshot | null;
  onClose: () => void;
}) {
  const reason = shot ? flagReason(shot) : null;
  return (
    <Dialog open={!!shot} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {shot ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {shot.user.name}
                {shot.flagged ? (
                  <Badge variant="destructive">
                    <Flag className="size-3" /> Flagged
                  </Badge>
                ) : null}
              </DialogTitle>
              <DialogDescription>
                {shot.user.department} · captured at {shot.time}
              </DialogDescription>
            </DialogHeader>

            {/* Full capture — unblurred for review */}
            <div className="relative aspect-[16/10] overflow-hidden rounded-lg border">
              <FauxCapture blur={false} />
              <div className="absolute left-2 top-2 rounded-full bg-background/85 px-2 py-0.5 text-xs font-medium backdrop-blur-sm">
                {shot.app}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Application</dt>
              <dd className="text-right font-medium">{shot.app}</dd>
              <dt className="text-muted-foreground">Activity</dt>
              <dd
                className={cn(
                  "text-right font-mono font-medium tabular-nums",
                  activityTone(shot.activity),
                )}
              >
                {shot.activity}%
              </dd>
              <dt className="text-muted-foreground">Captured</dt>
              <dd className="text-right font-medium">{shot.time}</dd>
              {reason ? (
                <>
                  <dt className="text-muted-foreground">Flag reason</dt>
                  <dd className="text-right font-medium text-destructive">
                    {reason}
                  </dd>
                </>
              ) : null}
            </dl>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
