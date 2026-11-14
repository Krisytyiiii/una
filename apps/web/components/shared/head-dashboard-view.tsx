"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Clock3,
  Inbox,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { useHeadDashboard, type HeadDashboardRange, type HeadPeriod } from "@/lib/hooks/use-head-dashboard";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { statusLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HeadDashboardBodySkeleton } from "./skeletons";
import { MetricCard, Panel, PanelEmpty, RangeBadge } from "./dashboard/primitives";
import { HeadTrendChart } from "./dashboard/head-trend-chart";
import { HeadDonut } from "./dashboard/head-donut";
import { HeadBars } from "./dashboard/head-bars";
import { HeadGauge } from "./dashboard/head-gauge";
import { HeadSessionStatusChart } from "./dashboard/head-session-status-chart";
import { HeadSessionsLineChart } from "./dashboard/head-sessions-line-chart";
import {
  lightPriorityColor,
  lightSnapshotColor,
  lightStatusColor,
} from "./dashboard/chart-palette";

function isoDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Label for the applied range, independent of the (possibly stale) payload. */
function rangeLabelOf(range: HeadDashboardRange): string {
  if (range.period === "today") return "Today";
  if (range.period === "month") return "Last 30 days";
  if (range.period === "custom") {
    if (range.from && range.to) return `${isoDayLabel(range.from)} – ${isoDayLabel(range.to)}`;
    return "Custom range";
  }
  return "Last 7 days";
}

/**
 * Same tone rules as `appointments/status.ts#statusTone`, inlined so this view
 * does not pull the appointments service/supabase client into the bundle.
 */
type BadgeTone = "info" | "success" | "warning" | "danger" | "muted";

function bookingTone(status: string): BadgeTone {
  if (status === "completed") return "success";
  if (status === "cancelled" || status === "rejected" || status === "no_show") return "danger";
  if (status === "assigned" || status === "confirmed") return "info";
  return "warning";
}

const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  info: "bg-blue-100 text-blue-800",
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-700",
  danger: "bg-red-100 text-red-700",
  muted: "bg-ink/10 text-ink-muted",
};

/** Calendar-tile pieces for a booking card's date block. */
function bookingDateParts(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { month: "", day: "", weekday: "", time: iso };
  }
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }),
    day: d.toLocaleDateString("en-US", { day: "numeric" }),
    weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

const HEAD_PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom" },
];

/** Seed for the custom calendar when no explicit window is applied. */
function isoDay(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Guidance-head dashboard — office-wide analytics.
 *
 * Layout: compact page header (range), a four-metric strip, then a
 * 12-column grid where the left column carries the chart stack and the right
 * rail carries the fixed office snapshot plus the two queues that need a head's
 * attention.
 */
export function HeadDashboardView({ name }: { name?: string | null }) {
  // Default to the overall 2026 window (Jan 1 → today) for the guidance head.
  const [range, setRange] = useState<HeadDashboardRange>(() => ({
    period: "custom",
    from: "2026-01-01",
    to: isoDay(),
  }));
  const { data, isLoading, isFetching, isError, error, refetch } = useHeadDashboard(range);

  // Show the skeleton for the initial load and for every period change.
  // `keepPreviousData` would otherwise leave the old period's numbers on
  // screen while the new range loads, which reads as stale data.
  const loading = !data || isFetching;
  const pending = isFetching && !isLoading;
  const rangeLabel = rangeLabelOf(range);

  // Client-only so server and client agree on hydration (the clock differs).
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);

  const firstName = name?.trim().split(/\s+/)[0];
  const filtered = data?.stats.filtered;
  const snapshot = data?.stats.snapshot;
  const latest = data?.latestBookings ?? [];
  const facultyReferrals = data?.facultyReferrals ?? [];
  const unassigned = data?.unassignedAppointments ?? [];
  // Only `pending` referrals still await triage; assigned rows are already in a
  // counselor's queue. Unassigned appointments always need an assignment.
  const pendingReferrals = facultyReferrals.filter((r) => r.status === "pending");
  const queueCount = pendingReferrals.length + unassigned.length;

  const priorityCounts = pendingReferrals.reduce<Record<string, number>>((acc, r) => {
    acc[r.priority] = (acc[r.priority] ?? 0) + 1;
    return acc;
  }, {});
  const triageItems = [
    { key: "appointments", name: "Student appointments", value: unassigned.length },
    { key: "urgent", name: "Urgent referrals", value: priorityCounts.urgent ?? 0 },
    { key: "high", name: "High referrals", value: priorityCounts.high ?? 0 },
    { key: "medium", name: "Medium referrals", value: priorityCounts.medium ?? 0 },
    { key: "low", name: "Low referrals", value: priorityCounts.low ?? 0 },
  ].filter((item) => item.value > 0);

  // The snapshot is fixed (not period-scoped). Only numeric values make it into
  // the donut; a failed sub-query returns null for that metric and is skipped.
  const snapshotItems = [
    {
      key: "upcomingSessions",
      name: "Upcoming sessions",
      value: snapshot?.upcomingSessionsThisWeek,
      href: "/appointments",
    },
    {
      key: "sessionsToday",
      name: "Sessions today",
      value: data?.kpis.sessionsToday,
      href: "/appointments",
    },
    {
      key: "activeStudents",
      name: "Active students",
      value: snapshot?.activeStudents,
      href: "/users",
    },
    {
      key: "activeCounselors",
      name: "Active counselors",
      value: snapshot?.activeCounselors,
      href: "/users",
    },
    {
      key: "referralsWaiting",
      name: "Referrals waiting",
      value: data?.kpis.referralsWaiting,
      href: "/referrals",
    },
    {
      key: "openChats",
      name: "Open chats",
      value: data?.kpis.openChats,
      href: "/chat",
    },
  ].filter(
    (item): item is { key: string; name: string; value: number; href: string } =>
      typeof item.value === "number"
  );

  return (
    <div className="space-y-5">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 border-b border-ink/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary-600">
            Guidance Office
          </p>
          <h1 className="mt-1 font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Office overview
          </h1>
          <p className="mt-1 max-w-[620px] text-[12.5px] leading-relaxed text-ink-muted">
            {greeting}
            {firstName ? `, ${firstName}` : ""} — referral flow, counselor workload, and the
            office&apos;s day at a glance.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <DateRangeFilter
            presets={HEAD_PERIODS}
            preset={range.period}
            from={range.from ?? ""}
            to={range.to ?? ""}
            rangeLabel={rangeLabel}
            pending={pending}
            tone="light"
            size="sm"
            labelPrefix="Period"
            dialogLabel="Dashboard filters"
            customDefaults={{ from: "2026-01-01", to: isoDay() }}
            disableFuture
            footer="Stats and charts follow the selected period. The office snapshot stays all-time / this week."
            onApply={(selection) => {
              if (selection.preset === "custom") {
                setRange({ period: "custom", from: selection.from, to: selection.to });
                return;
              }
              setRange({ period: selection.preset as HeadPeriod });
            }}
          />
        </div>
      </div>

      {isError && !data ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">Couldn&apos;t load the dashboard</p>
          <p className="mt-1 text-[12.5px] text-red-600">
            {(error as Error)?.message ?? "Something went wrong fetching the overview."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-3 inline-flex h-6 items-center gap-1.5 rounded-full bg-red-600 px-3 text-[11.5px] font-bold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-60"
          >
            <RefreshCw aria-hidden className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Retrying…" : "Try again"}
          </button>
        </div>
      ) : loading ? (
        <HeadDashboardBodySkeleton />
      ) : (
        <>
          {/* ── Filtered referral metrics ─────────────────────────────── */}
          <section aria-labelledby="filtered-stats-heading">
            <h2 id="filtered-stats-heading" className="sr-only">
              Referrals · {rangeLabel}
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total referrals"
                value={filtered?.total}
                icon={Inbox}
                hint={<RangeBadge>{rangeLabel}</RangeBadge>}
                trend={filtered?.trends.total}
              />
              <MetricCard
                label="Pending triage"
                value={filtered?.pending}
                icon={BarChart3}
                hint="Waiting for assignment"
                trend={filtered?.trends.pending}
                emphasis
              />
              <MetricCard
                label="Assigned / In progress"
                value={filtered?.assigned}
                icon={Users}
                hint="With a counselor"
                trend={filtered?.trends.assigned}
              />
              <MetricCard
                label="Resolved"
                value={filtered?.resolved}
                icon={Sparkles}
                hint="Closed in this window"
                trend={filtered?.trends.resolved}
              />
            </div>
          </section>

          {/* ── Analytics + queues ────────────────────────────────────── */}
          <div className="grid items-start gap-4 xl:grid-cols-12">
            <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
              <Panel
                title="Sessions booked"
                hint={
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    Appointments booked
                    <RangeBadge>{rangeLabel}</RangeBadge>
                  </span>
                }
              >
                <HeadSessionsLineChart points={data?.sessionTrend ?? []} />
              </Panel>

              <div className="grid gap-4 md:grid-cols-2">
                <Panel title="Pipeline by status" hint="Every referral status in this window.">
                  <HeadDonut
                    items={data?.byStatus ?? []}
                    colorOf={lightStatusColor}
                    centerLabel="referrals"
                  />
                </Panel>
                <Panel title="Urgency" hint="How quickly a case needs attention.">
                  <HeadGauge
                    items={data?.byUrgency ?? []}
                    colorOf={lightPriorityColor}
                    emptyTitle="No urgency data"
                    emptyHint="Referrals in this window have no priority recorded."
                  />
                </Panel>
              </div>

              <Panel
                title="Referrals over time"
                hint={
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    Cases created per day
                    <RangeBadge>{rangeLabel}</RangeBadge>
                  </span>
                }
                className="xl:h-[352px]"
                bodyClassName="flex flex-col justify-center"
              >
                <HeadTrendChart points={data?.referralTrend ?? []} />
              </Panel>
            </div>

            <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
              <Panel
                title="Office snapshot"
                hint="Fixed — does not follow the period filter."
              >
                <HeadDonut
                  items={snapshotItems}
                  colorOf={lightSnapshotColor}
                  centerLabel="total"
                  orientation="column"
                  emptyTitle="No snapshot data"
                  emptyHint="Office totals will appear here once the dashboard loads."
                />
              </Panel>

              <Panel
                title="Awaiting triage"
                hint={`${queueCount} case${queueCount === 1 ? "" : "s"} need a counselor or assignment.`}
                viewAllHref="/referrals"
              >
                {queueCount === 0 ? (
                  <PanelEmpty
                    icon={Inbox}
                    title="Queue is clear"
                    hint="No unassigned appointments or faculty referrals waiting."
                  />
                ) : (
                  <HeadBars
                    items={triageItems}
                    colorOf={(key) =>
                      key === "appointments" ? lightStatusColor("assigned") : lightPriorityColor(key)
                    }
                    emptyTitle="Queue is clear"
                    emptyHint="No unassigned appointments or faculty referrals waiting."
                    note="Student appointments have no priority yet, so they are counted as their own bucket."
                  />
                )}
              </Panel>

              <Panel
                title="Latest bookings"
                hint="Newest student appointment requests."
                viewAllHref="/appointments"
                className="xl:h-[352px]"
                bodyClassName="p-0"
              >
                {latest.length === 0 ? (
                  <PanelEmpty
                    icon={CalendarDays}
                    title="No bookings yet"
                    hint="New student requests will appear here."
                  />
                ) : (
                  <ul className="flex h-full flex-col justify-between gap-2 p-4">
                    {latest.slice(0, 3).map((b) => {
                      const when = bookingDateParts(b.scheduledAt);
                      return (
                        <li
                          key={b.id}
                          className="group flex items-start gap-3 rounded-lg border border-ink/10 bg-cream/30 p-3 transition hover:border-primary-200 hover:bg-white"
                        >
                          <div
                            aria-hidden
                            className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-white ring-1 ring-ink/10 transition group-hover:ring-primary-200"
                          >
                            <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-primary-600">
                              {when.month}
                            </span>
                            <span className="font-display text-[14px] font-bold leading-none tabular-nums text-ink">
                              {when.day}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-[12.5px] font-bold leading-snug text-ink">
                                {b.studentAlias}
                              </p>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold leading-none",
                                  BADGE_TONE_CLASS[bookingTone(b.status)]
                                )}
                              >
                                {statusLabel(b.status)}
                              </span>
                            </div>

                            <p className="mt-1 truncate text-[11.5px] leading-snug text-ink-muted">
                              {b.concern}
                            </p>

                            <p className="mt-1.5 flex items-center gap-1 text-[10.5px] font-medium text-ink-faint">
                              <Clock3 aria-hidden className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {when.weekday}, {when.time}
                              </span>
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            </div>
          </div>

          <Panel
            title="Sessions by status"
            hint={
              <span className="inline-flex flex-wrap items-center gap-1.5">
                Appointments per day
                <RangeBadge>{rangeLabel}</RangeBadge>
              </span>
            }
          >
            <HeadSessionStatusChart points={data?.sessionStatusTrend ?? []} />
          </Panel>
        </>
      )}
    </div>
  );
}
