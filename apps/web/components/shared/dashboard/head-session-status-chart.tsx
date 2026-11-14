"use client";

import { useReducedMotion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

/**
 * Sessions per day for the selected window, stacked by lifecycle state.
 *
 * Tones follow the appointment badge language: blue = still ahead, green =
 * completed, amber = overdue (slot passed, still active), red = no-show,
 * slate = cancelled, light red = rejected.
 */
const SERIES = [
  { key: "upcoming", label: "Upcoming", color: "#2563EB" },
  { key: "overdue", label: "Overdue", color: "#F59E0B" },
  { key: "completed", label: "Completed", color: "#16A34A" },
  { key: "no_show", label: "No-show", color: "#DC2626" },
  { key: "cancelled", label: "Cancelled", color: "#94A3B8" },
  { key: "rejected", label: "Rejected", color: "#F87171" },
] as const;

type StatusKey = (typeof SERIES)[number]["key"];

export type SessionStatusPoint = { key: string; label: string } & Record<StatusKey, number>;

const chartConfig = SERIES.reduce<ChartConfig>((config, series) => {
  config[series.key] = { label: series.label, color: series.color };
  return config;
}, {});

function StatusTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const rows = SERIES.map((series) => ({
    ...series,
    value: Number(payload.find((item) => item.dataKey === series.key)?.value ?? 0),
  })).filter((row) => row.value > 0);

  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (!total) return null;

  return (
    <div className="z-[9999] min-w-[9rem] rounded-lg border border-ink/10 bg-white px-3 py-2 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.35)]">
      <p className="text-[11px] font-bold text-ink">{String(label ?? "")}</p>
      <p className="text-[10px] font-medium text-ink-faint">
        {total} session{total === 1 ? "" : "s"}
      </p>
      <ul className="mt-1.5 space-y-1">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-1.5 text-[10.5px]">
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className="flex-1 text-ink-soft">{row.label}</span>
            <span className="font-bold tabular-nums text-ink">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HeadSessionStatusChart({
  points,
  className,
}: {
  points: SessionStatusPoint[];
  className?: string;
}) {
  const reduce = useReducedMotion();
  const total = points.reduce((sum, point) => sum + SERIES.reduce((s, series) => s + point[series.key], 0), 0);

  if (!points.length || total === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-ink/10 bg-cream/40 px-6 text-center",
          className
        )}
      >
        <p className="text-[12.5px] font-bold text-ink">No sessions in this period</p>
        <p className="mt-1 max-w-[300px] text-[11.5px] leading-relaxed text-ink-muted">
          Pick a wider period, or wait for students to book their next session.
        </p>
      </div>
    );
  }

  const summary = points
    .map((point) => {
      const count = SERIES.reduce((s, series) => s + point[series.key], 0);
      return `${point.label}: ${count}`;
    })
    .join(", ");

  return (
    <div className={cn("relative", className)}>
      <div role="img" aria-label={`Sessions per day by status. ${summary}`}>
        <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full overflow-visible">
          <BarChart data={points} margin={{ top: 14, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(30,58,95,0.10)" strokeDasharray="3 5" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              interval="preserveStartEnd"
              minTickGap={18}
              tick={{ fill: "#5A7FA0", fontSize: 10, fontWeight: 700 }}
            />
            <YAxis hide domain={[0, "auto"]} allowDecimals={false} />

            <ChartTooltip
              cursor={{ fill: "rgba(37,99,235,0.06)" }}
              wrapperStyle={{ zIndex: 9999, outline: "none" }}
              content={<StatusTooltip />}
            />

            {SERIES.map((series) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                stackId="sessions"
                name={series.label}
                fill={series.color}
                maxBarSize={26}
                isAnimationActive={!reduce}
                animationDuration={700}
                animationEasing="ease-out"
              />
            ))}
          </BarChart>
        </ChartContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {SERIES.map((series) => (
          <span
            key={series.key}
            className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-ink-muted"
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: series.color }}
            />
            {series.label}
          </span>
        ))}
        <span className="ml-auto text-[10.5px] font-medium text-ink-faint">
          <span className="font-bold text-ink">{total.toLocaleString("en-US")}</span> sessions in this
          window
        </span>
      </div>
    </div>
  );
}
