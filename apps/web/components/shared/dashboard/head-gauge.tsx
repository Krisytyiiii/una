"use client";

import { useState, type FocusEvent, type MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Semicircular gauge for priority / urgency splits.
 *
 * Unlike the multi-select classification field, a referral has exactly one
 * urgency, so the dial can be a single stacked arc: each bucket claims a slice
 * of the 180° sweep in lifecycle order. The legend beneath keeps the exact
 * counts readable without hovering, and the arc is purely decorative to screen
 * readers (the legend carries the data).
 */

const SIZE = { w: 260, h: 146 };
const CENTER = { x: 130, y: 130 };
const RADIUS = 100;
const STROKE = 20;
const GAP_DEG = 1.5;

function polar(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER.x + radius * Math.cos(a),
    y: CENTER.y + radius * Math.sin(a),
  };
}

function arcPath(startDeg: number, endDeg: number, radius: number) {
  const start = polar(startDeg, radius);
  const end = polar(endDeg, radius);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function HeadGauge({
  items,
  colorOf,
  emptyTitle,
  emptyHint,
  note,
  centerLabel = "cases",
  className,
}: {
  items: { key: string; name: string; value: number }[];
  colorOf: (key: string) => string;
  emptyTitle: string;
  emptyHint: string;
  note?: string;
  centerLabel?: string;
  className?: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const reduce = useReducedMotion();
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
          "flex min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-ink/10 bg-cream/40 px-6 text-center",
          className
        )}
      >
        <p className="text-[12.5px] font-bold text-ink">{emptyTitle}</p>
        <p className="mt-1 max-w-[260px] text-[11.5px] leading-relaxed text-ink-muted">{emptyHint}</p>
      </div>
    );
  }

  const summary = items.map((i) => `${i.name}: ${i.value}`).join(", ");

  const openTip = (
    item: { key: string; name: string; value: number },
    pct: number,
    x: number,
    y: number
  ) =>
    setTip({
      x,
      y,
      color: colorOf(item.key),
      name: item.name,
      value: item.value,
      pct,
    });

  // Stack each bucket along the 180° sweep (left → right), leaving a hairline
  // gap so adjacent priorities stay distinguishable.
  let cursor = 180;
  const segments = items.map((item) => {
    const sweep = (item.value / total) * 180;
    const start = cursor;
    const end = cursor + sweep;
    cursor = end;
    const gap = segmentsGap(sweep);
    return {
      key: item.key,
      item,
      pct: Math.round((item.value / total) * 100),
      color: colorOf(item.key),
      path: arcPath(start + gap, Math.max(start + gap, end - gap), RADIUS),
    };
  });

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative mx-auto w-full max-w-[280px]">
        <svg
          viewBox={`0 0 ${SIZE.w} ${SIZE.h}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Urgency gauge. ${summary}`}
        >
          {/* Track */}
          <path
            d={arcPath(180, 360, RADIUS)}
            fill="none"
            stroke="rgba(30,58,95,0.08)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {segments.map((seg) => (
            <path
              key={seg.key}
              d={seg.path}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeLinecap="butt"
              className="transition-opacity hover:opacity-80"
              onMouseEnter={(event: MouseEvent<SVGPathElement>) =>
                openTip(seg.item, seg.pct, event.clientX, event.clientY - 12)
              }
              onMouseLeave={() => setTip(null)}
            />
          ))}
          {/* End caps for the whole dial */}
          <path
            d={arcPath(180, 180.01, RADIUS)}
            fill="none"
            stroke={segments[0]?.color ?? "#2563EB"}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          <path
            d={arcPath(359.99, 360, RADIUS)}
            fill="none"
            stroke={segments[segments.length - 1]?.color ?? "#2563EB"}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        </svg>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="font-display text-[26px] font-bold leading-none tabular-nums text-ink">
            {total}
          </span>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-faint">
            {centerLabel}
          </span>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {items.map((item) => {
          const pct = Math.round((item.value / total) * 100);
          return (
            <li
              key={item.key}
              className="flex min-w-0 items-center gap-1.5 text-[11px]"
              onMouseEnter={(event: MouseEvent<HTMLLIElement>) => {
                const rect = event.currentTarget.getBoundingClientRect();
                openTip(item, pct, rect.left + rect.width / 2, rect.top - 8);
              }}
              onMouseLeave={() => setTip(null)}
              onFocus={(event: FocusEvent<HTMLLIElement>) => {
                const rect = event.currentTarget.getBoundingClientRect();
                openTip(item, pct, rect.left + rect.width / 2, rect.top - 8);
              }}
              onBlur={() => setTip(null)}
            >
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: colorOf(item.key) }}
              />
              <span className="min-w-0 flex-1 truncate font-medium text-ink-soft">{item.name}</span>
              <span className="shrink-0 font-bold tabular-nums text-ink">{item.value}</span>
              <span className="w-7 shrink-0 text-right text-[10px] font-semibold tabular-nums text-ink-faint">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>

      {note && <p className="text-[10px] leading-relaxed text-ink-faint">{note}</p>}

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

/** Keep tiny slices from collapsing to nothing while sparing big ones a gap. */
function segmentsGap(sweep: number): number {
  if (sweep <= GAP_DEG * 2) return 0;
  return GAP_DEG;
}
