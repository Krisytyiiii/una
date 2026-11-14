"use client";

import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  FileText,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Users,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuickFilter } from "./types";

export type StudentStats = {
  total: number;
  withUpcoming: number;
  withOpenRefs: number;
  highStress: number;
  newMonth: number;
  programs: number;
  needsAttention: number;
  neverBooked: number;
};

type StatCard = {
  key: QuickFilter;
  label: string;
  value: number;
  hint: string;
  icon: typeof Users;
  /** Emphasis treatment for risk-bearing tiles. */
  tone?: "accent" | "danger";
};

/**
 * Students hero — role-aware copy, a privacy note, a "start here" nudge, and
 * clickable stat tiles. Each tile applies its quick filter (pressed state is
 * announced with aria-pressed, and clicking the active tile clears it).
 */
export function StudentsHeader({
  role,
  loading,
  stats,
  quickFilter,
  onQuickFilter,
}: {
  role: string | null;
  loading: boolean;
  stats: StudentStats;
  quickFilter: QuickFilter;
  onQuickFilter: (f: QuickFilter) => void;
}) {
  const isCounselor = role === "counselor";

  const cards: StatCard[] = [
    { key: "all", label: "Students", value: stats.total, hint: isCounselor ? "On my caseload" : "In the directory", icon: Users },
    { key: "attention", label: "Needs attention", value: stats.needsAttention, hint: "Urgent or unsupported", icon: AlertTriangle, tone: "danger" },
    { key: "high", label: "High stress", value: stats.highStress, hint: "Latest screening", icon: HeartPulse, tone: "accent" },
    { key: "referrals", label: "Open referrals", value: stats.withOpenRefs, hint: "In progress", icon: FileText },
    { key: "upcoming", label: "Upcoming", value: stats.withUpcoming, hint: "Session booked", icon: CalendarClock },
    { key: "never", label: "Never booked", value: stats.neverBooked, hint: "No sessions yet", icon: UserX },
  ];

  // One clear next action instead of making the user infer it from the tiles.
  const focus =
    stats.needsAttention > 0
      ? {
          label: `${stats.needsAttention} student${stats.needsAttention === 1 ? "" : "s"} need a closer look`,
          cta: "Review now",
          pick: "attention" as QuickFilter,
        }
      : stats.neverBooked > 0
        ? {
            label: `${stats.neverBooked} student${stats.neverBooked === 1 ? "" : "s"} have never booked a session`,
            cta: "Show never booked",
            pick: "never" as QuickFilter,
          }
        : null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-200/40 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-accent-200/30 blur-2xl" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary-700">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Guidance office
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
              {isCounselor ? "My students" : "Students"}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-primary-700">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              {role === "counselor" ? "Counselor view" : role === "guidance_head" ? "Guidance head view" : "Staff view"}
            </span>
          </div>
          <p className="mt-1.5 max-w-[640px] text-[13px] leading-relaxed text-ink-muted">
            {isCounselor
              ? "Your caseload — students from your sessions, assigned referrals, and chats. Aliases only, with each student's load with you."
              : "The full alias-level directory with workload, referral, and screening signals. Open a student for the full record."}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-ink-faint">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-primary-500" aria-hidden />
              Privacy-safe: aliases only
            </span>
            <span aria-hidden>·</span>
            <span>{stats.programs} program{stats.programs === 1 ? "" : "s"}</span>
            <span aria-hidden>·</span>
            <span>{stats.newMonth} new this month</span>
          </div>
        </div>
      </div>

      {/* Next-step nudge — disappears when there is nothing pending. */}
      {!loading && focus && (
        <div className="relative mt-4 flex flex-col gap-2.5 rounded-xl border border-accent-300 bg-accent-50/80 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-200 text-accent-700">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            </span>
            <p className="text-[12.5px] font-semibold text-ink">
              {focus.label}
              <span className="ml-1.5 hidden font-medium text-ink-muted sm:inline">— start here.</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onQuickFilter(focus.pick)}
            className="inline-flex h-6 shrink-0 items-center gap-1 self-start rounded-full bg-accent-600 px-3 text-[11.5px] font-bold text-white shadow-soft transition hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 sm:self-auto"
          >
            {focus.cta}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      {/* Clickable stat tiles — each is a quick filter. */}
      <div className="relative mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((s) => {
          const active = quickFilter === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onQuickFilter(active && s.key !== "all" ? "all" : s.key)}
              title={active && s.key !== "all" ? "Clear this filter" : `Filter: ${s.label}`}
              aria-pressed={active}
              className={cn(
                "group rounded-xl border p-3 text-left shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                active
                  ? "border-primary-400 bg-primary-600 text-white ring-1 ring-primary-300"
                  : "border-white/70 bg-white/75 backdrop-blur hover:-translate-y-0.5 hover:border-primary-300 hover:bg-white"
              )}
            >
              <span
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em]",
                  active ? "text-primary-100" : "text-ink-muted"
                )}
              >
                <s.icon
                  className={cn(
                    "h-3 w-3",
                    active
                      ? "text-white"
                      : s.tone === "danger"
                        ? "text-accent-700"
                        : s.tone === "accent"
                          ? "text-accent-600"
                          : "text-primary-600"
                  )}
                  aria-hidden
                />
                {s.label}
              </span>
              {loading ? (
                <span className={cn("mt-2 block h-7 w-10 animate-pulse rounded", active ? "bg-white/30" : "bg-ink/10")} aria-hidden />
              ) : (
                <span className="mt-1 block font-display text-xl font-bold leading-none tabular-nums">{s.value}</span>
              )}
              <span className={cn("mt-1 block truncate text-[10.5px]", active ? "text-primary-100" : "text-ink-faint")}>
                {s.hint}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
