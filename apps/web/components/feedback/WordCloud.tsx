"use client";

import { useMemo } from "react";
import { Hash, Quote } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { STOPWORDS } from "@/lib/sentiment";

export type FeedbackRowLite = {
  id: string;
  appointment_id: string;
  student_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type Theme = { word: string; count: number };

/**
 * Word-frequency mining — lowercases, strips non-alphanumerics, drops short
 * words / STOPWORDS / pure digits.
 */
export function mineThemes(rows: Pick<FeedbackRowLite, "comment">[]): Theme[] {
  const freq = new Map<string, number>();
  for (const f of rows) {
    if (!f.comment) continue;
    for (const w of f.comment.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
      if (w.length < 4 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
}

/**
 * Comment themes — a weighted word cloud: font size and tint scale with how
 * often the word appears, so the biggest signal is the biggest chip.
 */
export function WordCloud({
  loading,
  rows,
  themes: themesProp,
}: {
  loading: boolean;
  rows?: Pick<FeedbackRowLite, "comment">[];
  themes?: Theme[];
}) {
  const mined = useMemo(() => (themesProp ?? (rows ? mineThemes(rows) : [])), [themesProp, rows]);
  const themes = themesProp ?? mined;
  const max = themes[0]?.count ?? 1;

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
            <Quote className="h-4 w-4 text-primary-600" aria-hidden />
            Comment themes
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">Most-used words across written feedback.</p>
        </div>
        {!loading && themes.length > 0 && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-ink-soft">
            {themes.length} themes
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-3 flex flex-wrap gap-2" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-ink/10" />
          ))}
        </div>
      ) : themes.length ? (
        <ul className="mt-3 flex flex-wrap items-center gap-2">
          {themes.map((t, i) => {
            const weight = t.count / max;
            return (
              <li
                key={t.word}
                title={`${t.word} appears ${t.count} time${t.count === 1 ? "" : "s"}`}
                style={{ fontSize: `${11 + Math.round(weight * 5)}px` }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-bold ring-1 transition hover:-translate-y-0.5 hover:shadow-card",
                  i === 0
                    ? "bg-primary-600 text-white ring-primary-600"
                    : weight >= 0.6
                      ? "bg-primary-100 text-primary-800 ring-primary-200"
                      : "bg-primary-50 text-primary-700 ring-primary-100"
                )}
              >
                <Hash className="h-3 w-3 opacity-60" aria-hidden />
                {t.word}
                <span className={cn("text-[10.5px] font-bold", i === 0 ? "text-primary-100" : "text-primary-500")}>
                  {t.count}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[12.5px] text-ink-muted">No written comments yet.</p>
      )}
    </Card>
  );
}
