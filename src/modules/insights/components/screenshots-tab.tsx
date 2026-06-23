"use client";

import { useState } from "react";
import { Camera, Flag } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { initials } from "@/lib/format";
import { SCREENSHOTS } from "@/lib/mock-insights";
import { cn } from "@/lib/utils";

const TILE_TINTS = [
  "from-primary/20 to-primary/5",
  "from-chart-2/20 to-chart-2/5",
  "from-chart-3/20 to-chart-3/5",
  "from-chart-4/20 to-chart-4/5",
];

export function ScreenshotsTab() {
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const shots = onlyFlagged ? SCREENSHOTS.filter((s) => s.flagged) : SCREENSHOTS;
  const flaggedCount = SCREENSHOTS.filter((s) => s.flagged).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Captured today" value="1,284" icon={Camera} hint="across all agents" featured />
        <StatCard label="Every" value="10 min" icon={Camera} hint="capture frequency" />
        <StatCard label="Flagged" value={flaggedCount} icon={Flag} hint="need review" />
        <StatCard label="Coverage" value="96%" icon={Camera} hint="agents online" />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {shots.length} recent captures
        </p>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant={onlyFlagged ? "outline" : "default"}
            onClick={() => setOnlyFlagged(false)}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={onlyFlagged ? "default" : "outline"}
            onClick={() => setOnlyFlagged(true)}
          >
            Flagged
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shots.map((shot, i) => (
          <figure
            key={shot.id}
            className="overflow-hidden rounded-[1.1rem] border bg-card shadow-soft"
          >
            <div
              className={cn(
                "relative flex h-32 items-center justify-center bg-gradient-to-br",
                TILE_TINTS[i % TILE_TINTS.length],
              )}
            >
              <Camera className="size-7 text-muted-foreground/50" />
              <span className="absolute left-2 top-2 rounded-md bg-background/80 px-1.5 py-0.5 text-[11px] font-medium backdrop-blur">
                {shot.app}
              </span>
              {shot.flagged ? (
                <Badge className="absolute right-2 top-2 bg-destructive/15 text-destructive">
                  <Flag className="size-3" /> Flagged
                </Badge>
              ) : null}
              <span className="absolute bottom-2 right-2 rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-[11px] tabular-nums backdrop-blur">
                {shot.activity}% active
              </span>
            </div>
            <figcaption className="flex items-center gap-2 p-3">
              <Avatar className="size-7">
                <AvatarImage src={shot.user.avatarUrl} alt={shot.user.name} />
                <AvatarFallback className="text-[10px]">
                  {initials(shot.user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{shot.user.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {shot.user.department}
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {shot.time}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
