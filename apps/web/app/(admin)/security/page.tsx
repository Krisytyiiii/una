"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { breakGlassSchema, type BreakGlassInput } from "@dorsu/shared-schemas";
import { actionPolicy, type AppAction } from "@dorsu/shared-services";
import { useSecurityBoard } from "@/lib/hooks/use-security-board";
import { useClearSectionBadge } from "@/lib/hooks/use-clear-section-badge";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  KeyRound,
  ListFilter,
  Loader2,
  Lock,
  Minus,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  UserX,
  X,
} from "lucide-react";
import { timeAgo } from "@/lib/format";
import { Button, Card, FieldError, Input, Textarea } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import { EventRow, type GlassLog } from "@/components/security/EventRow";
import { notifyStaff } from "@/lib/notify";
import { cn } from "@/lib/utils";

type AuditRow = {
  id: string;
  actor_profile_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const EMPTY_LOGS: GlassLog[] = [];
const EMPTY_AUDIT: AuditRow[] = [];
const EMPTY_MAP = new Map<string, string>();
const EMPTY_STUDENTS: { id: string; label: string }[] = [];
const EMPTY_COUNTS = new Map<string, number>();
const EMPTY_IDS: string[] = [];

const MATRIX_ROLES = ["student", "counselor", "guidance_head", "faculty"] as const;
const MATRIX_ROLE_LABEL: Record<string, string> = {
  student: "Student",
  counselor: "Counselor",
  guidance_head: "Head",
  faculty: "Faculty",
};

/** Starting points for the mandatory justification — edited, never submitted verbatim. */
const JUSTIFICATION_TEMPLATES = [
  {
    label: "Imminent risk",
    text: "Student reported imminent risk of self-harm; record opened to coordinate an emergency response.",
  },
  {
    label: "After-hours crisis",
    text: "After-hours crisis call requiring immediate access to the case record for safety planning.",
  },
  {
    label: "Legal obligation",
    text: "Access required to comply with a lawful order; scope limited to the named student's record.",
  },
];

/**
 * Head-only security console — break-glass oversight, audit trail, access matrix.
 */
export default function SecurityPage() {
  const { data: board, isLoading, isError, refetch } = useSecurityBoard();
  const logs = board?.logs ?? EMPTY_LOGS;
  const audit = board?.audit ?? EMPTY_AUDIT;
  const names = board?.names ?? EMPTY_MAP;
  const aliases = board?.aliases ?? EMPTY_MAP;
  const students = board?.students ?? EMPTY_STUDENTS;
  const roleCounts = board?.roleCounts ?? EMPTY_COUNTS;
  const deactivated = board?.deactivated ?? 0;
  const me = board?.me ?? null;
  const headIds = board?.headIds ?? EMPTY_IDS;
  const loading = isLoading && !board;
  // Visiting the section clears its sidebar badge (badges count unread
  // notification rows, not page views).
  useClearSectionBadge("/security", !loading && !!board);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [studentPick, setStudentPick] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<"all" | "unreviewed" | "reviewed">("all");
  const [matrixQuery, setMatrixQuery] = useState("");
  const [matrixRole, setMatrixRole] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef<HTMLDivElement>(null);
  const auditRef = useRef<HTMLDivElement>(null);
  const matrixRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, formState, reset, setValue, watch } = useForm<BreakGlassInput>({
    resolver: zodResolver(breakGlassSchema),
  });
  const justification = watch("justification") ?? "";

  useEffect(() => {
    if (isError) toast.error("Couldn't load security data right now.");
  }, [isError]);

  const unreviewed = useMemo(() => logs.filter((l) => !l.reviewed_at), [logs]);

  const eventTabs = useMemo(
    () => [
      { value: "all" as const, label: "All", count: logs.length },
      { value: "unreviewed" as const, label: "Unreviewed", count: unreviewed.length },
      { value: "reviewed" as const, label: "Reviewed", count: logs.length - unreviewed.length },
    ],
    [logs.length, unreviewed.length]
  );

  const visibleEvents = useMemo(() => {
    const rows =
      eventFilter === "all"
        ? logs
        : eventFilter === "unreviewed"
          ? logs.filter((l) => !l.reviewed_at)
          : logs.filter((l) => !!l.reviewed_at);
    return rows.slice(0, 4);
  }, [logs, eventFilter]);

  const actions = useMemo(() => Object.keys(actionPolicy) as AppAction[], []);
  const filteredActions = useMemo(() => {
    const q = matrixQuery.trim().toLowerCase();
    return q ? actions.filter((a) => a.toLowerCase().includes(q)) : actions;
  }, [actions, matrixQuery]);

  const scrollTo = (ref: { current: HTMLDivElement | null }) =>
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const logAccess = handleSubmit(async (v) => {
    if (!me) return;
    setBusyId("__new__");
    try {
      const res = await fetch("/api/staff/security/log-break-glass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: v.studentId, justification: v.justification }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Couldn't log that access.");
      reset();
      setStudentPick("");
      await refetch();
      toast.success("Emergency access logged and audited.");
      await notifyStaff(headIds.filter((id) => id !== me), {
        type: "system",
        title: "Emergency access logged",
        body: `${names.get(me) ?? "Staff"} opened a restricted record with justification on file.`,
        link: "/security",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't log that access.");
    } finally {
      setBusyId(null);
    }
  });

  const markReviewed = async (log: GlassLog) => {
    if (!me) return;
    setBusyId(log.id);
    try {
      const res = await fetch("/api/staff/security/review-break-glass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: log.id }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Couldn't record the review.");
      await refetch();
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

  const reviewQueue = () => {
    setEventFilter("unreviewed");
    scrollTo(eventsRef);
  };

  const statCards: {
    label: string;
    value: number;
    icon: typeof ShieldCheck;
    hint: string;
    tone: "primary" | "accent" | "danger";
    pick: (() => void) | null;
  }[] = [
    {
      label: "Emergency accesses",
      value: logs.length,
      icon: KeyRound,
      hint: "Break-glass opens on record",
      tone: "primary",
      pick: () => {
        setEventFilter("all");
        scrollTo(eventsRef);
      },
    },
    {
      label: "Awaiting review",
      value: unreviewed.length,
      icon: Clock,
      hint: unreviewed.length ? "Head sign-off needed" : "All reviewed",
      tone: unreviewed.length ? "danger" : "primary",
      pick: reviewQueue,
    },
    {
      label: "Audit events",
      value: audit.length,
      icon: ScrollText,
      hint: "Append-only ledger",
      tone: "accent",
      pick: () => scrollTo(auditRef),
    },
    {
      label: "Deactivated",
      value: deactivated,
      icon: UserX,
      hint: "Accounts disabled",
      tone: "primary",
      pick: null,
    },
  ];

  const navItems = [
    { label: "Log access", icon: KeyRound, ref: formRef },
    { label: "Access events", icon: Clock, ref: eventsRef, badge: unreviewed.length },
    { label: "Audit trail", icon: ScrollText, ref: auditRef },
    { label: "Permissions", icon: Lock, ref: matrixRef },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Hero — oversight posture, review nudge, and clickable KPIs. */}
      <section className="relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-200/40 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-accent-200/30 blur-2xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary-700">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Security &amp; oversight
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Security</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-primary-700">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                Head only
              </span>
            </div>
            <p className="mt-1.5 max-w-[620px] text-[13px] leading-relaxed text-ink-muted">
              Emergency access oversight, the append-only audit trail, and who is allowed to do what — every reveal
              leaves a record.
            </p>
          </div>

          {/* Review posture — the one number this page is about. */}
          <div
            className={cn(
              "shrink-0 self-start rounded-xl border px-4 py-3 shadow-card",
              unreviewed.length
                ? "border-red-200 bg-red-50/80"
                : "border-white/70 bg-white/85 backdrop-blur"
            )}
          >
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
              <Clock className="h-3 w-3" aria-hidden /> Review queue
            </p>
            {loading ? (
              <div className="mt-2 h-8 w-16 animate-pulse rounded bg-ink/10" aria-hidden />
            ) : (
              <>
                <div className="mt-1 flex items-end gap-1.5">
                  <span
                    className={cn(
                      "font-display text-3xl font-bold leading-none",
                      unreviewed.length ? "text-red-700" : "text-ink"
                    )}
                  >
                    {unreviewed.length}
                  </span>
                  <span className="pb-0.5 text-[12px] font-semibold text-ink-faint">
                    / {logs.length} accesses
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-ink/10">
                  <div
                    className={cn("h-full rounded-full transition-all", unreviewed.length ? "bg-red-500" : "bg-primary-500")}
                    style={{ width: `${logs.length ? Math.round((unreviewed.length / logs.length) * 100) : 0}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] font-medium text-ink-faint">
                  {unreviewed.length ? "Unreviewed — needs a head sign-off" : "Every access is reviewed"}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Next-step nudge — self-dismissing when the queue is clear. */}
        {!loading && (
          <div
            className={cn(
              "relative mt-4 flex flex-col gap-2.5 rounded-xl border px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between",
              unreviewed.length ? "border-red-200 bg-red-50/80" : "border-primary-200 bg-primary-50/70"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  unreviewed.length ? "bg-red-200 text-red-700" : "bg-primary-200 text-primary-700"
                )}
              >
                {unreviewed.length ? <Clock className="h-3.5 w-3.5" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
              </span>
              <p className="text-[12.5px] font-semibold text-ink">
                {unreviewed.length
                  ? `${unreviewed.length} emergency access${unreviewed.length === 1 ? "" : "es"} still need${unreviewed.length === 1 ? "s" : ""} review`
                  : logs.length
                    ? "All emergency accesses are reviewed — nothing waiting"
                    : "No emergency accesses logged yet — the queue is clear"}
              </p>
            </div>
            {unreviewed.length > 0 && (
              <button
                type="button"
                onClick={reviewQueue}
                className="inline-flex h-6 shrink-0 items-center gap-1 self-start rounded-full bg-red-600 px-3 text-[11.5px] font-bold text-white shadow-soft transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 sm:self-auto"
              >
                Review now
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        )}

        {/* KPI cards — review + events jump straight to the log. */}
        <div className="relative mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {statCards.map((s) => {
            const toneShell =
              s.tone === "danger"
                ? "border-red-200 bg-red-50/70"
                : s.tone === "accent"
                  ? "border-accent-200 bg-accent-50/60"
                  : "border-white/70 bg-white/75 backdrop-blur";
            const body = (
              <>
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                  <s.icon
                    className={cn(
                      "h-3 w-3",
                      s.tone === "danger" ? "text-red-600" : s.tone === "accent" ? "text-accent-600" : "text-primary-600"
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
                      s.tone === "danger" && s.value > 0 ? "text-red-700" : "text-ink"
                    )}
                  >
                    {s.value}
                  </span>
                )}
                <span className="mt-1 flex items-center justify-between gap-1 text-[10.5px] text-ink-faint">
                  <span className="truncate">{s.hint}</span>
                  {s.pick && <ArrowRight className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-100" aria-hidden />}
                </span>
              </>
            );
            const shell = cn("group rounded-xl border p-3 text-left shadow-card transition", toneShell);
            return s.pick ? (
              <button
                key={s.label}
                type="button"
                onClick={s.pick}
                className={cn(shell, "hover:border-primary-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400")}
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

      {/* Sticky section nav — jump straight to any part of the console. */}
      <nav
        aria-label="Security sections"
        className="sticky top-2 z-20 flex flex-wrap items-center gap-1 rounded-xl border border-ink/10 bg-white/90 p-1 shadow-card backdrop-blur"
      >
        {navItems.map((n) => (
          <button
            key={n.label}
            type="button"
            onClick={() => scrollTo(n.ref)}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[12px] font-bold text-ink-muted transition hover:bg-cream hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 sm:flex-none"
          >
            <n.icon className="h-3.5 w-3.5" aria-hidden />
            {n.label}
            {!!n.badge && n.badge > 0 && (
              <span className="rounded-full bg-red-100 px-1.5 text-[10.5px] font-bold text-red-700">{n.badge}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Break-glass form + access events preview */}
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <div ref={formRef} className="scroll-mt-20">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                  <KeyRound className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-ink">Log emergency access</h2>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">
                    Break-glass opens a restricted record now and audits it automatically — justification required.
                  </p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[10.5px] font-bold text-accent-700">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                Audited
              </span>
            </div>

            <form className="mt-4 space-y-3" onSubmit={logAccess}>
              <div>
                <label className="mb-1 block text-xs font-bold text-ink-muted">Student</label>
                <Dropdown
                  menuKey="glass-student"
                  openMenuKey={openMenuKey}
                  onOpenChange={setOpenMenuKey}
                  value={studentPick}
                  onChange={(val) => {
                    setStudentPick(val);
                    setValue("studentId", val, { shouldValidate: true });
                  }}
                  ariaLabel="Student for emergency access"
                  options={students.map((s) => ({ value: s.id, label: s.label }))}
                />
                <FieldError message={formState.errors.studentId?.message} />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-ink-muted">Emergency justification</label>
                  <span
                    className={cn(
                      "text-[10.5px] font-bold tabular-nums",
                      justification.trim().length >= 20 ? "text-primary-600" : "text-ink-faint"
                    )}
                  >
                    {justification.trim().length}/20 min
                  </span>
                </div>
                {/* Template chips — a fast, editable starting point. */}
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {JUSTIFICATION_TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setValue("justification", t.text, { shouldValidate: true })}
                      className="inline-flex h-6 items-center gap-1 rounded-full border border-ink/15 bg-cream px-2 text-[10.5px] font-bold text-ink-soft transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                      <Sparkles className="h-2.5 w-2.5" aria-hidden />
                      {t.label}
                    </button>
                  ))}
                </div>
                <Textarea
                  rows={3}
                  placeholder="Why must this record be opened right now?"
                  {...register("justification")}
                />
                <FieldError message={formState.errors.justification?.message} />
              </div>

              <div className="flex flex-col gap-2 rounded-lg bg-cream/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-1 text-[11px] font-medium text-ink-faint">
                  <Lock className="h-3 w-3" aria-hidden />
                  This action is audited and cannot be undone.
                </p>
                <Button disabled={busyId === "__new__"} className="shrink-0 gap-2">
                  {busyId === "__new__" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {busyId === "__new__" ? "Logging…" : "Log access"}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div ref={eventsRef} className="scroll-mt-20">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                  <Clock className="h-4 w-4 text-primary-600" aria-hidden />
                  Access events
                </h2>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">
                  Latest events — filter the queue, then mark reviewed.
                </p>
              </div>
              {!loading && unreviewed.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-800">
                  <Clock className="h-3 w-3" aria-hidden />
                  {unreviewed.length} unreviewed
                </span>
              )}
            </div>

            {/* Queue filter chips */}
            <div className="mt-3 flex flex-wrap items-center gap-1 rounded-lg border border-ink/10 bg-cream/30 p-1" role="group" aria-label="Filter access events">
              {eventTabs.map((t) => {
                const active = eventFilter === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setEventFilter(t.value)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                      active ? "bg-primary-600 text-white shadow-sm" : "text-ink-soft hover:bg-white"
                    )}
                  >
                    {t.label}
                    <span className={active ? "text-primary-100" : "text-ink-faint"}>{t.count}</span>
                  </button>
                );
              })}
            </div>

            {loading ? (
              <div className="mt-3 space-y-3" aria-hidden>
                <div className="h-16 animate-pulse rounded-lg bg-ink/10" />
                <div className="h-16 animate-pulse rounded-lg bg-ink/10" />
              </div>
            ) : visibleEvents.length ? (
              <ul className="mt-2 divide-y divide-ink/10">
                {visibleEvents.map((l) => (
                  <EventRow
                    key={l.id}
                    log={l}
                    accessorName={names.get(l.accessor_profile_id)}
                    studentAlias={aliases.get(l.student_id)}
                    reviewerName={names.get(l.reviewed_by ?? "")}
                    busy={busyId === l.id}
                    variant="preview"
                    onMarkReviewed={(log) => void markReviewed(log)}
                  />
                ))}
              </ul>
            ) : (
              <div className="mt-3 flex flex-col items-center justify-center rounded-xl bg-cream/60 px-4 py-8 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                  {eventFilter === "unreviewed" ? <Check className="h-5 w-5" aria-hidden /> : <ShieldCheck className="h-5 w-5" aria-hidden />}
                </span>
                <p className="mt-2 text-[13px] font-bold text-ink">
                  {eventFilter === "unreviewed"
                    ? "Nothing awaiting review"
                    : eventFilter === "reviewed"
                      ? "No reviewed events yet"
                      : "No emergency accesses logged"}
                </p>
                <p className="mt-0.5 max-w-[280px] text-[12px] text-ink-muted">
                  {eventFilter === "unreviewed"
                    ? "Every access in the log has a head sign-off."
                    : "Every break-glass reveal will appear here with its justification."}
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3">
              <p className="text-[11px] font-medium text-ink-faint">
                Showing {visibleEvents.length} of {eventFilter === "all" ? logs.length : eventFilter === "unreviewed" ? unreviewed.length : logs.length - unreviewed.length}
              </p>
              <Link
                href="/security/events"
                className="inline-flex items-center gap-1 text-[12.5px] font-bold text-primary-600 hover:underline"
              >
                See all access events
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Audit trail — preview only; the full log lives on /security/audit. */}
      <div ref={auditRef} className="scroll-mt-20">
        <Card className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                <ScrollText className="h-4 w-4 text-primary-600" aria-hidden />
                Audit trail
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">
                Append-only — rows can be written, never edited or deleted.
              </p>
            </div>
            <Link
              href="/security/audit"
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-[12px] font-bold text-primary-700 transition hover:bg-primary-100"
            >
              See full audit trail
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          {loading ? (
            <div className="mt-3 space-y-2.5" aria-hidden>
              <div className="h-10 animate-pulse rounded-xl bg-ink/10" />
              <div className="h-10 animate-pulse rounded-xl bg-ink/10" />
              <div className="h-10 animate-pulse rounded-xl bg-ink/10" />
            </div>
          ) : audit.length ? (
            <ul className="mt-3 divide-y divide-ink/10">
              {audit.slice(0, 5).map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 transition-colors first:pt-0 last:pb-0 hover:bg-cream/30"
                >
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
                    <span className="font-bold text-ink">{names.get(a.actor_profile_id ?? "") ?? "System"}</span>
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 font-mono text-[11px] font-bold text-primary-700 ring-1 ring-primary-100">
                      {a.action}
                    </span>
                    <span className="font-semibold text-ink-soft">{a.entity}</span>
                  </p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-faint">
                    <Clock className="h-3 w-3" aria-hidden />
                    {timeAgo(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-center text-[13px] text-ink-muted">
              No audit events yet — break-glass accesses land here automatically.
            </p>
          )}
        </Card>
      </div>

      {/* Access matrix */}
      <div ref={matrixRef} className="scroll-mt-20">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-ink">Who can do what</h2>
              <p className="mt-0.5 max-w-[620px] text-[12.5px] text-ink-muted">
                Live from the shared access policy — head holds every office power, counselors run sessions, faculty
                only refer. Tap a role to highlight its column.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
                <Input
                  value={matrixQuery}
                  onChange={(e) => setMatrixQuery(e.target.value)}
                  placeholder="Find an action…"
                  aria-label="Filter actions"
                  className="h-8 w-52 pl-8"
                />
              </div>
              {matrixRole && (
                <button
                  type="button"
                  onClick={() => setMatrixRole(null)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-ink/15 bg-white px-2.5 text-[11.5px] font-bold text-ink-soft transition hover:border-red-300 hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Clear highlight
                </button>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-bold text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                <Check className="h-3 w-3" aria-hidden />
              </span>
              Allowed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center text-ink-faint">
                <Minus className="h-3 w-3" aria-hidden />
              </span>
              Blocked
            </span>
            {matrixRole && (
              <span className="inline-flex items-center gap-1.5 text-primary-700">
                <ListFilter className="h-3 w-3" aria-hidden />
                Highlighting {MATRIX_ROLE_LABEL[matrixRole]}
              </span>
            )}
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-ink/10">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 bg-cream/40 text-xs uppercase text-ink-muted">
                  <th className="px-4 py-3">Action</th>
                  {MATRIX_ROLES.map((r) => {
                    const selected = matrixRole === r;
                    return (
                      <th key={r} className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setMatrixRole(selected ? null : r)}
                          aria-pressed={selected}
                          className={cn(
                            "inline-flex w-full items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                            selected ? "bg-primary-600 text-white shadow-sm" : "text-ink-muted hover:bg-white hover:text-ink"
                          )}
                        >
                          {MATRIX_ROLE_LABEL[r]}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredActions.map((action) => (
                  <tr key={action} className="border-b border-ink/5 transition-colors last:border-0 hover:bg-cream/30">
                    <td className="px-4 py-2.5 font-mono text-[13px] font-bold text-ink">{action}</td>
                    {MATRIX_ROLES.map((r) => {
                      const allowed = actionPolicy[action].includes(r as never);
                      const highlighted = matrixRole === r;
                      return (
                        <td
                          key={r}
                          className={cn("px-4 py-2.5 text-center", highlighted && "bg-primary-50/70")}
                        >
                          {allowed ? (
                            <span
                              aria-label="Allowed"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-700"
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden />
                            </span>
                          ) : (
                            <span aria-label="Not allowed" className="inline-flex h-6 w-6 items-center justify-center text-ink-faint">
                              <Minus className="h-3.5 w-3.5" aria-hidden />
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {filteredActions.length === 0 && (
                  <tr>
                    <td colSpan={MATRIX_ROLES.length + 1} className="px-4 py-8 text-center text-[13px] text-ink-muted">
                      No actions match “{matrixQuery}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[12.5px] leading-relaxed text-ink-muted">
            {roleCounts.size > 0 && (
              <>Current accounts — {[...roleCounts.entries()].map(([r, n]) => `${n} ${r.replace(/_/g, " ")}`).join(" · ")} · </>
            )}
            {deactivated} deactivated. Role changes happen only through staff provisioning.
          </p>
        </Card>
      </div>
    </div>
  );
}
