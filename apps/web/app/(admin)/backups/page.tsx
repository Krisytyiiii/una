"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  DatabaseBackup,
  Download,
  Eraser,
  HardDrive,
  HardDriveDownload,
  History,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useBackupRuns, useRunBackup, fetchBackupDownloadUrl, type BackupRun } from "@/lib/hooks/use-backups";
import { timeAgoLong } from "@/lib/format";
import { Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

function formatBytes(n: number): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function durationLabel(start: string, end: string | null): string {
  if (!end) return "—";
  const s = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m}m ${rest}s` : `${m}m`;
}

const STATUS_META: Record<
  string,
  { label: string; icon: typeof CheckCircle2; pill: string; dot: string; bar: string }
> = {
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    pill: "bg-green-50 text-green-700 ring-green-200",
    dot: "bg-green-500",
    bar: "bg-green-500",
  },
  partial: {
    label: "Partial",
    icon: AlertTriangle,
    pill: "bg-yellow-50 text-yellow-800 ring-yellow-200",
    dot: "bg-yellow-500",
    bar: "bg-yellow-500",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    pill: "bg-red-50 text-red-700 ring-red-200",
    dot: "bg-red-500",
    bar: "bg-red-500",
  },
  running: {
    label: "Running",
    icon: Loader2,
    pill: "bg-blue-50 text-blue-700 ring-blue-200",
    dot: "bg-blue-500",
    bar: "bg-blue-500",
  },
};

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.running;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1",
        meta.pill
      )}
    >
      <Icon className={cn("h-3 w-3", status === "running" && "animate-spin")} aria-hidden />
      {meta.label}
    </span>
  );
}

type FilterValue = "all" | "completed" | "partial" | "failed" | "running";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All runs" },
  { value: "completed", label: "Completed" },
  { value: "partial", label: "Partial" },
  { value: "failed", label: "Failed" },
];

/** Next 18:00 UTC run (vercel.json cron `0 18 * * *`). */
function nextScheduledRun(): Date {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 18, 0, 0));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

type Health = {
  kind: "running" | "failed" | "warning" | "stale" | "aging" | "protected" | "empty";
  label: string;
  hint: string;
  pill: string;
  dot: string;
  bar: string;
  percent: number;
};

/**
 * Head-only /backups — run + manage logical data backups.
 * The (admin) layout already hard-blocks non-heads; this page additionally
 * degrades to a notice when the role check disagrees.
 *
 * Backup = versioned gzipped JSON of the app tables in a private bucket
 * (run history below). Restore is deliberately NOT a button — recovery
 * follows the runbook (download the artifact, guided SQL restore) because a
 * live overwrite of counseling data must never be one click.
 */
export default function BackupsPage() {
  const { data, isPending, isError, error, refetch, isFetching } = useBackupRuns();
  const run = useRunBackup();
  const runs = data ?? [];
  const latest = runs[0] ?? null;
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isError) toast.error("Couldn't load backup history right now.");
  }, [isError]);

  // "/" jumps to the history search from anywhere on the page.
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

  const counts = useMemo(() => {
    const by = { completed: 0, partial: 0, failed: 0, running: 0 };
    for (const r of runs) {
      if (r.status === "completed") by.completed += 1;
      else if (r.status === "partial") by.partial += 1;
      else if (r.status === "failed") by.failed += 1;
      else by.running += 1;
    }
    return by;
  }, [runs]);

  const lastGood = useMemo(
    () => runs.find((r) => (r.status === "completed" || r.status === "partial") && r.finished_at) ?? null,
    [runs]
  );

  const archiveRuns = useMemo(
    () => runs.filter((r) => r.status === "completed" || r.status === "partial"),
    [runs]
  );

  const totalBytes = useMemo(() => archiveRuns.reduce((acc, r) => acc + (r.bytes ?? 0), 0), [archiveRuns]);

  const health = useMemo<Health>(() => {
    const base = { percent: 100, pill: "", dot: "", bar: "" };
    if (run.isPending || counts.running > 0) {
      return {
        ...base,
        kind: "running",
        label: "Backup in progress",
        hint: "Exporting tables now — keep this tab open.",
        percent: 100,
        pill: "bg-primary-100 text-primary-700 ring-primary-200",
        dot: "bg-primary-500 animate-pulse",
        bar: "bg-primary-500",
      };
    }
    if (latest?.status === "failed") {
      return {
        ...base,
        kind: "failed",
        label: "Last run failed",
        hint: lastGood ? `Last success ${timeAgoLong(lastGood.started_at)}.` : "No successful run on record.",
        percent: 0,
        pill: "bg-red-50 text-red-700 ring-red-200",
        dot: "bg-red-500",
        bar: "bg-red-500",
      };
    }
    if (latest?.status === "partial") {
      return {
        ...base,
        kind: "warning",
        label: "Completed with warnings",
        hint: "Review the warnings on the latest run.",
        percent: 100,
        pill: "bg-yellow-50 text-yellow-800 ring-yellow-200",
        dot: "bg-yellow-500",
        bar: "bg-yellow-500",
      };
    }
    if (!lastGood?.finished_at) {
      return {
        ...base,
        kind: "empty",
        label: "No backups yet",
        hint: "Run the first backup to start protection.",
        percent: 0,
        pill: "bg-ink/5 text-ink-muted ring-ink/10",
        dot: "bg-ink/30",
        bar: "bg-ink/20",
      };
    }
    const ageHours = Math.max(0, (Date.now() - new Date(lastGood.finished_at).getTime()) / 3_600_000);
    const percent = Math.max(0, Math.min(100, Math.round(100 - (ageHours / 72) * 100)));
    if (ageHours > 72) {
      return {
        ...base,
        kind: "stale",
        label: "Stale protection",
        hint: `No successful backup in ${Math.floor(ageHours / 24)} days.`,
        percent,
        pill: "bg-red-50 text-red-700 ring-red-200",
        dot: "bg-red-500",
        bar: "bg-red-500",
      };
    }
    if (ageHours > 36) {
      return {
        ...base,
        kind: "aging",
        label: "Aging backup",
        hint: "The last success is over a day old — run one now.",
        percent,
        pill: "bg-yellow-50 text-yellow-800 ring-yellow-200",
        dot: "bg-yellow-500",
        bar: "bg-yellow-500",
      };
    }
    return {
      ...base,
      kind: "protected",
      label: "Protected",
      hint: `Last success ${timeAgoLong(lastGood.finished_at)}.`,
      percent,
      pill: "bg-green-50 text-green-700 ring-green-200",
      dot: "bg-green-500",
      bar: "bg-green-500",
    };
  }, [counts.running, lastGood, latest?.status, run.isPending]);

  const q = search.trim().toLowerCase();

  const filteredRuns = useMemo(() => {
    let rows = statusFilter === "all" ? runs : runs.filter((r) => r.status === statusFilter);
    if (q) {
      rows = rows.filter((r) =>
        [r.id, r.storage_path ?? "", r.checksum ?? "", r.source].some((v) => v.toLowerCase().includes(q))
      );
    }
    return order === "newest" ? rows : [...rows].reverse();
  }, [runs, statusFilter, q, order]);

  const scrollToHistory = () => historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const applyFilter = (value: FilterValue) => {
    setStatusFilter((cur) => (cur === value && value !== "all" ? "all" : value));
    scrollToHistory();
  };

  const handleRun = () => {
    run.mutate(undefined, {
      onSuccess: (r) => {
        toast.success(r.status === "partial" ? "Backup finished with warnings" : "Backup completed", {
          description: `${r.table_count} tables · ${r.total_rows.toLocaleString()} rows · ${formatBytes(r.bytes)}${r.warnings.length ? ` · ${r.warnings.length} warning${r.warnings.length === 1 ? "" : "s"}` : ""}`,
          position: "top-right",
        });
        void refetch().catch(() => {});
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Backup failed.", { position: "top-right" });
      },
    });
  };

  const handleDownload = async (backup: BackupRun) => {
    if (downloadingId) return;
    setDownloadingId(backup.id);
    try {
      const url = await fetchBackupDownloadUrl(backup.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dorsu-backup-${backup.started_at.slice(0, 10)}-${backup.id.slice(0, 8)}.json.gz`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Download started — link expires in 30 minutes.", { position: "top-right" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't prepare the download.", { position: "top-right" });
    } finally {
      setDownloadingId(null);
    }
  };

  const statCards: {
    label: string;
    value: number;
    icon: typeof CheckCircle2;
    hint: string;
    filter: FilterValue;
  }[] = [
    { label: "Backup runs", value: runs.length, icon: History, hint: "On record", filter: "all" },
    { label: "Completed", value: counts.completed, icon: CheckCircle2, hint: "Verified artifacts", filter: "completed" },
    {
      label: "Partial",
      value: counts.partial,
      icon: AlertTriangle,
      hint: counts.partial ? "Review warnings" : "None",
      filter: "partial",
    },
    {
      label: "Failed",
      value: counts.failed,
      icon: XCircle,
      hint: counts.failed ? "Check errors" : "None",
      filter: "failed",
    },
  ];

  const nextRun = nextScheduledRun();
  const activeFilterLabel = FILTERS.find((f) => f.value === statusFilter)?.label ?? "";
  const busy = isFetching || run.isPending;

  return (
    <div className="w-full space-y-4" aria-busy={busy}>
      {/* Hero — posture, actions, live run state, clickable KPIs. */}
      <section className="relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-200/40 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-accent-200/30 blur-2xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-stretch lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary-700">
              <DatabaseBackup className="h-3.5 w-3.5" aria-hidden />
              Data resilience
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Backups</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-primary-700">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                Head only
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white/70 px-2.5 py-1 text-[11px] font-bold text-ink-muted">
                Checksummed
              </span>
            </div>
            <p className="mt-1.5 max-w-[620px] text-[13px] leading-relaxed text-ink-muted">
              Head-managed copies of office data — run one any time, plus the automatic nightly run. Artifacts are
              private, checksummed, and every download is audit-logged.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRun}
                disabled={run.isPending}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent-600 px-4 text-[12.5px] font-bold text-white shadow-soft transition hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:opacity-60"
              >
                {run.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <DatabaseBackup className="h-3.5 w-3.5" aria-hidden />
                )}
                {run.isPending ? "Backing up…" : "Run backup now"}
              </button>
              <button
                type="button"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/70 bg-white/85 px-3.5 text-[12.5px] font-bold text-ink-soft shadow-card backdrop-blur transition hover:border-primary-300 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-60"
              >
                {isFetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                )}
                Refresh
              </button>
              <button
                type="button"
                onClick={() => lastGood && void handleDownload(lastGood)}
                disabled={!lastGood || !!downloadingId}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary-200 bg-primary-50/80 px-3.5 text-[12.5px] font-bold text-primary-700 transition hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50"
              >
                {lastGood && downloadingId === lastGood.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Download className="h-3.5 w-3.5" aria-hidden />
                )}
                Download latest
              </button>
            </div>

            {run.isPending && (
              <div className="mt-3 rounded-lg border border-primary-200 bg-white/80 px-3 py-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-primary-700">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    Exporting tables and uploading the artifact…
                  </span>
                  <span className="font-medium text-ink-faint">This can take a minute</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary-100">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-primary-500" />
                </div>
              </div>
            )}
          </div>

          <HealthPanel
            health={health}
            latest={latest}
            lastGood={lastGood}
            totalBytes={totalBytes}
            archiveCount={archiveRuns.length}
            nextRun={nextRun}
            loading={isPending && !data}
          />
        </div>

        {/* KPI cards — each one filters the history below. */}
        <div className="relative mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {statCards.map((s) => {
            const active = s.filter !== "all" && statusFilter === s.filter;
            const toneDanger = s.filter === "failed" && s.value > 0;
            const toneWarn = s.filter === "partial" && s.value > 0;
            return (
              <button
                key={s.label}
                type="button"
                aria-pressed={statusFilter === s.filter}
                title={`Show ${s.label.toLowerCase()}`}
                onClick={() => applyFilter(s.filter)}
                className={cn(
                  "group rounded-xl border p-3 text-left shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                  active
                    ? "border-primary-400 bg-white ring-1 ring-primary-300"
                    : "border-white/70 bg-white/75 backdrop-blur hover:border-primary-300 hover:bg-white",
                  !active && toneDanger && "border-red-200 bg-red-50/60 hover:border-red-300",
                  !active && toneWarn && "border-yellow-200 bg-yellow-50/60 hover:border-yellow-300"
                )}
              >
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                  <s.icon
                    className={cn(
                      "h-3 w-3",
                      toneDanger ? "text-red-600" : toneWarn ? "text-yellow-600" : "text-primary-600"
                    )}
                    aria-hidden
                  />
                  {s.label}
                </span>
                {isPending && !data ? (
                  <span className="mt-2 block h-6 w-12 animate-pulse rounded bg-ink/10" aria-hidden />
                ) : (
                  <span
                    className={cn(
                      "mt-1 block font-display text-xl font-bold leading-none tabular-nums",
                      toneDanger ? "text-red-700" : toneWarn ? "text-yellow-700" : "text-ink"
                    )}
                  >
                    {s.value}
                  </span>
                )}
                <span className="mt-1 flex items-center justify-between gap-1 text-[10.5px] text-ink-faint">
                  <span className="truncate">{s.hint}</span>
                  <span className="opacity-0 transition group-hover:opacity-100" aria-hidden>
                    →
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* History */}
      <section
        ref={historyRef}
        className="scroll-mt-4 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 px-4 py-3 sm:px-5">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
              <History className="h-4 w-4 text-primary-600" aria-hidden />
              Run history
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              {filteredRuns.length} of {runs.length} run{runs.length === 1 ? "" : "s"}
              {statusFilter !== "all" && ` · ${activeFilterLabel}`}
              {q && ` · matching “${search.trim()}”`}
              {" — expand a run for its table breakdown."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-ink/10 bg-cream/30 p-1" role="group" aria-label="Filter runs by status">
            {FILTERS.map((f) => {
              const active = statusFilter === f.value;
              const count = f.value === "all" ? runs.length : counts[f.value as keyof typeof counts];
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                    active ? "bg-primary-600 text-white shadow-sm" : "text-ink-soft hover:bg-white"
                  )}
                >
                  {f.label}
                  <span className={active ? "text-primary-100" : "text-ink-faint"}>{count}</span>
                </button>
              );
            })}
            {counts.running > 0 && (
              <button
                type="button"
                aria-pressed={statusFilter === "running"}
                onClick={() => setStatusFilter("running")}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                  statusFilter === "running" ? "bg-blue-600 text-white shadow-sm" : "text-blue-700 hover:bg-blue-50"
                )}
              >
                Running
                <span className={statusFilter === "running" ? "text-blue-100" : "text-blue-500"}>{counts.running}</span>
              </button>
            )}
          </div>
        </div>

        {/* Command row — search + sort + clear. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 bg-cream/20 px-4 py-2.5 sm:px-5">
          <div className="relative w-full sm:max-w-sm sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Run id, checksum, or storage path…"
              aria-label="Search backup runs"
              className="h-9 pl-9 pr-12"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-ink/10 bg-cream px-1.5 py-0.5 text-[10px] font-bold text-ink-faint sm:block">
              /
            </kbd>
          </div>
          <button
            type="button"
            onClick={() => setOrder((o) => (o === "newest" ? "oldest" : "newest"))}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-2.5 text-[11.5px] font-bold text-ink-soft transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
            {order === "newest" ? "Newest first" : "Oldest first"}
          </button>
          {(statusFilter !== "all" || !!q) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setSearch("");
              }}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-ink/15 bg-white px-2.5 text-[11.5px] font-bold text-ink-soft transition hover:border-red-300 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden />
              Clear
            </button>
          )}
        </div>

        {isPending && !data ? (
          <div className="space-y-3 p-4" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-ink/10" />
            ))}
          </div>
        ) : filteredRuns.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 bg-cream/40 text-[10.5px] uppercase tracking-[0.08em] text-ink-muted">
                  <th className="px-4 py-2.5">Started</th>
                  <th className="px-4 py-2.5">Source</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Tables · rows</th>
                  <th className="px-4 py-2.5">Size</th>
                  <th className="px-4 py-2.5">Artifact</th>
                  <th className="w-10 px-2 py-2.5">
                    <span className="sr-only">Expand</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((r) => {
                  const expanded = expandedId === r.id;
                  const canDownload = !!r.storage_path && (r.status === "completed" || r.status === "partial");
                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
                        className={cn(
                          "cursor-pointer border-b border-ink/5 align-top transition-colors hover:bg-cream/40",
                          expanded && "bg-primary-50/40"
                        )}
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="font-semibold text-ink">{timeAgoLong(r.started_at)}</span>
                          <span className="mt-0.5 block font-mono text-[10.5px] text-ink-faint">
                            id {r.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold text-ink-soft ring-1 ring-ink/5">
                            {r.source === "cron" ? "Automatic" : "Manual"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusPill status={r.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                          <span className="font-semibold text-ink">{Object.keys(r.row_counts ?? r.tables ?? {}).length}</span>
                          <span className="text-ink-faint"> · </span>
                          <span className="text-ink-soft">{(r.total_rows ?? 0).toLocaleString()}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-soft">{formatBytes(r.bytes ?? 0)}</td>
                        <td className="px-4 py-3">
                          {canDownload ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDownload(r);
                              }}
                              disabled={downloadingId === r.id}
                              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-blue-100 px-2.5 text-[11px] font-bold text-blue-800 transition hover:bg-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50"
                            >
                              {downloadingId === r.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <Download className="h-3.5 w-3.5" aria-hidden />
                              )}
                              Download
                            </button>
                          ) : (
                            <span className="text-xs font-medium text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="px-2 py-3 text-right">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-label={expanded ? "Collapse run details" : "Expand run details"}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId((cur) => (cur === r.id ? null : r.id));
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
                          <td colSpan={7} className="px-4 pb-4 pt-1">
                            <RunDetail run={r} onDownload={() => void handleDownload(r)} downloading={downloadingId === r.id} canDownload={canDownload} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-primary-600 ring-1 ring-blue-100">
              <DatabaseBackup className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-bold text-ink">
              {isError
                ? "Couldn't load backup history"
                : runs.length
                  ? "No runs match these filters"
                  : "No backups yet"}
            </p>
            <p className="mt-1 max-w-[340px] text-[12.5px] leading-relaxed text-ink-muted">
              {isError
                ? ((error as Error)?.message ?? "Please try again in a moment.")
                : runs.length
                  ? "Adjust the status filter or search, or clear both to see every run."
                  : "Run the first one above — the nightly automatic run appears here too."}
            </p>
            {(statusFilter !== "all" || !!q) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setSearch("");
                }}
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary-600 px-3 text-[12px] font-bold text-white transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <Eraser className="h-3.5 w-3.5" aria-hidden />
                Clear filters
              </button>
            )}
          </div>
        )}

        {!!filteredRuns.length && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 px-4 py-2.5 text-[11px] font-medium text-ink-faint sm:px-5">
            <span>
              History shows the latest 100 runs · archives retained privately in the backup bucket
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", isFetching ? "bg-accent-500" : "bg-primary-500")} aria-hidden />
              {isFetching ? "Syncing…" : "Up to date"}
            </span>
          </div>
        )}
      </section>

      {/* Recovery runbook */}
      <section className="rounded-xl border border-primary-100 bg-gradient-to-br from-white to-blue-50/50 p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
              <HardDriveDownload className="h-4 w-4 text-primary-600" aria-hidden />
              If data ever needs restoring
            </h2>
            <p className="mt-0.5 max-w-[640px] text-[12.5px] text-ink-muted">
              Recovery is deliberate and guided — there is no in-app restore button, because a live overwrite of
              counseling data must never be one click.
            </p>
          </div>
          <CopyChip value="docs/operations/backup-restore.md" label="Runbook path" mono />
        </div>

        <ol className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: Download,
              title: "Download the latest artifact",
              body: "Pick the newest Completed run above. The link expires in 30 minutes and every download is audit-logged.",
            },
            {
              icon: ShieldCheck,
              title: "Verify the checksum",
              body: "Compare the artifact's sha256 against the run record before touching any database.",
            },
            {
              icon: DatabaseBackup,
              title: "Restore into staging first",
              body: "Follow the runbook's table-ordered restore into a staging project, verify, then promote.",
            },
            {
              icon: HardDrive,
              title: "Re-check file paths",
              body: "Artifacts hold database tables only — storage paths are recorded so bucket files can be re-verified.",
            },
          ].map((step, i) => (
            <li key={step.title} className="rounded-xl border border-ink/10 bg-white/80 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700">
                  {i + 1}
                </span>
                <step.icon className="h-3.5 w-3.5 text-primary-600" aria-hidden />
              </div>
              <p className="mt-2 text-[12.5px] font-bold text-ink">{step.title}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        <p className="mt-3 rounded-xl bg-white/70 px-4 py-3 text-[12.5px] leading-relaxed text-ink-muted ring-1 ring-primary-100">
          <span className="font-bold text-ink">Scope honesty:</span> artifacts hold database tables only. File bytes
          (announcement covers, session-note images) stay in their private buckets — the backup records their paths so
          recovery can re-verify them.
        </p>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Health panel                                                        */
/* ------------------------------------------------------------------ */

function HealthPanel({
  health,
  latest,
  lastGood,
  totalBytes,
  archiveCount,
  nextRun,
  loading,
}: {
  health: Health;
  latest: BackupRun | null;
  lastGood: BackupRun | null;
  totalBytes: number;
  archiveCount: number;
  nextRun: Date;
  loading: boolean;
}) {
  const Icon = health.kind === "failed" || health.kind === "stale" ? ShieldAlert : ShieldCheck;
  return (
    <div className="w-full shrink-0 rounded-xl border border-white/70 bg-white/85 p-3.5 shadow-card backdrop-blur lg:w-[330px]">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">
          <ShieldCheck className="h-3 w-3 text-primary-600" aria-hidden />
          Protection status
        </p>
        {latest && (
          <span className="font-mono text-[10px] text-ink-faint" title={latest.id}>
            #{latest.id.slice(0, 6)}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-2 space-y-2" aria-hidden>
          <div className="h-6 w-40 animate-pulse rounded bg-ink/10" />
          <div className="h-3 w-full animate-pulse rounded-full bg-ink/10" />
          <div className="h-3 w-32 animate-pulse rounded-full bg-ink/10" />
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-2">
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-full ring-1", health.pill)}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ring-1", health.pill)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", health.dot)} aria-hidden />
              {health.label}
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">{health.hint}</p>

          <div className="mt-2.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.08em] text-ink-faint">
              <span>Freshness</span>
              <span className="tabular-nums">{health.percent}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
              <div className={cn("h-full rounded-full transition-all", health.bar)} style={{ width: `${health.percent}%` }} />
            </div>
            <p className="mt-1 text-[10.5px] text-ink-faint">
              {lastGood ? `Last success ${timeAgoLong(lastGood.finished_at ?? lastGood.started_at)}` : "No successful run yet"}
            </p>
          </div>
        </>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-ink/10 pt-2.5">
        <div>
          <p className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-faint">
            <CalendarClock className="h-2.5 w-2.5" aria-hidden /> Next automatic
          </p>
          <p className="mt-0.5 text-[11.5px] font-semibold text-ink">
            {nextRun.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-faint">
            <HardDrive className="h-2.5 w-2.5" aria-hidden /> Stored archives
          </p>
          <p className="mt-0.5 text-[11.5px] font-semibold text-ink tabular-nums">
            {totalBytes ? formatBytes(totalBytes) : "0 B"}{" "}
            <span className="font-medium text-ink-faint">· {archiveCount} file{archiveCount === 1 ? "" : "s"}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Expandable run detail                                               */
/* ------------------------------------------------------------------ */

function RunDetail({
  run,
  onDownload,
  downloading,
  canDownload,
}: {
  run: BackupRun;
  onDownload: () => void;
  downloading: boolean;
  canDownload: boolean;
}) {
  const counts = run.row_counts ?? run.tables ?? {};
  const started = new Date(run.started_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  const finished = run.finished_at
    ? new Date(run.finished_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    : "Still running";

  return (
    <div className="rounded-xl border border-ink/10 bg-white p-3.5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DetailField label="Started">
          <span className="text-[12.5px] font-semibold text-ink">{started}</span>
          <span className="mt-0.5 block text-[11px] text-ink-faint">{timeAgoLong(run.started_at)}</span>
        </DetailField>
        <DetailField label="Finished · duration">
          <span className="text-[12.5px] font-semibold text-ink">{finished}</span>
          <span className="mt-0.5 block text-[11px] text-ink-faint">
            {run.finished_at ? `Took ${durationLabel(run.started_at, run.finished_at)}` : "In progress"}
          </span>
        </DetailField>
        <DetailField label="Source · scope">
          <span className="text-[12.5px] font-semibold text-ink">
            {run.source === "cron" ? "Automatic nightly" : "Manual"}
          </span>
          <span className="mt-0.5 block text-[11px] text-ink-faint">
            {Object.keys(counts).length} tables · {(run.total_rows ?? 0).toLocaleString()} rows · {formatBytes(run.bytes ?? 0)}
          </span>
        </DetailField>
        <DetailField label="Initiated by">
          <span className="text-[12.5px] font-semibold text-ink">
            {run.source === "cron" ? "Scheduler" : run.initiated_by ? `Staff ${run.initiated_by.slice(0, 8)}…` : "—"}
          </span>
          <span className="mt-0.5 block break-all font-mono text-[10.5px] text-ink-faint">{run.id}</span>
        </DetailField>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {run.checksum && <CopyChip value={run.checksum} label="sha256" mono truncate />}
        {run.storage_path && <CopyChip value={run.storage_path} label="artifact" mono />}
        <div className="ml-auto flex items-center gap-2">
          {canDownload && (
            <button
              type="button"
              onClick={onDownload}
              disabled={downloading}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-2.5 text-[11px] font-bold text-primary-700 transition hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
              Download artifact
            </button>
          )}
        </div>
      </div>

      {!!run.warnings.length && (
        <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50/70 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-yellow-800">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {run.warnings.length} warning{run.warnings.length === 1 ? "" : "s"}
          </p>
          <ul className="mt-1 space-y-0.5">
            {run.warnings.map((w) => (
              <li key={w} className="text-[11px] leading-relaxed text-yellow-800">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {run.status === "failed" && run.error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50/70 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-red-700">
            <XCircle className="h-3 w-3" aria-hidden />
            Run error
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-red-700">{run.error}</p>
        </div>
      )}

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-faint">Rows per table</span>
          <span className="text-[10.5px] font-medium text-ink-faint">Sorted by volume</span>
        </div>
        <TableBreakdown counts={counts} />
      </div>
    </div>
  );
}

function TableBreakdown({ counts }: { counts: Record<string, number> }) {
  const entries = useMemo(
    () => Object.entries(counts).sort((a, b) => b[1] - a[1]),
    [counts]
  );
  if (!entries.length) {
    return (
      <p className="rounded-lg bg-cream px-3 py-2 text-[11.5px] text-ink-faint">
        No per-table counts were recorded for this run.
      </p>
    );
  }
  const max = Math.max(1, ...entries.map(([, n]) => n));
  return (
    <div className="max-h-56 overflow-auto rounded-lg bg-cream/50 p-2.5">
      <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map(([table, n]) => (
          <div key={table} className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[10.5px] text-ink-soft" title={table}>
                {table}
              </span>
              <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-ink">{n.toLocaleString()}</span>
            </div>
            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-primary-400" style={{ width: `${Math.max(2, (n / max) * 100)}%` }} />
            </div>
          </div>
        ))}
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

function CopyChip({
  value,
  label,
  mono = false,
  truncate = false,
}: {
  value: string;
  label: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied.`);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy to the clipboard.");
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={value}
      className="inline-flex h-6 max-w-full items-center gap-1 rounded-md border border-ink/10 bg-white px-2 text-[10.5px] font-bold text-ink-soft transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
    >
      {copied ? <Check className="h-3 w-3 text-primary-600" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
      <span className="text-ink-faint">{label}</span>
      <span className={cn("min-w-0", mono && "font-mono", truncate && "truncate")}>
        {truncate ? `${value.slice(0, 16)}…` : value}
      </span>
    </button>
  );
}
