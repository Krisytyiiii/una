"use client";

import { useId } from "react";
import { useReducedMotion } from "framer-motion";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { CHART_PRIMARY } from "@/lib/report-palette";

export type TrendPoint = { day: string; sessions: number; [key: string]: number | string };
export type TrendSeries = { key: string; label: string; color: string };
export type DonutSlice = {
  name: string;
  value: number;
  color: string;
  /** Optional supporting line shown under the bento tile (e.g. "15/37 completed"). */
  hint?: string;
};
export type BarPoint = { label: string; value: number; color?: string };
/** Custom hover copy for a bar: a headline plus a supporting line. */
export type BarTooltip = (point: BarPoint, total: number) => {
  title: string;
  value: string;
  hint?: string;
};

/**
 * Report charts share the dashboard's shadcn/ui Recharts primitives, so the
 * hover tooltip is the same raised, high-z card used on the overview page
 * (instead of recharts' default tooltip box).
 */

const trendConfig: ChartConfig = {
  sessions: { label: "Sessions", color: CHART_PRIMARY },
};

/** Sessions-per-day bar trend (client — recharts can't render in an RSC). */
export function ReportTrendChart({ data }: { data: TrendPoint[] }) {
  const reduce = useReducedMotion();

  return (
    <ChartContainer config={trendConfig} className="mt-4 aspect-auto h-[240px] w-full overflow-visible">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.1)" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <ChartTooltip
          cursor={{ fill: "rgba(37,99,235,0.08)" }}
          wrapperStyle={{ zIndex: 9999, outline: "none" }}
          content={<ChartTooltipContent nameKey="sessions" />}
        />
        <Bar
          dataKey="sessions"
          name="Sessions"
          fill={CHART_PRIMARY}
          radius={[8, 8, 0, 0]}
          maxBarSize={28}
          isAnimationActive={!reduce}
          animationDuration={900}
          animationEasing="ease-out"
        />
      </BarChart>
    </ChartContainer>
  );
}

/** Sessions-per-day line + area trend for the headline sessions panel. */
export function ReportAreaChart({ data, series = [] }: { data: TrendPoint[]; series?: TrendSeries[] }) {
  const reduce = useReducedMotion();
  // useId keeps the gradient unique when several area charts share a page.
  const gradientId = `trend-area-${useId().replace(/:/g, "")}`;
  const config = series.reduce<ChartConfig>((acc, s) => {
    acc[s.key] = { label: s.label, color: s.color };
    return acc;
  }, { ...trendConfig });

  return (
    <ChartContainer config={config} className="mt-4 aspect-auto h-[240px] w-full overflow-visible">
      <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_PRIMARY} stopOpacity={0.18} />
            <stop offset="100%" stopColor={CHART_PRIMARY} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.1)" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <ChartTooltip
          cursor={{ stroke: "rgba(37,99,235,0.3)" }}
          wrapperStyle={{ zIndex: 9999, outline: "none" }}
          content={<ChartTooltipContent />}
        />
        <Area
          type="monotone"
          dataKey="sessions"
          name="All sessions"
          stroke={CHART_PRIMARY}
          strokeOpacity={0.45}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={!reduce}
          animationDuration={900}
          animationEasing="ease-out"
        />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={!reduce}
            animationDuration={900}
            animationEasing="ease-out"
          />
        ))}
      </ComposedChart>
    </ChartContainer>
  );
}

/** Generic donut with a bento legend (status, stress bands…). Each slice gets
 * its own tile with count + share so the panel reads without hovering, matching
 * the guidance-head dashboard's pipeline chart. `legend="list"` swaps the tiles
 * for a plain breakdown list (cohort groups: tooltip + rows, no cards).
 */
export function ReportDonut({
  data,
  legend = "bento",
}: {
  data: DonutSlice[];
  legend?: "bento" | "list";
}) {
  const reduce = useReducedMotion();
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const config = data.reduce<ChartConfig>((acc, slice) => {
    acc[slice.name] = { label: slice.name, color: slice.color };
    return acc;
  }, {});

  return (
    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative h-[148px] w-[148px] shrink-0 self-center">
        <ChartContainer config={config} className="aspect-auto h-full w-full overflow-visible">
          <PieChart>
            <ChartTooltip
              cursor={false}
              wrapperStyle={{ zIndex: 9999, outline: "none" }}
              content={<ChartTooltipContent nameKey="name" hideLabel indicator="dot" />}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="94%"
              paddingAngle={2}
              strokeWidth={0}
              isAnimationActive={!reduce}
              animationDuration={900}
              animationEasing="ease-out"
            >
              {data.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-[24%] flex flex-col items-center justify-center">
          <span className="font-display text-xl font-bold leading-none tabular-nums text-ink">{total}</span>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-faint">Total</span>
        </div>
      </div>
      {legend === "list" ? (
        <ul className="grid w-full gap-1.5 sm:flex-1">
          {data.map((s) => {
            const share = Math.round((s.value / Math.max(1, total)) * 100);
            return (
              <li key={s.name} className="flex min-w-0 items-center gap-2 text-[12px]">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate font-medium text-ink-soft">{s.name}</span>
                <span className="shrink-0 font-bold tabular-nums text-ink">{s.value}</span>
                <span className="w-8 shrink-0 text-right text-[10px] font-semibold tabular-nums text-ink-faint">
                  {share}%
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="grid w-full grid-cols-2 gap-2 sm:flex-1">
          {data.map((s) => {
            const share = Math.round((s.value / Math.max(1, total)) * 100);
            return (
              <li
                key={s.name}
                className="flex min-w-0 flex-col rounded-lg border border-ink/10 bg-cream/40 p-2.5"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                    {s.name}
                  </span>
                </span>
                <span className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="font-display text-[16px] font-bold leading-none tabular-nums text-ink">
                    {s.value}
                  </span>
                  <span className="text-[10px] font-semibold tabular-nums text-ink-faint">{share}%</span>
                </span>
                {s.hint && (
                  <span className="mt-1 truncate text-[10px] font-medium leading-none text-ink-faint">
                    {s.hint}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Generic vertical bars (rating distribution, referrals by priority…). */
export function ReportBars({
  data,
  barColor = CHART_PRIMARY,
  tooltip,
}: {
  data: BarPoint[];
  barColor?: string;
  tooltip?: BarTooltip;
}) {
  const reduce = useReducedMotion();
  const total = data.reduce((sum, point) => sum + point.value, 0);
  // Per-label config keeps the tooltip swatch in sync with each bar's colour.
  const config = data.reduce<ChartConfig>((acc, point) => {
    acc[point.label] = { label: point.label, color: point.color ?? barColor };
    return acc;
  }, {});

  return (
    <ChartContainer config={config} className="mt-4 aspect-auto h-[240px] w-full overflow-visible">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.1)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <ChartTooltip
          cursor={{ fill: "rgba(37,99,235,0.08)" }}
          wrapperStyle={{ zIndex: 9999, outline: "none" }}
          content={
            <ChartTooltipContent
              nameKey="label"
              hideLabel={Boolean(tooltip)}
              formatter={
                tooltip
                  ? (_value, _name, item) => {
                      const point = item?.payload as BarPoint | undefined;
                      if (!point) return null;
                      const info = tooltip(point, total);
                      return (
                        <div className="flex w-full items-start gap-2">
                          <span
                            aria-hidden
                            className="mt-1 h-2 w-2 shrink-0 rounded-full"
                            style={{ background: point.color ?? barColor }}
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-ink">{info.title}</p>
                            <p className="mt-0.5 text-ink-muted">{info.value}</p>
                            {info.hint && <p className="mt-0.5 text-ink-faint">{info.hint}</p>}
                          </div>
                        </div>
                      );
                    }
                  : undefined
              }
            />
          }
        />
        <Bar
          dataKey="value"
          name="Count"
          radius={[8, 8, 0, 0]}
          maxBarSize={36}
          isAnimationActive={!reduce}
          animationDuration={900}
          animationEasing="ease-out"
        >
          {data.map((d) => (
            <Cell key={d.label} fill={d.color ?? barColor} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Generic line trend (posts over time, sessions over time…). */
export function ReportLines({ data, stroke = CHART_PRIMARY }: { data: BarPoint[]; stroke?: string }) {
  const reduce = useReducedMotion();
  const config: ChartConfig = {
    value: { label: "Count", color: stroke },
  };

  return (
    <ChartContainer config={config} className="mt-4 aspect-auto h-[240px] w-full overflow-visible">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.1)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <ChartTooltip
          cursor={{ stroke: "rgba(37,99,235,0.3)" }}
          wrapperStyle={{ zIndex: 9999, outline: "none" }}
          content={<ChartTooltipContent nameKey="value" />}
        />
        <Line
          type="monotone"
          dataKey="value"
          name="Count"
          stroke={stroke}
          strokeWidth={2.5}
          dot={{ r: 3, fill: stroke, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={!reduce}
          animationDuration={900}
          animationEasing="ease-out"
        />
      </LineChart>
    </ChartContainer>
  );
}

/**
 * Multi-series line trend — one line per status/key (e.g. published vs
 * drafts). Series colours come from the caller so each domain keeps its own
 * palette; the tooltip shows every key.
 */
export function ReportMultiLines({
  data,
  series,
  height = 260,
}: {
  data: { label: string; [key: string]: number | string }[];
  series: TrendSeries[];
  height?: number;
}) {
  const reduce = useReducedMotion();
  const config: ChartConfig = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }]));

  return (
    <ChartContainer
      config={config}
      className="mt-4 aspect-auto w-full overflow-visible"
      style={{ height }}
    >
      <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.1)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <ChartTooltip cursor={{ stroke: "rgba(37,99,235,0.3)" }} wrapperStyle={{ zIndex: 9999, outline: "none" }} content={<ChartTooltipContent />} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2.4}
            dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
            activeDot={{ r: 4.5 }}
            isAnimationActive={!reduce}
            animationDuration={900}
            animationEasing="ease-out"
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
