"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCheck,
  Clock,
  Eraser,
  FileText,
  Loader2,
  Search,
  SearchX,
  UserCog,
  UserX,
  Video,
  X,
} from "lucide-react";
import { Button, Input } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import { HoverMenu } from "@/components/shared/hover-menu";
import { Pager } from "@/components/shared/Pager";
import { pageRange } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { FOCUS_RING, useFocusRow } from "@/lib/hooks/use-focus-row";
import { fmtHours, slotMinutes } from "@/lib/availability";
import type { BoardSlot } from "@/lib/hooks/use-appointments-board";
import { toISODate, slotWindowsForDate } from "./SlotSchedulePicker";
import { formatWhen, isUpcomingSession, statusBadgeClass, statusLabel, STATUSES } from "./status";
import type { ActionKind, Appt, CounselorOpt } from "./status";

/**
 * Does a session timestamp fall inside one of the counselor's published
 * availability windows? Used only to flag planning conflicts — the confirm
 * picker still enforces the scope on the way into the database.
 */
function isWithinAvailability(slots: BoardSlot[], iso: string): boolean {
  if (!slots.length) return true;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return true;
  const mins = d.getHours() * 60 + d.getMinutes();
  return slotWindowsForDate(slots, toISODate(d)).some((w) => mins >= w.start && mins < w.end);
}

/** Tone classes for the availability meta badges (mirrors /availability). */
const META_TONES: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  primary: "bg-primary-50 text-primary-700 ring-primary-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

/** Compact availability summary shown above the counselor's queue. */
function AvailabilityStrip({ slots }: { slots: BoardSlot[] }) {
  const minutes = slots.reduce((a, s) => a + slotMinutes(s), 0);
  const days = new Set(slots.map((s) => s.weekday)).size;

  if (!slots.length) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 sm:px-5">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-900">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          No availability set — you can&apos;t confirm a session until you publish a window.
        </p>
        <Link
          href="/availability"
          className="inline-flex h-7 items-center rounded-lg bg-amber-600 px-2.5 text-[11.5px] font-bold text-white transition hover:bg-amber-700"
        >
          Set availability
        </Link>
      </div>
    );
  }

  const badges = [
    {
      key: "windows",
      icon: CalendarClock,
      label: `${slots.length} window${slots.length === 1 ? "" : "s"}`,
      hint: "Published bookable windows in your weekly schedule.",
      tone: "primary",
    },
    {
      key: "hours",
      icon: Clock,
      label: `${fmtHours(minutes)}/week`,
      hint: "Total bookable time across all windows.",
      tone: "violet",
    },
    {
      key: "days",
      icon: CalendarDays,
      label: `${days}/7 days`,
      hint: "Days with at least one published window.",
      tone: days === 7 ? "emerald" : days === 0 ? "rose" : "sky",
    },
  ] as const;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 bg-cream/40 px-4 py-2.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-ink-soft">
          <CalendarCheck className="h-3.5 w-3.5 text-primary-600" aria-hidden />
          Your availability
        </span>
        {badges.map((b) => (
          <Tooltip
            key={b.key}
            content={b.hint}
            align="start"
            className={cn(
              "inline-flex cursor-default items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ring-inset",
              META_TONES[b.tone]
            )}
          >
            <b.icon className="h-3 w-3" aria-hidden />
            {b.label}
          </Tooltip>
        ))}
      </div>
      <Link
        href="/availability"
        className="text-[11.5px] font-bold text-primary-700 hover:underline"
      >
        Manage availability
      </Link>
    </div>
  );
}

/** Local-day comparison — "Today" chip and overdue accent. */
function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

/** Statuses with a meaningful count chip; terminal states stay selectable. */
const PRIMARY_STATUSES = ["pending", "assigned", "confirmed", "completed"] as const;

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
  children: React.ReactNode;
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
  children: React.ReactNode;
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
 * labeled button. No icon-only controls, no lifecycle jargon.
 */
function CounselorNextStep({
  appt,
  busy,
  upcoming,
  outsideAvailability,
  onConfirming,
  onNotes,
}: {
  appt: Appt;
  busy: boolean;
  upcoming: boolean;
  /** The current session time is not inside this counselor's availability. */
  outsideAvailability: boolean;
  onConfirming: (v: { appt: Appt; kind: ActionKind }) => void;
  onNotes: (appt: Appt) => void;
}) {
  const act = (kind: ActionKind) => onConfirming({ appt, kind });

  if (appt.status === "pending") {
    return <StepHint icon={Clock}>Waiting for the guidance head to assign this to you.</StepHint>;
  }

  if (appt.status === "assigned") {
    return (
      <div className="space-y-1.5">
        <p className="text-[11.5px] leading-snug text-ink-muted">
          {outsideAvailability
            ? "Requested time is outside your availability — confirming lets you pick a window that fits."
            : "Confirm to set the final date and time."}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <ActionButton variant="accent" icon={Check} disabled={busy} onClick={() => act("confirm")}>
            Confirm &amp; schedule
          </ActionButton>
          <ActionButton variant="outline" icon={CalendarClock} disabled={busy} onClick={() => act("reschedule")}>
            Other time
          </ActionButton>
        </div>
      </div>
    );
  }

  if (appt.status === "confirmed") {
    if (upcoming) {
      return (
        <div className="space-y-1.5">
          <StepHint icon={Clock} tone={outsideAvailability ? "accent" : "primary"}>
            {outsideAvailability
              ? "Scheduled outside your current availability — reschedule it into a slot."
              : "Scheduled — nothing to do until the session happens."}
          </StepHint>
          <ActionButton variant="outline" icon={CalendarClock} disabled={busy} onClick={() => act("reschedule")}>
            Reschedule
          </ActionButton>
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        <StepHint icon={Clock} tone="accent">
          It&apos;s past the session time. What happened?
        </StepHint>
        <div className="flex flex-wrap gap-1.5">
          <ActionButton variant="accent" icon={CheckCheck} disabled={busy} onClick={() => act("complete")}>
            Held — complete
          </ActionButton>
          <ActionButton variant="outline" icon={UserX} disabled={busy} onClick={() => act("no-show")}>
            Student didn&apos;t show
          </ActionButton>
        </div>
      </div>
    );
  }

  if (appt.status === "completed") {
    return (
      <ActionButton variant="outline" icon={FileText} disabled={busy} onClick={() => onNotes(appt)}>
        Open session notes
      </ActionButton>
    );
  }

  return <StepHint icon={CheckCheck}>Closed — no action needed.</StepHint>;
}

/**
 * Guidance-head "what to do next" cell — explains where assignment happens
 * and keeps the only in-row action (reject) clearly labeled.
 */
function HeadNextStep({
  appt,
  busy,
  reassigning,
  onReassign,
  onConfirming,
  onNotes,
}: {
  appt: Appt;
  busy: boolean;
  /** True while this row's counselor dropdown is unlocked for reassignment. */
  reassigning: boolean;
  onReassign: () => void;
  onConfirming: (v: { appt: Appt; kind: ActionKind }) => void;
  onNotes: (appt: Appt) => void;
}) {
  if (appt.status === "pending") {
    return (
      <div className="space-y-1.5">
        <p className="text-[11.5px] leading-snug text-ink-muted">
          Choose a counselor in the <span className="font-semibold text-ink">Counselor</span> column to assign this request.
        </p>
        <ActionButton
          variant="outline"
          icon={X}
          disabled={busy}
          onClick={() => onConfirming({ appt, kind: "reject" })}
        >
          Reject request
        </ActionButton>
      </div>
    );
  }

  if (appt.status === "assigned") {
    return (
      <div className="space-y-1.5">
        <StepHint icon={Clock}>Waiting for the counselor to confirm a time.</StepHint>
        <ActionButton variant="outline" icon={UserCog} disabled={busy} onClick={onReassign}>
          {reassigning ? "Choose in Counselor column" : "Reassign"}
        </ActionButton>
        <p className="pl-5 text-[10.5px] leading-snug text-ink-faint">
          To decline, set the counselor back to Unassigned first.
        </p>
      </div>
    );
  }

  if (appt.status === "confirmed") {
    return (
      <StepHint icon={CalendarClock} tone="primary">
        Scheduled — the counselor closes it after the session.
      </StepHint>
    );
  }

  if (appt.status === "completed") {
    return (
      <ActionButton variant="outline" icon={FileText} disabled={busy} onClick={() => onNotes(appt)}>
        View session notes
      </ActionButton>
    );
  }

  return <StepHint icon={CheckCheck}>Closed — no action needed.</StepHint>;
}

/**
 * Board — a sticky-feeling filter bar and the student table. Every filter is
 * a visible control (no buried menus) so the current view is always obvious.
 */
export function AppointmentsBoard({
  visible,
  loading,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  modeFilter,
  setModeFilter,
  counselorFilter,
  setCounselorFilter,
  counselors,
  slots,
  aliases,
  role,
  busyId,
  canAssign,
  isCounselor,
  canSeeActions,
  counselorName,
  openMenuKey,
  setOpenMenuKey,
  onAssign,
  onDetail,
  onConfirming,
  onNotes,
  onClearFilters,
  statusCounts,
  kindFilter = "appointments",
  page,
  size,
  totalApprox,
  hasMore,
  onPageChange,
}: {
  visible: Appt[];
  loading: boolean;
  query: string;
  setQuery: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  modeFilter: string;
  setModeFilter: (v: string) => void;
  counselorFilter: string;
  setCounselorFilter: (v: string) => void;
  counselors: CounselorOpt[];
  /** Counselor's own availability windows (empty for the head). */
  slots: BoardSlot[];
  aliases: Map<string, string>;
  role: string | null;
  busyId: string | null;
  canAssign: boolean;
  canReject: boolean;
  isCounselor: boolean;
  canSeeActions: boolean;
  counselorName: (id: string | null) => string;
  openMenuKey: string | null;
  setOpenMenuKey: (k: string | null) => void;
  onAssign: (appt: Appt, counselorId: string | null) => void;
  onDetail: (appt: Appt) => void;
  onConfirming: (v: { appt: Appt; kind: ActionKind }) => void;
  /** Open the private session-notes record (completed sessions, counselor/head). */
  onNotes: (appt: Appt) => void;
  /** Reset every structured filter + the text search. */
  onClearFilters: () => void;
  statusCounts: { pending: number; assigned: number; confirmed: number; completed: number };
  /** Active board tab — tailors the empty state. */
  kindFilter?: "appointments" | "followups";
  page: number;
  size: number;
  totalApprox: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}) {
  const focusedId = useFocusRow(visible);
  // Assigned rows keep the counselor dropdown locked until the head explicitly
  // clicks "Reassign" in the next-step cell — prevents accidental reassignment
  // from a stray click in the Counselor column.
  const [reassignId, setReassignId] = useState<string | null>(null);
  const filtersActive =
    query.trim() !== "" || statusFilter !== "active" || modeFilter !== "all" || counselorFilter !== "all";
  const range = pageRange(page, size, visible.length);

  return (
    <>
      {/* Filter bar — search, status chips, mode + counselor, reset. */}
      <div className="border-b border-ink/10 bg-cream/20 px-4 py-3 sm:px-5">
        {/* Search gets its own row, pinned top-right — never mixed in with
            the status/mode tabs below. */}
        <div className="mb-2.5 flex justify-end">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
            <Input
              placeholder="Search alias or concern…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search appointments by alias or concern"
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
                aria-pressed={statusFilter === "active"}
                onClick={() => setStatusFilter("active")}
                title="Show only sessions that still need action"
                className={
                  statusFilter === "active"
                    ? "inline-flex h-7 items-center gap-1 rounded-md bg-primary-600 px-2.5 text-[11.5px] font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    : "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-bold text-ink-soft transition-colors hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                }
              >
                Active
                <span className={statusFilter === "active" ? "text-primary-100" : "text-ink-faint"}>
                  {statusCounts.pending + statusCounts.assigned + statusCounts.confirmed}
                </span>
              </button>
              {STATUSES.map((s) => {
                const count =
                  PRIMARY_STATUSES.includes(s as (typeof PRIMARY_STATUSES)[number])
                    ? statusCounts[s as keyof typeof statusCounts]
                    : 0;
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
                    {count > 0 && (
                      <span className={active ? "text-primary-100" : "text-ink-faint"}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div
              className="flex rounded-lg border border-ink/10 bg-white p-1"
              role="group"
              aria-label="Filter by session mode"
            >
              {[
                { value: "all", label: "All modes" },
                { value: "in_person", label: "In person" },
                { value: "online", label: "Online" },
              ].map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={modeFilter === m.value}
                  onClick={() => setModeFilter(m.value)}
                  className={
                    modeFilter === m.value
                      ? "h-7 rounded-md bg-accent-400 px-2.5 text-[11.5px] font-bold text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                      : "h-7 rounded-md px-2.5 text-[11.5px] font-bold text-ink-soft transition-colors hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>

            {role !== "counselor" && (
              <HoverMenu
                ariaLabel="Filter by counselor"
                align="right"
                buttonLabel={
                  <>
                    {counselorFilter === "all"
                      ? "All counselors"
                      : counselorFilter === "unassigned"
                        ? "Unassigned"
                        : (counselors.find((c) => c.id === counselorFilter)?.name ?? "All counselors")}
                  </>
                }
                options={[
                  { value: "all", label: "All counselors" },
                  { value: "unassigned", label: "Unassigned only" },
                  ...counselors.map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={counselorFilter}
                onPick={setCounselorFilter}
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
          {loading ? (
            "Loading appointments…"
          ) : (
            <>
              Showing {range.start}–{range.end} of ~{totalApprox}{" "}
              {kindFilter === "followups" ? "follow-up sessions" : "sessions"}
              {query.trim() ? " · search matches this page only" : ""} · open a row for the full record (including the concern).
            </>
          )}
        </p>
      </div>

      {isCounselor && <AvailabilityStrip slots={slots} />}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm" aria-busy={loading}>
          <thead>
            <tr className="border-b border-ink/10 bg-cream/30 text-[11px] uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-2.5 font-bold">When</th>
              <th className="px-4 py-2.5 font-bold">Student</th>
              <th className="px-4 py-2.5 font-bold">Counselor</th>
              <th className="px-4 py-2.5 font-bold">Mode</th>
              <th className="px-4 py-2.5 font-bold">Status</th>
              {canSeeActions && <th className="px-4 py-2.5 font-bold">What to do next</th>}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: size }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-b border-ink/5 align-top last:border-0" aria-hidden>
                    <td className="px-4 py-3"><div className="h-4 w-28 animate-pulse rounded bg-ink/10" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-ink/10" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-28 animate-pulse rounded bg-ink/10" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 animate-pulse rounded bg-ink/10" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-20 animate-pulse rounded-full bg-ink/10" /></td>
                    {canSeeActions && (
                      <td className="px-4 py-3"><div className="h-6 w-24 animate-pulse rounded bg-ink/10" /></td>
                    )}
                  </tr>
                ))
              : visible.map((a) => {
                  const upcoming = isUpcomingSession(a.scheduled_at);
                  const today = isToday(a.scheduled_at);
                  const needsOutcome = a.status === "confirmed" && !upcoming;
                  const needsTriage = a.status === "pending" && role === "guidance_head";
                  const outsideAvailability =
                    isCounselor &&
                    (a.status === "assigned" || a.status === "confirmed") &&
                    !isWithinAvailability(slots, a.scheduled_at);
                  const accent = needsOutcome
                    ? "border-l-accent-500"
                    : needsTriage
                      ? "border-l-primary-500"
                      : outsideAvailability
                        ? "border-l-amber-400"
                        : "border-l-transparent";
                  return (
                    <tr
                      key={a.id}
                      id={`focus-${a.id}`}
                      onClick={() => onDetail(a)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onDetail(a);
                        }
                      }}
                      tabIndex={0}
                      title="View session details"
                      aria-label={`View details for the session on ${formatWhen(a.scheduled_at)}`}
                      className={`cursor-pointer border-b border-l-2 border-ink/5 align-top transition-colors last:border-0 hover:bg-cream/60 focus-visible:outline-none focus-visible:bg-cream ${accent} ${focusedId === a.id ? FOCUS_RING : ""}`}
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="block font-semibold text-ink">{formatWhen(a.scheduled_at)}</span>
                        {(today || needsOutcome) && (
                          <span className="mt-1 inline-flex items-center gap-1">
                            {today && (
                              <span className="inline-flex items-center rounded-full bg-primary-50 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-primary-700">
                                Today
                              </span>
                            )}
                            {needsOutcome && (
                              <span className="inline-flex items-center rounded-full bg-accent-100 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-accent-700">
                                Needs outcome
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium">
                        {a.student_id ? (
                          (aliases.get(a.student_id) ?? "Student")
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-bold text-ink-muted">
                            Walk-in
                          </span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {canAssign &&
                        (a.status === "pending" || a.status === "assigned") &&
                        (a.status === "pending" || !a.counselor_id || reassignId === a.id) ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Dropdown
                              menuKey={`assign-${a.id}`}
                              openMenuKey={openMenuKey}
                              onOpenChange={setOpenMenuKey}
                              value={a.counselor_id ?? ""}
                              onChange={(v) => {
                                setReassignId(null);
                                onAssign(a, v || null);
                              }}
                              ariaLabel={`Assign counselor for session ${formatWhen(a.scheduled_at)}`}
                              buttonClassName="max-w-[170px] rounded px-2.5 text-[13px]"
                              disabled={busyId === a.id}
                              options={[
                                { value: "", label: "Unassigned" },
                                ...counselors.map((c) => ({
                                  value: c.id,
                                  label: c.available ? c.name : `${c.name} · paused`,
                                  disabled: !c.available,
                                })),
                              ]}
                            />
                            {busyId === a.id && (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-faint" aria-label="Assigning counselor" />
                            )}
                          </span>
                        ) : (
                          <span className="whitespace-nowrap">{counselorName(a.counselor_id)}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-ink-soft">
                          {a.mode === "online" ? (
                            <Video className="h-3.5 w-3.5 text-primary-600" aria-hidden />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
                          )}
                          {a.mode === "online" ? "Online" : "In person"}
                        </span>
                        {a.mode === "online" && a.meeting_url && (
                          <a
                            href={a.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 flex w-fit items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 transition-colors hover:bg-blue-200"
                            aria-label={`Join the Google Meet for the session on ${formatWhen(a.scheduled_at)}`}
                          >
                            <Video className="h-3 w-3" aria-hidden />
                            Join Meet
                          </a>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <span className={statusBadgeClass(a.status)}>{statusLabel(a.status)}</span>
                          {a.is_follow_up && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                              Follow-up
                            </span>
                          )}
                          {outsideAvailability && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-inset ring-amber-200"
                              title="This time is outside the counselor's current availability windows."
                            >
                              <Clock className="h-3 w-3" aria-hidden />
                              Outside availability
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
                              appt={a}
                              busy={busyId === a.id}
                              upcoming={upcoming}
                              outsideAvailability={outsideAvailability}
                              onConfirming={onConfirming}
                              onNotes={onNotes}
                            />
                          ) : (
                            <HeadNextStep
                              appt={a}
                              busy={busyId === a.id}
                              reassigning={reassignId === a.id}
                              onReassign={() =>
                                setReassignId((current) => (current === a.id ? null : a.id))
                              }
                              onConfirming={onConfirming}
                              onNotes={onNotes}
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
          <p className="mt-3 text-sm font-bold text-ink">
            {kindFilter === "followups" ? "No follow-up sessions here" : "No sessions match these filters"}
          </p>
          <p className="mt-1 max-w-[320px] text-[12.5px] leading-relaxed text-ink-muted">
            {kindFilter === "followups"
              ? "Document a follow-up from a completed session's notes and it will appear here."
              : filtersActive
                ? "Try clearing the search or choosing another status — nothing is hidden permanently."
                : "New student requests will land here as soon as they're booked."}
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

      <Pager page={page} size={size} totalApprox={totalApprox} hasMore={hasMore} onPage={onPageChange} busy={loading} />
    </>
  );
}
