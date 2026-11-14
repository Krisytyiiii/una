"use client";

import { useId } from "react";
import { useReducedMotion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const chartConfig = {
  sessions: { label: "Sessions", color: "#3B82F6" },
} satisfies ChartConfig;

/**
 * Sessions booked per day for the rolling current week (`weekChart`).
 * Today's bar uses a lighter blue step so it reads apart from the rest.
 */
export function HeadWeekChart({
  points,
  className,
}: {
  points: { key: string; day: string; sessions: number }[];
  className?: string;
}) {
  const reduce = useReducedMotion();
  const barId = `head-week-bar-${useId().replace(/:/g, "")}`;
  const todayId = `head-week-today-${useId().replace(/:/g, "")}`;
  const total = points.reduce((sum, p) => sum + p.sessions, 0);

  if (!points.length) {
    return (
      <div
        className={cn(
          "flex min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-ink/10 bg-cream/40 px-6 text-center",
          className
        )}
      >
        <p className="text-[12.5px] font-bold text-ink">No session data</p>
        <p className="mt-1 max-w-[240px] text-[11.5px] leading-relaxed text-ink-muted">
          This week&apos;s bookings will show up here.
        </p>
      </div>
    );
  }

  const summary = points.map((p) => `${p.day}: ${p.sessions}`).join(", ");

  return (
    <div className={cn("relative", className)}>
      <div role="img" aria-label={`Sessions per day this week. ${summary}`}>
        <ChartContainer config={chartConfig} className="aspect-auto h-[176px] w-full overflow-visible">
          <BarChart data={points} margin={{ top: 16, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={barId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#1E40AF" />
              </linearGradient>
              <linearGradient id={todayId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#93C5FD" />
                <stop offset="100%" stopColor="#2563EB" />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke="rgba(30,58,95,0.10)" strokeDasharray="3 5" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              interval={0}
              tick={{ fill: "#5A7FA0", fontSize: 10, fontWeight: 700 }}
            />
            <YAxis hide domain={[0, "auto"]} allowDecimals={false} />

            <ChartTooltip
              cursor={{ fill: "rgba(59,130,246,0.08)" }}
              wrapperStyle={{ zIndex: 9999, outline: "none" }}
              content={<ChartTooltipContent nameKey="sessions" />}
            />

            <Bar
              dataKey="sessions"
              name="Sessions"
              radius={[6, 6, 0, 0]}
              maxBarSize={44}
              isAnimationActive={!reduce}
              animationDuration={850}
              animationEasing="ease-out"
            >
              {points.map((point, i) => (
                <Cell key={point.key} fill={`url(#${i === points.length - 1 ? todayId : barId})`} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>

      <p className="mt-2 text-[11px] font-medium text-ink-faint">
        <span className="font-bold text-ink">{total.toLocaleString("en-US")}</span> sessions in the
        last 7 days · today in lighter blue
      </p>
    </div>
  );
}
