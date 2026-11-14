"use client";

import { useReducedMotion } from "framer-motion";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const chartConfig = {
  count: { label: "Sessions booked", color: "#2563EB" },
} satisfies ChartConfig;

/**
 * Sessions booked per bucket across the selected window (`sessionTrend`),
 * drawn as a blue line so booking momentum reads at a glance.
 */
export function HeadSessionsLineChart({
  points,
  className,
}: {
  points: { key: string; label: string; count: number }[];
  className?: string;
}) {
  const reduce = useReducedMotion();
  const total = points.reduce((sum, p) => sum + p.count, 0);

  if (!points.length) {
    return (
      <div
        className={cn(
          "flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-ink/10 bg-cream/40 px-6 text-center",
          className
        )}
      >
        <p className="text-[12.5px] font-bold text-ink">No session data</p>
        <p className="mt-1 max-w-[240px] text-[11.5px] leading-relaxed text-ink-muted">
          Appointments booked in this period will show up here.
        </p>
      </div>
    );
  }

  const data = points.map((p) => ({ label: p.label, count: p.count }));
  const summary = points.map((p) => `${p.label}: ${p.count}`).join(", ");

  return (
    <div className={cn("relative", className)}>
      <div role="img" aria-label={`Sessions booked. ${summary}`}>
        <ChartContainer config={chartConfig} className="aspect-auto h-[196px] w-full overflow-visible">
          <LineChart data={data} margin={{ top: 16, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid
              vertical={false}
              stroke="rgba(30,58,95,0.10)"
              strokeDasharray="3 5"
            />
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
              cursor={{ stroke: "#2563EB", strokeOpacity: 0.35, strokeDasharray: "4 4" }}
              wrapperStyle={{ zIndex: 9999, outline: "none" }}
              content={<ChartTooltipContent nameKey="count" />}
            />

            <Line
              type="monotone"
              dataKey="count"
              name="Sessions booked"
              stroke="#2563EB"
              strokeWidth={2.25}
              strokeLinecap="round"
              dot={{ r: 3, fill: "#3B82F6", stroke: "#ffffff", strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: "#1D4ED8", stroke: "#ffffff", strokeWidth: 2 }}
              isAnimationActive={!reduce}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </LineChart>
        </ChartContainer>
      </div>

      <p className="mt-2 text-[11px] font-medium text-ink-faint">
        <span className="font-bold text-ink">{total.toLocaleString("en-US")}</span> sessions booked in
        this window
      </p>
    </div>
  );
}
