"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Minus,
  type LucideIcon,
} from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { cn } from "@/lib/utils";

/**
 * Light dashboard primitives.
 *
 * The dashboard used to be a navy, glass-morphic landing canvas. These
 * primitives keep the workspace calm and data-first: white surfaces, a hairline
 * border, one elevation step, and compact type. Charts and lists own their
 * padding so panels can be used for both scrolling content and flush tables.
 */

export function Panel({
  title,
  hint,
  viewAllHref,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  hint?: React.ReactNode;
  viewAllHref?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Override the body padding — use "p-0" for flush tables/lists. */
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-xl border border-ink/10 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className
      )}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-ink/[0.07] px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="font-display text-[13.5px] font-bold leading-snug tracking-[-0.005em] text-ink">
            {title}
          </h2>
          {hint && <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">{hint}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="rounded text-[11.5px] font-bold text-primary-600 transition hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              View all
            </Link>
          )}
        </div>
      </header>
      <div className={cn("min-w-0 flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Small pill for the applied date window inside card hints. */
export function RangeBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold leading-none text-primary-700 ring-1 ring-inset ring-primary-200",
        className
      )}
    >
      {children}
    </span>
  );
}

export function PanelEmpty({
  icon: Icon,
  title,
  hint,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  hint: string;
  className?: string;
}) {
  const Glyph = Icon ?? BarChart3;
  return (
    <div
      className={cn(
        "flex min-h-[132px] flex-col items-center justify-center px-6 py-6 text-center",
        className
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-primary-600">
        <Glyph className="h-4 w-4" aria-hidden />
      </span>
      <p className="mt-2.5 text-[12.5px] font-bold text-ink">{title}</p>
      <p className="mt-1 max-w-[240px] text-[11.5px] leading-relaxed text-ink-muted">{hint}</p>
    </div>
  );
}

const TREND_UP = "bg-emerald-50 text-emerald-700";
const TREND_DOWN = "bg-rose-50 text-rose-700";
const TREND_FLAT = "bg-cream text-ink-muted";

/** Compact KPI tile used in the top strip of every dashboard. */
export function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
  trend,
  emphasis = false,
}: {
  label: string;
  value: number | null | undefined;
  icon: LucideIcon;
  hint?: React.ReactNode;
  href?: string;
  /** Percentage change vs the comparison window, or null when there is no baseline. */
  trend?: number | null;
  emphasis?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10.5px] font-bold uppercase leading-tight tracking-[0.11em] text-ink-muted">
          {label}
        </p>
        <Icon
          aria-hidden
          className={cn("h-4 w-4 shrink-0", emphasis ? "text-accent-500" : "text-ink-faint")}
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-end gap-x-2 gap-y-1">
        <p className="font-display text-[27px] font-bold leading-none tracking-[-0.025em] text-ink tabular-nums">
          {value === null || value === undefined ? (
            <span className="text-ink-faint">–</span>
          ) : (
            <CountUp to={value} />
          )}
        </p>
        {typeof trend === "number" && (
          <span
            className={cn(
              "mb-0.5 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none",
              trend === 0 ? TREND_FLAT : trend > 0 ? TREND_UP : TREND_DOWN
            )}
          >
            {trend === 0 ? (
              <Minus className="h-2.5 w-2.5" aria-hidden />
            ) : trend > 0 ? (
              <ArrowUpRight className="h-2.5 w-2.5" aria-hidden />
            ) : (
              <ArrowDownRight className="h-2.5 w-2.5" aria-hidden />
            )}
            {Math.abs(trend)}%
          </span>
        )}
      </div>

      {hint && <p className="mt-2 text-[11px] font-medium text-ink-faint">{hint}</p>}
    </>
  );

  const className = cn(
    "flex min-h-[108px] flex-col rounded-xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition",
    emphasis ? "border-accent-200" : "border-ink/10",
    href && "hover:-translate-y-px hover:border-primary-200 hover:shadow-card"
  );

  if (!href) return <div className={className}>{body}</div>;

  return (
    <Link
      href={href}
      className={cn(
        className,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      )}
    >
      {body}
    </Link>
  );
}

/** Compact "label … value" row for snapshot panels. */
export function StatRow({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number | string | null | undefined;
  icon?: LucideIcon;
  href?: string;
}) {
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cream text-primary-600">
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
        <span className="truncate text-[12.5px] font-medium text-ink-soft">{label}</span>
      </span>
      <span className="shrink-0 font-display text-[15px] font-bold tabular-nums text-ink">
        {value === null || value === undefined ? "–" : value}
      </span>
    </>
  );

  if (!href) {
    return <div className="flex items-center justify-between gap-3 px-5 py-2.5">{content}</div>;
  }

  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 px-5 py-2.5 transition hover:bg-cream/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
    >
      {content}
    </Link>
  );
}
