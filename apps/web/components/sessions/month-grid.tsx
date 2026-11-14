"use client";

import type { CalendarSession } from "@/lib/hooks/use-sessions-calendar";
import { AlertTriangle } from "lucide-react";
import { STATUS_PILL, WEEKDAYS, dayKey, formatTime, monthCells, sameDay, sessionPhase, statusLabel } from "@/lib/calendar";
import { cn } from "@/lib/utils";

export type CalendarGridHandlers = {
  onPickDay: (d: Date) => void;
  onPickSession: (s: CalendarSession) => void;
  onExpandDay: (d: Date) => void;
};

const MONTH_CHIP_LIMIT = 3;

/**
 * Full-width month view — 42 cells with outside-month dimming. The whole cell
 * opens that day's overlay; individual session chips open the overlay with
 * that session already expanded. Chips stop propagation so a session click
 * never double-fires the day handler.
 */
export function MonthGrid({
  cursor,
  byDay,
  aliases,
  today,
  selectedDay,
  selectedId,
  now,
  onPickDay,
  onPickSession,
  onExpandDay,
}: {
  cursor: Date;
  byDay: Map<string, CalendarSession[]>;
  aliases: Map<string, string>;
  today: Date;
  selectedDay: Date;
  selectedId: string | null;
  now: number;
} & CalendarGridHandlers) {
  const cells = monthCells(cursor);
  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[680px]">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w) => (
            <span
              key={w}
              className="pb-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-ink-faint"
            >
              {w}
            </span>
          ))}
        </div>
        <div className="grid auto-rows-[minmax(112px,1fr)] grid-cols-7 gap-1.5">
          {cells.map((d, i) => {
            const k = dayKey(d);
            const daySessions = byDay.get(k) ?? [];
            const isToday = sameDay(d, today);
            const isSelected = sameDay(d, selectedDay);
            const outside = d.getMonth() !== cursor.getMonth();
            const shown = daySessions.slice(0, MONTH_CHIP_LIMIT);
            const overflow = daySessions.length - shown.length;
            return (
              <div
                key={`${k}-${i}`}
                role="button"
                tabIndex={0}
                onClick={() => onPickDay(d)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPickDay(d);
                  }
                }}
                aria-label={`${d.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                })}, ${daySessions.length} session${daySessions.length === 1 ? "" : "s"} — open day schedule`}
                className={cn(
                  "group flex min-h-[118px] cursor-pointer flex-col rounded-xl border p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                  isSelected
                    ? "border-primary-400 bg-primary-50 ring-1 ring-primary-300"
                    : "border-ink/10 bg-white hover:border-primary-300 hover:bg-primary-50/60 hover:shadow-soft",
                  outside && "bg-cream/60 opacity-60 hover:opacity-100"
                )}
               >
                 <div className="flex items-center justify-between gap-1">
                   <span
                     className={cn(
                       "inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold",
                       isToday
                         ? "bg-primary-600 text-white shadow-soft"
                         : outside
                           ? "text-ink-faint"
                           : "text-ink"
                     )}
                   >
                     {d.getDate()}
                   </span>
                   {daySessions.length > 0 && (
                     <span className="rounded-full bg-primary-100 px-1.5 text-[10px] font-bold leading-4 text-primary-800">
                       {daySessions.length}
                     </span>
                   )}
                 </div>

                 <div className="mt-1 space-y-1">
                   {shown.map((s) => {
                     const alias = s.student_id ? (aliases.get(s.student_id) ?? "Student") : "Walk-in";
                     const overdue = sessionPhase(s.scheduled_at, s.ends_at, now) === "past";
                     return (
                       <button
                         key={s.id}
                         type="button"
                         aria-label={`${alias} at ${formatTime(s.scheduled_at)}, ${statusLabel(s.status)}${overdue ? ", needs outcome" : ""} — open session details`}
                         onClick={(e) => {
                           e.stopPropagation();
                           onPickSession(s);
                         }}
                         onKeyDown={(e) => e.stopPropagation()}
                         className={cn(
                           "flex w-full cursor-pointer items-center gap-1 truncate rounded-md px-1.5 py-1 text-left text-[10.5px] font-bold transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                           STATUS_PILL[s.status] ?? "bg-ink/10 text-ink-muted",
                           overdue && "ring-1 ring-accent-500",
                           selectedId === s.id && "ring-2 ring-ink/30"
                         )}
                       >
                         <span
                           aria-hidden
                           className={cn(
                             "h-1 w-1 shrink-0 rounded-full",
                             overdue ? "bg-accent-600" : "bg-current opacity-70"
                           )}
                         />
                         <span className="truncate">{formatTime(s.scheduled_at)} · {alias}</span>
                         {overdue && (
                           <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-accent-700" aria-hidden />
                         )}
                       </button>
                     );
                   })}
                   {overflow > 0 && (
                     <button
                       type="button"
                       onClick={(e) => {
                         e.stopPropagation();
                         onExpandDay(d);
                       }}
                       onKeyDown={(e) => e.stopPropagation()}
                       className="block w-full cursor-pointer rounded px-1.5 text-left text-[10.5px] font-bold text-primary-700 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                     >
                       +{overflow} more
                     </button>
                   )}
                 </div>

                 {daySessions.length === 0 && (
                   <span className="mt-auto hidden text-[10px] font-medium text-ink-faint group-hover:block">
                     Open day
                   </span>
                 )}
               </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
