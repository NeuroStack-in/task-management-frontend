"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity as ActivityIcon,
  Gauge,
  MousePointerClick,
  Coffee,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

const formatMinutes = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const trendData = ACTIVITY_BY_HOUR.map((active, i) => ({
  hour: HOUR_LABELS[i],
  active,
  keyboard: KEYBOARD_BY_HOUR[i],
  mouse: MOUSE_BY_HOUR[i],
}));

export function ActivityTab() {
  const active = users.filter((u) => u.status === "active").length;
  const inactive = users.filter((u) => u.status === "inactive").length;

  const totals = usageTotals(APP_USAGE);
  const totalMin = totals.productive + totals.neutral + totals.distracting;
  const productivePct = Math.round((totals.productive / (totalMin || 1)) * 100);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active now"
          value={active}
          icon={ActivityIcon}
          hint="live"
          trend={ACTIVITY_BY_HOUR}
          featured
        />
        <StatCard
          label="Avg. active"
          value={`${avg(ACTIVITY_BY_HOUR)}%`}
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
          value={formatMinutes(totals.distracting)}
          icon={Coffee}
          delta={-6}
          trend={[52, 48, 55, 44, 50, 46, 41]}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Activity by hour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: -18, right: 8, top: 4 }}>
                  <defs>
                    <linearGradient id="fillActiveHr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      fontSize: 12,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Area type="monotone" dataKey="active" stroke="var(--chart-1)" fill="url(#fillActiveHr)" strokeWidth={2} name="Active %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time by category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.keys(totals) as UsageCategory[]).map((cat) => {
              const pct = Math.round((totals[cat] / (totalMin || 1)) * 100);
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLOR[cat] }} />
                      {CATEGORY_LABEL[cat]}
                    </span>
                    <span className="font-medium tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLOR[cat] }} />
                  </div>
                </div>
              );
            })}
            <p className="pt-1 text-xs text-muted-foreground">
              Based on {Math.round(totalMin / 60)}h of tracked application time today.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProductivityHeatmap data={productivityHeatmap()} />
        </div>
        <ActiveInactiveRing active={active} inactive={inactive} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <UsageList title="Top applications" items={APP_USAGE} />
        <UsageList title="Top websites" items={URL_USAGE} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <IntensityCard title="Keyboard intensity" data={KEYBOARD_BY_HOUR} labels={HOUR_LABELS} />
        <IntensityCard title="Mouse intensity" data={MOUSE_BY_HOUR} labels={HOUR_LABELS} />
      </div>
    </div>
  );
}

function UsageList({ title, items }: { title: string; items: UsageItem[] }) {
  const max = Math.max(...items.map((i) => i.minutes));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
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
