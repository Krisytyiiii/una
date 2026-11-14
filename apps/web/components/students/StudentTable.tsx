"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Loader2,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { HoverMenu } from "@/components/shared/hover-menu";
import { Card, Input } from "@/components/ui/primitives";
import { Pager } from "@/components/shared/Pager";
import { pageRange } from "@/lib/pagination";
import { formatWhen, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { QUICK_FILTER_LABELS, type QuickFilter, type SortDir, type StudentSortKey } from "./types";

export type Student = {
  id: string;
  program: string | null;
  year_level: string | null;
  college: string | null;
  anonymous_alias: string | null;
  created_at: string;
};

export type StudentAgg = {
  total: number;
  completed: number;
  upcoming: number;
  missed: number;
  nextAt: string | null;
  lastAt: string | null;
  openRefs: number;
  urgentRefs: number;
  band: string | null;
};

export function bandTone(b: string): string {
  // PSS-10 bands use intuitive risk colors: healthy → caution → alarm.
  if (b === "high") return "bg-red-100 text-red-800";
  if (b === "moderate") return "bg-amber-100 text-amber-800";
  return "bg-green-100 text-green-800";
}

export function bandLabel(b: string): string {
  return b.charAt(0).toUpperCase() + b.slice(1);
}

/** Alias initials — two letters, never a real name. */
function aliasInitials(alias: string | null): string {
  if (!alias) return "ST";
  const parts = alias.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "ST";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function avatarTone(band: string | null): string {
  if (band === "high") return "bg-red-100 text-red-800 ring-red-200";
  if (band === "moderate") return "bg-amber-100 text-amber-800 ring-amber-200";
  if (band === "low") return "bg-green-100 text-green-800 ring-green-200";
  return "bg-ink/5 text-ink-muted ring-ink/10";
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  sortKey: StudentSortKey;
  activeKey: StudentSortKey;
  dir: SortDir;
  onSort: (k: StudentSortKey) => void;
  align?: "left" | "center";
  className?: string;
}) {
  const active = activeKey === sortKey;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-4 py-3", align === "center" && "text-center", className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded text-[11px] font-bold uppercase tracking-wider transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
          align === "center" && "justify-center",
          active ? "text-primary-700" : "text-ink-muted"
        )}
      >
        {label}
        <Icon className={cn("h-3 w-3", active ? "text-primary-600" : "text-ink-faint")} aria-hidden />
      </button>
    </th>
  );
}

/**
 * Privacy-safe directory with sortable columns, quick-filter chips, and row
 * navigation. Filters live above the table; the page owns filtering/sorting and
 * only hands this component the current page window.
 */
export function StudentTable({
  visible,
  totalCount,
  page,
  size,
  hasMore,
  onPageChange,
  loading,
  query,
  setQuery,
  programFilter,
  setProgramFilter,
  yearFilter,
  setYearFilter,
  collegeFilter,
  setCollegeFilter,
  programs,
  years,
  colleges,
  perStudent,
  quickFilter,
  setQuickFilter,
  sortKey,
  sortDir,
  onSort,
  onClearFilters,
}: {
  visible: Student[];
  totalCount: number;
  page: number;
  size: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
  loading: boolean;
  query: string;
  setQuery: (v: string) => void;
  programFilter: string;
  setProgramFilter: (v: string) => void;
  yearFilter: string;
  setYearFilter: (v: string) => void;
  collegeFilter: string;
  setCollegeFilter: (v: string) => void;
  programs: string[];
  years: string[];
  colleges: string[];
  perStudent: Map<string, StudentAgg>;
  quickFilter: QuickFilter;
  setQuickFilter: (f: QuickFilter) => void;
  sortKey: StudentSortKey;
  sortDir: SortDir;
  onSort: (k: StudentSortKey) => void;
  onClearFilters: () => void;
}) {
  const router = useRouter();
  // Immediate "opening…" feedback on the clicked row while the route chunk and
  // the record query load (prevents the click feeling ignored).
  const [openingId, setOpeningId] = useState<string | null>(null);

  const prefetchStudent = useCallback(
    (id: string) => {
      router.prefetch(`/students/${id}`);
    },
    [router]
  );

  const openStudent = useCallback(
    (id: string) => {
      setOpeningId(id);
      router.push(`/students/${id}`);
    },
    [router]
  );

  const hasFilters =
    quickFilter !== "all" || !!query.trim() || programFilter !== "all" || yearFilter !== "all" || collegeFilter !== "all";

  const removeFilter = useCallback(
    (kind: "quick" | "query" | "program" | "year" | "college") => {
      if (kind === "quick") setQuickFilter("all");
      if (kind === "query") setQuery("");
      if (kind === "program") setProgramFilter("all");
      if (kind === "year") setYearFilter("all");
      if (kind === "college") setCollegeFilter("all");
    },
    [setQuickFilter, setQuery, setProgramFilter, setYearFilter, setCollegeFilter]
  );

  const range = pageRange(page, size, visible.length);

  return (
    <Card className="overflow-hidden rounded-2xl p-0">
      {/* Toolbar */}
      <div className="border-b border-ink/10 p-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-ink">Student directory</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[10.5px] font-bold text-primary-700">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                Aliases only
              </span>
              <span className="inline-flex items-center rounded-full border border-ink/10 bg-cream px-2 py-0.5 text-[10.5px] font-bold text-ink-soft tabular-nums">
                {loading ? "Loading…" : `${totalCount} matching`}
              </span>
            </div>
          </div>

          <div className="relative w-full sm:ml-auto sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
            <Input
              placeholder="Search alias, program, year…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search students"
              className="h-8 pl-8 pr-8"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint transition hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            <SlidersHorizontal className="h-3 w-3" aria-hidden />
            Filter
          </span>
          <HoverMenu
            ariaLabel="Filter by program"
            buttonLabel={<>Program: {programFilter === "all" ? "All" : programFilter}</>}
            options={[{ value: "all", label: "All programs" }, ...programs.map((p) => ({ value: p, label: p }))]}
            value={programFilter}
            onPick={setProgramFilter}
          />
          <HoverMenu
            ariaLabel="Filter by year level"
            buttonLabel={<>Year: {yearFilter === "all" ? "All" : yearFilter}</>}
            options={[{ value: "all", label: "All year levels" }, ...years.map((y) => ({ value: y, label: y }))]}
            value={yearFilter}
            onPick={setYearFilter}
          />
          <HoverMenu
            ariaLabel="Filter by college"
            align="right"
            buttonLabel={<>College: {collegeFilter === "all" ? "All" : collegeFilter}</>}
            options={[{ value: "all", label: "All colleges" }, ...colleges.map((c) => ({ value: c, label: c }))]}
            value={collegeFilter}
            onPick={setCollegeFilter}
          />
          {hasFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="ml-auto inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-bold text-ink-muted transition hover:bg-cream hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <X className="h-3 w-3" aria-hidden />
              Clear all
            </button>
          )}
        </div>

        {hasFilters && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {quickFilter !== "all" && (
              <FilterChip label={QUICK_FILTER_LABELS[quickFilter]} onRemove={() => removeFilter("quick")} tone="accent" />
            )}
            {query.trim() && <FilterChip label={`“${query.trim()}”`} onRemove={() => removeFilter("query")} />}
            {programFilter !== "all" && <FilterChip label={programFilter} onRemove={() => removeFilter("program")} />}
            {yearFilter !== "all" && <FilterChip label={yearFilter} onRemove={() => removeFilter("year")} />}
            {collegeFilter !== "all" && <FilterChip label={collegeFilter} onRemove={() => removeFilter("college")} />}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 bg-cream/40">
              <SortHeader label="Student" sortKey="alias" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Program" sortKey="program" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Sessions" sortKey="sessions" activeKey={sortKey} dir={sortDir} onSort={onSort} align="center" />
              <SortHeader label="Upcoming" sortKey="upcoming" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Open referrals" sortKey="referrals" activeKey={sortKey} dir={sortDir} onSort={onSort} align="center" />
              <SortHeader label="Latest screening" sortKey="screening" activeKey={sortKey} dir={sortDir} onSort={onSort} align="center" />
              <th className="w-8 px-2 py-3" aria-hidden />
            </tr>
          </thead>
          <tbody aria-busy={loading}>
            {loading
              ? Array.from({ length: Math.min(Math.max(size, 3), 10) }).map((_, i) => (
                  <tr key={`student-skeleton-${i}`} className="border-b border-ink/5 align-top last:border-0" aria-hidden>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 animate-pulse rounded-full bg-ink/10" />
                        <div className="space-y-1.5">
                          <div className="h-3.5 w-24 animate-pulse rounded bg-ink/10" />
                          <div className="h-3 w-20 animate-pulse rounded bg-ink/10" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-32 animate-pulse rounded bg-ink/10" />
                      <div className="mt-1.5 h-3 w-24 animate-pulse rounded bg-ink/10" />
                    </td>
                    <td className="px-4 py-3"><div className="mx-auto h-4 w-12 animate-pulse rounded bg-ink/10" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-28 animate-pulse rounded bg-ink/10" /></td>
                    <td className="px-4 py-3"><div className="mx-auto h-5 w-16 animate-pulse rounded-full bg-ink/10" /></td>
                    <td className="px-4 py-3"><div className="mx-auto h-5 w-16 animate-pulse rounded-full bg-ink/10" /></td>
                    <td className="px-2 py-3" />
                  </tr>
                ))
              : visible.map((s) => {
                  const agg = perStudent.get(s.id);
                  const total = agg?.total ?? 0;
                  const completed = agg?.completed ?? 0;
                  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => openStudent(s.id)}
                      onMouseEnter={() => prefetchStudent(s.id)}
                      onFocus={() => prefetchStudent(s.id)}
                      aria-busy={openingId === s.id || undefined}
                      className={cn(
                        "group cursor-pointer border-b border-ink/5 align-top transition last:border-0 hover:bg-primary-50/50 focus-within:bg-primary-50/50",
                        openingId === s.id && "bg-primary-50/70 opacity-70"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            aria-hidden
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1",
                              avatarTone(agg?.band ?? null)
                            )}
                          >
                            {aliasInitials(s.anonymous_alias)}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/students/${s.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpeningId(s.id);
                              }}
                              onMouseEnter={() => prefetchStudent(s.id)}
                              onFocus={() => prefetchStudent(s.id)}
                              className="font-bold text-ink underline-offset-2 transition group-hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                            >
                              {s.anonymous_alias ?? "Student"}
                            </Link>
                            <p className="mt-0.5 truncate text-[11px] font-medium text-ink-muted">
                              {agg?.lastAt ? `Last session ${timeAgo(agg.lastAt)}` : "No sessions yet"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink">{s.program ?? "—"}</p>
                        <p className="text-[11px] font-medium text-ink-muted">
                          {[s.year_level, s.college].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <span className="font-bold text-ink tabular-nums">{completed}/{total}</span>
                        <span className="mt-1 block text-[10px] font-medium text-ink-faint">done/booked</span>
                        <span aria-hidden className="mx-auto mt-1 block h-1 w-14 overflow-hidden rounded-full bg-ink/10">
                          <span className="block h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {agg?.nextAt ? (
                          <>
                            <span className="font-semibold text-ink">{formatWhen(agg.nextAt)}</span>
                            {agg.upcoming > 1 && (
                              <span className="ml-1.5 inline-block rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">
                                +{agg.upcoming - 1}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {agg && agg.openRefs > 0 ? (
                          <span
                            className={cn(
                              "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                              agg.urgentRefs > 0 ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-700"
                            )}
                          >
                            {agg.urgentRefs > 0 ? `${agg.urgentRefs} urgent` : `${agg.openRefs} open`}
                          </span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {agg?.band ? (
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${bandTone(agg.band)}`}>
                            {bandLabel(agg.band)}
                          </span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {openingId === s.id ? (
                          <span className="flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin text-primary-600" aria-hidden />
                            <span className="sr-only">Opening student record…</span>
                          </span>
                        ) : (
                          <ChevronRight className="h-4 w-4 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-primary-600" aria-hidden />
                        )}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>

        {!loading && !visible.length && (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-ink-muted">
              <Search className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-sm font-semibold text-ink">No students match these filters</p>
            <p className="max-w-[360px] text-[13px] text-ink-muted">
              Try a different alias or clear the filters to see the whole directory.
            </p>
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-1 inline-flex h-6 items-center rounded-full bg-primary-600 px-3 text-[12px] font-bold text-white transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 px-4 py-2.5 sm:px-5">
        <p className="text-[11.5px] font-medium text-ink-faint">
          {loading ? "Loading students…" : `Showing ${range.start}–${range.end} of ${totalCount} · aliases only`}
        </p>
      </div>
      <Pager page={page} size={size} totalApprox={totalCount} hasMore={hasMore} onPage={onPageChange} busy={loading} />
    </Card>
  );
}

function FilterChip({
  label,
  onRemove,
  tone = "default",
}: {
  label: string;
  onRemove: () => void;
  tone?: "default" | "accent";
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-[11px] font-bold",
        tone === "accent" ? "border-accent-300 bg-accent-50 text-accent-700" : "border-ink/10 bg-cream text-ink-soft"
      )}
    >
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full transition hover:bg-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <X className="h-2.5 w-2.5" aria-hidden />
      </button>
    </span>
  );
}
