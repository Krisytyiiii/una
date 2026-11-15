"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileSpreadsheet,
  Inbox,
  MapPin,
  Send,
  ShieldAlert,
  UserRoundCheck,
  Video,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_REFERRALS_SCOPE, useReferralsBoard } from "@/lib/hooks/use-referrals-board";
import { Button, Card } from "@/components/ui/primitives";
import { IconAction } from "@/components/shared/icon-action";
import { PageSize, Pager } from "@/components/shared/Pager";
import { Panel, PanelEmpty, MetricCard } from "@/components/shared/dashboard/primitives";
import { ReferralExcelModal } from "@/components/referrals/ReferralExcelModal";
import { ReferralFormModal } from "@/components/referrals/ReferralFormModal";
import { ReferralTrackingModal } from "@/components/referrals/ReferralTrackingModal";
import { useClampedPanel } from "@/components/shared/hover-menu";
import {
  classificationSummary,
  priorityBadgeClass,
  referralStudentName,
  statusBadgeClass,
  statusLabel,
  type RefAction,
  type Referral,
} from "@/components/referrals/status";
import {
  formatSessionMode,
  formatWhen,
  hasReschedule,
  latestSessionSchedule,
  parseScheduleNote,
  parseSessionMode,
  timeAgo,
} from "@/components/referrals/format-helpers";

const EMPTY_MAP = new Map<string, string>();
const EMPTY_IDS: string[] = [];
const EMPTY_TRAIL: Map<string, RefAction[]> = new Map();
const EMPTY_STATS = { total: 0, pending: 0, assigned: 0, confirmed: 0, resolved: 0, unassigned: 0 };

/**
 * What-happens-next help — opens on hover or click, top-right of the page.
 * Same floating-panel behavior as the notification bell (viewport-clamped,
 * outside-click / Escape to dismiss).
 */
function WhatNextMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pos = useClampedPanel(open, ref, 300, "right");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const peek = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  const toggle = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0" onMouseEnter={peek} onMouseLeave={hide}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex h-6 items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 text-[11.5px] font-bold text-ink-soft transition hover:border-primary-300 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        What happens next?
        <ChevronDown
          aria-hidden
          className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      {open && pos && (
        <div
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="fixed z-50 rounded-xl border border-ink/10 bg-white p-4 shadow-card"
        >
          <p className="text-sm font-bold text-ink">What happens next?</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
            The head assigns a counselor, the counselor confirms a session, then resolves the
            case. Follow every step under{" "}
            <Link href="/referrals" className="font-bold text-primary-700 hover:underline">
              Referrals
            </Link>{" "}
            or your{" "}
            <Link href="/dashboard" className="font-bold text-primary-700 hover:underline">
              Dashboard
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}

/** One step in the "how a referral moves" rail. */
function Step({
  index,
  icon: Icon,
  title,
  body,
  last = false,
}: {
  index: number;
  icon: LucideIcon;
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && (
        <span
          aria-hidden
          className="absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-px bg-ink/10"
        />
      )}
      <span className="relative z-10 mt-0.5 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border border-primary-200 bg-primary-50 text-primary-700">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-[12.5px] font-bold leading-tight text-ink">
          <span className="mr-1.5 tabular-nums text-ink-faint">{index}.</span>
          {title}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">{body}</p>
      </div>
    </li>
  );
}

/**
 * Faculty-only /refer-student — the dedicated referral submission page.
 * The form files an academic / behavioral / relational concern with the
 * Guidance Office; tracking lives on /referrals and the dashboard. Kept as
 * its own route so the faculty referral flow can grow here later.
 */
export default function ReferStudentPage() {
  // Sent history pages through the faculty member's own filings, newest first,
  // using the same cursor-backed pager as /referrals.
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const { data: board, isLoading, isFetching, refetch } = useReferralsBoard({
    ...DEFAULT_REFERRALS_SCOPE,
    page,
    size,
  });
  const role = board?.role ?? null;
  const loading = isLoading && !board;
  const [excelOpen, setExcelOpen] = useState(false);
  const [formRef, setFormRef] = useState<Referral | null>(null);
  const [trackRef, setTrackRef] = useState<Referral | null>(null);

  // Counselor-set session time + mode per referral. The confirm trail note
  // carries the first schedule and every later reschedule overrides it
  // (faculty cannot read appointments via RLS — the trail is the channel).
  // Unconfirmed referrals simply show "—".
  const trail = board?.trail ?? (EMPTY_TRAIL as Map<string, RefAction[]>);
  const sessionSchedule = useMemo(() => {
    const m = new Map<string, string>();
    for (const [refId, actions] of trail) {
      const iso = latestSessionSchedule(actions, null);
      if (iso) m.set(refId, iso);
    }
    return m;
  }, [trail]);
  const sessionMode = useMemo(() => {
    const m = new Map<string, "in_person" | "online">();
    for (const [refId, actions] of trail) {
      const confirm = actions.find((a) => a.action === "confirmed" && parseScheduleNote(a.note));
      const mode = confirm ? parseSessionMode(confirm.note) : null;
      if (mode) m.set(refId, mode);
    }
    return m;
  }, [trail]);

  // Server stats (RLS-scoped status RPC) — for faculty these aggregate only
  // their own filings, so the strip below is "my referrals · all time".
  const stats = board?.stats ?? EMPTY_STATS;
  const withOffice = stats.assigned + stats.confirmed;
  const otherCount = Math.max(0, stats.total - stats.pending - withOffice - stats.resolved);
  const pipelineTotal = Math.max(1, stats.total);
  const pipeline = [
    { key: "pending", label: "Pending triage", count: stats.pending, dot: "bg-amber-400", bar: "bg-amber-400" },
    { key: "office", label: "With the office", count: withOffice, dot: "bg-sky-400", bar: "bg-sky-400" },
    { key: "resolved", label: "Resolved", count: stats.resolved, dot: "bg-emerald-400", bar: "bg-emerald-400" },
    { key: "other", label: "Escalated / rejected", count: otherCount, dot: "bg-ink/25", bar: "bg-ink/25" },
  ].filter((s) => s.count > 0);

  if (!loading && role !== "faculty") {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Refer a student</h1>
        <Card className="rounded-xl">
          <p className="text-sm text-ink-muted">Only faculty can file student referrals.</p>
        </Card>
      </div>
    );
  }

  const rows = board?.rows ?? [];
  const aliases = board?.aliases ?? EMPTY_MAP;

  return (
    <div className="space-y-5">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 border-b border-ink/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary-600">
            Faculty referral desk
          </p>
          <h1 className="mt-1 font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Refer a student
          </h1>
          <p className="mt-1 max-w-[620px] text-[12.5px] leading-relaxed text-ink-muted">
            Flag a student with an observed academic, behavioral, or relational concern — the
            Guidance Office triages every submission and you&apos;re notified as it moves.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <WhatNextMenu />
          <Button onClick={() => setExcelOpen(true)} className="gap-1.5">
            <Send className="h-3.5 w-3.5" aria-hidden />
            Fill up referral form
          </Button>
        </div>
      </div>

      {/* ── My referral metrics ──────────────────────────────────────── */}
      <section aria-labelledby="refer-student-stats-heading">
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="refer-student-stats-heading"
            className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-muted"
          >
            My referrals · all time
          </h2>
          <span className="text-[10.5px] font-medium text-ink-faint">
            Live counts — everything you&apos;ve filed
          </span>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[108px] animate-pulse rounded-xl border border-ink/10 bg-white/70"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="My referrals"
              value={stats.total}
              icon={Inbox}
              hint="Cases I flagged"
              href="/referrals"
            />
            <MetricCard
              label="Pending triage"
              value={stats.pending}
              icon={CalendarClock}
              hint="Waiting for the office"
              href="/referrals"
              emphasis
            />
            <MetricCard
              label="With the office"
              value={withOffice}
              icon={UserRoundCheck}
              hint="Assigned → session confirmed"
              href="/referrals"
            />
            <MetricCard
              label="Resolved"
              value={stats.resolved}
              icon={CheckCircle2}
              hint="Closed by a counselor"
              href="/reports"
            />
          </div>
        )}
      </section>

      {/* ── History + side rail ──────────────────────────────────────── */}
      <div className="grid items-start gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <Panel
            title="My sent referrals"
            hint="Newest first — open a row to track it."
            viewAllHref="/referrals"
            bodyClassName="p-0"
          >
            {loading ? (
              <div className="space-y-2 p-5" aria-hidden>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-ink/10" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream text-primary-600">
                  <FileSpreadsheet className="h-5 w-5" aria-hidden />
                </span>
                <p className="mt-3 text-[13px] font-bold text-ink">No referrals sent yet</p>
                <p className="mt-1 max-w-[300px] text-[11.5px] leading-relaxed text-ink-muted">
                  Fill up the official referral form and it will list here with everything the
                  Guidance Office does next.
                </p>
                <Button onClick={() => setExcelOpen(true)} className="mt-4 gap-1.5">
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  Fill up referral form
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink/[0.07] bg-cream/40 text-[10px] uppercase tracking-[0.09em] text-ink-muted">
                        <th className="whitespace-nowrap px-5 py-2.5 font-bold">Student &amp; concern</th>
                        <th className="whitespace-nowrap px-3 py-2.5 font-bold">Priority</th>
                        <th className="whitespace-nowrap px-3 py-2.5 font-bold">Classification</th>
                        <th className="whitespace-nowrap px-3 py-2.5 font-bold">Status</th>
                        <th className="whitespace-nowrap px-3 py-2.5 font-bold">Session</th>
                        <th className="whitespace-nowrap px-3 py-2.5 font-bold">Sent</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const when = sessionSchedule.get(r.id);
                        const mode = sessionMode.get(r.id) ?? null;
                        const rescheduled = hasReschedule(trail.get(r.id) ?? []);
                        const openTracker = () => setTrackRef(r);
                        const alias = referralStudentName(r, aliases);
                        return (
                          <tr
                            key={r.id}
                            tabIndex={0}
                            aria-label={`Track referral for ${alias}`}
                            onClick={openTracker}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openTracker();
                              }
                            }}
                            className="group cursor-pointer border-b border-ink/[0.06] align-middle transition-colors last:border-0 hover:bg-cream/50 focus-visible:bg-cream/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300"
                          >
                            <td className="px-5 py-3">
                              <p className="text-[12.5px] font-bold leading-tight text-ink group-hover:text-primary-700">
                                {alias}
                              </p>
                              <p className="mt-0.5 line-clamp-1 max-w-[320px] text-[11.5px] leading-relaxed text-ink-muted">
                                {r.reason}
                              </p>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              <span className={priorityBadgeClass(r.priority)}>
                                {statusLabel(r.priority)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 ring-1 ring-inset ring-blue-100">
                                {classificationSummary(r.case_classification)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              <span className={statusBadgeClass(r.status)}>
                                {statusLabel(r.status)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              {when ? (
                                <span className="inline-flex flex-col items-start gap-1">
                                  <span className="text-[12px] font-semibold text-ink">
                                    {formatWhen(when)}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted">
                                    {mode === "online" ? (
                                      <Video className="h-3 w-3" aria-hidden />
                                    ) : mode === "in_person" ? (
                                      <MapPin className="h-3 w-3" aria-hidden />
                                    ) : null}
                                    {formatSessionMode(mode)}
                                    {rescheduled && (
                                      <span className="ml-0.5 rounded-full bg-accent-100 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider text-accent-700">
                                        Rescheduled
                                      </span>
                                    )}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-[12px] font-medium text-ink-faint">—</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-[11.5px] font-medium text-ink-faint">
                              {timeAgo(r.created_at)}
                            </td>
                            <td
                              className="whitespace-nowrap px-3 py-3"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-end gap-1.5">
                                <IconAction
                                  label="View sent form"
                                  variant="outline"
                                  icon={Eye}
                                  onClick={() => setFormRef(r)}
                                />
                                <IconAction
                                  label="Track referral"
                                  variant="accent"
                                  icon={Activity}
                                  onClick={() => setTrackRef(r)}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-0 flex flex-wrap items-center justify-between gap-3 border-t border-ink/[0.07] px-5 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-[11.5px] font-medium text-ink-muted">
                      Page {board?.page ?? page} · showing {rows.length} of ~{board?.totalApprox ?? 0} sent
                      referral{(board?.totalApprox ?? 0) === 1 ? "" : "s"}
                    </p>
                    <PageSize
                      value={size}
                      onChange={(next) => {
                        setPage(1);
                        setSize(next);
                      }}
                      disabled={isFetching}
                    />
                  </div>
                  <Pager
                    page={board?.page ?? page}
                    size={board?.size ?? size}
                    totalApprox={board?.totalApprox ?? 0}
                    hasMore={board?.hasMore ?? false}
                    onPage={setPage}
                    busy={isFetching && !isLoading}
                  />
                </div>
              </>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <Panel title="Referral pipeline" hint="Where your filed cases sit right now.">
            {stats.total === 0 ? (
              <PanelEmpty
                icon={Inbox}
                title="Nothing filed yet"
                hint="Your first referral will start the pipeline here."
              />
            ) : (
              <div className="space-y-4">
                <div
                  className="flex h-2.5 w-full overflow-hidden rounded-full bg-cream"
                  role="img"
                  aria-label={pipeline.map((s) => `${s.label}: ${s.count}`).join(", ")}
                >
                  {pipeline.map((s) => (
                    <span
                      key={s.key}
                      title={`${s.label}: ${s.count}`}
                      className={cn("h-full transition-all", s.bar)}
                      style={{ width: `${(s.count / pipelineTotal) * 100}%` }}
                    />
                  ))}
                </div>
                <ul className="space-y-2">
                  {pipeline.map((s) => (
                    <li key={s.key} className="flex items-center gap-2.5">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", s.dot)} aria-hidden />
                      <span className="flex-1 truncate text-[12px] font-medium text-ink-soft">
                        {s.label}
                      </span>
                      <span className="font-display text-[13px] font-bold tabular-nums text-ink">
                        {s.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <Panel title="How a referral moves" hint="Every step is visible in your tracker.">
            <ol className="mt-1">
              <Step
                index={1}
                icon={FileSpreadsheet}
                title="You file the form"
                body="Fill the official sheet once — submit it or keep an Excel/PDF copy."
              />
              <Step
                index={2}
                icon={UserRoundCheck}
                title="The head assigns a counselor"
                body="Urgent and high cases are triaged first."
              />
              <Step
                index={3}
                icon={CalendarClock}
                title="The counselor confirms a session"
                body="Date, time, and mode appear on your sent list."
              />
              <Step
                index={4}
                icon={CheckCircle2}
                title="The case is resolved"
                body="You're notified at each move — no need to follow up."
                last
              />
            </ol>
            <Link
              href="/referrals"
              className="mt-4 inline-flex items-center gap-1 text-[11.5px] font-bold text-primary-600 transition hover:text-primary-700 hover:underline"
            >
              Open the full tracker
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </Panel>

          <div className="rounded-xl border border-accent-200 bg-accent-50/70 p-4">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-accent-700 shadow-[0_1px_2px_rgba(16,24,40,0.06)]">
                <ShieldAlert className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-bold text-ink">Someone in crisis?</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">
                  Don&apos;t wait for triage — use an emergency reveal to reach the student now.
                </p>
                <Link
                  href="/emergency"
                  className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-bold text-accent-700 hover:underline"
                >
                  Open emergency access
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Official-form fill-up flow (template unchanged). */}
      <ReferralExcelModal
        open={excelOpen}
        myName={board?.myName ?? "Faculty"}
        facultyId={board?.facultyId ?? null}
        headIds={board?.headIds ?? EMPTY_IDS}
        onSubmitted={() => {
          setPage(1);
          refetch().catch(() => {});
        }}
        onClose={() => setExcelOpen(false)}
      />
      <ReferralFormModal
        referral={formRef}
        referrerName={board?.myName ?? ""}
        onClose={() => setFormRef(null)}
      />
      <ReferralTrackingModal
        referral={trackRef}
        alias={trackRef ? referralStudentName(trackRef, aliases) : ""}
        counselorName={
          trackRef?.assigned_counselor_id
            ? ((board?.counselors ?? []).find((c) => c.id === trackRef.assigned_counselor_id)?.name ??
              "Counselor")
            : "Unassigned — waiting for head"
        }
        sessionIso={trackRef ? (sessionSchedule.get(trackRef.id) ?? null) : null}
        sessionMode={trackRef ? (sessionMode.get(trackRef.id) ?? null) : null}
        trail={trackRef ? (trail.get(trackRef.id) ?? []) : []}
        actorNames={board?.actorNames ?? EMPTY_MAP}
        onClose={() => setTrackRef(null)}
      />
    </div>
  );
}
