"use client";

import { useState } from "react";
import { Camera, EyeOff, Flag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { initials } from "@/lib/format";
import { SCREENSHOTS, type Screenshot } from "@/lib/mock-insights";
import { cn } from "@/lib/utils";

export function ScreenshotsView() {
  const [blur, setBlur] = useState(true);
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const flaggedCount = SCREENSHOTS.filter((s) => s.flagged).length;
  const avgActivity = Math.round(
    SCREENSHOTS.reduce((a, s) => a + s.activity, 0) / SCREENSHOTS.length,
  );
  const shots = flaggedOnly
    ? SCREENSHOTS.filter((s) => s.flagged)
    : SCREENSHOTS;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Captured today"
          value={SCREENSHOTS.length * 107}
          icon={Camera}
          hint="across team"
          trend={[180, 210, 240, 220, 260, 250, 284]}
          featured
        />
        <StatCard
          label="Flagged"
          value={flaggedCount}
          icon={Flag}
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

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-card px-5 py-3 shadow-soft">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{shots.length}</span>{" "}
          recent captures
        </p>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={blur} onCheckedChange={setBlur} />
            Privacy blur
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={flaggedOnly} onCheckedChange={setFlaggedOnly} />
            Flagged only
          </label>
        </div>
      </div>

      {shots.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No flagged screenshots"
          description="Nothing needs review right now. Toggle off “Flagged only” to see all captures."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shots.map((shot) => (
            <ShotCard key={shot.id} shot={shot} blur={blur} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShotCard({ shot, blur }: { shot: Screenshot; blur: boolean }) {
  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden p-0",
        shot.flagged && "ring-1 ring-destructive/40",
      )}
    >
      {/* Faux capture */}
      <div className="relative aspect-[16/10] overflow-hidden">
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
