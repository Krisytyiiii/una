"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Eraser,
  Filter,
  LayoutList,
  ListChecks,
  Loader2,
  RefreshCw,
  Rows3,
  ScrollText,
  Search,
  ShieldCheck,
  Table2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAuditTrail,
  AUDIT_TRAIL_PAGE_SIZE,
  type AuditActor,
  type AuditDayBucket,
  type AuditTrailOrder,
  type AuditTrailRange,
  type AuditTrailRow,
} from "@/lib/hooks/use-audit-trail";
import { useClearSectionBadge } from "@/lib/hooks/use-clear-section-badge";
import { formatWhen, initials, timeAgo } from "@/lib/format";
import { Input } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import { Pager } from "@/components/shared/Pager";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  counselor: "Counselor",
  guidance_head: "Guidance head",
  faculty: "Faculty",
  guidance_personnel: "Guidance personnel",
  admin: "Admin",
};

function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role.replace(/_/g, " ");
}

const RANGE_OPTIONS: { value: AuditTrailRange; label: string; short: string }[] = [
  { value: "all", label: "All time", short: "All" },
  { value: "24h", label: "Last 24 hours", short: "24h" },
  { value: "7d", label: "Last 7 days", short: "7d" },
  { value: "30d", label: "Last 30 days", short: "30d" },
];

const RANGE_LABEL: Record<AuditTrailRange, string> = {
  all: "All time",
  "24h": "Last 24h",
  "7d": "Last 7d",
  "30d": "Last 30d",
};

type ViewMode = "table" | "timeline";

/**
 * Head-only full audit trail.
 *
 * The security console shows a short preview; this page pages through every
 * append-only `audit_logs` row and resolves the actor, so the office can
 * answer "who changed what, and exactly when" for the whole system.
 */
export default function AuditTrailPage() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState("all");
  const [range, setRange] = useState<AuditTrailRange>("all");
  const [order, setOrder] = useState<AuditTrailOrder>("newest");
  const [view, setView] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Keystroke-friendly: only query after the typist pauses.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // "/" jumps to search from anywhere on the page (unless typing already).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) {
        return;
      }
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data, isLoading, isFetching, isError, refetch } = useAuditTrail({
    page,
    entity,
    action,
    query,
    range,
    order,
  });

  useClearSectionBadge("/security", !!data);

  useEffect(() => {
    if (isError) toast.error("Couldn't load the audit trail right now.");
  }, [isError]);

  // A new result set means the old expanded row is off-screen — collapse it.
  useEffect(() => {
    setExpandedId(null);
  }, [page, entity, action, query, range, order]);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const filtered = entity !== "all" || action !== "all" || !!query || range !== "all";

  const statCards = useMemo(
    () => [
      { label: "Total events", value: data ? data.totalAll.toLocaleString() : "—", icon: ScrollText, hint: "Whole ledger" },
      { label: "Today", value: data ? data.today.toLocaleString() : "—", icon: CalendarDays, hint: "Since midnight" },
      { label: "Matching", value: data ? total.toLocaleString() : "—", icon: Filter, hint: filtered ? "Filtered view" : "No filters" },
      { label: "Actions", value: data ? String(data.actions.length) : "—", icon: ListChecks, hint: "Distinct verbs" },
      { label: "Entities", value: data ? String(data.entities.length) : "—", icon: Rows3, hint: "Distinct tables" },
    ],
    [data, total, filtered]
  );

  const clearFilters = () => {
    setEntity("all");
    setAction("all");
    setRange("all");
    setSearch("");
    setQuery("");
    setPage(1);
  };

  const toggleOrder = () => {
    setOrder((o) => (o === "newest" ? "oldest" : "newest"));
    setPage(1);
  };

  const showingFrom = total === 0 ? 0 : (page - 1) * AUDIT_TRAIL_PAGE_SIZE + 1;
  const showingTo = Math.min(page * AUDIT_TRAIL_PAGE_SIZE, total);

  const activeChips = [
    range !== "all" ? { key: "range", label: RANGE_LABEL[range], clear: () => { setRange("all"); setPage(1); } } : null,
    entity !== "all" ? { key: "entity", label: `Entity: ${entity}`, clear: () => { setEntity("all"); setPage(1); } } : null,
    action !== "all" ? { key: "action", label: `Action: ${action}`, clear: () => { setAction("all"); setPage(1); } } : null,
    query ? { key: "query", label: `Search: “${query}”`, clear: () => { setSearch(""); setQuery(""); setPage(1); } } : null,
  ].filter((c): c is { key: string; label: string; clear: () => void } => c !== null);

  return (
    <div className="w-full space-y-4">
      {/* Hero — posture, volume signal, and clickable KPIs. */}
      <section className="relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-200/40 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-accent-200/30 blur-2xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary-700">
              <ScrollText className="h-3.5 w-3.5" aria-hidden />
              Accountability
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Audit trail</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-primary-700">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                Append-only
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white/70 px-2.5 py-1 text-[11px] font-bold text-ink-muted">
                Head only
              </span>
            </div>
            <p className="mt-1.5 max-w-[640px] text-[13px] leading-relaxed text-ink-muted">
              Every recorded action across the system — who did it, what changed, and the exact time. Rows can be
              written, never edited or deleted.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/70 bg-white/85 px-3.5 text-[12.5px] font-bold text-ink-soft shadow-card backdrop-blur transition hover:border-primary-300 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-60"
              >
                {isFetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                )}
                {isFetching ? "Refreshing…" : "Refresh"}
              </button>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-faint">
                <span className={cn("h-1.5 w-1.5 rounded-full", isFetching ? "bg-accent-500" : "bg-primary-500")} aria-hidden />
                {isFetching ? "Syncing…" : data ? "Up to date" : "Waiting for data"}
              </span>
            </div>
          </div>

          <ActivitySpark daily={data?.daily ?? []} loading={isLoading && !data} />
        </div>

        {/* KPI cards */}
        <div className="relative mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          {statCards.map((s) => (
            <div
              key={s.label}
              className={cn(
                "rounded-xl border p-3 shadow-card",
                s.label === "Matching" && filtered
                  ? "border-primary-400 bg-primary-600 text-white ring-1 ring-primary-300"
                  : "border-white/70 bg-white/75 backdrop-blur"
              )}
            >
              <span
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em]",
                  s.label === "Matching" && filtered ? "text-primary-100" : "text-ink-muted"
                )}
              >
                <s.icon
                  className={cn("h-3 w-3", s.label === "Matching" && filtered ? "text-white" : "text-primary-600")}
                  aria-hidden
                />
                {s.label}
              </span>
              {isLoading && !data ? (
                <span className="mt-2 block h-6 w-12 animate-pulse rounded bg-ink/10" aria-hidden />
              ) : (
                <span className="mt-1 block font-display text-xl font-bold leading-none tabular-nums">{s.value}</span>
              )}
              <span
                className={cn(
                  "mt-1 block truncate text-[10.5px]",
                  s.label === "Matching" && filtered ? "text-primary-100" : "text-ink-faint"
                )}
              >
                {s.hint}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Command bar — search, scopes, view + sort. */}
      <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 bg-cream/20 px-4 py-3 sm:px-5">
          <div className="relative w-full sm:max-w-sm sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Action, entity, or staff name…"
              aria-label="Search audit events"
              className="h-9 pl-9 pr-12"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-ink/10 bg-cream px-1.5 py-0.5 text-[10px] font-bold text-ink-faint sm:block">
              /
            </kbd>
          </div>
          <div className="w-full sm:w-44">
            <Dropdown
              menuKey="audit-entity"
              openMenuKey={openMenuKey}
              onOpenChange={setOpenMenuKey}
              value={entity}
              onChange={(v) => {
                setEntity(v);
                setPage(1);
              }}
              ariaLabel="Filter by entity"
              options={[
                { value: "all", label: "All entities" },
                ...(data?.entities ?? []).map((e) => ({ value: e, label: e })),
              ]}
            />
          </div>
          <div className="w-full sm:w-44">
            <Dropdown
              menuKey="audit-action"
              openMenuKey={openMenuKey}
              onOpenChange={setOpenMenuKey}
              value={action}
              onChange={(v) => {
                setAction(v);
                setPage(1);
              }}
              ariaLabel="Filter by action"
              options={[
                { value: "all", label: "All actions" },
                ...(data?.actions ?? []).map((a) => ({ value: a, label: a })),
              ]}
            />
          </div>
          {filtered && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-ink/15 bg-white px-2.5 text-[11.5px] font-bold text-ink-soft transition hover:border-red-300 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden />
              Clear
            </button>
          )}
        </div>

        {/* Range + sort + view */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Time range"
              className="inline-flex items-center gap-0.5 rounded-lg border border-ink/10 bg-cream/40 p-0.5"
            >
              {RANGE_OPTIONS.map((o) => {
                const active = range === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={active}
                    title={o.label}
                    onClick={() => {
                      setRange(o.value);
                      setPage(1);
                    }}
                    className={cn(
                      "inline-flex h-7 items-center rounded-md px-2.5 text-[11.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                      active ? "bg-white text-ink shadow-sm ring-1 ring-ink/5" : "text-ink-muted hover:text-ink"
                    )}
                  >
                    {o.short}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={toggleOrder}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-2.5 text-[11.5px] font-bold text-ink-soft transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
              {order === "newest" ? "Newest first" : "Oldest first"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <p className="hidden text-[11.5px] font-medium text-ink-faint md:block">
              {data ? `${showingFrom}–${showingTo} of ${total.toLocaleString()}` : "Loading events…"}
            </p>
            <div
              role="group"
              aria-label="Trail view"
              className="inline-flex items-center gap-0.5 rounded-lg border border-ink/10 bg-cream/40 p-0.5"
            >
              <ViewButton active={view === "table"} onClick={() => setView("table")} icon={Table2} label="Table" />
              <ViewButton active={view === "timeline"} onClick={() => setView("timeline")} icon={LayoutList} label="Timeline" />
            </div>
          </div>
        </div>

        {/* Active scope chips */}
        {(activeChips.length > 0 || !!data?.actions.length) && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-ink/5 px-4 py-2.5 sm:px-5">
            {activeChips.length > 0 && (
              <>
                <span className="mr-0.5 inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-faint">
                  <Filter className="h-3 w-3" aria-hidden />
                  Active
                </span>
                {activeChips.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={c.clear}
                    className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-bold text-primary-700 ring-1 ring-primary-200 transition hover:bg-primary-100"
                    title={`Remove ${c.label}`}
                  >
                    {c.label}
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-ink/10" aria-hidden />
              </>
            )}
            {!!data?.actions.length && (
              <>
                <span className="mr-0.5 inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-faint">
                  Quick actions
                </span>
                {data.actions.slice(0, 8).map((a) => {
                  const active = action === a;
                  return (
                    <button
                      key={a}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setAction(active ? "all" : a);
                        setPage(1);
                      }}
                      className={cn(
                        "inline-flex h-6 items-center rounded-full px-2.5 font-mono text-[10.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                        active
                          ? "bg-primary-600 text-white shadow-sm"
                          : "bg-cream text-ink-soft ring-1 ring-ink/10 hover:bg-primary-50 hover:text-primary-700"
                      )}
                    >
                      {a}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </section>

      {/* Ledger */}
      <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <ScrollText className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-[13.5px] font-bold text-ink">
                {view === "table" ? "Event ledger" : "Event timeline"}
              </h2>
              <p className="text-[11px] text-ink-faint">
                {filtered ? RANGE_LABEL[range] : "Full history"} · {order === "newest" ? "newest first" : "oldest first"}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-ink-muted ring-1 ring-ink/5">
            <Clock className="h-3 w-3" aria-hidden />
            {total.toLocaleString()} event{total === 1 ? "" : "s"}
          </span>
        </div>

        {isLoading && !data ? (
          <div className="space-y-3 p-5" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-ink/10" />
            ))}
          </div>
        ) : rows.length ? (
          view === "table" ? (
            <TrailTable
              rows={rows}
              actors={data?.actors}
              order={order}
              onToggleOrder={toggleOrder}
              expandedId={expandedId}
              onToggleRow={(id) => setExpandedId((cur) => (cur === id ? null : id))}
            />
          ) : (
            <TrailTimeline
              rows={rows}
              actors={data?.actors}
              expandedId={expandedId}
              onToggleRow={(id) => setExpandedId((cur) => (cur === id ? null : id))}
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-primary-600 ring-1 ring-blue-100">
              <Search className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-bold text-ink">
              {filtered ? "No events match these filters" : "No audit events yet"}
            </p>
            <p className="mt-1 max-w-[340px] text-[12.5px] leading-relaxed text-ink-muted">
              {filtered
                ? "Try widening the time range or clearing the search, entity, and action filters."
                : "Actions across the office will be recorded here automatically."}
            </p>
            {filtered && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary-600 px-3 text-[12px] font-bold text-white transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <Eraser className="h-3.5 w-3.5" aria-hidden />
                Clear all filters
              </button>
            )}
          </div>
        )}

        {data && total > AUDIT_TRAIL_PAGE_SIZE && (
          <div className="border-t border-ink/10">
            <Pager
              page={page}
              size={AUDIT_TRAIL_PAGE_SIZE}
              totalApprox={total}
              hasMore={page * AUDIT_TRAIL_PAGE_SIZE < total}
              onPage={setPage}
              busy={isFetching && !isLoading}
            />
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero sparkline                                                      */
/* ------------------------------------------------------------------ */

/** 14-day bar strip; hovering a bar labels the exact day + count. */
function ActivitySpark({ daily, loading }: { daily: AuditDayBucket[]; loading: boolean }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...daily.map((d) => d.count));
  const sum = daily.reduce((acc, d) => acc + d.count, 0);
  const focus = hovered !== null ? daily[hovered] : null;

  return (
    <div className="w-full shrink-0 rounded-xl border border-white/70 bg-white/80 p-3 shadow-card backdrop-blur lg:w-[320px]">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">
          <Activity className="h-3 w-3 text-primary-600" aria-hidden />
          14-day volume
        </p>
        <span className="text-[11px] font-bold tabular-nums text-ink">
          {focus ? (
            <>
              {focus.count} · {new Date(`${focus.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </>
          ) : (
            <>{sum.toLocaleString()} events</>
          )}
        </span>
      </div>

      {loading ? (
        <div className="mt-3 flex h-16 items-end gap-[3px]" aria-hidden>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="flex-1 animate-pulse rounded-sm bg-ink/10" style={{ height: `${30 + ((i * 13) % 55)}%` }} />
          ))}
        </div>
      ) : (
        <div className="mt-3 flex h-16 items-end gap-[3px]" onMouseLeave={() => setHovered(null)}>
          {daily.map((d, i) => {
            const h = Math.max(4, Math.round((d.count / max) * 100));
            const active = hovered === i;
            return (
              <button
                key={d.date}
                type="button"
                onMouseEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                aria-label={`${d.count} events on ${new Date(`${d.date}T00:00:00`).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}`}
                className="group flex h-full flex-1 items-end rounded-sm focus-visible:outline-none"
              >
                <span
                  className={cn(
                    "w-full rounded-sm transition-all",
                    active ? "bg-primary-600" : d.count ? "bg-primary-300 group-hover:bg-primary-400" : "bg-ink/10"
                  )}
                  style={{ height: `${h}%` }}
                />
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-1.5 flex items-center justify-between text-[10px] font-medium text-ink-faint">
        <span>
          {daily[0]
            ? new Date(`${daily[0].date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : "—"}
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* View switcher                                                       */
/* ------------------------------------------------------------------ */

function ViewButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Table2;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
        active ? "bg-white text-ink shadow-sm ring-1 ring-ink/5" : "text-ink-muted hover:text-ink"
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Table view                                                          */
/* ------------------------------------------------------------------ */

function TrailTable({
  rows,
  actors,
  order,
  onToggleOrder,
  expandedId,
  onToggleRow,
}: {
  rows: AuditTrailRow[];
  actors?: Map<string, AuditActor>;
  order: AuditTrailOrder;
  onToggleOrder: () => void;
  expandedId: string | null;
  onToggleRow: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead>
          <tr className="border-b border-ink/10 bg-cream/40 text-[10.5px] uppercase tracking-[0.08em] text-ink-muted">
            <th className="px-4 py-2.5 whitespace-nowrap">
              <button
                type="button"
                onClick={onToggleOrder}
                className="inline-flex items-center gap-1 font-bold transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                title={`Sort ${order === "newest" ? "oldest" : "newest"} first`}
              >
                When
                <ArrowUpDown className="h-3 w-3" aria-hidden />
              </button>
            </th>
            <th className="px-4 py-2.5">Actor</th>
            <th className="px-4 py-2.5">Action</th>
            <th className="px-4 py-2.5">Entity</th>
            <th className="px-4 py-2.5">Details</th>
            <th className="w-10 px-2 py-2.5">
              <span className="sr-only">Expand</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const actor = r.actor_profile_id ? actors?.get(r.actor_profile_id) : undefined;
            const day = new Date(r.created_at);
            const prev = i > 0 ? new Date(rows[i - 1].created_at) : null;
            const showDay = !prev || prev.toDateString() !== day.toDateString();
            const expanded = expandedId === r.id;
            return (
              <Fragment key={r.id}>
                {showDay && (
                  <tr>
                    <td
                      colSpan={6}
                      className="border-b border-ink/5 bg-cream/50 px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-faint"
                    >
                      {day.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                )}
                <tr
                  onClick={() => onToggleRow(r.id)}
                  className={cn(
                    "cursor-pointer border-b border-ink/5 align-top transition-colors last:border-0 hover:bg-cream/40",
                    expanded && "bg-primary-50/50"
                  )}
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-semibold text-ink">{formatWhen(r.created_at)}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-ink-faint">
                      <Clock className="h-3 w-3" aria-hidden />
                      {timeAgo(r.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ActorAvatar actor={actor} />
                      <div className="min-w-0">
                        <span className="block truncate font-bold text-ink">{actor?.name ?? "System"}</span>
                        <span className="mt-0.5 block text-[11px] font-medium text-ink-faint">
                          {actor ? roleLabel(actor.role) : "Automated"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 font-mono text-[11px] font-bold text-primary-700 ring-1 ring-primary-100">
                      {r.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-ink">{r.entity}</span>
                    {r.entity_id && (
                      <span className="mt-0.5 block font-mono text-[11px] text-ink-faint" title={r.entity_id}>
                        {r.entity_id.slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <MetadataPreview metadata={r.metadata} />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-label={expanded ? "Collapse event details" : "Expand event details"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleRow(r.id);
                      }}
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint transition hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                        expanded && "bg-white text-ink shadow-sm"
                      )}
                    >
                      <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden />
                    </button>
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-b border-ink/5 bg-cream/20">
                    <td colSpan={6} className="px-4 pb-4 pt-1">
                      <RowDetail row={r} actor={actor} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Timeline view                                                       */
/* ------------------------------------------------------------------ */

function TrailTimeline({
  rows,
  actors,
  expandedId,
  onToggleRow,
}: {
  rows: AuditTrailRow[];
  actors?: Map<string, AuditActor>;
  expandedId: string | null;
  onToggleRow: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const out: { key: string; label: string; rows: AuditTrailRow[] }[] = [];
    for (const r of rows) {
      const d = new Date(r.created_at);
      const key = d.toDateString();
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(r);
      else
        out.push({
          key,
          label: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" }),
          rows: [r],
        });
    }
    return out;
  }, [rows]);

  return (
    <div className="px-4 py-4 sm:px-5">
      {groups.map((g) => (
        <div key={g.key} className="mb-5 last:mb-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-faint">{g.label}</span>
            <span className="h-px flex-1 bg-ink/10" aria-hidden />
            <span className="rounded-full bg-cream px-2 py-0.5 text-[10.5px] font-bold text-ink-muted">
              {g.rows.length}
            </span>
          </div>

          <ol className="relative ml-2 border-l border-ink/10 pl-4">
            {g.rows.map((r) => {
              const actor = r.actor_profile_id ? actors?.get(r.actor_profile_id) : undefined;
              const expanded = expandedId === r.id;
              const time = new Date(r.created_at).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <li key={r.id} className="relative pb-3 last:pb-0">
                  <span
                    aria-hidden
                    className="absolute -left-[21px] top-3 h-2 w-2 rounded-full bg-primary-400 ring-2 ring-white"
                  />
                  <div
                    className={cn(
                      "rounded-xl border transition-colors",
                      expanded ? "border-primary-200 bg-primary-50/40" : "border-ink/10 bg-white hover:border-primary-200 hover:bg-cream/30"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleRow(r.id)}
                      aria-expanded={expanded}
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                      <span className="w-14 shrink-0 pt-0.5 text-[11px] font-bold tabular-nums text-ink-muted">{time}</span>
                      <ActorAvatar actor={actor} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-bold text-ink">{actor?.name ?? "System"}</span>
                          <span className="rounded-full bg-primary-50 px-2 py-0.5 font-mono text-[10.5px] font-bold text-primary-700 ring-1 ring-primary-100">
                            {r.action}
                          </span>
                          <span className="text-[12px] font-semibold text-ink-soft">{r.entity}</span>
                        </span>
                        <span className="mt-1 block truncate text-[11.5px] text-ink-faint">
                          <MetadataText metadata={r.metadata} />
                        </span>
                      </span>
                      <ChevronDown
                        className={cn("mt-0.5 h-4 w-4 shrink-0 text-ink-faint transition-transform", expanded && "rotate-180")}
                        aria-hidden
                      />
                    </button>
                    {expanded && (
                      <div className="px-3 pb-3 pl-[4.75rem]">
                        <RowDetail row={r} actor={actor} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function ActorAvatar({ actor }: { actor?: AuditActor }) {
  if (!actor) {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/5 text-[10px] font-bold text-ink-faint ring-1 ring-ink/10">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10.5px] font-bold text-primary-700 ring-1 ring-primary-200">
      {initials(actor.name)}
    </span>
  );
}

function metadataSummary(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "—";
  const entries = Object.entries(metadata);
  if (!entries.length) return "—";
  const [k, v] = entries[0];
  return `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`;
}

/** One-line metadata preview for compact rows. */
function MetadataPreview({ metadata }: { metadata: Record<string, unknown> | null }) {
  const entries = metadata ? Object.entries(metadata) : [];
  if (!entries.length) return <span className="text-ink-faint">—</span>;
  return (
    <span className="block max-w-[340px]">
      <span className="line-clamp-1 text-[13px] text-ink-muted">{metadataSummary(metadata)}</span>
      {entries.length > 1 && (
        <span className="text-[11px] font-bold text-primary-600">+{entries.length - 1} more</span>
      )}
    </span>
  );
}

function MetadataText({ metadata }: { metadata: Record<string, unknown> | null }) {
  return <>{metadataSummary(metadata)}</>;
}

function RowDetail({ row, actor }: { row: AuditTrailRow; actor?: AuditActor }) {
  const [copied, setCopied] = useState(false);
  const fullTime = new Date(row.created_at).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

  const copy = async () => {
    const payload = JSON.stringify(
      {
        id: row.id,
        action: row.action,
        entity: row.entity,
        entity_id: row.entity_id,
        actor: actor ? { id: actor.id, name: actor.name, role: actor.role } : null,
        created_at: row.created_at,
        metadata: row.metadata,
      },
      null,
      2
    );
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast.success("Event record copied.");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy the event record.");
    }
  };

  return (
    <div className="rounded-xl border border-ink/10 bg-white p-3.5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DetailField label="Recorded">
          <span className="text-[12.5px] font-semibold text-ink">{fullTime}</span>
          <span className="mt-0.5 block text-[11px] text-ink-faint">{timeAgo(row.created_at)}</span>
        </DetailField>
        <DetailField label="Actor">
          <span className="text-[12.5px] font-semibold text-ink">{actor?.name ?? "System"}</span>
          <span className="mt-0.5 block text-[11px] text-ink-faint">
            {actor ? `${roleLabel(actor.role)} · ${actor.email}` : "Automated action"}
          </span>
        </DetailField>
        <DetailField label="Action">
          <span className="inline-flex rounded-full bg-primary-50 px-2 py-0.5 font-mono text-[11px] font-bold text-primary-700 ring-1 ring-primary-100">
            {row.action}
          </span>
          <span className="mt-1 block font-mono text-[10.5px] text-ink-faint">id {row.id.slice(0, 8)}…</span>
        </DetailField>
        <DetailField label="Entity">
          <span className="text-[12.5px] font-semibold text-ink">{row.entity}</span>
          {row.entity_id && (
            <span className="mt-0.5 block break-all font-mono text-[10.5px] text-ink-faint">{row.entity_id}</span>
          )}
        </DetailField>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-faint">Metadata</span>
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex h-6 items-center gap-1 rounded-md border border-ink/10 bg-white px-2 text-[10.5px] font-bold text-ink-soft transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            {copied ? <Check className="h-3 w-3 text-primary-600" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
            {copied ? "Copied" : "Copy record"}
          </button>
        </div>
        {row.metadata && Object.keys(row.metadata).length ? (
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-cream p-2.5 font-mono text-[11px] leading-relaxed text-ink-muted">
            {JSON.stringify(row.metadata, null, 2)}
          </pre>
        ) : (
          <p className="rounded-lg bg-cream px-3 py-2 text-[11.5px] text-ink-faint">No metadata attached to this event.</p>
        )}
      </div>
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-ink-faint">{label}</span>
      {children}
    </div>
  );
}
