"use client";

import { AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/format";
import { stars, type Feedback, type FeedbackContext, type SentimentCounts } from "./FeedbackList";

/**
 * Needs follow-up — 1–2★ ratings surfaced as an action list rather than a
 * footnote. The header count is clickable so the head can jump straight to
 * those responses in the full list.
 */
export function FollowUpList({
  loading,
  low,
  totalCount,
  counts,
  aliases,
  contexts,
  isCounselor,
  onViewAll,
}: {
  loading: boolean;
  low: Feedback[];
  totalCount: number;
  counts: SentimentCounts;
  aliases: Map<string, string>;
  contexts: Map<string, FeedbackContext>;
  isCounselor: boolean;
  onViewAll: () => void;
}) {
  return (
    <Card className="flex h-full flex-col border-accent-200 bg-gradient-to-br from-white to-accent-50/60 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
            <AlertTriangle className="h-4 w-4 text-accent-600" aria-hidden />
            Needs follow-up
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">1–2★ ratings — reach out while it&apos;s fresh.</p>
        </div>
        {!loading && low.length > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-200 px-2.5 py-1 text-[11px] font-bold text-accent-700">
            {low.length} flagged
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-3 space-y-3" aria-hidden>
          <div className="h-16 animate-pulse rounded-lg bg-ink/10" />
          <div className="h-16 animate-pulse rounded-lg bg-ink/10" />
        </div>
      ) : low.length ? (
        <ul className="mt-3 max-h-[300px] divide-y divide-accent-100 overflow-y-auto">
          {low.slice(0, 8).map((f) => {
            const ctx = contexts.get(f.appointment_id);
            return (
              <li key={f.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  {stars(f.rating)}
                  <span className="flex items-center gap-1 text-[10.5px] font-medium text-ink-faint">
                    <Clock className="h-3 w-3" aria-hidden />
                    {timeAgo(f.created_at)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-soft">
                  {f.comment?.trim() || "No written comment."}
                </p>
                <p className="mt-1 truncate text-[11px] font-medium text-ink-muted">
                  {aliases.get(f.student_id) ?? "Student"}
                  {ctx ? (isCounselor ? ` · ${ctx.concern.slice(0, 48)}` : ` · ${ctx.counselor} · ${ctx.concern.slice(0, 48)}`) : ""}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg bg-white/70 px-4 py-3 text-[12.5px] text-ink-muted">
          {totalCount ? "No low ratings — nothing to chase." : "No ratings yet."}
        </p>
      )}

      {!loading && counts.negative > 0 && (
        <Button variant="outline" size="sm" onClick={onViewAll} className="mt-3 self-start gap-1.5 bg-white/80">
          See all low ratings
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      )}
    </Card>
  );
}
