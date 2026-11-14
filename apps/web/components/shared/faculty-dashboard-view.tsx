"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  ChevronRight,
  Inbox,
  Megaphone,
  MessagesSquare,
  RefreshCw,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { useFacultyDashboard } from "@/lib/hooks/use-faculty-dashboard";
import { classificationSummary } from "@/components/referrals/status";
import { timeAgoLong } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MetricCard, Panel, PanelEmpty } from "./dashboard/primitives";
import { HeadTrendChart } from "./dashboard/head-trend-chart";
import { HeadDonut } from "./dashboard/head-donut";
import { HeadBars } from "./dashboard/head-bars";
import {
  lightClassificationColor,
  lightPriorityColor,
  lightStatusColor,
} from "./dashboard/chart-palette";
import { FacultyDashboardBodySkeleton } from "./skeletons";

const FACULTY_QUICK_LINKS = [
  { href: "/refer-student", label: "Refer a student", hint: "Flag a student for counseling", icon: UserPlus },
  { href: "/referrals", label: "Referrals", hint: "Track my cases", icon: Inbox },
  { href: "/reports", label: "Reports", hint: "Review my referrals", icon: BarChart3 },
  { href: "/chat", label: "Chat", hint: "Message the office", icon: MessagesSquare },
  { href: "/announcements", label: "Announcements", hint: "Office news", icon: Megaphone },
  { href: "/emergency", label: "Emergency access", hint: "Crisis reveal", icon: ShieldAlert },
  { href: "/notifications", label: "Notifications", hint: "Updates on my referrals", icon: Bell },
] as const;

/** Compact referral row used by the faculty panels. */
function ReferralRows({
  items,
  showPriority = false,
}: {
  items: {
    id: string;
    studentAlias: string;
    reason: string;
    status: string;
    priority: string;
    createdAt: string;
    classification: string[];
  }[];
  showPriority?: boolean;
}) {
  return (
    <ul className="divide-y divide-ink/[0.07]">
      {items.map((r) => (
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
              <p className="mt-0.5 line-clamp-1 text-[11.5px] text-ink-muted">
                {classificationSummary(r.classification)} · {r.reason}
              </p>
            </div>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="rounded bg-cream px-1.5 py-0.5 text-[10px] font-bold capitalize text-ink-soft">
                {r.status.replace(/_/g, " ")}
              </span>
              {showPriority && (
                <span className="rounded bg-accent-50 px-1.5 py-0.5 text-[9.5px] font-bold capitalize text-accent-700">
                  {r.priority}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Faculty dashboard — the same light, data-first layout as the counselor view,
 * scoped to the referrals this faculty member filed. RLS enforces the scope.
 */
export function FacultyDashboardView({ name }: { name: string | null }) {
  const { data, isFetching, isError, error, refetch } = useFacultyDashboard();

  // Keep the skeleton up while any fetch is in flight so the view never shows
  // a half-updated dashboard.
  const loading = !data || isFetching;
  const unlinked = !loading && (data as { unlinked?: boolean } | undefined)?.unlinked === true;

  // Client-only so server and client agree on hydration (the clock differs).
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);

  const firstName = name?.trim().split(/\s+/)[0];
  const kpis = data?.kpis;
  const trend = data?.trend ?? [];
  const byStatus = data?.byStatus ?? [];
  const byPriority = data?.byPriority ?? [];
  const byClassification = data?.byClassification ?? [];
  const attention = data?.attention ?? [];
  const recent = data?.recent ?? [];
  const announcements = data?.announcements ?? [];
  const hasTrend = trend.some((b) => b.referrals > 0);

  return (
    <div className="space-y-5">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 border-b border-ink/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary-600">
            My referral desk
          </p>
          <h1 className="mt-1 font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Dashboard
          </h1>
          <p className="mt-1 max-w-[620px] text-[12.5px] leading-relaxed text-ink-muted">
            {greeting}
            {firstName ? `, ${firstName}` : ""} — every case you flagged, where it sits now, and
            what the Guidance Office needs next.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!unlinked && (
            <Link
              href="/refer-student"
              className="inline-flex h-6 items-center gap-1.5 rounded-full bg-primary-600 px-3 text-[11.5px] font-bold text-white shadow-card transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              Refer a student
            </Link>
          )}
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
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-[12px] font-bold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-60"
          >
            <RefreshCw aria-hidden className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Retrying…" : "Try again"}
          </button>
        </div>
      ) : loading ? (
        <FacultyDashboardBodySkeleton />
      ) : unlinked ? (
        <div className="rounded-xl border border-accent-200 bg-accent-50 p-5">
          <p className="text-sm font-bold text-accent-700">Faculty record not linked yet</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-accent-700/80">
            Your login works, but no faculty row is linked to your account. Ask the guidance head
            to finish setup.
          </p>
        </div>
      ) : (
        <>
          {/* ── Referral metrics ──────────────────────────────────────── */}
          <section aria-labelledby="faculty-stats-heading">
            <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="faculty-stats-heading"
                className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-muted"
              >
                My referrals · all time
              </h2>
              <span className="text-[10.5px] font-medium text-ink-faint">
                Live counts — open a card to see that view
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <MetricCard
                label="My referrals"
                value={kpis?.totalReferrals}
                icon={Inbox}
                hint="Cases I flagged"
                href="/referrals"
              />
              <MetricCard
                label="Pending triage"
                value={kpis?.pending}
                icon={Clock}
                hint="Waiting for the office"
                href="/referrals"
                emphasis
              />
              <MetricCard
                label="With the office"
                value={kpis?.inProgress}
                icon={CalendarDays}
                hint="Assigned → confirmed"
                href="/referrals"
              />
              <MetricCard
                label="Resolved"
                value={kpis?.resolved}
                icon={CheckCircle2}
                hint="Closed by a counselor"
                href="/reports"
              />
              <MetricCard
                label="Unread updates"
                value={kpis?.unreadNotifications}
                icon={Bell}
                hint="Referral updates for me"
                href="/notifications"
              />
            </div>
          </section>

          {/* ── Cases + analytics ─────────────────────────────────────── */}
          <div className="grid items-start gap-4 xl:grid-cols-12">
            <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
              <Panel
                title="Needs the office"
                hint="Your pending + escalated referrals waiting on triage."
                viewAllHref="/referrals"
                bodyClassName="p-0"
              >
                {!attention.length ? (
                  <PanelEmpty
                    icon={Inbox}
                    title="Nothing waiting"
                    hint="Your flagged cases are all moving — new flags will show here while they wait."
                  />
                ) : (
                  <ReferralRows items={attention} />
                )}
              </Panel>

              <Panel title="Referrals over time" hint="Cases I flagged · rolling 14 days.">
                {hasTrend ? (
                  <HeadTrendChart
                    points={trend.map((b, i) => ({
                      key: `${b.day}-${i}`,
                      label: b.day,
                      count: b.referrals,
                    }))}
                  />
                ) : (
                  <PanelEmpty
                    icon={CalendarDays}
                    title="No referrals in the last 14 days"
                    hint="Cases you flag will chart here."
                    className="min-h-[196px]"
                  />
                )}
              </Panel>

              <div className="grid gap-4 md:grid-cols-2">
                <Panel title="Where my cases sit" hint="All-time status split.">
                  {byStatus.length ? (
                    <HeadDonut
                      items={byStatus}
                      colorOf={lightStatusColor}
                      centerLabel="referrals"
                      emptyTitle="No referrals yet"
                      emptyHint="Cases you flag will break down here."
                    />
                  ) : (
                    <PanelEmpty
                      icon={Inbox}
                      title="No referrals yet"
                      hint="Cases you flag will break down here."
                    />
                  )}
                </Panel>

                <Panel title="My urgency mix" hint="Urgent and high cases are triaged first.">
                  {byPriority.length ? (
                    <HeadBars
                      items={byPriority}
                      colorOf={lightPriorityColor}
                      emptyTitle="No priority data"
                      emptyHint="Your urgent vs routine mix will show here."
                    />
                  ) : (
                    <PanelEmpty
                      icon={BarChart3}
                      title="No priority data"
                      hint="Your urgent vs routine mix will show here."
                    />
                  )}
                </Panel>
              </div>

              <Panel title="What I flag most" hint="Case kinds from the official referral form.">
                {byClassification.length ? (
                  <HeadBars
                    items={byClassification}
                    colorOf={lightClassificationColor}
                    emptyTitle="No classifications yet"
                    emptyHint="The case kinds you flag will break down here."
                    note="Classification is multi-select on the paper form, so one referral can appear in more than one bar."
                  />
                ) : (
                  <PanelEmpty
                    icon={BarChart3}
                    title="No classifications yet"
                    hint="The case kinds you flag will break down here."
                  />
                )}
              </Panel>

              <Panel
                title="My recent referrals"
                hint="Latest cases I flagged."
                viewAllHref="/referrals"
                bodyClassName="p-0"
              >
                {!recent.length ? (
                  <PanelEmpty
                    icon={UserPlus}
                    title="No referrals yet"
                    hint="Flag a student from the Refer a student page — your cases will show up here."
                  />
                ) : (
                  <ReferralRows items={recent} showPriority />
                )}
              </Panel>
            </div>

            <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
              <Panel
                title="Office news"
                hint="Latest published announcements."
                viewAllHref="/announcements"
                bodyClassName="p-0"
              >
                {!announcements.length ? (
                  <PanelEmpty
                    icon={Megaphone}
                    title="No announcements"
                    hint="News from the guidance office will show up here."
                  />
                ) : (
                  <ul className="divide-y divide-ink/[0.07]">
                    {announcements.map((a) => (
                      <li key={a.id}>
                        <Link
                          href="/announcements"
                          className="group block px-5 py-3 transition hover:bg-cream/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
                        >
                          <p className="truncate text-[12.5px] font-semibold text-ink group-hover:text-primary-700">
                            {a.title}
                          </p>
                          {a.publishedAt && (
                            <p className="mt-0.5 text-[10.5px] font-medium text-ink-faint">
                              {timeAgoLong(a.publishedAt)}
                            </p>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Quick links" hint="Jump back into your workspace." bodyClassName="p-0">
                <ul className="divide-y divide-ink/[0.07]">
                  {FACULTY_QUICK_LINKS.map((q) => (
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
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600"
                          )}
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
