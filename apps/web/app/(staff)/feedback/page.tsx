"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BarChart3,
  CheckCheck,
  ChevronRight,
  Clock,
  MessageSquareQuote,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { useFeedbackBoard } from "@/lib/hooks/use-feedback-board";
import { useClearSectionBadge } from "@/lib/hooks/use-clear-section-badge";
import { Card } from "@/components/ui/primitives";
import { ReportBars, ReportDonut, ReportLines } from "@/components/shared/reports-charts";
import { CHART_PRIMARY, ratingColor } from "@/lib/report-palette";
import { colors } from "@dorsu/ui-tokens";
import { sentimentOf, ratingBarInsight } from "@/lib/sentiment";
import { cn } from "@/lib/utils";
import { FeedbackList, stars, type Feedback, type SentimentCounts } from "@/components/feedback/FeedbackList";
import { FollowUpList } from "@/components/feedback/FollowUpList";
import { WordCloud } from "@/components/feedback/WordCloud";

const EMPTY_ROWS: Feedback[] = [];
const EMPTY_MAP = new Map<string, string>();
const EMPTY_CONTEXTS = new Map<string, { concern: string; counselor: string; when: string }>();

/** Page size for the recent-feedback list; "Show more" grows it. */
const PAGE_STEP = 20;

/**
 * Feedback analytics — a scorecard hero, KPI cards that filter the list,
 * distribution/trend charts, follow-up triage, and themes. Read-only.
 */
export default function FeedbackAdminPage() {
  const { data: board, isLoading, isError } = useFeedbackBoard();
  const rows = board?.rows ?? EMPTY_ROWS;
  const aliases = board?.aliases ?? EMPTY_MAP;
  const contexts = board?.contexts ?? EMPTY_CONTEXTS;
  const completedTotal = board?.completedTotal ?? 0;
  const role = board?.role ?? null;
  const counselorId = board?.counselorId ?? null;
  const loading = isLoading && !board;
  // Visiting the section clears its sidebar badge (badges count unread
  // notification rows, not page views).
  useClearSectionBadge("/feedback", !loading && !!board);
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_STEP);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isError) toast.error("Couldn't load feedback right now.");
  }, [isError]);

  const analysis = useMemo(() => {
    const n = rows.length;
    const avg = n ? rows.reduce((a, f) => a + f.rating, 0) / n : null;
    const dist = [1, 2, 3, 4, 5].map((s) => ({
      label: `${s}★`,
      value: rows.filter((f) => f.rating === s).length,
      color: ratingColor(s),
    }));
    const fiveShare = n ? Math.round((rows.filter((f) => f.rating === 5).length / n) * 100) : 0;
    const withComments = rows.filter((f) => f.comment?.trim()).length;
    const low = rows.filter((f) => f.rating <= 2);

    // Trend: average per day for days with responses, last 14 days.
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime() - 13 * 24 * 60 * 60 * 1000;
    const byDay = new Map<string, { sum: number; n: number; label: string }>();
    for (const f of rows) {
      const d = new Date(f.created_at);
      if (d.getTime() < startMs) continue;
      const key = d.toDateString();
      const e = byDay.get(key) ?? { sum: 0, n: 0, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
      e.sum += f.rating;
      e.n += 1;
      byDay.set(key, e);
    }
    const trend = [...byDay.entries()]
      .sort((a, b) => +new Date(a[0]) - +new Date(b[0]))
      .map(([, e]) => ({ label: e.label, value: Math.round((e.sum / e.n) * 10) / 10 }));

    // Counselor comparison via appointment context.
    const byCounselor = new Map<string, { sum: number; n: number }>();
    for (const f of rows) {
      const c = contexts.get(f.appointment_id)?.counselor;
      if (!c || c === "Unassigned") continue;
      const e = byCounselor.get(c) ?? { sum: 0, n: 0 };
      e.sum += f.rating;
      e.n += 1;
      byCounselor.set(c, e);
    }
    const leaderboard = [...byCounselor.entries()]
      .map(([name, e]) => ({ name, avg: Math.round((e.sum / e.n) * 10) / 10, n: e.n }))
      .sort((a, b) => b.avg - a.avg || b.n - a.n)
      .slice(0, 6);

    // Sentiment split: positive 4–5, neutral 3, negative 1–2. The report
    // palette keeps charts inside the brand's two-hue rule.
    const pos = rows.filter((f) => f.rating >= 4).length;
    const neu = rows.filter((f) => f.rating === 3).length;
    const neg = rows.filter((f) => f.rating <= 2).length;
    const donut = [
      { name: "Positive", value: pos, color: colors.primary[600] },
      { name: "Neutral", value: neu, color: colors.accent[500] },
      { name: "Negative", value: neg, color: colors.accent[700] },
    ].filter((s) => s.value > 0);

    return { n, avg, dist, fiveShare, withComments, low, trend, leaderboard, donut, pos, neu, neg };
  }, [rows, contexts]);

  const sentimentCounts: SentimentCounts = {
    all: analysis.n,
    positive: analysis.pos,
    neutral: analysis.neu,
    negative: analysis.neg,
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((f) => {
        if (sentimentFilter === "all") return true;
        if (sentimentFilter === "positive") return f.rating >= 4;
        if (sentimentFilter === "neutral") return f.rating === 3;
        return f.rating <= 2;
      })
      .filter((f) => {
        if (!q) return true;
        const alias = aliases.get(f.student_id) ?? "";
        const ctx = contexts.get(f.appointment_id);
        return `${alias} ${f.comment ?? ""} ${ctx?.concern ?? ""} ${ctx?.counselor ?? ""}`.toLowerCase().includes(q);
      });
  }, [rows, sentimentFilter, query, aliases, contexts]);

  const visible = filtered.slice(0, visibleLimit);

  // Any filter change starts the page over so "Show more" never leaves a
  // half-filtered tail.
  const applySentiment = (v: string) => {
    setSentimentFilter(v);
    setVisibleLimit(PAGE_STEP);
  };
  const applyQuery = (v: string) => {
    setQuery(v);
    setVisibleLimit(PAGE_STEP);
  };

  const sentiment = sentimentOf(analysis.avg);
  const sentimentTone =
    sentiment.tone === "danger"
      ? "bg-accent-700 text-white"
      : sentiment.tone === "warning"
        ? "bg-accent-100 text-accent-700"
        : "bg-primary-100 text-primary-800";
  const isCounselor = role === "counselor";

  const statCards: {
    label: string;
    value: string;
    sub?: string;
    icon: typeof Star;
    active?: boolean;
    pick: (() => void) | null;
  }[] = [
    { label: "Responses", value: analysis.n ? String(analysis.n) : "0", icon: MessageSquareQuote, active: sentimentFilter === "all", pick: () => applySentiment("all") },
    { label: "Avg. rating", value: analysis.avg === null ? "—" : `${analysis.avg.toFixed(1)} / 5`, icon: Star, pick: null },
    { label: "5-star share", value: analysis.n ? `${analysis.fiveShare}%` : "—", icon: CheckCheck, pick: null },
    { label: "Response rate", value: completedTotal ? `${Math.round((analysis.n / completedTotal) * 100)}%` : "—", sub: `${analysis.n}/${completedTotal} completed`, icon: BarChart3, pick: null },
    { label: "With comments", value: String(analysis.withComments), icon: TrendingUp, pick: null },
    { label: "Low ratings (≤2★)", value: String(analysis.low.length), sub: "Need follow-up", icon: AlertTriangle, active: sentimentFilter === "negative", pick: () => applySentiment("negative") },
  ];

  const jumpToLowRatings = () => {
    applySentiment("negative");
    window.setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const focusNudge =
    analysis.avg !== null && analysis.low.length > 0
      ? {
          label: `${analysis.low.length} low rating${analysis.low.length === 1 ? "" : "s"} need${analysis.low.length === 1 ? "s" : ""} a follow-up`,
          cta: "Review low ratings",
          pick: jumpToLowRatings,
        }
      : analysis.n === 0
        ? { label: "No feedback yet — ratings arrive after completed sessions", cta: null as string | null, pick: null }
        : { label: "Every rating is 3★ or better — nothing to chase", cta: null as string | null, pick: null };

  if (!loading && role === "faculty") {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Feedback</h1>
        <Card><p className="text-sm text-ink-muted">Your role can&apos;t open feedback. Counselors and the guidance head work from here.</p></Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Hero — scorecard, next step, and filterable KPI cards. */}
      <section className="relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-200/40 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-accent-200/30 blur-2xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary-700">
              <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden />
              Student voice
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
                {isCounselor ? "My feedback" : "Feedback"}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-primary-700">
                <Users className="h-3 w-3" aria-hidden />
                {role === "guidance_head" ? "Guidance head" : "Counselor view"}
              </span>
            </div>
            <p className="mt-1.5 max-w-[600px] text-[13px] leading-relaxed text-ink-muted">
              {isCounselor
                ? "What your students think after your sessions — your ratings, trends, and who needs a follow-up."
                : "What students think after sessions — ratings, trends, themes, and who needs a follow-up."}
            </p>
          </div>

          {/* Overall scorecard — the one number the page is about. */}
          <div className="shrink-0 self-start rounded-xl border border-white/70 bg-white/85 px-4 py-3 shadow-card backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">Overall rating</p>
            {loading ? (
              <div className="mt-2 h-8 w-20 animate-pulse rounded bg-ink/10" aria-hidden />
            ) : (
              <>
                <div className="mt-1 flex items-end gap-1.5">
                  <span className="font-display text-3xl font-bold leading-none text-ink">
                    {analysis.avg === null ? "—" : analysis.avg.toFixed(1)}
                  </span>
                  <span className="pb-0.5 text-[12px] font-semibold text-ink-faint">/ 5</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {analysis.avg !== null && stars(Math.round(analysis.avg))}
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold", sentimentTone)}>
                    {sentiment.label}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-medium text-ink-faint">
                  {analysis.n} response{analysis.n === 1 ? "" : "s"} · {analysis.withComments} with a comment
                </p>
              </>
            )}
          </div>
        </div>

        {/* Next-step nudge — self-dismissing when there is nothing to chase. */}
        {!loading && focusNudge && (
          <div className="relative mt-4 flex flex-col gap-2.5 rounded-xl border border-accent-300 bg-accent-50/80 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-200 text-accent-700">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              </span>
              <p className="text-[12.5px] font-semibold text-ink">{focusNudge.label}</p>
            </div>
            {focusNudge.cta && (
              <button
                type="button"
                onClick={focusNudge.pick ?? undefined}
                className="inline-flex h-6 shrink-0 items-center gap-1 self-start rounded-full bg-accent-600 px-3 text-[11.5px] font-bold text-white shadow-soft transition hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 sm:self-auto"
              >
                {focusNudge.cta}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        )}

        {/* KPI cards — the two filterable ones show an active state. */}
        <div className="relative mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          {statCards.map((s) => {
            const body = (
              <>
                <span className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em]", s.active ? "text-primary-100" : "text-ink-muted")}>
                  <s.icon className={cn("h-3 w-3", s.active ? "text-white" : "text-primary-600")} aria-hidden />
                  {s.label}
                </span>
                {loading ? (
                  <span className={cn("mt-2 block h-6 w-12 animate-pulse rounded", s.active ? "bg-white/30" : "bg-ink/10")} aria-hidden />
                ) : (
                  <>
                    <span className="mt-1 block font-display text-xl font-bold leading-none tabular-nums">{s.value}</span>
                    {s.sub && (
                      <span className={cn("mt-1 block truncate text-[10.5px]", s.active ? "text-primary-100" : "text-ink-faint")}>
                        {s.sub}
                      </span>
                    )}
                  </>
                )}
              </>
            );
            const shell = cn(
              "rounded-xl border p-3 text-left shadow-card transition",
              s.active
                ? "border-primary-400 bg-primary-600 text-white ring-1 ring-primary-300"
                : "border-white/70 bg-white/75 backdrop-blur hover:border-primary-300 hover:bg-white"
            );
            return s.pick ? (
              <button
                key={s.label}
                type="button"
                onClick={s.pick}
                title={`Filter by ${s.label}`}
                aria-pressed={s.active}
                className={cn(shell, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400")}
              >
                {body}
              </button>
            ) : (
              <div key={s.label} className={shell}>
                {body}
              </div>
            );
          })}
        </div>
      </section>

      {isCounselor && !counselorId && !loading && (
        <div className="rounded-xl border border-accent-200 bg-accent-50 p-5 shadow-card">
          <p className="flex items-center gap-2 text-sm font-bold text-accent-700">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Counselor record not linked yet
          </p>
          <p className="mt-1 text-[13px] text-accent-700">
            Your login works, but no counselor row is linked to your account. Ask the guidance head to finish setup.
          </p>
        </div>
      )}

      {/* Distribution + trend */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
            <BarChart3 className="h-4 w-4 text-primary-600" aria-hidden />
            Rating distribution
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">How the stars stack up — hover a bar for its share and what it means.</p>
          {loading ? (
            <div className="animate-pulse pt-4" aria-hidden><div className="h-[240px] rounded-lg bg-ink/10" /></div>
          ) : analysis.n ? (
            <ReportBars data={analysis.dist} tooltip={ratingBarInsight} />
          ) : (
            <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">No ratings yet.</p>
          )}
        </Card>

        <Card className="p-5 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                <TrendingUp className="h-4 w-4 text-primary-600" aria-hidden />
                Satisfaction trend
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">Daily average, last 14 days with responses.</p>
            </div>
            {!loading && analysis.trend.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-ink-soft">
                <Clock className="h-3 w-3" aria-hidden />
                {analysis.trend.length} day{analysis.trend.length === 1 ? "" : "s"} with data
              </span>
            )}
          </div>
          {loading ? (
            <div className="animate-pulse pt-4" aria-hidden><div className="h-[240px] rounded-lg bg-ink/10" /></div>
          ) : analysis.trend.length ? (
            <ReportLines data={analysis.trend} stroke={CHART_PRIMARY} />
          ) : (
            <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">Not enough responses for a trend yet.</p>
          )}
        </Card>
      </div>

      {/* Follow-ups + sentiment + coverage */}
      <div className="grid gap-4 xl:grid-cols-3">
        <FollowUpList
          loading={loading}
          low={analysis.low}
          totalCount={analysis.n}
          counts={sentimentCounts}
          aliases={aliases}
          contexts={contexts}
          isCounselor={isCounselor}
          onViewAll={jumpToLowRatings}
        />

        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
            <Star className="h-4 w-4 text-primary-600" aria-hidden />
            Sentiment split
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">Positive 4–5★ · neutral 3★ · negative 1–2★.</p>
          {loading ? (
            <div className="animate-pulse pt-4" aria-hidden><div className="h-[200px] rounded-lg bg-ink/10" /></div>
          ) : analysis.donut.length ? (
            <ReportDonut data={analysis.donut} />
          ) : (
            <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">No ratings yet.</p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
            <Users className="h-4 w-4 text-primary-600" aria-hidden />
            {isCounselor ? "My coverage" : "Counselor comparison"}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {isCounselor ? "How many of my completed sessions got rated." : "Average rating per counselor, by their sessions."}
          </p>
          {loading ? (
            <div className="animate-pulse space-y-3 pt-3" aria-hidden>
              <div className="h-10 rounded-lg bg-ink/10" />
              <div className="h-10 rounded-lg bg-ink/10" />
            </div>
          ) : isCounselor ? (
            <ul className="mt-3 space-y-2">
              {[
                { label: "My sessions rated", value: `${analysis.n} responses` },
                { label: "My completed sessions", value: String(completedTotal) },
                { label: "Coverage", value: completedTotal ? `${Math.round((analysis.n / completedTotal) * 100)}%` : "—" },
              ].map((r) => (
                <li key={r.label} className="flex items-center justify-between gap-3 rounded-lg bg-cream px-3.5 py-2.5">
                  <span className="text-[12.5px] font-semibold text-ink-soft">{r.label}</span>
                  <span className="shrink-0 rounded-full bg-accent-100 px-2.5 py-0.5 text-[12px] font-bold text-accent-700">{r.value}</span>
                </li>
              ))}
            </ul>
          ) : analysis.leaderboard.length ? (
            <ul className="mt-3 divide-y divide-ink/10">
              {analysis.leaderboard.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <p className="min-w-0 truncate text-[12.5px] font-bold text-ink">
                    <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-cream text-[10px] font-bold text-ink-muted">
                      {i + 1}
                    </span>
                    {c.name}
                    <span className="ml-1.5 text-[10.5px] font-medium text-ink-faint">{c.n} rated</span>
                  </p>
                  <span className="shrink-0 rounded-full bg-accent-100 px-2.5 py-0.5 text-[12px] font-bold text-accent-700">
                    {c.avg.toFixed(1)} ★
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">No rated sessions yet.</p>
          )}
        </Card>
      </div>

      {/* List + themes rail */}
      <div ref={listRef} className="grid scroll-mt-24 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <FeedbackList
          loading={loading}
          visible={visible}
          total={filtered.length}
          rowsLength={rows.length}
          query={query}
          setQuery={applyQuery}
          sentimentFilter={sentimentFilter}
          setSentimentFilter={applySentiment}
          counts={sentimentCounts}
          aliases={aliases}
          contexts={contexts}
          isCounselor={isCounselor}
          hasMore={visible.length < filtered.length}
          onShowMore={() => setVisibleLimit((n) => n + PAGE_STEP)}
        />
        <div className="space-y-4 xl:sticky xl:top-4">
          <WordCloud loading={loading} rows={rows} />
          <Card className="border-primary-100 bg-blue-50/40 p-5">
            <h2 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
              <MessageSquareQuote className="h-4 w-4 text-primary-600" aria-hidden />
              Reading feedback safely
            </h2>
            <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-ink-muted">
              <li>· Responses are anonymous — only aliases are shown.</li>
              <li>· Low ratings are a prompt to reach out, not a verdict on the counselor.</li>
              <li>· Never copy comments into notes or messages outside the case record.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
