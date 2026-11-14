"use client";

import { Suspense } from "react";
import Link from "next/link";
import {
  BarChart3,
  PieChart as PieChartIcon,
  CalendarDays,
  ClipboardList,
  Inbox,
  Loader2,
  MessagesSquare,
  ShieldAlert,
  Users,
} from "lucide-react";
import { ReportAreaChart, ReportBars, ReportDonut, ReportTrendChart } from "@/components/shared/reports-charts";
import { HeadGauge } from "@/components/shared/dashboard/head-gauge";
import {
  ReportsFilters,
  ReportsFiltersSkeleton,
  ReportsSectionNav,
  ReportsSectionNavSkeleton,
} from "@/components/shared/reports-filters";
import { ReportKpiCard, ReportKpiSkeleton, pointDelta, relativeDelta } from "@/components/shared/reports-kpi";
import { useHeadReports } from "@/lib/hooks/use-head-reports";
import type { HeadReportsPayload } from "@/lib/hooks/use-head-reports";
import {
  buildTrendBuckets,
  COHORT_GROUPS,
  fmtDayCompact,
  rangeDay,
  type CohortGroup,
  type ReportRange,
  type ReportSection,
} from "@/lib/reports-scope";
import { timeAgoLong } from "@/lib/format";
import { EmptyState, PanelShell, ListSkeleton } from "@/components/shared/panel-shell";
import {
  APPT_STATUS_META,
  COHORT_SLICE_COLORS,
  FALLBACK_SLICE,
  PRIORITY_META,
  REFERRAL_STATUS_META,
  SESSION_STATUS_SERIES,
  STRESS_META,
  UNASSIGNED_SLICE_COLOR,
  ratingColor,
} from "@/lib/report-palette";
import { MIN_CELL, isSuppressed, suppressCount } from "@/lib/reports/suppression";
import { kpiChange, kpiPointChange, rate, summarizeKpi } from "@/lib/reports/kpi-summary";
import { ratingBarInsight } from "@/lib/sentiment";

function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

/* ── Pure section renderers (same math as the old server components) ── */

function ChartSkeleton() {
  return (
    <div className="animate-pulse pt-4" aria-hidden>
      <div className="h-[240px] rounded-lg bg-ink/10" />
    </div>
  );
}

function KpiGrid({ data }: { data: HeadReportsPayload }) {
  const current = summarizeKpi({
    appointments: data.appointments,
    referrals: data.referrals,
    feedback: data.feedback,
    screenings: data.screenings,
  });
  const prev = data.comparison;
  const resolution = rate(current.resolvedReferrals, current.referrals);
  const prevResolution = prev ? rate(prev.resolvedReferrals, prev.referrals) : null;
  // A suppressed high-stress cell must not become inferable through its delta.
  const stressHidden =
    isSuppressed(current.highStress) || (prev ? isSuppressed(prev.highStress) : false);

  const cards = [
    {
      label: "Sessions completed",
      value: String(current.completed),
      sub: `${pct(current.completed, current.sessions)} completion rate`,
      delta: relativeDelta(kpiChange(current.completed, prev?.completed)),
    },
    {
      label: "Missed sessions",
      value: String(current.missed),
      sub: "Cancelled + rejected + no-show",
      delta: relativeDelta(kpiChange(current.missed, prev?.missed)),
    },
    {
      label: "Open referrals",
      value: String(current.openReferrals),
      sub: "Waiting for action",
      delta: relativeDelta(kpiChange(current.openReferrals, prev?.openReferrals)),
    },
    {
      label: "Referral resolution",
      value: resolution == null ? "—" : `${resolution}%`,
      sub: `${current.resolvedReferrals} of ${current.referrals} resolved`,
      delta: pointDelta(kpiPointChange(resolution, prevResolution)),
    },
    {
      label: "Avg. satisfaction",
      value: current.avgRating == null ? "—" : `${current.avgRating.toFixed(1)} / 5`,
      sub: `${current.feedback} feedback response${current.feedback === 1 ? "" : "s"}`,
      delta: pointDelta(kpiPointChange(current.avgRating, prev?.avgRating ?? null)),
    },
    {
      label: "High-stress screenings",
      value: stressHidden ? `<${MIN_CELL}` : String(current.highStress),
      sub: `${current.screenings} screening${current.screenings === 1 ? "" : "s"} in range`,
      delta: stressHidden ? null : relativeDelta(kpiChange(current.highStress, prev?.highStress)),
    },
  ];

  return (
    <>
      {cards.map((c) => (
        <ReportKpiCard key={c.label} label={c.label} value={c.value} sub={c.sub} delta={c.delta} />
      ))}
    </>
  );
}

/**
 * Attention banner shown at the bottom of the reports section rail. Each one
 * deep-links into the section that can act on it. The CTA is a compact 24px
 * button anchored to the bottom-right of the card.
 */
function AttentionBanner({
  href,
  title,
  detail,
  tone = "amber",
}: {
  href: string;
  title: string;
  detail: string;
  tone?: "amber" | "blue";
}) {
  return (
    <div
      className={
        tone === "amber"
          ? "rounded-lg border border-amber-200 bg-amber-50 p-3"
          : "rounded-lg border border-blue-200 bg-blue-50 p-3"
      }
    >
      <div className="flex items-start gap-2">
        <span
          className={
            tone === "amber"
              ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
              : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-primary-700"
          }
        >
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
        </span>
        <p className="min-w-0 text-[12px] font-bold leading-snug text-ink">{title}</p>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">{detail}</p>
      <div className="mt-2.5 flex justify-end">
        <Link
          href={href}
          className="inline-flex h-6 items-center gap-1 rounded bg-primary-600 px-2.5 text-[11px] font-bold text-white shadow-soft transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          Open <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}

type SessionLifecycleKey = "upcoming" | "completed" | "overdue" | "cancelled" | "rejected" | "no_show";

function lifecycleOf(status: string, scheduledAt: string, nowMs: number): SessionLifecycleKey {
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "rejected") return "rejected";
  if (status === "no_show") return "no_show";
  return new Date(scheduledAt).getTime() < nowMs ? "overdue" : "upcoming";
}

function sessionTrend(data: HeadReportsPayload, range: ReportRange) {
  const scoped = range.from !== null && range.to !== null;
  const t = scoped
    ? buildTrendBuckets(range.from as string, range.to as string)
    : (() => {
        const now = new Date();
        const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const start = new Date(end.getTime() - 13 * 24 * 60 * 60 * 1000);
        return buildTrendBuckets(start.toISOString(), end.toISOString());
      })();
  const counts = t.buckets.map(() => ({
    upcoming: 0,
    completed: 0,
    overdue: 0,
    cancelled: 0,
    rejected: 0,
    no_show: 0,
  }));
  const nowMs = Date.now();
  for (const row of data.appointments) {
    const i = t.indexOf(row.scheduled_at);
    if (i < 0) continue;
    t.buckets[i].sessions += 1;
    counts[i][lifecycleOf(row.status, row.scheduled_at, nowMs)] += 1;
  }
  return t.buckets.map((b, i) => ({ day: b.label, sessions: b.sessions, ...counts[i] }));
}

/** Top-right peak callout for the sessions trend panel header. */
function SessionPeak({ data, range }: { data: HeadReportsPayload; range: ReportRange }) {
  const points = sessionTrend(data, range);
  if (!points.some((p) => p.sessions > 0)) return null;
  const peak = points.reduce((a, b) => (b.sessions > a.sessions ? b : a), points[0]);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold text-primary-700">
      <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
      Peak: <span className="text-ink">{peak.day}</span>
      <span className="text-ink-faint" aria-hidden>·</span>
      {peak.sessions} session{peak.sessions === 1 ? "" : "s"}
    </span>
  );
}

function SessionsTrend({ data, range }: { data: HeadReportsPayload; range: ReportRange }) {
  const scoped = range.from !== null && range.to !== null;
  const points = sessionTrend(data, range);
  if (!points.some((p) => p.sessions > 0)) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={scoped ? "No sessions in this range" : "No sessions in the last 14 days"}
        hint={scoped ? "Try widening the date range." : "Bars will appear here once sessions get booked."}
      />
    );
  }
  const totals = SESSION_STATUS_SERIES.map((s) => ({
    ...s,
    total: points.reduce((sum, p) => sum + Number(p[s.key] ?? 0), 0),
  }));
  return (
    <>
      <ReportAreaChart data={points} series={[...SESSION_STATUS_SERIES]} />
      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {totals.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label} <span className="font-bold tabular-nums text-ink">{s.total}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function AppointmentStatus({ data }: { data: HeadReportsPayload }) {
  const counts = new Map<string, number>();
  for (const row of data.appointments) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  const slices = [...counts.entries()]
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: APPT_STATUS_META[k]?.label ?? k, value: v, color: APPT_STATUS_META[k]?.color ?? FALLBACK_SLICE }));
  if (!slices.length) {
    return <EmptyState icon={PieChartIcon} title="No sessions yet" hint="The status breakdown will appear here once appointments are booked." />;
  }
  return <ReportDonut data={slices} />;
}

function ReferralStatus({ data }: { data: HeadReportsPayload }) {
  const counts = new Map<string, number>();
  for (const row of data.referrals) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  const slices = [...counts.entries()]
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: REFERRAL_STATUS_META[k]?.label ?? k, value: v, color: REFERRAL_STATUS_META[k]?.color ?? FALLBACK_SLICE }));
  if (!slices.length) {
    return <EmptyState icon={Inbox} title="No referrals yet" hint="The pipeline breakdown will appear here once referrals come in." />;
  }
  return <ReportDonut data={slices} />;
}

function ReferralPriority({ data }: { data: HeadReportsPayload }) {
  const order = ["low", "medium", "high", "urgent"];
  const counts = new Map<string, number>(order.map((k) => [k, 0]));
  for (const row of data.referrals) counts.set(row.priority, (counts.get(row.priority) ?? 0) + 1);
  return (
    <HeadGauge
      items={order.map((k) => ({ key: k, name: PRIORITY_META[k].label, value: counts.get(k) ?? 0 }))}
      colorOf={(key) => PRIORITY_META[key]?.color ?? FALLBACK_SLICE}
      emptyTitle="No priorities yet"
      emptyHint="Urgent vs routine mix will show here."
      centerLabel="referrals"
      note={`${counts.get("urgent") ?? 0} urgent · ${counts.get("high") ?? 0} high — triage these first.`}
    />
  );
}

function Satisfaction({ data }: { data: HeadReportsPayload }) {
  const rows = data.feedback;
  if (!rows.length) {
    return <EmptyState icon={ClipboardList} title="No ratings yet" hint="The 1–5 star distribution will appear once students leave feedback." />;
  }
  const counts = [1, 2, 3, 4, 5].map((s) => ({
    label: `${s}★`,
    value: rows.filter((f) => f.rating === s).length,
    color: ratingColor(s),
  }));
  const avg = (rows.reduce((a, f) => a + f.rating, 0) / rows.length).toFixed(1);
  return (
    <>
      <p className="mt-2 text-[13px] text-ink-muted">
        Average <span className="font-bold text-ink">{avg} / 5</span> from{" "}
        <span className="font-bold text-ink">{rows.length}</span> responses.
      </p>
      <ReportBars data={counts} tooltip={ratingBarInsight} />
    </>
  );
}

function StressBands({ data }: { data: HeadReportsPayload }) {
  const rows = data.screenings;
  if (!rows.length) {
    return <EmptyState icon={BarChart3} title="No screenings yet" hint="Low / moderate / high stress mix will appear once PSS-10 screenings are submitted." />;
  }
  const order = ["low", "moderate", "high"];
  const counts = new Map(order.map((k) => [k, 0]));
  for (const r of rows) counts.set(r.band, (counts.get(r.band) ?? 0) + 1);
  const avg = (rows.reduce((a, r) => a + r.total_score, 0) / rows.length).toFixed(1);
  // Small cells are withheld from the chart itself, not just the caption — a
  // donut slice with 1–4 screenings would still identify them visually.
  const visible = order
    .map((k) => ({ name: STRESS_META[k].label, value: counts.get(k) ?? 0, color: STRESS_META[k].color }))
    .filter((r) => r.value === 0 || !isSuppressed(r.value));
  const withheld = order.filter((k) => isSuppressed(counts.get(k) ?? 0));
  return (
    <>
      <p className="mt-2 text-[13px] text-ink-muted">
        Average PSS-10 <span className="font-bold text-ink">{avg} / 40</span> across{" "}
        <span className="font-bold text-ink">{rows.length}</span> screenings.
      </p>
      {visible.length ? <ReportDonut data={visible} /> : null}
      {withheld.length > 0 && (
        <p className="mt-2 text-[11px] font-medium text-ink-faint">
          {withheld.map((k) => STRESS_META[k].label).join(" and ")} band{withheld.length === 1 ? " has" : "s have"}{" "}
          fewer than {MIN_CELL} screenings and {withheld.length === 1 ? "is" : "are"} withheld.
        </p>
      )}
    </>
  );
}

function ScreeningSummary({ data }: { data: HeadReportsPayload }) {
  const rows = data.screenings;
  if (!rows.length) {
    return <EmptyState icon={ClipboardList} title="No screenings yet" hint="A quick summary will appear here once PSS-10 screenings are submitted." />;
  }
  const high = rows.filter((r) => r.band === "high").length;
  const moderate = rows.filter((r) => r.band === "moderate").length;
  const avg = (rows.reduce((a, r) => a + r.total_score, 0) / rows.length).toFixed(1);
  const smallDenominator = rows.length < MIN_CELL;
  const share = (n: number) => (smallDenominator ? null : `${Math.round((n / rows.length) * 100)}%`);
  const summary = [
    {
      label: "Screenings",
      value: String(rows.length),
      unit: "",
      caption: "PSS-10 submissions in this range",
      accent: "bg-primary-500",
    },
    {
      label: "Average score",
      value: avg,
      unit: "/ 40",
      caption: "Mean PSS-10 score",
      accent: "bg-primary-400",
    },
    {
      label: "High band",
      value: suppressCount(high) == null ? `<${MIN_CELL}` : String(high),
      unit: share(high) ?? "",
      caption: share(high) == null ? "Withheld to protect privacy" : "Of screenings — follow up first",
      accent: "bg-red-400",
    },
    {
      label: "Moderate band",
      value: String(moderate),
      unit: share(moderate) ?? "",
      caption: share(moderate) == null ? "Withheld to protect privacy" : "Of screenings",
      accent: "bg-amber-400",
    },
  ];
  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-3">
        {summary.map((r) => (
          <div
            key={r.label}
            className="relative overflow-hidden rounded-xl border border-ink/10 bg-cream/40 p-3.5"
          >
            <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${r.accent}`} />
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">{r.label}</span>
            <span className="mt-2 flex items-baseline gap-1">
              <span className="font-display text-2xl font-bold leading-none tabular-nums text-ink">{r.value}</span>
              {r.unit && <span className="text-[11px] font-semibold text-ink-faint">{r.unit}</span>}
            </span>
            <p className="mt-1.5 text-[10.5px] leading-snug text-ink-muted">{r.caption}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-ink-muted">
        Follow up high-band students first — bands are signals, not diagnoses.
      </p>
    </div>
  );
}

function ReferralPipeline({ data }: { data: HeadReportsPayload }) {
  const { unassigned, escalated, oldestOpenAt } = data.pipeline;
  const rows = [
    { label: "Waiting without a counselor", value: String(unassigned), tone: "bg-red-100 text-red-800" },
    { label: "Escalated", value: String(escalated), tone: "bg-amber-100 text-amber-800" },
    { label: "Longest wait", value: oldestOpenAt ? timeAgoLong(oldestOpenAt) : "—", tone: "bg-blue-100 text-blue-800" },
  ];
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center justify-between gap-3 rounded-lg bg-cream px-4 py-3">
          <span className="text-sm font-semibold text-ink-soft">{r.label}</span>
          <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${r.tone}`}>{r.value}</span>
        </li>
      ))}
      <li className="pt-1 text-[13px] text-ink-muted">
        Keep unassigned at zero — assign every waiting referral so no student falls through.
      </li>
    </ul>
  );
}

function CounselorWorkload({ data }: { data: HeadReportsPayload }) {
  const { ranked, unassignedSessions } = data.workload;
  if (!ranked.length && unassignedSessions === 0) {
    return <EmptyState icon={Users} title="No assignments yet" hint="Per-counselor load will appear once sessions are assigned." />;
  }
  // Same donut + bento pattern as the other report panels: each counselor is a
  // slice (completion shown under the count) and the unassigned queue is the
  // amber tail so an overloaded lane or a growing queue is obvious at a glance.
  const slices = ranked.map((c, i) => ({
    name: c.name,
    value: c.total,
    color: COHORT_SLICE_COLORS[i % COHORT_SLICE_COLORS.length],
    hint: `${c.completed}/${c.total} completed`,
  }));
  if (unassignedSessions > 0) {
    slices.push({
      name: "Unassigned",
      value: unassignedSessions,
      color: UNASSIGNED_SLICE_COLOR,
      hint: "Waiting for a counselor",
    });
  }
  return (
    <>
      <ReportDonut data={slices} />
      <p className="mt-3 text-[13px] text-ink-muted">
        {unassignedSessions > 0
          ? `${unassignedSessions} session${unassignedSessions === 1 ? "" : "s"} still unassigned — rebalance the busiest lane.`
          : "Every session is assigned — rebalance when one lane carries far more than the rest."}
      </p>
    </>
  );
}

function TopConcerns({ data }: { data: HeadReportsPayload }) {
  const rows = data.appointments.map((r) => r.concern?.trim()).filter(Boolean) as string[];
  if (!rows.length) {
    return <EmptyState icon={ClipboardList} title="No concerns logged yet" hint="Common presenting concerns will be ranked here." />;
  }
  const counts = new Map<string, { label: string; count: number }>();
  for (const c of rows) {
    const key = c.toLowerCase();
    const e = counts.get(key) ?? { label: c, count: 0 };
    e.count += 1;
    counts.set(key, e);
  }
  const sorted = [...counts.values()].sort((a, b) => b.count - a.count);
  // Top five stay named; the long tail is grouped so the donut never turns into
  // a confetti ring while the total still reconciles to every logged concern.
  const slices = sorted.slice(0, 5).map((t, i) => ({
    name: t.label,
    value: t.count,
    color: COHORT_SLICE_COLORS[i % COHORT_SLICE_COLORS.length],
  }));
  const rest = sorted.slice(5);
  if (rest.length) {
    slices.push({
      name: "Other concerns",
      value: rest.reduce((sum, t) => sum + t.count, 0),
      color: COHORT_SLICE_COLORS[COHORT_SLICE_COLORS.length - 1],
    });
  }
  return (
    <>
      <ReportDonut data={slices} />
      <p className="mt-3 text-[13px] text-ink-muted">
        Use this ranking to plan group sessions, workshops, and announcements.
      </p>
    </>
  );
}

function RecentFeedback({ data }: { data: HeadReportsPayload }) {
  const rows = [...data.feedback]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 5);
  if (!rows.length) {
    return <EmptyState icon={MessagesSquare} title="No feedback yet" hint="Student comments will show up here once sessions are rated." />;
  }
  return (
    <ul className="mt-3 divide-y divide-ink/10">
      {rows.map((f, i) => (
        <li key={`${f.created_at}-${i}`} className="py-2.5 first:pt-0 last:pb-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-accent-500" aria-label={`${f.rating} out of 5 stars`}>
              {"★".repeat(f.rating)}
              <span className="text-ink/20">{"★".repeat(Math.max(0, 5 - f.rating))}</span>
            </p>
            <p className="text-[11px] font-medium text-ink-faint">{timeAgoLong(f.created_at)}</p>
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
            {f.comment?.trim() || "No written comment."}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Top-right summary for the wellbeing trend panel header. */
function WellbeingSummary({ data }: { data: HeadReportsPayload }) {
  const rows = data.trends;
  if (!rows.length) return null;
  const total = rows.reduce((a, r) => a + r.screenings, 0);
  const scored = rows.filter((r) => r.avg_score != null);
  const avg = scored.length ? (scored.reduce((a, r) => a + (r.avg_score ?? 0), 0) / scored.length).toFixed(1) : "—";
  return (
    <p className="max-w-[300px] text-right text-[13px] leading-relaxed text-ink-muted">
      <span className="font-bold text-ink">{total}</span> screenings across{" "}
      <span className="font-bold text-ink">{rows.length}</span> day{rows.length === 1 ? "" : "s"} · average{" "}
      <span className="font-bold text-ink">{avg} / 40</span>.
    </p>
  );
}

function WellbeingTrend({ data }: { data: HeadReportsPayload }) {
  const rows = data.trends;
  if (!rows.length) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No screening trend yet"
        hint="Daily PSS-10 volumes and averages will appear as screenings are completed."
      />
    );
  }
  return (
    <>
      <ReportTrendChart data={rows.map((r) => ({ day: r.day.slice(5), sessions: r.screenings }))} />
      <p className="mt-2 text-[11px] font-medium text-ink-faint">
        Band counts below {MIN_CELL} are withheld to protect small groups; daily totals remain visible.
      </p>
    </>
  );
}

/** Turns a cohort list into donut slices, keeping the top 5 and grouping the rest. */
function cohortSlices(rows: { cohort: string; screenings: number }[]) {
  const sorted = [...rows].sort((a, b) => b.screenings - a.screenings);
  const slices = sorted.slice(0, 5).map((r, i) => ({
    name: r.cohort,
    value: r.screenings,
    color: COHORT_SLICE_COLORS[i % COHORT_SLICE_COLORS.length],
  }));
  const rest = sorted.slice(5);
  if (rest.length) {
    slices.push({
      name: "Other cohorts",
      value: rest.reduce((a, r) => a + r.screenings, 0),
      color: COHORT_SLICE_COLORS[COHORT_SLICE_COLORS.length - 1],
    });
  }
  return slices;
}

function CohortStress({ data }: { data: HeadReportsPayload }) {
  // College cohorts are hidden here — students often share a college, so the
  // split adds noise without telling the head anything actionable.
  const groups = COHORT_GROUPS.filter((g) => g.key !== "college").map((g) => ({
    ...g,
    rows: data.cohorts[g.key] ?? [],
  }));
  if (!groups.some((g) => g.rows.length)) {
    return (
      <EmptyState
        icon={Users}
        title="Not enough cohort data"
        hint={`Cohorts with fewer than ${MIN_CELL} screenings are withheld so no individual can be inferred.`}
      />
    );
  }
  return (
    <>
      <p className="mt-2 text-[13px] text-ink-muted">
        Cohorts with at least <span className="font-bold text-ink">{MIN_CELL}</span> screenings in this range.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.key} className="rounded-lg border border-ink/10 bg-cream/40 p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">{g.label}</p>
            {g.rows.length ? (
              <ReportDonut data={cohortSlices(g.rows)} legend="list" />
            ) : (
              <p className="flex min-h-[200px] items-center justify-center px-4 text-center text-[13px] text-ink-muted">
                Not enough {g.label.toLowerCase()} data in this range.
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] font-medium text-ink-faint">
        Cohorts with fewer than {MIN_CELL} screenings are withheld so no individual can be inferred.
      </p>
    </>
  );
}

function DataQuality({ data }: { data: HeadReportsPayload }) {
  const q = data.quality;
  if (!q) {
    return <EmptyState icon={ClipboardList} title="No quality snapshot" hint="Data-quality metrics will appear once records exist." />;
  }
  const rows = [
    {
      label: "Completed sessions without a note",
      hint: "Write-ups still missing",
      value: String(q.completed_without_note),
      dot: q.completed_without_note > 0 ? "bg-red-500" : "bg-emerald-500",
    },
    {
      label: "Screenings not linked to a session",
      hint: "PSS-10 results with no visit attached",
      value: String(q.screenings_unlinked),
      dot: q.screenings_unlinked > 0 ? "bg-amber-500" : "bg-emerald-500",
    },
    {
      label: "Open referrals without a counselor",
      hint: "Waiting in the unassigned queue",
      value: String(q.referrals_unassigned),
      dot: q.referrals_unassigned > 0 ? "bg-amber-500" : "bg-emerald-500",
    },
    {
      label: "Feedback coverage",
      hint: "Sessions with a student rating",
      value: q.feedback_coverage == null ? "—" : `${q.feedback_coverage}%`,
      dot: "bg-primary-500",
    },
    {
      label: "Daily summary age",
      hint: "Last nightly rollup",
      value: q.summary_age_days == null ? "Never run" : `${q.summary_age_days}d old`,
      dot:
        q.summary_age_days == null || q.summary_age_days > 2
          ? "bg-amber-500"
          : "bg-emerald-500",
    },
  ];
  return (
    <div className="mt-4">
      <div className="divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/10 bg-cream/40">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 px-4 py-3">
            <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.dot}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-snug text-ink">{r.label}</p>
              <p className="mt-0.5 text-[10.5px] leading-snug text-ink-muted">{r.hint}</p>
            </div>
            <span className="shrink-0 font-display text-lg font-bold leading-none tabular-nums text-ink">
              {r.value}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-ink-muted">
        Clear missing notes and unassigned referrals first — they weaken every other report.
      </p>
    </div>
  );
}

/**
 * Guidance-head (admin) reports — cached client view.
 * First visit fetches /api/reports/head once per filter; going back (or
 * re-picking a recent filter) re-renders the TanStack Query cache instantly
 * (fresh for 60s) and revalidates in the background, so the page never
 * blocks on the ~25-query waterfall again. Export Excel still fetches its
 * own fresh bundle, so downloads are never stale.
 */
export function HeadReportsView({
  section,
  range,
  group,
  sections,
}: {
  section: ReportSection;
  range: ReportRange;
  group: CohortGroup;
  sections: { key: ReportSection; label: string }[];
}) {
  const scope = {
    section,
    preset: range.preset,
    fromDay: rangeDay(range.from),
    toDay: rangeDay(range.to),
    group,
  };
  const { data, isPending, isError, error, isFetching, refetch } = useHeadReports(scope);
  // The API only reads the tables the requested section needs and echoes the
  // section it fetched for. With keepPreviousData, a section switch keeps the
  // previous payload while the new one loads — that stale payload holds [] for
  // the newly-visible section, which would flash false "No X yet" empty
  // states. Treat uncovered cached data as loading so panels show skeletons
  // until the new section's payload arrives.
  const coversSection = !!data && (data.section === "all" || data.section === section);
  const loading = isPending || isFetching || !coversSection;
  const showAll = section === "all";
  const scoped = range.from !== null && range.to !== null;
  const pipelineAttention =
    !!data && (data.pipeline.unassigned > 0 || data.pipeline.escalated > 0);
  const qualityAttention =
    !!data &&
    !!data.quality &&
    (data.quality.completed_without_note > 0 ||
      data.quality.screenings_unlinked > 0 ||
      data.quality.referrals_unassigned > 0);

  /** Deep link into another tab while keeping the current range (and cohort). */
  const hrefFor = (target: ReportSection) => {
    const p = new URLSearchParams();
    p.set("section", target);
    if (range.preset === "custom") {
      if (range.from) p.set("from", rangeDay(range.from));
      if (range.to) p.set("to", rangeDay(range.to));
    } else if (range.preset !== "30d") {
      p.set("range", range.preset);
    }
    if (target === "wellbeing") p.set("group", group);
    return `/reports?${p.toString()}`;
  };

  return (
    <div className="space-y-6 lg:-m-4 lg:space-y-0" aria-busy={isFetching}>
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-0">
        <div className="order-2 min-w-0 flex-1 space-y-6 lg:order-1 lg:px-6 lg:py-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold">Reports</h1>
            </div>
            <Suspense fallback={<ReportsFiltersSkeleton />}>
              <ReportsFilters
                section={section}
                preset={range.preset}
                fromDay={rangeDay(range.from)}
                toDay={rangeDay(range.to)}
                rangeLabel={range.label}
                fetching={isFetching}
              />
            </Suspense>
          </div>

      {isError && !data ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 shadow-card" role="alert">
          <p className="text-sm font-bold text-red-800">Couldn&apos;t load the reports</p>
          <p className="mt-1 text-[13px] text-red-700">
            {(error as Error)?.message ?? "Something went wrong fetching the overview."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-3 inline-flex h-6 items-center gap-1.5 rounded-full bg-red-600 px-3 text-[11.5px] font-bold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-60"
          >
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {isFetching ? "Retrying…" : "Try again"}
          </button>
        </div>
      ) : (
        <>
          {showAll && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {loading || !data ? <ReportKpiSkeleton count={6} /> : <KpiGrid data={data} />}
            </div>
          )}

          {(showAll || section === "sessions") && (
            <div className={`grid gap-4 sm:grid-cols-2 ${showAll ? "xl:grid-cols-2" : ""}`}>
              <div className={showAll ? "sm:col-span-2 xl:col-span-2" : "sm:col-span-2"}>
                <PanelShell
                  title={scoped ? `Sessions — ${range.label}` : "Sessions — last 14 days"}
                  action={loading || !data ? null : <SessionPeak data={data} range={range} />}
                >
                  {loading || !data ? <ChartSkeleton /> : <SessionsTrend data={data} range={range} />}
                </PanelShell>
              </div>
              <PanelShell title="Sessions by status" hint="Where every booked session currently sits." viewAllHref="/appointments">
                {loading || !data ? <ChartSkeleton /> : <AppointmentStatus data={data} />}
              </PanelShell>
              {showAll && (
                <PanelShell title="Referrals by status" hint="Pipeline health at a glance." viewAllHref="/referrals">
                  {loading || !data ? <ChartSkeleton /> : <ReferralStatus data={data} />}
                </PanelShell>
              )}
            </div>
          )}

          {(showAll || section === "referrals") && (
            <div className="grid gap-4 sm:grid-cols-2">
              {!showAll && (
                <PanelShell title="Referrals by status" hint="Pipeline health at a glance." viewAllHref="/referrals">
                  {loading || !data ? <ChartSkeleton /> : <ReferralStatus data={data} />}
                </PanelShell>
              )}
              <PanelShell title="Referrals by priority" hint="Urgency mix — urgent + high need triage first." viewAllHref="/referrals">
                {loading || !data ? <ChartSkeleton /> : <ReferralPriority data={data} />}
              </PanelShell>
              <PanelShell title="Referral pipeline watch" hint="What needs attention right now." viewAllHref="/referrals">
                {loading || !data ? <ListSkeleton /> : <ReferralPipeline data={data} />}
              </PanelShell>
            </div>
          )}

          {(showAll || section === "satisfaction") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <PanelShell title="Student satisfaction" hint="Post-session ratings, 1–5 stars." viewAllHref="/feedback">
                {loading || !data ? <ChartSkeleton /> : <Satisfaction data={data} />}
              </PanelShell>
              <PanelShell title="Latest feedback" hint="Most recent student comments." viewAllHref="/feedback">
                {loading || !data ? <ListSkeleton /> : <RecentFeedback data={data} />}
              </PanelShell>
            </div>
          )}

          {(showAll || section === "wellbeing") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <PanelShell
                  title="Wellbeing trend"
                  hint="Daily PSS-10 screening volume and average score."
                  action={loading || !data ? null : <WellbeingSummary data={data} />}
                >
                  {loading || !data ? <ChartSkeleton /> : <WellbeingTrend data={data} />}
                </PanelShell>
              </div>
              <PanelShell title="Stress levels (PSS-10)" hint="Screening bands from pre-booking assessments.">
                {loading || !data ? <ChartSkeleton /> : <StressBands data={data} />}
              </PanelShell>
              <PanelShell title="Screening summary" hint="What the numbers mean at a glance.">
                {loading || !data ? <ListSkeleton /> : <ScreeningSummary data={data} />}
              </PanelShell>
              <div className="sm:col-span-2">
                <PanelShell title="Cohort stress" hint="Program, year level, and college cohorts — small cohorts are withheld.">
                  {loading || !data ? <ChartSkeleton /> : <CohortStress data={data} />}
                </PanelShell>
              </div>
            </div>
          )}

          {(showAll || section === "quality") && (
            <div className="grid gap-4">
              <PanelShell title="Data quality" hint="Gaps that weaken reports and follow-up.">
                {loading || !data ? <ListSkeleton /> : <DataQuality data={data} />}
              </PanelShell>
            </div>
          )}

          {(showAll || section === "operations") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <PanelShell title="Counselor workload" hint="Sessions per counselor — rebalance when one lane overloads." viewAllHref="/users">
                {loading || !data ? <ListSkeleton /> : <CounselorWorkload data={data} />}
              </PanelShell>
              <PanelShell title="Top presenting concerns" hint="Most common reasons students book.">
                {loading || !data ? <ListSkeleton /> : <TopConcerns data={data} />}
              </PanelShell>
            </div>
          )}
        </>
      )}
        </div>

        <aside className="order-1 flex flex-col gap-3 lg:order-2 lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-[224px] lg:shrink-0 lg:self-start lg:overflow-y-auto lg:py-6">
          <div className="rounded-xl border border-ink/10 bg-white p-3 shadow-card">
            <Suspense fallback={<ReportsSectionNavSkeleton />}>
              <ReportsSectionNav
                sections={sections}
                section={section}
                preset={range.preset}
                fromDay={rangeDay(range.from)}
                toDay={rangeDay(range.to)}
              />
            </Suspense>
          </div>
          {showAll && !loading && data && (pipelineAttention || qualityAttention) && (
            <div className="mt-auto space-y-3">
              {pipelineAttention && (
                <AttentionBanner
                  href={hrefFor("referrals")}
                  title="Referral pipeline needs attention"
                  detail={`${data.pipeline.unassigned} waiting without a counselor · ${data.pipeline.escalated} escalated.`}
                />
              )}
              {qualityAttention && data.quality && (
                <AttentionBanner
                  href={hrefFor("quality")}
                  title="Some records weaken these reports"
                  detail={`${data.quality.completed_without_note} completed sessions without a note · ${data.quality.screenings_unlinked} unlinked screenings · ${data.quality.referrals_unassigned} referrals without a counselor.`}
                  tone="blue"
                />
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
