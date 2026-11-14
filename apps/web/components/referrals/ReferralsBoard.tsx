"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCheck,
  Clock,
  Eraser,
  Flame,
  Loader2,
  Search,
  SearchX,
  UserCog,
  X,
} from "lucide-react";
import { Button, Input } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import { HoverMenu } from "@/components/shared/hover-menu";
import { Pager } from "@/components/shared/Pager";
import { pageRange } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { FOCUS_RING, useFocusRow } from "@/lib/hooks/use-focus-row";
import {
  PRIORITIES,
  STATUSES,
  classificationSummary,
  isReferralAssignable,
  priorityBadgeClass,
  referralStudentName,
  statusBadgeClass,
  statusLabel,
  type Referral,
  type TriageKind,
} from "./status";
import { formatWhen, isSessionUpcoming, timeAgo } from "./format-helpers";
import type { ReferralStats } from "./ReferralStats";

/** Statuses with a meaningful count chip; terminal/legacy states stay selectable. */
const COUNTED_STATUSES = ["pending", "assigned", "confirmed", "resolved"] as const;

/** Compact labeled button — text first so nothing depends on icon recall. */
function ActionButton({
  variant,
  icon: Icon,
  onClick,
  disabled,
  children,
}: {
  variant: "accent" | "outline";
  icon: typeof Check;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={disabled}
      onClick={onClick}
      className="h-6 gap-1 rounded-full px-2.5 text-[11px]"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {children}
    </Button>
  );
}

function StepHint({
  icon: Icon,
  tone = "muted",
  children,
}: {
  icon: typeof Clock;
  tone?: "muted" | "accent" | "primary";
  children: ReactNode;
}) {
  const tones = {
    muted: "text-ink-faint",
    accent: "text-accent-700",
    primary: "text-primary-700",
  };
  return (
    <p className={cn("flex items-start gap-1.5 text-[11.5px] font-medium leading-snug", tones[tone])}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/**
 * Counselor "what to do next" cell — one plain sentence plus a clearly
 * labeled button, mirroring the appointments board.
 */
function CounselorNextStep({
  ref_,
  busy,
  upcoming,
  onConfirming,
  onReschedule,
}: {
  ref_: Referral;
  busy: boolean;
  upcoming: boolean;
  onConfirming: (ref: Referral, to: TriageKind) => void;
  onReschedule: (ref: Referral) => void;
}) {
  const act = (to: TriageKind) => onConfirming(ref_, to);

  if (ref_.status === "pending") {
    return <StepHint icon={Clock}>Waiting for the guidance head to assign this to you.</StepHint>;
  }

  if (ref_.status === "assigned") {
    return (
      <div className="space-y-1.5">
        <p className="text-[11.5px] leading-snug text-ink-muted">Confirm to set the final session date and time.</p>
        <div className="flex flex-wrap gap-1.5">
          <ActionButton variant="accent" icon={Check} disabled={busy} onClick={() => act("confirmed")}>
            Confirm &amp; schedule
          </ActionButton>
          <ActionButton variant="outline" icon={AlertTriangle} disabled={busy} onClick={() => act("escalated")}>
            Escalate
          </ActionButton>
        </div>
      </div>
    );
  }

  if (ref_.status === "confirmed") {
    if (upcoming) {
      return (
        <div className="space-y-1.5">
          <StepHint icon={Clock} tone="primary">Scheduled — nothing to do until the session happens.</StepHint>
          <ActionButton variant="outline" icon={CalendarClock} disabled={busy} onClick={() => onReschedule(ref_)}>
            Reschedule
          </ActionButton>
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        <StepHint icon={Clock} tone="accent">It&apos;s past the session time. What happened?</StepHint>
        <div className="flex flex-wrap gap-1.5">
          <ActionButton variant="accent" icon={CheckCheck} disabled={busy} onClick={() => act("resolved")}>
            Resolve case
          </ActionButton>
          <ActionButton variant="outline" icon={AlertTriangle} disabled={busy} onClick={() => act("escalated")}>
            Escalate
          </ActionButton>
        </div>
      </div>
    );
  }

  if (ref_.status === "escalated") {
    return (
      <div className="space-y-1.5">
        <StepHint icon={Flame} tone="accent">Flagged as urgent — resolve once the student is supported.</StepHint>
        <ActionButton variant="accent" icon={CheckCheck} disabled={busy} onClick={() => act("resolved")}>
          Resolve case
        </ActionButton>
      </div>
    );
  }

  if (ref_.status === "resolved" || ref_.status === "rejected") {
    return <StepHint icon={CheckCheck}>Closed — no action needed.</StepHint>;
  }

  // Legacy acknowledged / in_progress rows still exit via resolve or escalate.
  return (
    <div className="space-y-1.5">
      <StepHint icon={Clock} tone="primary">In progress — close it once the student is supported.</StepHint>
      <div className="flex flex-wrap gap-1.5">
        <ActionButton variant="accent" icon={CheckCheck} disabled={busy} onClick={() => act("resolved")}>
          Resolve case
        </ActionButton>
        <ActionButton variant="outline" icon={AlertTriangle} disabled={busy} onClick={() => act("escalated")}>
          Escalate
        </ActionButton>
      </div>
    </div>
  );
}

/**
 * Guidance-head "what to do next" cell — explains where assignment happens
 * and keeps the only in-row decisions (reject / reassign) clearly labeled.
 */
function HeadNextStep({
  ref_,
  busy,
  reassigning,
  canReject,
  onReassign,
  onConfirming,
}: {
  ref_: Referral;
  busy: boolean;
  /** True while this row's counselor dropdown is unlocked for reassignment. */
  reassigning: boolean;
  canReject: boolean;
  onReassign: () => void;
  onConfirming: (ref: Referral, to: TriageKind) => void;
}) {
  if (ref_.status === "pending") {
    return (
      <div className="space-y-1.5">
        <p className="text-[11.5px] leading-snug text-ink-muted">
          Choose a counselor in the <span className="font-semibold text-ink">Counselor</span> column to assign this referral.
        </p>
        {canReject && (
          <ActionButton
            variant="outline"
            icon={X}
            disabled={busy}
            onClick={() => onConfirming(ref_, "rejected")}
          >
            Reject referral
          </ActionButton>
        )}
      </div>
    );
  }

  if (ref_.status === "assigned") {
    return (
      <div className="space-y-1.5">
        <StepHint icon={Clock}>Waiting for the counselor to confirm a time.</StepHint>
        <ActionButton variant="outline" icon={UserCog} disabled={busy} onClick={onReassign}>
          {reassigning ? "Choose in Counselor column" : "Reassign"}
        </ActionButton>
        <p className="pl-5 text-[10.5px] leading-snug text-ink-faint">
          Assignment locks once the counselor confirms.
        </p>
      </div>
    );
  }

  if (ref_.status === "confirmed") {
    return <StepHint icon={CalendarClock} tone="primary">Scheduled — the counselor closes it after the session.</StepHint>;
  }

  if (ref_.status === "escalated") {
    return <StepHint icon={Flame} tone="accent">Escalated — the counselor resolves or reschedules this case.</StepHint>;
  }

  if (ref_.status === "resolved" || ref_.status === "rejected") {
    return <StepHint icon={CheckCheck}>Closed — no action needed.</StepHint>;
  }

  return <StepHint icon={Clock}>Waiting on the counselor&apos;s next move.</StepHint>;
}

/**
 * Referrals board — same chrome as /appointments: a filter bar (search,
 * status chips, priority chips, counselor menu, clear) and the table with a
 * "What to do next" column. Scope, columns, and lifecycle copy are referral
 * specific.
 */
export function ReferralsBoard({
  loading,
  fetching = false,
  role,
  visible,
  stats,
  totalApprox,
  page,
  size,
  hasMore,
  onPageChange,
  searchActive,
  aliases,
  escalatedAt,
  sessionSchedule,
  counselors,
  filters,
  busyId,
  canAssign,
  canReject,
  isCounselor,
  canSeeActions,
  counselorName,
  openMenuKey,
  setOpenMenuKey,
  onAssign,
  onDetails,
  onConfirming,
  onReschedule,
  onClearFilters,
}: {
  loading: boolean;
  /** A page/filter fetch is in flight over cached rows — show row skeletons. */
  fetching?: boolean;
  role: string | null;
  visible: Referral[];
  stats: ReferralStats;
  totalApprox: number;
  page: number;
  size: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
  /** Free-text search filters the loaded page only (structured filters are server-side). */
  searchActive: boolean;
  aliases: Map<string, string>;
  escalatedAt: Map<string, string>;
  /** Counselor-set session time per referral (confirm note / reschedules). */
  sessionSchedule: Map<string, string>;
  counselors: { id: string; name: string }[];
  // Filter state with plain setter signatures (the page wraps picks to reset
  // the pager; Dispatch setters satisfy this shape too).
  filters: {
    statusFilter: string;
    setStatusFilter: (s: string) => void;
    priorityFilter: string;
    setPriorityFilter: (p: string) => void;
    assigneeFilter: string;
    setAssigneeFilter: (a: string) => void;
    query: string;
    setQuery: (q: string) => void;
  };
  busyId: string | null;
  canAssign: boolean;
  canReject: boolean;
  isCounselor: boolean;
  canSeeActions: boolean;
  counselorName: (id: string | null) => string;
  openMenuKey: string | null;
  setOpenMenuKey: (k: string | null) => void;
  onAssign: (ref: Referral, counselorId: string) => void;
  onDetails: (ref: Referral) => void;
  onConfirming: (ref: Referral, to: TriageKind) => void;
  onReschedule: (ref: Referral) => void;
  onClearFilters: () => void;
}) {
  const {
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    assigneeFilter,
    setAssigneeFilter,
    query,
    setQuery,
  } = filters;

  const focusedId = useFocusRow(visible);
  // Assigned rows keep the counselor dropdown locked until the head explicitly
  // clicks "Reassign" in the next-step cell — same guard as /appointments.
  const [reassignId, setReassignId] = useState<string | null>(null);
  const filtersActive =
    query.trim() !== "" || statusFilter !== "all" || priorityFilter !== "all" || assigneeFilter !== "all";
  const range = pageRange(page, size, visible.length);

  const statusCount = (s: string): number => {
    if (s === "pending") return stats.pending;
    if (s === "assigned") return stats.assigned;
    if (s === "confirmed") return stats.confirmed;
    if (s === "resolved") return stats.resolved;
    return 0;
  };

  return (
    <>
      {/* Filter bar — search, status chips, priority chips, counselor, reset. */}
      <div className="border-b border-ink/10 bg-cream/20 px-4 py-3 sm:px-5">
        {/* Search gets its own row, pinned top-right — never mixed in with
            the status/priority tabs below. */}
        <div className="mb-2.5 flex justify-end">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
            <Input
              placeholder="Search alias or reason…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search referrals by alias, reason, or classification"
              className="h-8 pl-8"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex flex-wrap items-center gap-1 rounded-lg border border-ink/10 bg-white p-1"
            role="group"
            aria-label="Filter by status"
          >
            <button
              type="button"
              aria-pressed={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
              title="Show every referral status"
              className={
                statusFilter === "all"
                  ? "inline-flex h-7 items-center gap-1 rounded-md bg-primary-600 px-2.5 text-[11.5px] font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  : "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-bold text-ink-soft transition-colors hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              }
            >
              All
              <span className={statusFilter === "all" ? "text-primary-100" : "text-ink-faint"}>{stats.total}</span>
            </button>
            {STATUSES.map((s) => {
              const count = COUNTED_STATUSES.includes(s as (typeof COUNTED_STATUSES)[number]) ? statusCount(s) : 0;
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(s)}
                  title={`Show ${statusLabel(s).toLowerCase()}`}
                  className={
                    active
                      ? "inline-flex h-7 items-center gap-1 rounded-md bg-primary-600 px-2.5 text-[11.5px] font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                      : "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-bold text-ink-soft transition-colors hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  }
                >
                  {statusLabel(s)}
                  {count > 0 && <span className={active ? "text-primary-100" : "text-ink-faint"}>{count}</span>}
                </button>
              );
            })}
          </div>

          <div
            className="flex flex-wrap items-center gap-1 rounded-lg border border-ink/10 bg-white p-1"
            role="group"
            aria-label="Filter by priority"
          >
            {[{ value: "all", label: "All priorities" }, ...PRIORITIES.map((p) => ({ value: p, label: statusLabel(p) }))].map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={priorityFilter === p.value}
                onClick={() => setPriorityFilter(p.value)}
                className={
                  priorityFilter === p.value
                    ? "h-7 rounded-md bg-accent-400 px-2.5 text-[11.5px] font-bold text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    : "h-7 rounded-md px-2.5 text-[11.5px] font-bold text-ink-soft transition-colors hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                }
              >
                {p.label}
              </button>
            ))}
          </div>

          {role !== "counselor" && (
            <HoverMenu
              ariaLabel="Filter by counselor"
              align="right"
              buttonLabel={
                <>
                  {assigneeFilter === "all"
                    ? "All counselors"
                    : assigneeFilter === "unassigned"
                      ? "Unassigned"
                      : (counselors.find((c) => c.id === assigneeFilter)?.name ?? "All counselors")}
                </>
              }
              options={[
                { value: "all", label: "All counselors" },
                { value: "unassigned", label: "Unassigned only" },
                ...counselors.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={assigneeFilter}
              onPick={setAssigneeFilter}
            />
          )}

          {filtersActive && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-ink/15 bg-white px-2.5 text-[11.5px] font-bold text-ink-soft transition hover:border-red-300 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden />
              Clear
            </button>
          )}
        </div>

        <p className="mt-2 text-[11.5px] font-medium text-ink-faint">
          {loading || fetching ? (
            "Loading referrals…"
          ) : (
            <>
              Showing {range.start}–{range.end} of ~{totalApprox} referrals
              {searchActive ? " · search matches this page only" : ""} · aliases only · open a row for the full record.
            </>
          )}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm" aria-busy={loading || fetching}>
          <thead>
            <tr className="border-b border-ink/10 bg-cream/30 text-[11px] uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-2.5 font-bold">Filed</th>
              <th className="px-4 py-2.5 font-bold">Student</th>
              <th className="px-4 py-2.5 font-bold">Counselor</th>
              <th className="px-4 py-2.5 font-bold">Priority</th>
              <th className="px-4 py-2.5 font-bold">Status</th>
              {canSeeActions && <th className="px-4 py-2.5 font-bold">What to do next</th>}
            </tr>
          </thead>
          <tbody>
            {loading || fetching
              ? Array.from({ length: size }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-b border-ink/5 align-top last:border-0" aria-hidden>
                    <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-ink/10" /></td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-32 animate-pulse rounded bg-ink/10" />
                      <div className="mt-2 h-3 w-44 animate-pulse rounded bg-ink/5" />
                    </td>
                    <td className="px-4 py-3"><div className="h-4 w-28 animate-pulse rounded bg-ink/10" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-20 animate-pulse rounded-full bg-ink/10" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-20 animate-pulse rounded-full bg-ink/10" /></td>
                    {canSeeActions && (
                      <td className="px-4 py-3"><div className="h-6 w-28 animate-pulse rounded bg-ink/10" /></td>
                    )}
                  </tr>
                ))
              : visible.map((r) => {
                  const upcoming = isSessionUpcoming(sessionSchedule.get(r.id) ?? null);
                  const needsTriage = r.status === "pending" && isHeadRole(role);
                  const needsConfirm = r.status === "assigned" && isCounselor;
                  const accent = r.status === "escalated"
                    ? "border-l-rose-500"
                    : needsTriage
                      ? "border-l-primary-500"
                      : needsConfirm
                        ? "border-l-accent-500"
                        : "border-l-transparent";
                  const escalateAge = escalatedAt.get(r.id);
                  const alias = referralStudentName(r, aliases);
                  const assignEditable =
                    canAssign &&
                    isReferralAssignable(r.status) &&
                    (r.status === "pending" || !r.assigned_counselor_id || reassignId === r.id);
                  return (
                    <tr
                      key={r.id}
                      id={`focus-${r.id}`}
                      onClick={() => onDetails(r)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onDetails(r);
                        }
                      }}
                      tabIndex={0}
                      title="View referral details"
                      aria-label={`View details for the referral for ${alias}`}
                      className={`cursor-pointer border-b border-l-2 border-ink/5 align-top transition-colors last:border-0 hover:bg-cream/60 focus-visible:outline-none focus-visible:bg-cream ${accent} ${focusedId === r.id ? FOCUS_RING : ""}`}
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="block font-semibold text-ink">{timeAgo(r.created_at)}</span>
                        <span className="mt-1 block text-[11px] text-ink-faint">{formatWhen(r.created_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap items-center gap-1.5 font-medium">
                          {alias}
                          {!r.student_id && (
                            <span className="inline-flex items-center rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-bold text-ink-muted">
                              Walk-in
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 line-clamp-1 max-w-[300px] text-[11.5px] text-ink-faint" title={r.reason}>
                          {classificationSummary(r.case_classification)} · {r.reason}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {assignEditable ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Dropdown
                              menuKey={`assign-${r.id}`}
                              openMenuKey={openMenuKey}
                              onOpenChange={setOpenMenuKey}
                              value={r.assigned_counselor_id ?? ""}
                              onChange={(v) => {
                                setReassignId(null);
                                onAssign(r, v);
                              }}
                              ariaLabel={`Assign counselor for the referral for ${alias}`}
                              buttonClassName="max-w-[170px] rounded px-2.5 text-[13px]"
                              disabled={busyId === r.id}
                              options={[
                                { value: "", label: "Unassigned" },
                                ...counselors.map((c) => ({ value: c.id, label: c.name })),
                              ]}
                            />
                            {busyId === r.id && (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-faint" aria-label="Assigning counselor" />
                            )}
                          </span>
                        ) : (
                          <span className="whitespace-nowrap">{counselorName(r.assigned_counselor_id)}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={priorityBadgeClass(r.priority)}>{statusLabel(r.priority)}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                          {r.status === "escalated" && escalateAge && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                              Escalated {escalateAge}
                            </span>
                          )}
                        </span>
                      </td>
                      {canSeeActions && (
                        <td
                          className="px-4 py-3 align-top"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {isCounselor ? (
                            <CounselorNextStep
                              ref_={r}
                              busy={busyId === r.id}
                              upcoming={upcoming}
                              onConfirming={onConfirming}
                              onReschedule={onReschedule}
                            />
                          ) : (
                            <HeadNextStep
                              ref_={r}
                              busy={busyId === r.id}
                              reassigning={reassignId === r.id}
                              canReject={canReject}
                              onReassign={() => setReassignId((current) => (current === r.id ? null : r.id))}
                              onConfirming={onConfirming}
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {!loading && !visible.length && (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-primary-600 ring-1 ring-blue-100">
            <SearchX className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-bold text-ink">No referrals match these filters</p>
          <p className="mt-1 max-w-[320px] text-[12.5px] leading-relaxed text-ink-muted">
            {filtersActive
              ? "Try clearing the search or choosing another status — nothing is hidden permanently."
              : "New referrals from faculty and the office will land here as soon as they're filed."}
          </p>
          {filtersActive && (
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 text-[12px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden />
              Clear filters
            </button>
          )}
        </div>
      )}

      <Pager page={page} size={size} totalApprox={totalApprox} hasMore={hasMore} onPage={onPageChange} busy={loading || fetching} />
    </>
  );
}

/** Role helper kept local so the accent logic reads cleanly. */
function isHeadRole(role: string | null): boolean {
  return role === "guidance_head";
}
