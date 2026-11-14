"use client";

import { useMemo } from "react";
import { CalendarDays, Clock, Plus, Users } from "lucide-react";
import type { AvailabilityCounselor, AvailabilitySlot } from "@/lib/hooks/use-availability-board";
import { DAYS, MON_FIRST, fmtHours, hhmm, slotMinutes } from "@/lib/availability";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Deterministic avatar tint per counselor — same colors everywhere on the page. */
const AVATAR_TONES = [
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function toMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function fmtTime12(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${period}` : `${h12} ${period}`;
}

/** Monday-anchored dates for the current week (local). */
function weekDates(): Date[] {
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
  return MON_FIRST.map(
    (weekday) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + ((weekday + 6) % 7))
  );
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function DayDate({ date, isToday }: { date: Date; isToday: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        {DAYS[date.getDay()]}
      </span>
      <span className="text-[13px] font-bold text-ink">{date.getDate()}</span>
      <span className="text-[10.5px] font-semibold text-ink-faint">
        {date.toLocaleDateString("en-US", { month: "short" })}
      </span>
      {isToday && (
        <span className="rounded-full bg-primary-600 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-white">
          Today
        </span>
      )}
    </div>
  );
}

/**
 * Weekly coverage board.
 * - Personal mode (counselor): a week planner with a proportional 24h timeline
 *   per day, its own summary band, and empty days turned into an add-CTA.
 * - Office mode (head): an agenda of days with every counselor's windows.
 */
export function CoverageGrid({
  slots,
  counselors,
  loading,
  personal = false,
}: {
  slots: AvailabilitySlot[];
  counselors: AvailabilityCounselor[];
  loading: boolean;
  /** True in the counselor view — show only their own windows. */
  personal?: boolean;
}) {
  const now = useMemo(() => new Date(), []);
  const dates = useMemo(() => weekDates(), []);
  const counselorIndex = useMemo(
    () => new Map(counselors.map((c, i) => [c.id, i])),
    [counselors]
  );

  const coverage = useMemo(
    () =>
      MON_FIRST.map((d, i) => {
        const items = slots
          .filter((s) => s.weekday === d)
          .map((s) => ({
            id: s.id,
            counselorId: s.counselor_id,
            name: counselors.find((c) => c.id === s.counselor_id)?.name ?? "Counselor",
            range: `${hhmm(s.start_time)}–${hhmm(s.end_time)}`,
            start: toMins(s.start_time),
            end: toMins(s.end_time),
            recurring: s.is_recurring,
            minutes: slotMinutes(s),
          }))
          .sort((a, b) => a.start - b.start);
        return {
          day: d,
          label: DAYS[d],
          date: dates[i],
          items,
          minutes: items.reduce((sum, it) => sum + it.minutes, 0),
        };
      }),
    [slots, counselors, dates]
  );

  // Shared scale for the personal timeline: the earliest start to the latest
  // end, snapped to the hour so every day's bars line up.
  const scale = useMemo(() => {
    const starts = slots.map((s) => toMins(s.start_time));
    const ends = slots.map((s) => toMins(s.end_time));
    if (!starts.length || !ends.length) return { from: 8 * 60, to: 18 * 60 };
    const from = Math.max(0, Math.floor(Math.min(...starts) / 60) * 60);
    const to = Math.min(24 * 60, Math.ceil(Math.max(...ends) / 60) * 60);
    return to > from ? { from, to } : { from: 8 * 60, to: 18 * 60 };
  }, [slots]);
  const pct = (mins: number) =>
    Math.min(100, Math.max(0, ((mins - scale.from) / (scale.to - scale.from)) * 100));

  const totalSlots = slots.length;
  const totalMinutes = coverage.reduce((sum, d) => sum + d.minutes, 0);
  const coveredDays = coverage.filter((d) => d.items.length > 0).length;
  const todayDay = coverage.find((d) => sameDay(d.date, now));
  const nowMins = now.getHours() * 60 + now.getMinutes();

  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-ink">
              {personal ? "My weekly coverage" : "Weekly coverage"}
            </h2>
            <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
              {personal
                ? "Your published windows, Monday to Sunday."
                : "Open windows across the team, Monday to Sunday."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {!personal && (
            <Tooltip
              content="Counselors on the roster"
              align="end"
              className="inline-flex cursor-default items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-[11.5px] font-bold text-ink-soft"
            >
              <Users className="h-3.5 w-3.5 text-primary-600" aria-hidden />
              {loading ? "—" : `${counselors.length} counselors`}
            </Tooltip>
          )}
          <Tooltip
            content="Published windows and their total bookable time per week. Students can only book inside one of these."
            align="end"
            className="inline-flex cursor-default items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-[11.5px] font-bold text-ink-soft"
          >
            <Clock className="h-3.5 w-3.5 text-primary-600" aria-hidden />
            {loading ? "—" : `${totalSlots} window${totalSlots === 1 ? "" : "s"} · ${fmtHours(totalMinutes)}`}
          </Tooltip>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2" aria-hidden>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-ink/10" />
          ))}
        </div>
      ) : personal ? (
        <>
          {/* Personal summary band */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              {
                label: "Open hours",
                value: fmtHours(totalMinutes),
                hint: "Total bookable time across your weekly windows.",
              },
              {
                label: "Days covered",
                value: `${coveredDays}/7`,
                hint: "Days with at least one published window.",
              },
              {
                label: "Today",
                value: `${todayDay?.items.length ?? 0} window${(todayDay?.items.length ?? 0) === 1 ? "" : "s"}`,
                hint: "Your windows scheduled for today.",
              },
            ].map((s) => (
              <Tooltip
                key={s.label}
                content={
                  <>
                    <strong className="block font-bold">{s.label}</strong>
                    <span className="block text-white/75">{s.hint}</span>
                  </>
                }
                align="center"
                className="block cursor-default rounded-xl border border-ink/10 bg-cream/40 px-3 py-2"
              >
                <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                  {s.label}
                </p>
                <p className="mt-0.5 font-display text-base font-bold leading-none text-ink">{s.value}</p>
              </Tooltip>
            ))}
          </div>

          {/* Week planner */}
          <div className="mt-3 rounded-xl border border-ink/10">
            {coverage.map((d) => {
              const isToday = sameDay(d.date, now);
              const empty = d.items.length === 0;
              return (
                <div
                  key={d.day}
                  className={cn(
                    "flex flex-col gap-2.5 border-b border-ink/5 px-3 py-3 last:border-0 first:rounded-t-xl last:rounded-b-xl sm:flex-row sm:items-center sm:gap-4 sm:px-4",
                    isToday && "bg-primary-50/50",
                    empty && "bg-cream/30"
                  )}
                >
                  <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-32 sm:block">
                    <DayDate date={d.date} isToday={isToday} />
                    {!empty && (
                      <p className="text-[10px] font-semibold text-ink-faint sm:mt-0.5">
                        {fmtHours(d.minutes)} open
                      </p>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {empty ? (
                      <a
                        href="#add-availability"
                        className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink/15 bg-white/60 px-3 text-[11.5px] font-semibold text-ink-muted transition hover:border-primary-300 hover:text-primary-700"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        No windows — add availability
                      </a>
                    ) : (
                      <>
                        <div className="relative h-8 rounded-lg bg-cream ring-1 ring-inset ring-ink/5">
                          {d.items.map((it) => {
                            const left = pct(it.start);
                            const width = Math.max(pct(it.end) - left, 2);
                            // Keep the bubble inside the card at the edges.
                            const align = left < 18 ? "start" : left > 72 ? "end" : "center";
                            return (
                              <Tooltip
                                key={it.id}
                                side="top"
                                align={align}
                                className="absolute inset-y-1 cursor-default"
                                style={{ left: `${left}%`, width: `${width}%` }}
                                content={
                                  <>
                                    <strong className="block font-bold tabular-nums">{it.range}</strong>
                                    <span className="mt-0.5 block text-white/75">
                                      {DAYS[d.day]} · {fmtHours(it.minutes)}
                                    </span>
                                    <span className="block text-white/60">
                                      {it.recurring ? "Repeats weekly" : "One-off window"}
                                    </span>
                                  </>
                                }
                              >
                                <span
                                  className="block h-full w-full rounded-md bg-primary-500/85 shadow-sm transition-colors group-hover/tt:bg-primary-600"
                                  aria-hidden
                                />
                              </Tooltip>
                            );
                          })}
                          {isToday && nowMins >= scale.from && nowMins <= scale.to && (
                            <span
                              className="absolute inset-y-0 z-10 w-0.5 bg-accent-500"
                              style={{ left: `${pct(nowMins)}%` }}
                              aria-hidden
                            />
                          )}
                        </div>
                        <div className="mt-1 flex justify-between text-[9.5px] font-semibold text-ink-faint">
                          <span>{fmtTime12(scale.from)}</span>
                          <span>{fmtTime12(scale.to)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-28 sm:flex-col sm:items-end sm:justify-center">
                    {empty ? (
                      <p className="text-[11px] font-semibold text-ink-faint">No windows</p>
                    ) : (
                      <>
                        <p className="text-[12.5px] font-bold tabular-nums text-ink">{fmtHours(d.minutes)}</p>
                        <p className="text-[10px] font-semibold text-ink-faint">
                          {d.items.length} window{d.items.length === 1 ? "" : "s"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-medium text-ink-faint">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-sm bg-primary-500/85" aria-hidden />
              Each bar is a bookable window
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-0.5 bg-accent-500" aria-hidden />
              Current time (today)
            </span>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-ink/10">
          {coverage.map((d) => {
            const isToday = sameDay(d.date, now);
            const empty = d.items.length === 0;
            return (
              <div
                key={d.day}
                className={cn(
                  "flex flex-col gap-2 border-b border-ink/5 px-3 py-3 last:border-0 first:rounded-t-xl last:rounded-b-xl sm:flex-row sm:items-start sm:gap-4 sm:px-4",
                  isToday && "bg-primary-50/50",
                  empty && "bg-red-50/30"
                )}
              >
                <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-36 sm:flex-col sm:items-start sm:justify-start sm:gap-0.5">
                  <DayDate date={d.date} isToday={isToday} />
                  <span
                    className={cn(
                      "text-[10.5px] font-semibold",
                      empty ? "text-red-600" : "text-ink-faint"
                    )}
                  >
                    {empty
                      ? "No coverage"
                      : `${d.items.length} window${d.items.length === 1 ? "" : "s"} · ${fmtHours(d.minutes)}`}
                  </span>
                </div>

                <div className="flex flex-1 flex-wrap items-center gap-1.5">
                  {empty ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-red-200 bg-white/70 px-2.5 py-1.5 text-[11.5px] font-semibold text-red-600">
                      No open windows this day
                    </span>
                  ) : (
                    d.items.map((it) => (
                      <Tooltip
                        key={it.id}
                        side="top"
                        align="center"
                        className="inline-flex max-w-full cursor-default items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-2 py-1 shadow-sm"
                        content={
                          <>
                            <strong className="block font-bold">{it.name}</strong>
                            <span className="mt-0.5 block text-white/75 tabular-nums">
                              {DAYS[d.day]} · {it.range}
                            </span>
                            <span className="block text-white/60">
                              {fmtHours(it.minutes)} · {it.recurring ? "repeats weekly" : "one-off"}
                            </span>
                          </>
                        }
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                            AVATAR_TONES[(counselorIndex.get(it.counselorId) ?? 0) % AVATAR_TONES.length]
                          )}
                          aria-hidden
                        >
                          {initials(it.name) || "C"}
                        </span>
                        <span className="max-w-[150px] truncate text-[11.5px] font-semibold text-ink">
                          {it.name}
                        </span>
                        <span className="text-[11.5px] font-bold tabular-nums text-ink-soft">
                          {it.range}
                        </span>
                        {it.recurring && (
                          <span className="rounded-full bg-cream px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-ink-faint">
                            Weekly
                          </span>
                        )}
                      </Tooltip>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
