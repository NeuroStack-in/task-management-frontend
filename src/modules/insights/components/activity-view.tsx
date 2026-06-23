"use client";

import { Activity, Gauge, MousePointerClick, Coffee } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { Sparkline } from "@/components/shared/sparkline";
import {
  ProductivityHeatmap,
  ActiveInactiveRing,
} from "@/modules/dashboard/components/insight-widgets";
import { users } from "@/lib/data";
import { productivityHeatmap } from "@/lib/mock-metrics";
import {
  APP_USAGE,
  URL_USAGE,
  ACTIVITY_BY_HOUR,
  HOUR_LABELS,
  KEYBOARD_BY_HOUR,
  MOUSE_BY_HOUR,
  usageTotals,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  type UsageItem,
  type UsageCategory,
} from "@/lib/mock-insights";

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function ActivityView() {
  const active = users.filter((u) => u.status === "active").length;
  const inactive = users.filter((u) => u.status === "inactive").length;
  const avgActivity = Math.round(
    ACTIVITY_BY_HOUR.reduce((a, b) => a + b, 0) / ACTIVITY_BY_HOUR.length,
  );

  const appTotals = usageTotals(APP_USAGE);
  const appTotalMin = Object.values(appTotals).reduce((a, b) => a + b, 0);
  const productivePct = Math.round((appTotals.productive / appTotalMin) * 100);
  const distractingMin = appTotals.distracting;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active now"
          value={active}
          icon={Activity}
          hint="live"
          trend={[58, 62, 60, 68, 64, 72, active]}
          featured
        />
        <StatCard
          label="Avg activity"
          value={`${avgActivity}%`}
          icon={Gauge}
          delta={4}
          trend={ACTIVITY_BY_HOUR.slice(-7)}
        />
        <StatCard
          label="Productive time"
          value={`${productivePct}%`}
          icon={MousePointerClick}
          delta={2}
          trend={KEYBOARD_BY_HOUR.slice(-7)}
        />
        <StatCard
          label="Distracting time"
          value={formatMinutes(distractingMin)}
          icon={Coffee}
          delta={-6}
          trend={[52, 48, 55, 44, 50, 46, 41]}
        />
      </div>

      {/* Hourly activity */}
      <Card>
        <CardHeader>
          <CardTitle>Activity through the day</CardTitle>
          <CardDescription>
            Share of monitored time spent active, 8:00 – 19:00
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Sparkline
            data={ACTIVITY_BY_HOUR}
            area
            width={920}
            height={120}
            className="w-full text-primary"
          />
          <div className="mt-1 flex justify-between">
            {HOUR_LABELS.map((h) => (
              <span key={h} className="text-[10px] text-muted-foreground">
                {h}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProductivityHeatmap data={productivityHeatmap()} />
        </div>
        <ActiveInactiveRing active={active} inactive={inactive} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <UsageCard
          title="Top applications"
          description="Time spent per app today"
          items={APP_USAGE}
        />
        <UsageCard
          title="Top websites"
          description="Most visited domains today"
          items={URL_USAGE}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <IntensityCard
          title="Keyboard intensity"
          data={KEYBOARD_BY_HOUR}
          labels={HOUR_LABELS}
        />
        <IntensityCard
          title="Mouse intensity"
          data={MOUSE_BY_HOUR}
          labels={HOUR_LABELS}
        />
      </div>
    </div>
  );
}

function UsageCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: UsageItem[];
}) {
  const max = Math.max(...items.map((i) => i.minutes));
  const totals = usageTotals(items);
  const total = Object.values(totals).reduce((a, b) => a + b, 0) || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLOR[it.category] }}
                  />
                  {it.name}
                </span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {formatMinutes(it.minutes)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(it.minutes / max) * 100}%`,
                    backgroundColor: CATEGORY_COLOR[it.category],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs">
          {(Object.keys(totals) as UsageCategory[]).map((c) => (
            <span key={c} className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: CATEGORY_COLOR[c] }}
              />
              {CATEGORY_LABEL[c]} {Math.round((totals[c] / total) * 100)}%
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function IntensityCard({
  title,
  data,
  labels,
}: {
  title: string;
  data: number[];
  labels: string[];
}) {
  const max = Math.max(...data);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-28 items-end gap-1.5">
          {data.map((v, i) => (
            <div
              key={i}
              title={`${labels[i]} · ${v}%`}
              className="flex-1 rounded-t-[4px] bg-primary/80"
              style={{ height: `${(v / max) * 100}%` }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between">
          {labels.map((h) => (
            <span key={h} className="text-[10px] text-muted-foreground">
              {h}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
