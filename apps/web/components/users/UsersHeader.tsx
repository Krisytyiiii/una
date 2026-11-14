"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CheckCheck,
  Clock,
  ShieldCheck,
  Sparkles,
  UserCog,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UsersStats } from "@/lib/hooks/use-users-board";

/**
 * UsersHeader — access-control hero for the admin user directory.
 * Stats double as filters (same language as /appointments), and a single
 * "review pending" nudge surfaces the one queue that actually needs action.
 */
export function UsersHeader({
  loading,
  stats,
  roleFilter,
  statusFilter,
  onStatusFilter,
  onRoleFilter,
  onReset,
}: {
  loading: boolean;
  stats: UsersStats;
  roleFilter: string;
  statusFilter: string;
  onStatusFilter: (v: string) => void;
  onRoleFilter: (v: string) => void;
  onReset: () => void;
}) {
  const cards = [
    {
      key: "all",
      label: "All accounts",
      hint: "Everyone in the directory",
      value: stats.total,
      icon: Users,
      active: roleFilter === "all" && statusFilter === "all",
      pick: onReset,
    },
    {
      key: "active",
      label: "Active",
      hint: "Can sign in now",
      value: stats.active,
      icon: CheckCheck,
      active: statusFilter === "active",
      pick: () => onStatusFilter("active"),
    },
    {
      key: "pending",
      label: "Pending approval",
      hint: "Waiting on you",
      value: stats.pending,
      icon: Clock,
      active: statusFilter === "pending",
      pick: () => onStatusFilter("pending"),
    },
    {
      key: "inactive",
      label: "Deactivated",
      hint: "Access switched off",
      value: stats.inactive,
      icon: UserX,
      active: statusFilter === "inactive",
      pick: () => onStatusFilter("inactive"),
    },
    {
      key: "staff",
      label: "Staff",
      hint: "Counselors, heads, faculty",
      value: stats.staff,
      icon: UserCog,
      active: roleFilter === "staff",
      pick: () => onRoleFilter("staff"),
    },
    {
      key: "new",
      label: "New this week",
      hint: "Created in the last 7 days",
      value: stats.newWeek,
      icon: Sparkles,
      active: false,
      pick: null,
    },
  ] as const;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-200/40 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-accent-200/30 blur-2xl"
      />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary-700">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Guidance office · Access control
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">User directory</h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-primary-700">
              <UserCog className="h-3 w-3" aria-hidden />
              Guidance head
            </span>
          </div>
          <p className="mt-1.5 max-w-[640px] text-[13px] leading-relaxed text-ink-muted">
            Approve new accounts, check roles, and switch access on or off. Changes take effect at
            the next sign-in — records stay intact either way.
          </p>
        </div>

        <Link
          href="/users/new"
          className="inline-flex h-6 shrink-0 items-center gap-1.5 self-start rounded-full bg-primary-600 px-3 text-[12px] font-bold text-white shadow-soft transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          Add staff
          <ArrowUpRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
        </Link>
      </div>

      {/* Next-step nudge — disappears as soon as the approval queue is clear. */}
      {!loading && stats.pending > 0 && (
        <div className="relative mt-4 flex flex-col gap-2.5 rounded-xl border border-accent-300 bg-accent-50/80 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-200 text-accent-700">
              <Clock className="h-3.5 w-3.5" aria-hidden />
            </span>
            <p className="text-[12.5px] font-semibold text-ink">
              {stats.pending} account{stats.pending === 1 ? "" : "s"} waiting for approval
              <span className="ml-1.5 hidden font-medium text-ink-muted sm:inline">
                — approve them so they can finish setup.
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onStatusFilter("pending")}
            className="inline-flex h-6 shrink-0 items-center gap-1 self-start rounded-full bg-accent-600 px-3 text-[11.5px] font-bold text-white shadow-soft transition hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 sm:self-auto"
          >
            Review pending
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      {/* Clickable stats — each card filters the directory; active card is filled. */}
      <div className="relative mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((s) => {
          const content = (
            <>
              <span
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em]",
                  s.active ? "text-primary-100" : "text-ink-muted"
                )}
              >
                <s.icon
                  className={cn("h-3 w-3", s.active ? "text-white" : "text-primary-600")}
                  aria-hidden
                />
                {s.label}
              </span>
              {loading ? (
                <span
                  className={cn(
                    "mt-2 block h-7 w-10 animate-pulse rounded",
                    s.active ? "bg-white/30" : "bg-ink/10"
                  )}
                  aria-hidden
                />
              ) : (
                <span className="mt-1 block font-display text-xl font-bold leading-none tabular-nums">
                  {s.value}
                </span>
              )}
              <span
                className={cn(
                  "mt-1 block truncate text-[10.5px]",
                  s.active ? "text-primary-100" : "text-ink-faint"
                )}
              >
                {s.hint}
              </span>
            </>
          );
          const base =
            "group rounded-xl border p-3 text-left shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400";
          return s.pick ? (
            <button
              key={s.key}
              type="button"
              onClick={s.pick}
              title={`Filter by ${s.label}`}
              aria-pressed={s.active}
              className={cn(
                base,
                s.active
                  ? "border-primary-400 bg-primary-600 text-white ring-1 ring-primary-300"
                  : "border-white/70 bg-white/75 backdrop-blur hover:border-primary-300 hover:bg-white"
              )}
            >
              {content}
            </button>
          ) : (
            <div
              key={s.key}
              className={cn(base, "border-white/70 bg-white/60 backdrop-blur")}
            >
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
