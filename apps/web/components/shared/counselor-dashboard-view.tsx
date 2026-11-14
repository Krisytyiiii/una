"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Inbox,
  MessagesSquare,
  RefreshCw,
  Sparkles,
  UserX,
} from "lucide-react";
import {
  useCounselorDashboard,
  type CounselorDashboardPayload,
  type CounselorDashboardRange,
  type CounselorPeriod,
} from "@/lib/hooks/use-counselor-dashboard";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { statusLabel } from "@/components/referrals/status";
import { formatWhen, timeAgoLong } from "@/lib/format";
import { MetricCard, Panel, PanelEmpty, RangeBadge, StatRow } from "./dashboard/primitives";
import { HeadTrendChart } from "./dashboard/head-trend-chart";
import { HeadDonut } from "./dashboard/head-donut";
import { HeadBars } from "./dashboard/head-bars";
import { HeadWeekChart } from "./dashboard/head-week-chart";
import { HeadSessionsLineChart } from "./dashboard/head-sessions-line-chart";
import {
  lightAppointmentStatusColor,
  lightModeColor,
  lightPriorityColor,
} from "./dashboard/chart-palette";
import { CounselorDashboardBodySkeleton } from "./skeletons";

const COUNSELOR_PERIODS = [
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

function isoDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Label for the applied range, independent of the (possibly stale) payload. */
function rangeLabelOf(range: CounselorDashboardRange): string {
  if (range.period === "today") return "Today";
  if (range.period === "month") return "Last 30 days";
  if (range.period === "custom") {
    if (range.from && range.to) return `${isoDayLabel(range.from)} – ${isoDayLabel(range.to)}`;
    return "Custom range";
  }
  return "Last 7 days";
}

const COUNSELOR_QUICK_LINKS = [
  { href: "/appointments", label: "My appointments", hint: "Confirm & complete", icon: CalendarCheck },
  { href: "/referrals", label: "Referrals inbox", hint: "Triage your queue", icon: Inbox },
  { href: "/chat", label: "Chat", hint: "Message students", icon: MessagesSquare },
  { href: "/availability", label: "Availability", hint: "Manage open slots", icon: Clock },
  { href: "/sessions", label: "Sessions calendar", hint: "Month, week, day", icon: CalendarDays },
  { href: "/reports", label: "Reports", hint: "Review my work", icon: BarChart3 },
] as const;

/** Compact row used by the counselor's own session lists. */
function SessionRows({ items }: { items: CounselorDashboardPayload["today"] }) {
  return (
    <ul className="divide-y divide-ink/[0.07]">
      {items.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-bold text-ink">{a.studentAlias}</p>
            <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">
              {formatWhen(a.scheduledAt)} · {a.concern}
            </p>
          </div>
          <span className="shrink-0 rounded bg-cream px-1.5 py-0.5 text-[10px] font-bold capitalize text-ink-soft">
            {a.status.replace(/_/g, " ")}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Counselor dashboard — the same structure as the head view, scoped to the
 * logged-in counselor. Work queue first, then today's calendar, then charts;
 * the right rail keeps live counts and reference lists within one scroll.
 */
export function CounselorDashboardView({ name }: { name: string | null }) {
  const [range, setRange] = useState<CounselorDashboardRange>({ period: "week" });
  const { data, isLoading, isFetching, isError, error, refetch } = useCounselorDashboard(range);

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
  const unlinked = !loading && data?.unlinked === true;
  const filtered = data?.stats.filtered;
  const snapshot = data?.stats.snapshot;

  // Assigned-only action queue — appointments + referrals waiting for
  // confirmation. Filtered client-side too so stale caches never leak a
  // confirmed/resolved record into the queue.
  const actionAppts = (data?.actionQueue ?? []).filter((a) => a.status === "assigned");
  const actionRefs = (data?.actionReferrals ?? []).filter((r) => r.status === "assigned");
  const queueEmpty = !actionAppts.length && !actionRefs.length;

  return (
    <div className="space-y-5">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 border-b border-ink/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary-600">
            My counseling desk
          </p>
          <h1 className="mt-1 font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Dashboard
          </h1>
          <p className="mt-1 max-w-[620px] text-[12.5px] leading-relaxed text-ink-muted">
            {greeting}
            {firstName ? `, ${firstName}` : ""} — your sessions, referrals, and confirmation queue.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <DateRangeFilter
            presets={COUNSELOR_PERIODS}
            preset={range.period}
            from={range.from ?? ""}
            to={range.to ?? ""}
            rangeLabel={rangeLabel}
            pending={pending}
            tone="light"
            size="sm"
            labelPrefix="Period"
            dialogLabel="Dashboard filters"
            customDefaults={{ from: isoDay(-29), to: isoDay() }}
            disableFuture
            footer="Your stats and charts follow the selected period. The at-a-glance cards stay live."
            onApply={(selection) => {
              if (selection.preset === "custom") {
                setRange({ period: "custom", from: selection.from, to: selection.to });
                return;
              }
              setRange({ period: selection.preset as CounselorPeriod });
            }}
          />
        </div>
      </div>

      {isError && !data ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">Couldn&apos;t load the dashboard</p>
          <p className="mt-1 text-[12.5px] text-red-600">
            {(error as Error)?.message ?? "Something went wrong fetching your overview."}
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
        <CounselorDashboardBodySkeleton />
      ) : unlinked ? (
        <div className="rounded-xl border border-accent-200 bg-accent-50 p-5">
          <p className="text-sm font-bold text-accent-700">Counselor record not linked yet</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-accent-700/80">
            Your login works, but no counselor row is linked to your account. Ask the guidance head
            to finish setup.
          </p>
        </div>
      ) : (
        <>
          {/* ── Filtered session metrics ──────────────────────────────── */}
          <section aria-labelledby="filtered-stats-heading">
            <h2 id="filtered-stats-heading" className="sr-only">
              My sessions · {rangeLabel}
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total sessions"
                value={filtered?.total}
                icon={CalendarDays}
                hint={<RangeBadge>{rangeLabel}</RangeBadge>}
                trend={filtered?.trends.total}
              />
              <MetricCard
                label="Completed"
                value={filtered?.completed}
                icon={CheckCircle2}
                hint="Marked complete"
                trend={filtered?.trends.completed}
              />
              <MetricCard
                label="Confirmed"
                value={filtered?.confirmed}
                icon={CalendarCheck}
                hint="Booked and confirmed"
                trend={filtered?.trends.confirmed}
              />
              <MetricCard
                label="No-shows"
                value={filtered?.noShow}
                icon={UserX}
                hint="Missed sessions"
                trend={filtered?.trends.noShow}
                emphasis
              />
            </div>
          </section>

          {/* ── Work + analytics ──────────────────────────────────────── */}
          <div className="grid items-start gap-4 xl:grid-cols-12">
            <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
              <Panel
                title="Needs your action"
                hint="Live queue — assigned appointments and referrals waiting for your confirmation."
                bodyClassName="p-0"
                action={
                  !queueEmpty ? (
                    <span className="rounded bg-accent-50 px-2 py-0.5 text-[10.5px] font-bold text-accent-700">
                      {actionAppts.length + actionRefs.length} waiting
                    </span>
                  ) : undefined
                }
              >
                {queueEmpty ? (
                  <PanelEmpty
                    icon={CalendarCheck}
                    title="All confirmed"
                    hint="No assigned appointments or referrals waiting for confirmation."
                  />
                ) : (
                  <ul className="divide-y divide-ink/[0.07]">
                    {actionAppts.map((a) => (
                      <li key={`appt-${a.id}`}>
                        <Link
                          href={`/appointments#confirm-${a.id}`}
                          className="group flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-cream/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-bold text-ink group-hover:text-primary-700">
                              {a.studentAlias}
                            </p>
                            <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">
                              {formatWhen(a.scheduledAt)} · {a.concern}
                            </p>
                          </div>
                          <span className="flex shrink-0 items-center gap-1.5 rounded bg-accent-50 px-2 py-1 text-[10.5px] font-bold text-accent-700">
                            Confirm
                            <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                          </span>
                        </Link>
                      </li>
                    ))}
                    {actionRefs.map((r) => (
                      <li key={`ref-${r.id}`}>
                        <Link
                          href={`/referrals#triage-${r.id}`}
                          className="group flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-cream/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-bold text-ink group-hover:text-primary-700">
                              {r.studentAlias}
                            </p>
                            <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">
                              Referred {timeAgoLong(r.createdAt)} · {statusLabel(r.priority)} priority
                            </p>
                          </div>
                          <span className="flex shrink-0 items-center gap-1.5 rounded bg-primary-50 px-2 py-1 text-[10.5px] font-bold text-primary-700">
                            Triage
                            <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel
                title="Today's sessions"
                hint="Your calendar for today."
                viewAllHref="/appointments"
                bodyClassName="p-0"
              >
                {!data?.today.length ? (
                  <PanelEmpty
                    icon={CalendarDays}
                    title="Nothing today"
                    hint="No sessions on your calendar today — check your upcoming appointments."
                  />
                ) : (
                  <SessionRows items={data.today} />
                )}
              </Panel>

              <div className="grid gap-4 md:grid-cols-2">
                <Panel
                  title="Sessions booked"
                  hint={
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      Appointments on your calendar
                      <RangeBadge>{rangeLabel}</RangeBadge>
                    </span>
                  }
                >
                  <HeadSessionsLineChart points={data?.sessionTrend ?? []} />
                </Panel>
                <Panel title="Session status" hint="Every session in this window.">
                  <HeadDonut
                    items={data?.byStatus ?? []}
                    colorOf={lightAppointmentStatusColor}
                    centerLabel="sessions"
                    emptyTitle="No sessions in this window"
                    emptyHint="Sessions scheduled in the selected period will appear here."
                  />
                </Panel>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Panel title="Session mode" hint="Online vs in-person sessions.">
                  <HeadBars
                    items={data?.byMode ?? []}
                    colorOf={lightModeColor}
                    emptyTitle="No sessions to split"
                    emptyHint="Sessions in this window have no mode recorded."
                  />
                </Panel>
                <Panel title="Referral priority" hint="How quickly your referrals need attention.">
                  <HeadBars
                    items={data?.byReferralPriority ?? []}
                    colorOf={lightPriorityColor}
                    emptyTitle="No referral priority data"
                    emptyHint="Referrals assigned to you in this window have no priority recorded."
                  />
                </Panel>
              </div>

              <Panel
                title="Referrals over time"
                hint={
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    Referrals assigned to you
                    <RangeBadge>{rangeLabel}</RangeBadge>
                  </span>
                }
              >
                <HeadTrendChart points={data?.referralTrend ?? []} />
              </Panel>

              <Panel title="Sessions this week" hint="Your appointments per day, rolling 7 days.">
                <HeadWeekChart points={data?.weekChart ?? []} />
              </Panel>
            </div>

            <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
              <Panel
                title="At a glance"
                hint="Live — does not follow the period filter."
                bodyClassName="p-0"
              >
                <div className="divide-y divide-ink/[0.07]">
                  <StatRow
                    label="Sessions today"
                    value={snapshot?.sessionsToday}
                    icon={Clock}
                    href="/appointments"
                  />
                  <StatRow
                    label="Awaiting your confirmation"
                    value={snapshot?.awaitingConfirmation}
                    icon={CalendarClock}
                    href="/appointments"
                  />
                  <StatRow
                    label="Open referrals"
                    value={snapshot?.openReferrals}
                    icon={Inbox}
                    href="/referrals"
                  />
                  <StatRow
                    label="Open chats"
                    value={snapshot?.openChats}
                    icon={MessagesSquare}
                    href="/chat"
                  />
                </div>
              </Panel>

              <Panel
                title="My referrals"
                hint={
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    Referrals assigned to you
                    <RangeBadge>{rangeLabel}</RangeBadge>
                  </span>
                }
                viewAllHref="/referrals"
                bodyClassName="p-0"
              >
                {!data?.myReferrals.length ? (
                  <PanelEmpty
                    icon={Inbox}
                    title="No referrals in this period"
                    hint="Referrals assigned to you in the selected period will show up here."
                  />
                ) : (
                  <ul className="divide-y divide-ink/[0.07]">
                    {data.myReferrals.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/referrals#focus-${r.id}`}
                          className="group flex items-start justify-between gap-3 px-5 py-3 transition hover:bg-cream/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-bold text-ink group-hover:text-primary-700">
                              {r.studentAlias}
                              <span className="ml-2 text-[10.5px] font-medium text-ink-faint">
                                {timeAgoLong(r.createdAt)}
                              </span>
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-[11.5px] text-ink-muted">{r.reason}</p>
                          </div>
                          <span className="shrink-0 rounded bg-cream px-1.5 py-0.5 text-[10px] font-bold capitalize text-ink-soft">
                            {r.status.replace(/_/g, " ")}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel
                title="Your caseload"
                hint={
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    Referrals assigned to you
                    <RangeBadge>{rangeLabel}</RangeBadge>
                  </span>
                }
                bodyClassName="p-0"
              >
                <div className="divide-y divide-ink/[0.07]">
                  <StatRow label="Referrals" value={data?.stats.referrals.total} icon={Sparkles} />
                  <StatRow label="Resolved" value={data?.stats.referrals.resolved} icon={CheckCircle2} />
                  <StatRow label="Escalated" value={data?.stats.referrals.escalated} icon={Inbox} />
                </div>
              </Panel>

              <Panel title="Quick links" hint="Jump back into your workspace." bodyClassName="p-0">
                <ul className="divide-y divide-ink/[0.07]">
                  {COUNSELOR_QUICK_LINKS.map((q) => (
                    <li key={q.href}>
                      <Link
                        href={q.href}
                        className="group flex items-center gap-3 px-5 py-2.5 transition hover:bg-cream/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cream text-primary-600">
                          <q.icon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block truncate text-[12.5px] font-semibold text-ink group-hover:text-primary-700">
                            {q.label}
                          </span>
                          <span className="block truncate text-[10.5px] font-medium text-ink-faint">
                            {q.hint}
                          </span>
                        </span>
                        <ChevronRight
                          aria-hidden
                          className="h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
