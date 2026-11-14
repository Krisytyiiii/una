"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  Clock,
  Eraser,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/primitives";
import { EventRow, type GlassLog } from "@/components/security/EventRow";
import { notifyStaff } from "@/lib/notify";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

/** Head-only full log of emergency accesses, with review actions. */
export default function AccessEventsPage() {
  const [logs, setLogs] = useState<GlassLog[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [aliases, setAliases] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "unreviewed" | "reviewed">("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("break_glass_logs")
      .select("id, accessor_profile_id, student_id, justification, accessed_at, reviewed_by, reviewed_at")
      .order("accessed_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const list = ((data ?? []) as GlassLog[]);
    setLogs(list);
    const profileIds = [...new Set(list.flatMap((l) => [l.accessor_profile_id, l.reviewed_by]).filter(Boolean))] as string[];
    if (profileIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", profileIds.slice(0, 200));
      setNames(
        new Map(
          ((profiles ?? []) as { id: string; full_name: string | null; email: string }[]).map((p) => [p.id, p.full_name ?? p.email])
        )
      );
    }
    const studentIds = [...new Set(list.map((l) => l.student_id))];
    if (studentIds.length) {
      const { data: students } = await supabase.rpc("get_student_aliases", { ids: studentIds.slice(0, 200) });
      setAliases(
        new Map(
          ((students ?? []) as { id: string; anonymous_alias: string | null }[]).map((s) => [s.id, s.anonymous_alias ?? "Student"])
        )
      );
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch {
        toast.error("Couldn't load access events right now.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } catch {
      toast.error("Couldn't refresh access events.");
    } finally {
      setRefreshing(false);
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs
      .filter((l) => {
        if (statusFilter === "unreviewed") return !l.reviewed_at;
        if (statusFilter === "reviewed") return !!l.reviewed_at;
        return true;
      })
      .filter((l) => {
        if (!q) return true;
        const who = names.get(l.accessor_profile_id) ?? "";
        const alias = aliases.get(l.student_id) ?? "";
        return `${who} ${alias} ${l.justification}`.toLowerCase().includes(q);
      });
  }, [logs, statusFilter, query, names, aliases]);

  const unreviewed = useMemo(() => logs.filter((l) => !l.reviewed_at).length, [logs]);
  const reviewed = logs.length - unreviewed;
  const accessors = useMemo(() => new Set(logs.map((l) => l.accessor_profile_id)).size, [logs]);

  // Group the log by calendar day — the trail reads like a timeline.
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: GlassLog[] }[] = [];
    for (const l of visible) {
      const d = new Date(l.accessed_at);
      const key = d.toDateString();
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(l);
      else
        out.push({
          key,
          label: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" }),
          items: [l],
        });
    }
    return out;
  }, [visible]);

  const filtersActive = statusFilter !== "all" || query.trim() !== "";

  const markReviewed = async (log: GlassLog) => {
    setBusyId(log.id);
    try {
      const res = await fetch("/api/staff/security/review-break-glass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: log.id }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Couldn't record the review.");
      await reload();
      toast.success("Marked as reviewed.");
      await notifyStaff([log.accessor_profile_id], {
        type: "system",
        title: "Emergency access reviewed",
        body: "The head reviewed your logged emergency access. No further action needed.",
        link: "/security",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't record the review.");
    } finally {
      setBusyId(null);
    }
  };

  const statCards: {
    label: string;
    value: number;
    icon: typeof KeyRound;
    hint: string;
    tone: "primary" | "danger";
    filter: "all" | "unreviewed" | "reviewed" | null;
  }[] = [
    { label: "Total accesses", value: logs.length, icon: KeyRound, hint: "On record", tone: "primary", filter: "all" },
    { label: "Unreviewed", value: unreviewed, icon: Clock, hint: unreviewed ? "Needs sign-off" : "Queue clear", tone: unreviewed ? "danger" : "primary", filter: "unreviewed" },
    { label: "Reviewed", value: reviewed, icon: Check, hint: "Signed off by head", tone: "primary", filter: "reviewed" },
    { label: "Distinct accessors", value: accessors, icon: Users, hint: "Staff who revealed", tone: "primary", filter: null },
  ];

  return (
    <div className="w-full space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/security">Security</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Access events</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-200/40 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-accent-200/30 blur-2xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary-700">
              <KeyRound className="h-3.5 w-3.5" aria-hidden />
              Emergency access log
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Access events</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-primary-700">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                Head review
              </span>
            </div>
            <p className="mt-1.5 max-w-[620px] text-[13px] leading-relaxed text-ink-muted">
              Every logged emergency access. Review each one so nothing sits unexamined — reveals are audited and
              never shown with student names.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
            <Link
              href="/security"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/70 bg-white/85 px-3 text-[12.5px] font-bold text-ink-soft shadow-card backdrop-blur transition hover:border-primary-300 hover:text-ink"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              Security
            </Link>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/70 bg-white/85 px-3.5 text-[12.5px] font-bold text-ink-soft shadow-card backdrop-blur transition hover:border-primary-300 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-60"
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              )}
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Review posture */}
        {!loading && (
          <div
            className={cn(
              "relative mt-4 flex flex-col gap-2.5 rounded-xl border px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between",
              unreviewed ? "border-red-200 bg-red-50/80" : "border-primary-200 bg-primary-50/70"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  unreviewed ? "bg-red-200 text-red-700" : "bg-primary-200 text-primary-700"
                )}
              >
                {unreviewed ? <Clock className="h-3.5 w-3.5" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
              </span>
              <p className="text-[12.5px] font-semibold text-ink">
                {unreviewed
                  ? `${unreviewed} access event${unreviewed === 1 ? "" : "s"} still need${unreviewed === 1 ? "s" : ""} a head review`
                  : logs.length
                    ? "Every access event is reviewed — nothing waiting"
                    : "No emergency accesses logged yet"}
              </p>
            </div>
            {unreviewed > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter("unreviewed")}
                className="inline-flex h-6 shrink-0 items-center gap-1 self-start rounded-full bg-red-600 px-3 text-[11.5px] font-bold text-white shadow-soft transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 sm:self-auto"
              >
                Show unreviewed
              </button>
            )}
          </div>
        )}

        {/* KPI cards */}
        <div className="relative mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {statCards.map((s) => {
            const active = s.filter !== null && statusFilter === s.filter;
            const shell = cn(
              "rounded-xl border p-3 text-left shadow-card transition",
              active
                ? "border-primary-400 bg-primary-600 text-white ring-1 ring-primary-300"
                : s.tone === "danger"
                  ? "border-red-200 bg-red-50/70"
                  : "border-white/70 bg-white/75 backdrop-blur"
            );
            const body = (
              <>
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em]",
                    active ? "text-primary-100" : "text-ink-muted"
                  )}
                >
                  <s.icon
                    className={cn(
                      "h-3 w-3",
                      active ? "text-white" : s.tone === "danger" ? "text-red-600" : "text-primary-600"
                    )}
                    aria-hidden
                  />
                  {s.label}
                </span>
                {loading ? (
                  <span className="mt-2 block h-6 w-12 animate-pulse rounded bg-ink/10" aria-hidden />
                ) : (
                  <span
                    className={cn(
                      "mt-1 block font-display text-xl font-bold leading-none tabular-nums",
                      active ? "text-white" : s.tone === "danger" && s.value > 0 ? "text-red-700" : "text-ink"
                    )}
                  >
                    {s.value}
                  </span>
                )}
                <span
                  className={cn(
                    "mt-1 block truncate text-[10.5px]",
                    active ? "text-primary-100" : "text-ink-faint"
                  )}
                >
                  {s.hint}
                </span>
              </>
            );
            return s.filter ? (
              <button
                key={s.label}
                type="button"
                onClick={() => setStatusFilter(s.filter as "all" | "unreviewed" | "reviewed")}
                aria-pressed={active}
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

      {/* Filters */}
      <section className="rounded-xl border border-ink/10 bg-white shadow-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 bg-cream/20 px-4 py-3 sm:px-5">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
            <Input
              placeholder="Search accessor, student, or justification…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search access events"
              className="h-8 pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-ink/10 bg-white p-1" role="group" aria-label="Filter by review status">
            {(
              [
                { v: "all", label: "All", count: logs.length },
                { v: "unreviewed", label: "Unreviewed", count: unreviewed },
                { v: "reviewed", label: "Reviewed", count: reviewed },
              ] as const
            ).map((s) => {
              const active = statusFilter === s.v;
              return (
                <button
                  key={s.v}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(s.v)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                    active ? "bg-primary-600 text-white shadow-sm" : "text-ink-soft hover:bg-cream"
                  )}
                >
                  {s.label}
                  <span className={active ? "text-primary-100" : "text-ink-faint"}>{s.count}</span>
                </button>
              );
            })}
          </div>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setQuery("");
              }}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-ink/15 bg-white px-2.5 text-[11.5px] font-bold text-ink-soft transition hover:border-red-300 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden />
              Clear
            </button>
          )}
        </div>
        <p className="px-4 py-2.5 text-[11.5px] font-medium text-ink-faint sm:px-5">
          {loading ? "Loading access events…" : `Showing ${visible.length} of ${logs.length} events.`}
          {filtersActive ? " Filters applied." : ""}
        </p>
      </section>

      {/* Timeline */}
      <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
        {loading ? (
          <div className="space-y-3 p-5" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-ink/10" />
            ))}
          </div>
        ) : groups.length ? (
          <div className="divide-y divide-ink/10">
            {groups.map((g) => (
              <div key={g.key}>
                <p className="sticky top-0 z-[1] border-b border-ink/5 bg-cream/50 px-5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-faint backdrop-blur">
                  {g.label}
                </p>
                <ul className="divide-y divide-ink/10 px-4 sm:px-5">
                  {g.items.map((l) => (
                    <EventRow
                      key={l.id}
                      log={l}
                      accessorName={names.get(l.accessor_profile_id)}
                      studentAlias={aliases.get(l.student_id)}
                      reviewerName={names.get(l.reviewed_by ?? "")}
                      busy={busyId === l.id}
                      variant="full"
                      onMarkReviewed={(log) => void markReviewed(log)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-primary-600 ring-1 ring-blue-100">
              <Search className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-bold text-ink">
              {logs.length ? "No events match these filters" : "No emergency accesses logged"}
            </p>
            <p className="mt-1 max-w-[320px] text-[12.5px] leading-relaxed text-ink-muted">
              {logs.length
                ? "Try clearing the search or picking another review status."
                : "Every break-glass reveal will appear here with its justification and reviewer."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
