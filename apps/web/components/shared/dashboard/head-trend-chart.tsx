"use client";

import { useId } from "react";
import { useReducedMotion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const chartConfig = {
  count: { label: "Referrals", color: "#2563EB" },
} satisfies ChartConfig;

/**
 * Referral volume for the selected window as a per-day bar chart. Each bar is
 * one calendar day, so quiet days stay visible instead of being smoothed into
 * a monthly line. Hovering a bar exposes the shared raised tooltip.
 */
export function HeadTrendChart({
  points,
  className,
}: {
  points: { key: string; label: string; count: number }[];
  className?: string;
}) {
  const reduce = useReducedMotion();
  const gradientId = `head-trend-fill-${useId().replace(/:/g, "")}`;
  const total = points.reduce((sum, p) => sum + p.count, 0);

  if (!points.length || total === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[190px] flex-col items-center justify-center rounded-lg border border-dashed border-ink/10 bg-cream/40 px-6 text-center",
          className
        )}
      >
        <p className="text-[12.5px] font-bold text-ink">No referrals in this period</p>
        <p className="mt-1 max-w-[280px] text-[11.5px] leading-relaxed text-ink-muted">
          Pick a wider period, or wait for faculty to file the next case.
        </p>
      </div>
    );
  }

  const data = points.map((p) => ({ label: p.label, count: p.count }));
  const summary = points.map((p) => `${p.label}: ${p.count}`).join(", ");

  return (
    <div className={cn("relative", className)}>
      <div role="img" aria-label={`Referrals per day. ${summary}`}>
        <ChartContainer config={chartConfig} className="aspect-auto h-[196px] w-full overflow-visible">
          <BarChart data={data} margin={{ top: 14, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#2563EB" stopOpacity={0.75} />
              </linearGradient>
            </defs>

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
              cursor={{ fill: "rgba(37,99,235,0.08)" }}
              wrapperStyle={{ zIndex: 9999, outline: "none" }}
              content={<ChartTooltipContent nameKey="count" />}
            />

            <Bar
              dataKey="count"
              name="Referrals"
              fill={`url(#${gradientId})`}
              radius={[3, 3, 0, 0]}
              maxBarSize={16}
              isAnimationActive={!reduce}
              animationDuration={700}
              animationEasing="ease-out"
            />
          </BarChart>
        </ChartContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-ink-faint">
        <span>
          <span className="font-bold text-ink">{total.toLocaleString("en-US")}</span> referrals in this
          window
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary-500" />
          Hover a bar for details
        </span>
      </div>
    </div>
  );
}
