"use client";

import { useState, type FocusEvent, type MouseEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Cell, Pie, PieChart } from "recharts";
import { CountUp } from "@/components/CountUp";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

/**
 * Pipeline share by status.
 *
 * Status is single-select per referral, so a donut is honest here (unlike the
 * multi-select classification field). The legend is a bento grid: each bucket
 * becomes its own tile with the count and share, so the panel stays readable
 * without hovering and the breakdown never reads as a plain list.
 *
 * `orientation="row"` puts the tiles beside the ring; `"column"` stacks them
 * under it for narrow rails. `href` keeps tiles navigable when the source rows
 * used to link.
 */
export function HeadDonut({
  items,
  colorOf,
  centerLabel,
  emptyTitle = "Nothing in the pipeline",
  emptyHint = "No referrals were created in this window.",
  orientation = "row",
  className,
}: {
  items: { key: string; name: string; value: number; href?: string }[];
  colorOf: (key: string) => string;
  centerLabel: string;
  emptyTitle?: string;
  emptyHint?: string;
  orientation?: "row" | "column";
  className?: string;
}) {
  const reduce = useReducedMotion();
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    color: string;
    name: string;
    value: number;
    pct: number;
  } | null>(null);

  if (!items.length || total === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[190px] flex-col items-center justify-center rounded-lg border border-dashed border-ink/10 bg-cream/40 px-6 text-center",
          className
        )}
      >
        <p className="text-[12.5px] font-bold text-ink">{emptyTitle}</p>
        <p className="mt-1 max-w-[240px] text-[11.5px] leading-relaxed text-ink-muted">{emptyHint}</p>
      </div>
    );
  }

  const summary = items.map((i) => `${i.name}: ${i.value}`).join(", ");
  const chartConfig = items.reduce<ChartConfig>((config, item) => {
    config[item.key] = { label: item.name, color: colorOf(item.key) };
    return config;
  }, {});
  const data = items.map((item) => ({
    key: item.key,
    name: item.name,
    value: item.value,
    fill: colorOf(item.key),
  }));

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        orientation === "row" && "sm:flex-row sm:items-center",
        className
      )}
    >
      <div
        role="img"
        aria-label={`${centerLabel} split. ${summary}`}
        className={cn("relative h-[148px] w-[148px] shrink-0", orientation === "column" && "mx-auto")}
      >
        <ChartContainer config={chartConfig} className="aspect-auto h-full w-full overflow-visible">
          <PieChart>
            <ChartTooltip
              cursor={false}
              wrapperStyle={{ zIndex: 9999, outline: "none" }}
              content={<ChartTooltipContent nameKey="key" hideLabel indicator="dot" />}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              innerRadius="64%"
              outerRadius="94%"
              paddingAngle={2}
              strokeWidth={0}
              isAnimationActive={!reduce}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {data.map((item) => (
                <Cell key={item.key} fill={item.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="pointer-events-none absolute inset-[24%] flex flex-col items-center justify-center">
          <span className="font-display text-xl font-bold leading-none text-ink">
            <CountUp to={total} />
          </span>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-faint">
            {centerLabel}
          </span>
        </div>
      </div>

      <ul className={cn("grid w-full grid-cols-2 gap-2", orientation === "row" && "sm:flex-1")}>
        {items.map((item) => {
          const pct = Math.round((item.value / total) * 100);
          const tile = (
            <>
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorOf(item.key) }}
                />
                <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  {item.name}
                </span>
              </span>
              <span className="mt-1 flex items-baseline justify-between gap-2">
                <span className="font-display text-[16px] font-bold leading-none tabular-nums text-ink">
                  <CountUp to={item.value} />
                </span>
                <span className="text-[10px] font-semibold tabular-nums text-ink-faint">{pct}%</span>
              </span>
            </>
          );

          return (
            <li
              key={item.key}
              className="min-w-0"
              onMouseEnter={(event: MouseEvent<HTMLLIElement>) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setTip({
                  x: rect.left + rect.width / 2,
                  y: rect.top - 8,
                  color: colorOf(item.key),
                  name: item.name,
                  value: item.value,
                  pct,
                });
              }}
              onMouseLeave={() => setTip(null)}
              onFocus={(event: FocusEvent<HTMLLIElement>) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setTip({
                  x: rect.left + rect.width / 2,
                  y: rect.top - 8,
                  color: colorOf(item.key),
                  name: item.name,
                  value: item.value,
                  pct,
                });
              }}
              onBlur={() => setTip(null)}
            >
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex h-full min-w-0 flex-col rounded-lg border border-ink/10 bg-cream/40 p-2.5 transition hover:border-primary-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  {tile}
                </Link>
              ) : (
                <div className="flex h-full min-w-0 flex-col rounded-lg border border-ink/10 bg-cream/40 p-2.5">
                  {tile}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <AnimatePresence>
        {tip && (
          <motion.div
            role="tooltip"
            style={{ left: tip.x, top: tip.y }}
            initial={{ opacity: 0, scale: 0.96, x: "-50%", y: "-94%" }}
            animate={{ opacity: 1, scale: 1, x: "-50%", y: "-100%" }}
            exit={{ opacity: 0, scale: 0.98, x: "-50%", y: "-96%" }}
            transition={{ duration: reduce ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none fixed z-[80] hidden min-w-[132px] rounded-lg border border-ink/10 bg-white px-2.5 py-1.5 shadow-[0_12px_32px_-10px_rgba(16,24,40,0.35)] sm:block"
          >
            <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-ink">
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: tip.color }}
              />
              {tip.name}
            </span>
            <span className="mt-0.5 block text-[10px] font-medium tabular-nums text-ink-muted">
              {tip.value} of {total} {centerLabel} · {tip.pct}%
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
