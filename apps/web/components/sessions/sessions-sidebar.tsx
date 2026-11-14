"use client";

import { AlertTriangle, CalendarDays, ChevronRight, Clock, MapPin, TrendingUp, Video } from "lucide-react";
import type { CalendarSession } from "@/lib/hooks/use-sessions-calendar";
import { formatTime, isSessionLive } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { LiveSessionBanner, NextSessionTimer } from "./next-session-timer";

export type BusiestDay = { date: Date; label: string; count: number };

/**
 * Right-hand rail for the session calendar — what's next, today's lineup, and
 * the busiest days in the current month/week. Everything is a shortcut into
 * the same day overlay, so the rail never duplicates scheduling actions.
 */
export function SessionsSidebar({
  liveSession,
  nextSession,
  today,
  todaySessions,
  aliases,
  counselorNames,
  role,
  now,
  busiestDays,
  needsClosing,
  rangeLabel,
  onSelect,
  onOpenDay,
}: {
  liveSession: CalendarSession | null;
  nextSession: CalendarSession | null;
  today: Date;
  todaySessions: CalendarSession[];
  aliases: Map<string, string>;
  counselorNames: Map<string, string>;
  role: string | null;
  now: number;
  busiestDays: BusiestDay[];
  /** Confirmed sessions whose end time passed without an outcome. */
  needsClosing: CalendarSession[];
  rangeLabel: string;
  onSelect: (session: CalendarSession) => void;
  onOpenDay: (day: Date) => void;
}) {
  const aliasOf = (s: CalendarSession) =>
    s.student_id ? (aliases.get(s.student_id) ?? "Student") : "Walk-in";
  const maxLoad = busiestDays[0]?.count ?? 0;

  return (
    <aside className="space-y-4">
      {needsClosing.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-accent-300 bg-white shadow-card">
          <div className="flex items-center justify-between gap-2 border-b border-accent-200 bg-accent-50 px-4 py-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-accent-700">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Needs closing
              </h2>
              <p className="mt-0.5 truncate text-[11.5px] font-medium text-ink-muted">
                Past sessions still confirmed
              </p>
            </div>
            <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-accent-200 px-2 text-[11px] font-bold tabular-nums text-accent-700">
              {needsClosing.length}
            </span>
          </div>
          <ul className="hover-scroll max-h-[240px] divide-y divide-ink/5 overflow-y-auto">
            {needsClosing.slice(0, 6).map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s)}
                  className="group flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-accent-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500"
                >
                  <span className="w-11 shrink-0 text-[11px] font-bold tabular-nums text-ink">
                    {formatTime(s.scheduled_at)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold text-ink group-hover:text-accent-700">
                      {aliasOf(s)}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 truncate text-[10.5px] text-ink-faint">
                      {new Date(s.scheduled_at).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                      <span aria-hidden>·</span>
                      {s.mode === "online" ? "Online" : "In person"}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent-700"
                  />
                </button>
              </li>
            ))}
          </ul>
          {needsClosing.length > 6 && (
            <p className="border-t border-ink/10 bg-cream/20 px-4 py-2 text-[10.5px] font-semibold text-ink-faint">
              +{needsClosing.length - 6} more flagged on the calendar.
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-ink/10 bg-white p-3 shadow-card">
        <div className="mb-2 flex items-center justify-between px-0.5">
          <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            Up next
          </h2>
          <span className="text-[10.5px] font-semibold text-ink-faint">
            {liveSession ? "In progress" : nextSession ? "Countdown" : "Clear"}
          </span>
        </div>
        {liveSession ? (
          <LiveSessionBanner session={liveSession} alias={aliasOf(liveSession)} onSelect={onSelect} />
        ) : nextSession ? (
          <NextSessionTimer session={nextSession} alias={aliasOf(nextSession)} onSelect={onSelect} />
        ) : (
          <div className="rounded-xl border border-dashed border-ink/15 bg-cream/30 px-4 py-6 text-center">
            <p className="text-[13px] font-bold text-ink">Nothing upcoming</p>
            <p className="mx-auto mt-1 max-w-[220px] text-[11.5px] leading-relaxed text-ink-muted">
              Confirmed sessions appear here with a live countdown.
            </p>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
        <div className="flex items-center justify-between gap-2 border-b border-ink/10 bg-cream/30 px-4 py-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              Today
            </h2>
            <p className="mt-0.5 truncate text-[12px] font-semibold text-ink">
              {today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </p>
          </div>
          <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 px-2 text-[11px] font-bold tabular-nums text-primary-700">
            {todaySessions.length}
          </span>
        </div>

        {todaySessions.length ? (
          <ul className="hover-scroll max-h-[300px] divide-y divide-ink/5 overflow-y-auto">
            {todaySessions.map((s) => {
              const live = isSessionLive(s.scheduled_at, s.ends_at, now);
              const counselor =
                role === "guidance_head" && s.counselor_id
                  ? (counselorNames.get(s.counselor_id) ?? "Counselor")
                  : null;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(s)}
                    className="group flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-cream/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
                  >
                    <span className="w-11 shrink-0 text-[11.5px] font-bold tabular-nums text-ink">
                      {formatTime(s.scheduled_at)}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        live ? "bg-accent-500" : "bg-primary-500"
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[12.5px] font-bold text-ink group-hover:text-primary-700">
                          {aliasOf(s)}
                        </span>
                        {live && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-600 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-white">
                            <span aria-hidden className="h-1 w-1 animate-pulse rounded-full bg-white" />
                            Live
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 truncate text-[10.5px] text-ink-faint">
                        {s.mode === "online" ? (
                          <Video className="h-2.5 w-2.5 shrink-0" aria-hidden />
                        ) : (
                          <MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden />
                        )}
                        {s.mode === "online" ? "Online" : "In person"}
                        {counselor ? ` · ${counselor}` : ""}
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-[12px] font-medium text-ink-muted">
            No confirmed sessions today.
          </p>
        )}

        <button
          type="button"
          onClick={() => onOpenDay(today)}
          className="flex w-full items-center justify-between gap-2 border-t border-ink/10 bg-cream/20 px-4 py-2.5 text-[11.5px] font-bold text-primary-700 transition-colors hover:bg-cream/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
        >
          Open today&apos;s schedule
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </section>

      <section className="rounded-xl border border-ink/10 bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            Busiest days
          </h2>
          <span className="truncate text-[10.5px] font-semibold text-ink-faint">{rangeLabel}</span>
        </div>

        {busiestDays.length ? (
          <ul className="mt-2 space-y-1">
            {busiestDays.map((d) => (
              <li key={d.date.toISOString()}>
                <button
                  type="button"
                  onClick={() => onOpenDay(d.date)}
                  className="w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-cream/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  <span className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="truncate font-semibold text-ink-soft">{d.label}</span>
                    <span className="shrink-0 font-bold tabular-nums text-ink">{d.count}</span>
                  </span>
                  <span aria-hidden className="mt-1 block h-1.5 overflow-hidden rounded-full bg-ink/10">
                    <span
                      className="block h-full rounded-full bg-primary-500 transition-[width] duration-500"
                      style={{ width: `${maxLoad ? (d.count / maxLoad) * 100 : 0}%` }}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-5 text-center text-[12px] font-medium text-ink-muted">
            No sessions in this period yet.
          </p>
        )}

        <p className="mt-2 text-[10.5px] leading-relaxed text-ink-faint">
          Tap a day to open its schedule.
        </p>
      </section>
    </aside>
  );
}
