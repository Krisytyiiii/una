"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { isCustomRangeValid, type ReportSection } from "@/lib/reports-scope";
import { useRestoreReportScope, writeStoredScope } from "@/lib/hooks/use-report-scope";
import { cn } from "@/lib/utils";

const RANGE_PRESETS = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
];

/** Reports-only custom window rule: ordered and at most ~12 months. */
function validateCustomRange(from: string, to: string): string | null {
  return isCustomRangeValid(from, to) ? null : "Keep the range within 12 months.";
}

type SectionProps = {
  /** Sections this role can actually fill (see `reportSectionsForRole`). */
  sections: { key: ReportSection; label: string }[];
  section: ReportSection;
  preset: string;
  fromDay: string;
  toDay: string;
};

/**
 * Vertical, Supabase-style section rail for /reports. Each entry writes
 * `?section=` (URL-driven, like the old tabs) while the surrounding page
 * keeps the range in the header. Sticky on tall accounts so the rail stays
 * next to the content it filters.
 */
export function ReportsSectionNav({
  sections,
  section,
  preset,
  fromDay,
  toDay,
}: SectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pickSection = (v: string) => {
    const s = v as ReportSection;
    const p = new URLSearchParams(searchParams.toString());
    // Always write the param explicitly — a missing ?section= means the
    // "Overview" default, so Overview must be set, not deleted.
    p.set("section", s);
    router.replace(`${pathname}?${p.toString()}`);
    writeStoredScope({ section: s, preset, from: fromDay, to: toDay });
  };

  return (
    <div className="print:hidden">
      <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">
        Sections
      </p>
      <nav aria-label="Report sections" className="flex flex-col divide-y divide-ink/[0.07]">
        {sections.map((s) => {
          const active = s.key === section;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => pickSection(s.key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2.5 text-left text-[12.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                active
                  ? "bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-200"
                  : "text-ink-muted hover:bg-white hover:text-ink"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full transition",
                  active ? "bg-primary-600" : "bg-ink/20 group-hover:bg-primary-400"
                )}
              />
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * Report period control — the shared `DateRangeFilter` used by the dashboard
 * header, with the report presets and the 12-month custom window rule.
 * URL-driven via replace() so the server streams the scoped report and
 * print/export see the same scope; the last selection also persists locally
 * so a refresh restores it. Explicit URL params always win over storage.
 */
export function ReportsFilters({
  section,
  preset,
  fromDay,
  toDay,
  rangeLabel,
  fetching = false,
}: Omit<SectionProps, "sections"> & {
  rangeLabel: string;
  /** True while the report query refetches (section/range change). */
  fetching?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The app is light-only, so the filter uses the light palette everywhere.
  const tone = "light" as const;

  // Restore the last stored scope on first load (URL params win).
  useRestoreReportScope();

  const go = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const applyRange = (selection: { preset: string; from: string; to: string }) => {
    if (selection.preset === "custom") {
      go({ range: null, from: selection.from, to: selection.to });
      writeStoredScope({
        section,
        preset: "custom",
        from: selection.from,
        to: selection.to,
      });
      return;
    }
    go({ range: selection.preset, from: null, to: null });
    writeStoredScope({ section, preset: selection.preset, from: "", to: "" });
  };

  const clearRange = () => {
    go({ range: null, from: null, to: null });
    writeStoredScope({ section, preset: "30d", from: "", to: "" });
  };

  return (
    <div
      className="flex w-full flex-wrap items-center justify-start gap-2 print:hidden sm:w-auto sm:justify-end"
      aria-busy={fetching}
    >
      <div className="shrink-0">
        <DateRangeFilter
          presets={RANGE_PRESETS}
          preset={preset}
          from={fromDay}
          to={toDay}
          rangeLabel={rangeLabel}
          pending={fetching}
          tone={tone}
          dialogLabel="Report date range"
          footer="Every report section follows the selected period."
          validateCustom={validateCustomRange}
          onApply={applyRange}
          onClear={clearRange}
        />
      </div>
    </div>
  );
}

/** Slim skeleton for the section rail while it streams in. */
export function ReportsSectionNavSkeleton() {
  return (
    <div aria-hidden className="animate-pulse print:hidden">
      <div className="mb-2 h-3 w-16 rounded bg-ink/10" />
      <div className="flex flex-col gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 rounded-lg bg-ink/[0.06]" />
        ))}
      </div>
    </div>
  );
}

/** Slim exact-position skeleton for the period control while it streams in. */
export function ReportsFiltersSkeleton() {
  return (
    <div aria-hidden className="flex animate-pulse items-center justify-end print:hidden">
      <div className="h-7 w-32 rounded-full bg-ink/10" />
    </div>
  );
}
