"use client";

import {
  Building2,
  CalendarClock,
  ChevronDown,
  Eraser,
  MessageSquareQuote,
  Search,
  SearchX,
  Star,
} from "lucide-react";
import { Button, Card, Input } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Feedback = {
  id: string;
  appointment_id: string;
  student_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type FeedbackContext = { concern: string; counselor: string; when: string };

export type SentimentCounts = { all: number; positive: number; neutral: number; negative: number };

export function stars(r: number) {
  return (
    <span className="text-sm font-bold tracking-tight" aria-label={`${r} out of 5 stars`}>
      <span className="text-accent-500">{"★".repeat(r)}</span>
      <span className="text-ink/20">{"★".repeat(Math.max(0, 5 - r))}</span>
    </span>
  );
}

/** Row accent + pill tint per sentiment, so low scores stand out at a glance. */
function ratingTone(rating: number): { bar: string; pill: string } {
  if (rating >= 4) return { bar: "border-l-primary-500", pill: "bg-primary-100 text-primary-800" };
  if (rating === 3) return { bar: "border-l-accent-400", pill: "bg-accent-100 text-accent-700" };
  return { bar: "border-l-accent-700", pill: "bg-accent-100 text-accent-700" };
}

/**
 * Recent feedback — search + sentiment chips live in the card header so the
 * list is one self-contained, filterable workspace.
 */
export function FeedbackList({
  loading,
  visible,
  total,
  rowsLength,
  query,
  setQuery,
  sentimentFilter,
  setSentimentFilter,
  counts,
  aliases,
  contexts,
  isCounselor,
  hasMore,
  onShowMore,
}: {
  loading: boolean;
  visible: Feedback[];
  /** How many rows match the current filters. */
  total: number;
  /** Total rows on the board (unfiltered) — drives the empty copy. */
  rowsLength: number;
  query: string;
  setQuery: (v: string) => void;
  sentimentFilter: string;
  setSentimentFilter: (v: string) => void;
  counts: SentimentCounts;
  aliases: Map<string, string>;
  contexts: Map<string, FeedbackContext>;
  isCounselor: boolean;
  hasMore: boolean;
  onShowMore: () => void;
}) {
  const chips: { value: string; label: string; count: number }[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "positive", label: "Positive 4–5★", count: counts.positive },
    { value: "neutral", label: "Neutral 3★", count: counts.neutral },
    { value: "negative", label: "Negative 1–2★", count: counts.negative },
  ];
  const filtersActive = sentimentFilter !== "all" || query.trim() !== "";

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4 sm:px-5">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
            <MessageSquareQuote className="h-4 w-4 text-primary-600" aria-hidden />
            Recent feedback
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">What students said, newest first.</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-ink-soft">
          {loading ? "Loading…" : `${total} match${total === 1 ? "" : "es"}`}
        </span>
      </div>

      {/* Filter bar */}
      <div className="mt-3 border-y border-ink/10 bg-cream/20 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
            <Input
              placeholder={isCounselor ? "Search comments, students…" : "Search comments, students, counselors…"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search feedback"
              className="h-8 pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-ink/10 bg-white p-1" role="group" aria-label="Filter by sentiment">
            {chips.map((c) => {
              const active = sentimentFilter === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSentimentFilter(c.value)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                    active ? "bg-primary-600 text-white shadow-sm" : "text-ink-soft hover:bg-cream"
                  )}
                >
                  {c.label}
                  <span className={active ? "text-primary-100" : "text-ink-faint"}>{c.count}</span>
                </button>
              );
            })}
          </div>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSentimentFilter("all");
              }}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-ink/15 bg-white px-2.5 text-[11.5px] font-bold text-ink-soft transition hover:border-red-300 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden />
              Clear
            </button>
          )}
        </div>
        <p className="mt-2 text-[11.5px] font-medium text-ink-faint">
          {loading
            ? "Loading feedback…"
            : `Showing ${visible.length} of ${total} matching response${total === 1 ? "" : "s"}${
                query.trim() ? " · search is case-insensitive" : ""
              }`}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3 p-4 sm:p-5" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-ink/10" />
          ))}
        </div>
      ) : visible.length ? (
        <ul className="divide-y divide-ink/10">
          {visible.map((f) => {
            const ctx = contexts.get(f.appointment_id);
            const tone = ratingTone(f.rating);
            return (
              <li key={f.id} className={cn("border-l-2 px-4 py-3 transition-colors hover:bg-cream/40 sm:px-5", tone.bar)}>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  {stars(f.rating)}
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold", tone.pill)}>
                    <Star className="h-2.5 w-2.5" aria-hidden />
                    {f.rating}/5
                  </span>
                  <span className="text-[11.5px] font-semibold text-ink">
                    {aliases.get(f.student_id) ?? "Student"}
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-ink-faint">
                    <CalendarClock className="h-3 w-3" aria-hidden />
                    {timeAgo(f.created_at)}
                  </span>
                </div>
                {f.comment?.trim() ? (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{f.comment}</p>
                ) : (
                  <p className="mt-1.5 text-[12px] italic text-ink-faint">No written comment.</p>
                )}
                {ctx && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-ink-muted">
                    <Building2 className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate">
                      {isCounselor ? ctx.concern : `${ctx.counselor} · ${ctx.concern}`}
                    </span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-primary-600 ring-1 ring-blue-100">
            <SearchX className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-bold text-ink">
            {rowsLength ? "No feedback matches these filters" : "No feedback yet"}
          </p>
          <p className="mt-1 max-w-[320px] text-[12.5px] leading-relaxed text-ink-muted">
            {rowsLength
              ? "Try clearing the search or picking another sentiment."
              : "Ratings appear here after completed sessions — nothing to chase yet."}
          </p>
        </div>
      )}

      {!loading && hasMore && (
        <div className="flex justify-center border-t border-ink/10 px-4 py-3">
          <Button variant="outline" size="sm" onClick={onShowMore} className="gap-1.5">
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            Show more
          </Button>
        </div>
      )}
    </Card>
  );
}
