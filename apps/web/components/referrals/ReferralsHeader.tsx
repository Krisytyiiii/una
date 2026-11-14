"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarCheck,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Inbox,
  Sparkles,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { useClampedPanel } from "@/components/shared/hover-menu";
import { cn } from "@/lib/utils";
import type { ReferralStats } from "./ReferralStats";
import { COUNSELOR_LEGEND, HEAD_LEGEND } from "./status";

/**
 * Page header — same structure as /appointments: role-aware hero, a "next
 * step" nudge, clickable stat cards (each applies its filter), and the
 * floating actions legend. Only the scope (referrals, not sessions) differs.
 */
export function ReferralsHeader({
  role,
  canSeeActions,
  loading,
  stats,
  statusFilter,
  assigneeFilter,
  onPickStatus,
  onPickUnassigned,
  onReset,
}: {
  role: string | null;
  canSeeActions: boolean;
  loading: boolean;
  stats: ReferralStats;
  statusFilter: string;
  assigneeFilter: string;
  onPickStatus: (s: string) => void;
  onPickUnassigned: () => void;
  onReset: () => void;
}) {
  const [legendOpen, setLegendOpen] = useState(false);
  const legendRef = useRef<HTMLDivElement>(null);
  const legendCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openLegend = () => { if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current); setLegendOpen(true); };
  const scheduleLegendClose = () => { if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current); legendCloseTimer.current = setTimeout(() => setLegendOpen(false), 150); };
  const toggleLegend = () => { if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current); setLegendOpen((v) => !v); };

  useEffect(() => {
    if (!legendOpen) return;
    const onPointerDown = (e: PointerEvent) => { if (legendRef.current && !legendRef.current.contains(e.target as Node)) setLegendOpen(false); };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setLegendOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current); };
  }, [legendOpen]);
  const legendPos = useClampedPanel(legendOpen, legendRef, 320, "right");

  const isHead = role === "guidance_head";
  const isCounselor = role === "counselor";
  const onAll = statusFilter === "all" && assigneeFilter !== "unassigned";
  const activeCount = stats.pending + stats.assigned + stats.confirmed;

  const statCards = [
    {
      key: "all",
      label: isCounselor ? "My referrals" : "All referrals",
      value: stats.total,
      hint: `${activeCount} active`,
      icon: Users,
      active: onAll,
      pick: onReset,
    },
    {
      key: "pending",
      label: "Pending",
      value: stats.pending,
      hint: "Awaiting triage",
      icon: Clock,
      active: statusFilter === "pending",
      pick: () => onPickStatus("pending"),
    },
    {
      key: "assigned",
      label: "Assigned",
      value: stats.assigned,
      hint: isCounselor ? "Needs confirming" : "With a counselor",
      icon: UserCheck,
      active: statusFilter === "assigned",
      pick: () => onPickStatus("assigned"),
    },
    {
      key: "confirmed",
      label: "Confirmed",
      value: stats.confirmed,
      hint: "Session scheduled",
      icon: CalendarCheck,
      active: statusFilter === "confirmed",
      pick: () => onPickStatus("confirmed"),
    },
    {
      key: "resolved",
      label: "Resolved",
      value: stats.resolved,
      hint: "Closed cases",
      icon: CheckCheck,
      active: statusFilter === "resolved",
      pick: () => onPickStatus("resolved"),
    },
    {
      key: "unassigned",
      label: "Unassigned",
      value: stats.unassigned,
      hint: "No counselor yet",
      icon: UserX,
      active: assigneeFilter === "unassigned",
      pick: onPickUnassigned,
    },
  ];

  // One clear "what should I do next" shortcut instead of making the user
  // scan the table to infer it. Head triages pending referrals; counselors
  // confirm what the head handed them.
  const focus =
    isHead && stats.pending > 0
      ? {
          label: `${stats.pending} referral${stats.pending === 1 ? "" : "s"} waiting for a counselor`,
          cta: "Review pending",
          pick: () => onPickStatus("pending"),
        }
      : isCounselor && stats.assigned > 0
        ? {
            label: `${stats.assigned} referral${stats.assigned === 1 ? "" : "s"} to confirm and schedule`,
            cta: "Review assigned",
            pick: () => onPickStatus("assigned"),
          }
        : isHead && stats.unassigned > 0
          ? {
              label: `${stats.unassigned} active referral${stats.unassigned === 1 ? "" : "s"} still unassigned`,
              cta: "Show unassigned",
              pick: onPickUnassigned,
            }
          : null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-200/40 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-accent-200/30 blur-2xl" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary-700">
            <Inbox className="h-3.5 w-3.5" aria-hidden />
            Guidance office
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
              {isCounselor ? "My referrals" : "Referrals"}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-primary-700">
              <UserCheck className="h-3 w-3" aria-hidden />
              {isHead ? "Guidance head" : isCounselor ? "Counselor view" : "Staff view"}
            </span>
          </div>
          <p className="mt-1.5 max-w-[620px] text-[13px] leading-relaxed text-ink-muted">
            {isHead
              ? "Triage incoming referrals, assign a counselor, and keep every case moving. Click any row for the full record."
              : "Confirm and schedule the referrals assigned to you, then resolve them once the session happens. Click any row for the full record."}
          </p>
        </div>

        {canSeeActions && (
          <div className="relative shrink-0" ref={legendRef} onMouseEnter={openLegend} onMouseLeave={scheduleLegendClose}>
            <button
              type="button"
              onClick={toggleLegend}
              onFocus={openLegend}
              onBlur={scheduleLegendClose}
              aria-haspopup="dialog"
              aria-expanded={legendOpen}
              className="inline-flex h-6 items-center gap-1.5 rounded-full border border-ink/10 bg-white/90 px-2.5 text-[12px] font-bold text-ink-soft shadow-card backdrop-blur transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              {isHead ? "Admin actions" : "Counselor actions"}
              <ChevronDown aria-hidden className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", legendOpen && "rotate-180")} />
            </button>
            {legendOpen && (
              <div role="dialog" aria-label={isHead ? "Admin actions legend" : "Counselor actions legend"} style={{ top: legendPos?.top, left: legendPos?.left, width: legendPos?.width ?? 320 }} className="fixed z-50 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-ink/10 bg-white px-4 py-3 shadow-card">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{isHead ? "Admin actions" : "Counselor actions"}</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {(isHead ? HEAD_LEGEND : COUNSELOR_LEGEND).map((l) => (
                    <li key={l.label} className="flex items-center gap-2 text-[13px]">
                      <span aria-hidden className={l.variant === "accent" ? "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-400 text-ink" : "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white text-ink"}>
                        <l.icon className="h-3.5 w-3.5" />
                      </span>
                      <span><span className="font-bold text-ink">{l.label}</span><span className="text-ink-muted"> · {l.desc}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Next-step nudge — dismisses itself when the queue is clear. */}
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
            onClick={focus.pick}
            className="inline-flex h-6 shrink-0 items-center gap-1 self-start rounded-full bg-accent-600 px-3 text-[11.5px] font-bold text-white shadow-soft transition hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 sm:self-auto"
          >
            {focus.cta}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      {/* Visible stats cards — click one to filter the table; active state shows. */}
      <div className="relative mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {statCards.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={s.pick}
            title={`Filter by ${s.label}`}
            aria-pressed={s.active}
            className={cn(
              "group rounded-xl border p-3 text-left shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
              s.active
                ? "border-primary-400 bg-primary-600 text-white ring-1 ring-primary-300"
                : "border-white/70 bg-white/75 backdrop-blur hover:border-primary-300 hover:bg-white"
            )}
          >
            <span className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em]", s.active ? "text-primary-100" : "text-ink-muted")}>
              <s.icon className={cn("h-3 w-3", s.active ? "text-white" : "text-primary-600")} aria-hidden />
              {s.label}
            </span>
            {loading ? (
              <span className={cn("mt-2 block h-7 w-10 animate-pulse rounded", s.active ? "bg-white/30" : "bg-ink/10")} aria-hidden />
            ) : (
              <span className="mt-1 block font-display text-xl font-bold leading-none tabular-nums">{s.value}</span>
            )}
            <span className={cn("mt-1 block truncate text-[10.5px]", s.active ? "text-primary-100" : "text-ink-faint")}>{s.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
