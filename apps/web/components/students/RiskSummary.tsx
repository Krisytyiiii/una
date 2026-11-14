"use client";

import { AlertTriangle, ArrowUpRight, PieChart } from "lucide-react";
import { ReportBars, ReportDonut } from "@/components/shared/reports-charts";
import { HeadGauge } from "@/components/shared/dashboard/head-gauge";
import { ATTENTION_META } from "@/lib/report-palette";

export type ProgramBar = { label: string; value: number };
export type ScreeningSlice = { name: string; value: number; color: string };
export type AttentionGaugeItem = { key: keyof typeof ATTENTION_META; name: string; value: number };

/**
 * Insight bento — attention gauge (same dashboard dial + tooltip), latest
 * screening mix, and program spread. Page owns all memos; this is pure
 * presentation plus navigation.
 */
export function RiskSummary({
  loading,
  attentionGauge,
  programBars,
  screeningDonut,
  attentionTotal,
  onSeeAll,
}: {
  loading: boolean;
  attentionGauge: AttentionGaugeItem[];
  programBars: ProgramBar[];
  screeningDonut: ScreeningSlice[];
  attentionTotal: number;
  onSeeAll: () => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      {/* Attention signals */}
      <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-card xl:col-span-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              </span>
              Needs attention
            </h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              Each student counted once, by their most urgent signal.
            </p>
          </div>
          {!loading && attentionTotal > 0 && (
            <button
              type="button"
              onClick={onSeeAll}
              className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-ink/10 bg-white px-2.5 text-[11.5px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              View {attentionTotal}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>

        {loading ? (
          <div className="animate-pulse pt-4" aria-hidden>
            <div className="h-[240px] rounded-lg bg-ink/10" />
          </div>
        ) : (
          <HeadGauge
            className="mt-4"
            items={attentionGauge}
            colorOf={(key) => ATTENTION_META[key as keyof typeof ATTENTION_META]?.color ?? "#2563EB"}
            emptyTitle="Nothing urgent right now"
            emptyHint="No unsupported high-stress screens, urgent referrals, or repeat misses."
            note="Urgent referrals · high stress with nothing booked · two or more missed sessions."
            centerLabel="flagged"
          />
        )}
      </section>

      {/* Screening mix */}
      <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-card xl:col-span-5">
        <h2 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <PieChart className="h-3.5 w-3.5" aria-hidden />
          </span>
          Latest screening mix
        </h2>
        <p className="mt-1 text-[13px] text-ink-muted">Each student counted once, by most recent PSS-10 band.</p>
        {loading ? (
          <div className="animate-pulse pt-4" aria-hidden>
            <div className="h-[200px] rounded-lg bg-ink/10" />
          </div>
        ) : screeningDonut.length ? (
          <ReportDonut data={screeningDonut} />
        ) : (
          <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">No screenings yet.</p>
        )}
      </section>

      {/* Program spread */}
      <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-card xl:col-span-12">
        <h2 className="font-display text-base font-bold text-ink">Students per program</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">Where to focus outreach and group sessions.</p>
        {loading ? (
          <div className="animate-pulse pt-4" aria-hidden>
            <div className="h-[220px] rounded-lg bg-ink/10" />
          </div>
        ) : programBars.length ? (
          <ReportBars data={programBars} />
        ) : (
          <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">No program data yet.</p>
        )}
      </section>
    </div>
  );
}
