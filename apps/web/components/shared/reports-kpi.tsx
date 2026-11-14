"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/** A KPI change chip — visual only; callers decide which metric it belongs to. */
export type KpiDeltaTone = "positive" | "negative" | "neutral";

export type KpiDelta = {
  direction: "up" | "down" | "flat";
  label: string;
  /**
   * Whether the change is good, bad, or simply informational. Badges use
   * direction only: up = green, down = red, flat = neutral.
   */
  tone: KpiDeltaTone;
};

/** Direction-only tone: positive changes are green, negative ones red. */
function toneFor(change: number): KpiDeltaTone {
  if (change === 0) return "neutral";
  return change > 0 ? "positive" : "negative";
}

/** Relative change chip ("+12% vs previous"). Null when there is no baseline. */
export function relativeDelta(change: number | null): KpiDelta | null {
  if (change == null) return null;
  return {
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
    label: `${change > 0 ? "+" : ""}${change}% vs previous`,
    tone: toneFor(change),
  };
}

/** Percentage-point change chip (for rates). */
export function pointDelta(change: number | null): KpiDelta | null {
  if (change == null) return null;
  return {
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
    label: `${change > 0 ? "+" : ""}${change} pts vs previous`,
    tone: toneFor(change),
  };
}

export function ReportKpiCard({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string;
  sub: string;
  delta?: KpiDelta | null;
}) {
  const Icon = delta?.direction === "up" ? ArrowUpRight : delta?.direction === "down" ? ArrowDownRight : Minus;
  return (
    <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
      <p className="text-[13px] font-medium text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-ink">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium text-ink-faint">{sub}</p>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold",
              delta.tone === "positive" && "bg-emerald-50 text-emerald-700",
              delta.tone === "negative" && "bg-red-50 text-red-700",
              delta.tone === "neutral" && "bg-blue-50 text-primary-700"
            )}
          >
            <Icon className="h-3 w-3" aria-hidden />
            {delta.label}
          </span>
        )}
      </div>
    </div>
  );
}

export function ReportKpiSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
          <div className="mt-3 h-8 w-1/3 rounded-lg bg-ink/10" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-ink/10" />
        </div>
      ))}
    </>
  );
}
