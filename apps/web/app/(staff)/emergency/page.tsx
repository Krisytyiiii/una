"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertOctagon,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Eye,
  FileCheck2,
  FileText,
  Loader2,
  Lock,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  UserSearch,
} from "lucide-react";
import { breakGlassSchema, type BreakGlassInput } from "@dorsu/shared-schemas";
import { createClient } from "@/lib/supabase/client";
import {
  EMERGENCY_BOARD_KEY,
  useEmergencyBoard,
  type EmergencyBoardData,
} from "@/lib/hooks/use-emergency-board";
import {
  clearStoredGrant,
  fmtLeft,
  isUnexpiredGrant,
  loadStoredGrant,
  saveStoredGrant,
  type EmergencyGrant as Grant,
} from "@/lib/hooks/use-emergency-grant";
import { Button, Card, FieldError, Textarea } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import { GrantBanner } from "@/components/emergency/grant-banner";
import { IdentityCard, type EmergencyIdentity as Identity } from "@/components/emergency/identity-card";
import { notifyStaff } from "@/lib/notify";
import { cn } from "@/lib/utils";

/**
 * Justification starters — they only prefill the field; the counselor still
 * edits the wording so every audit row carries a real, human reason.
 */
const JUSTIFICATION_TEMPLATES = [
  "Student disclosed imminent risk during a session.",
  "Third-party crisis report referencing this student.",
  "Emergency contact from faculty about immediate danger.",
] as const;

const EMPTY_STUDENTS: { id: string; label: string; alias: string }[] = [];
const EMPTY_IDS: string[] = [];

/**
 * Shared /emergency — break-glass anonymity override for authorized
 * counselors and the head. Logging access opens a 30-minute grant; resolving
 * the real identity requires the grant and audit-logs every view. The head
 * reviews all events under /security.
 */
export default function EmergencyPage() {
  const qc = useQueryClient();
  const { data: board, isLoading, isError } = useEmergencyBoard();
  const role = board?.role ?? null;
  const me = board?.me ?? null;
  const myName = board?.myName ?? "Staff";
  const students = board?.students ?? EMPTY_STUDENTS;
  const headIds = board?.headIds ?? EMPTY_IDS;
  const loading = isLoading && !board;
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  // Restore the last unexpired grant instantly so a full page refresh never
  // flashes back to an empty form while the board refetches.
  const [studentPick, setStudentPick] = useState(() => loadStoredGrant()?.studentId ?? "");
  const [grant, setGrant] = useState<Grant | null>(() => {
    const s = loadStoredGrant();
    return s
      ? { studentId: s.studentId, alias: s.alias, expiresAt: s.expiresAt, logId: s.logId, reviewed: s.reviewed }
      : null;
  });
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Collapse the log-access form while a grant is live so the active window
  // (and the reveal) stays the focus; "Log new access" reopens it on demand.
  const [formOpen, setFormOpen] = useState(false);

  const { register, handleSubmit, formState, reset, setValue, watch } = useForm<BreakGlassInput>({
    resolver: zodResolver(breakGlassSchema),
  });
  const justification = watch("justification") ?? "";
  const justificationLen = justification.trim().length;

  useEffect(() => {
    if (isError) toast.error("Couldn't load emergency access right now.");
  }, [isError]);

  // Reconcile the local grant with the server board. The DB row is the source
  // of truth, but an unexpired local grant (e.g. just logged, waiting for
  // head review) is never wiped by a fetch that returns no grant — otherwise
  // a page refresh would make the waiting state vanish.
  useEffect(() => {
    if (!board) return;
    if (board.grant) {
      const server = board.grant;
      setGrant((prev) => {
        const reviewed =
          server.reviewed || (prev?.logId === server.logId && prev.reviewed);
        const next: Grant = { ...server, reviewed };
        if (
          prev &&
          prev.logId === next.logId &&
          prev.studentId === next.studentId &&
          prev.expiresAt === next.expiresAt &&
          prev.reviewed === next.reviewed &&
          prev.alias === next.alias
        ) {
          return prev;
        }
        return next;
      });
      setStudentPick((prev) => prev || server.studentId);
      saveStoredGrant(
        {
          ...server,
          reviewed:
            server.reviewed ||
            loadStoredGrant()?.reviewed === true,
        },
        board.me ?? null
      );
    } else {
      // Server reports no active grant. Only drop the local one when it is
      // expired (or belongs to another user — checked below); otherwise keep
      // showing the waiting state across refreshes.
      setGrant((prev) => {
        if (!prev) return prev;
        if (!isUnexpiredGrant(prev)) {
          clearStoredGrant();
          return null;
        }
        return prev;
      });
    }
  }, [board]);

  // A stored grant from another account (shared device) must never leak in.
  useEffect(() => {
    if (!me) return;
    const s = loadStoredGrant();
    if (s && s.accessorId && s.accessorId !== me) {
      clearStoredGrant();
      setGrant(null);
      setStudentPick("");
    }
  }, [me]);

  // Keep storage in step with local review/expiry transitions.
  useEffect(() => {
    if (grant && me) saveStoredGrant(grant, me);
  }, [grant, me]);

  // Countdown tick while a grant is live.
  useEffect(() => {
    if (!grant) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [grant]);

  const msLeft = grant ? new Date(grant.expiresAt).getTime() - now : 0;
  useEffect(() => {
    if (grant && msLeft <= 0) {
      setGrant(null);
      setIdentity(null);
      clearStoredGrant();
      toast.error("Emergency grant expired — log access again if still needed.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft > 0]);

  const logAccess = handleSubmit(async (v) => {
    if (!me) return;
    setBusy(true);
    try {
      // Server-enforced caseload scope: counselors may only log access for
      // referred students / assigned appointments (see log-break-glass route).
      const res = await fetch("/api/staff/security/log-break-glass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: v.studentId, justification: v.justification }),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: string;
        log?: { id: string; student_id: string; expires_at: string };
      } | null;
      if (!res.ok) throw new Error(json?.error ?? "Couldn't log that access.");
      const row = json?.log as { id: string; student_id: string; expires_at: string };
      const alias = students.find((s) => s.id === v.studentId)?.alias ?? grant?.alias ?? "Student";
      // A fresh log is unreviewed — counselors wait for head review before reveal.
      // Persist + patch the board cache so a refresh keeps the waiting state.
      const next: Grant = { studentId: row.student_id, alias, expiresAt: row.expires_at, logId: row.id, reviewed: false };
      setGrant(next);
      saveStoredGrant(next, me);
      qc.setQueryData<EmergencyBoardData>([...EMERGENCY_BOARD_KEY], (prev) =>
        prev ? { ...prev, grant: { ...next } } : prev
      );
      setIdentity(null);
      reset();
      setFormOpen(false);
      setStudentPick(v.studentId);
      toast.success(
        role === "counselor"
          ? "Emergency access logged — waiting for head review before the identity can be revealed."
          : "Emergency access logged — 30-minute grant open."
      );
      // Fire-and-forget: heads review from /security; the grant itself is
      // already persisted above. Body carries ids only, never identity.
      void notifyStaff(headIds.filter((id) => id !== me), {
        type: "system",
        title: "Emergency access logged",
        body: `${myName} opened a restricted record with justification on file.`,
        link: "/security",
        dedupeKey: `breakglass:${row.id}:logged`,
        tone: "info",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't log that access.");
    } finally {
      setBusy(false);
    }
  });

  const reveal = async () => {
    if (!grant) return;
    setRevealing(true);
    try {
      const res = await fetch("/api/staff/security/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: grant.studentId }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string; identity?: Identity } | null;
      if (!res.ok) {
        // Counselor hitting the review gate (e.g. grant reviewed state changed
        // mid-session) — re-check so the UI reflects the current status.
        if (res.status === 403 && role !== "guidance_head") void checkReview();
        throw new Error(json?.error ?? "Couldn't reveal that identity.");
      }
      setIdentity(json?.identity ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't reveal that identity.");
    } finally {
      setRevealing(false);
    }
  };

  // Re-read the grant's review flag (counselors can read their own log rows).
  const checkReview = async () => {
    if (!grant || !me) return false;
    setChecking(true);
    try {
      const { data } = await createClient()
        .from("break_glass_logs")
        .select("id, expires_at, reviewed_at")
        .eq("accessor_profile_id", me)
        .eq("student_id", grant.studentId)
        .gt("expires_at", new Date().toISOString())
        .order("accessed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const g = data as { id: string; expires_at: string; reviewed_at: string | null } | null;
      if (!g) {
        // No active row server-side (expired/closed) — drop the local copy so
        // the UI never gets stuck in "waiting for review".
        setGrant(null);
        setIdentity(null);
        clearStoredGrant();
        return false;
      }
      if (g.reviewed_at) {
        setGrant((prev) => {
          const next = prev ? { ...prev, logId: g.id, reviewed: true, expiresAt: g.expires_at } : prev;
          if (next) saveStoredGrant(next, me);
          return next;
        });
        qc.setQueryData<EmergencyBoardData>([...EMERGENCY_BOARD_KEY], (prev) =>
          prev?.grant ? { ...prev, grant: { ...prev.grant, logId: g.id, reviewed: true, expiresAt: g.expires_at } } : prev
        );
        toast.success("Head review complete — you may now reveal the identity.");
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setChecking(false);
    }
  };

  // Counselors see no Reveal button until the head reviews the log. While the
  // board (and therefore the role) is still loading after a refresh, assume
  // the waiting state so an unreviewed grant never flashes a Reveal button.
  const needsReview = !!grant && !grant.reviewed && !identity && role !== "guidance_head";

  // While waiting, poll so Reveal appears on its own once reviewed.
  useEffect(() => {
    if (!needsReview) return;
    const t = setInterval(() => {
      void checkReview();
    }, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsReview, grant?.studentId]);

  if (!loading && (!role || !["counselor", "guidance_head"].includes(role))) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Emergency access</h1>
        <Card><p className="text-sm text-ink-muted">Only counselors and the guidance head can open emergency access.</p></Card>
      </div>
    );
  }

  const isHead = role === "guidance_head";
  // The head's own logs bypass review; counselors wait for it.
  const reviewed = !!grant && (grant.reviewed || isHead);
  const picked = students.find((s) => s.id === studentPick) ?? null;
  const formVisible = !grant || formOpen;

  const hideIdentity = () => setIdentity(null);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // The three-step rail is the page's mental model: log → review → reveal.
  const steps: {
    n: number;
    label: string;
    hint: string;
    state: "done" | "active" | "idle";
    target: string;
    icon: typeof Clock;
  }[] = [
    {
      n: 1,
      label: "Log access",
      hint: grant ? "Justification on file" : "Pick a student + reason",
      state: grant ? "done" : "active",
      target: "log-access",
      icon: FileText,
    },
    {
      n: 2,
      label: isHead ? "Review" : "Head review",
      hint: !grant ? "Opens with a log" : reviewed ? "Reviewed" : "Waiting on the head",
      state: !grant ? "idle" : reviewed ? "done" : "active",
      target: grant ? "active-grant" : "log-access",
      icon: FileCheck2,
    },
    {
      n: 3,
      label: "Reveal identity",
      hint: identity ? "Identity on screen" : !grant ? "Needs an active grant" : !reviewed ? "Locked until reviewed" : "Ready",
      state: identity ? "done" : reviewed ? "active" : "idle",
      target: identity ? "identity-panel" : grant ? "active-grant" : "log-access",
      icon: Eye,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      {/* Hero — crisis framing, live window state, and the step rail. */}
      <section className="relative overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-br from-white via-cream to-red-50 p-5 shadow-card sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-red-200/40 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-accent-200/25 blur-2xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-red-700">
              <AlertOctagon className="h-3.5 w-3.5" aria-hidden />
              Crisis protocol
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Emergency access</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-red-700">
                <ShieldAlert className="h-3 w-3" aria-hidden />
                {isHead ? "Guidance head" : "Counselor view"}
              </span>
            </div>
            <p className="mt-1.5 max-w-[600px] text-[13px] leading-relaxed text-ink-muted">
              Crisis only. Logging access lifts anonymity for one student for{" "}
              <span className="font-bold text-ink">30 minutes</span>. Every log and every reveal is
              audit-logged under your name and reviewed by the head.
            </p>
          </div>

          {/* Live window state — the one number that matters right now. */}
          <div
            className={cn(
              "shrink-0 self-start rounded-xl border px-4 py-3 shadow-card backdrop-blur",
              grant ? "border-red-200 bg-white/90" : "border-white/70 bg-white/70"
            )}
            role={grant ? "timer" : undefined}
            aria-live="off"
          >
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
              {grant ? <Timer className="h-3 w-3 text-red-600" aria-hidden /> : <Lock className="h-3 w-3" aria-hidden />}
              Grant window
            </p>
            {grant ? (
              <>
                <p
                  className={cn(
                    "mt-1 font-mono text-2xl font-bold leading-none tabular-nums",
                    msLeft <= 5 * 60 * 1000 ? "text-red-700" : "text-ink"
                  )}
                >
                  {fmtLeft(msLeft)}
                </p>
                <p className="mt-1 max-w-[160px] truncate text-[11px] font-semibold text-ink-muted">
                  {grant.alias} · {reviewed ? "reviewed" : "awaiting review"}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-[15px] font-bold leading-tight text-ink">None open</p>
                <p className="mt-1 text-[11px] font-medium text-ink-faint">Log access to start the 30-minute clock.</p>
              </>
            )}
          </div>
        </div>

        {/* Step rail — click a step to jump to the card that handles it. */}
        <div className="relative mt-5 grid gap-2 sm:grid-cols-3">
          {steps.map((s, i) => (
            <button
              key={s.n}
              type="button"
              onClick={() => scrollTo(s.target)}
              className={cn(
                "group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400",
                s.state === "done"
                  ? "border-emerald-200 bg-emerald-50/80"
                  : s.state === "active"
                    ? "border-red-300 bg-white ring-1 ring-red-200"
                    : "border-white/70 bg-white/60 hover:border-ink/15"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                  s.state === "done"
                    ? "bg-emerald-600 text-white"
                    : s.state === "active"
                      ? "bg-red-600 text-white"
                      : "bg-ink/10 text-ink-muted"
                )}
              >
                {s.state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden /> : s.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-[12.5px] font-bold text-ink">
                  <s.icon className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
                  {s.label}
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] font-medium text-ink-faint">{s.hint}</span>
              </span>
              {i < steps.length - 1 && (
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-ink-faint sm:block" aria-hidden />
              )}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* Main flow */}
        <div className="space-y-4">
          {/* Step 1 — log access (collapses to a summary while a grant is live) */}
          <Card id="log-access" className="scroll-mt-24 p-5">
            {!formVisible ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Check className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-bold text-ink">1 · Access logged</h2>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">
                      Grant open for <span className="font-bold text-ink">{grant?.alias}</span>. Log another
                      access only if a <em>different</em> student needs one.
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setFormOpen(true)} className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  Log new access
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">
                      1
                    </span>
                    Log emergency access
                  </h2>
                  <p className="flex items-center gap-1 text-[11px] font-medium text-ink-faint">
                    <Clock className="h-3 w-3" aria-hidden />
                    Opens a 30-minute window
                  </p>
                </div>

                {loading ? (
                  <div className="animate-pulse space-y-3 pt-3" aria-hidden>
                    <div className="h-10 rounded-lg bg-ink/10" />
                    <div className="h-20 rounded-lg bg-ink/10" />
                  </div>
                ) : (
                  <form className="mt-3 space-y-4" onSubmit={logAccess}>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-ink-muted">Student (shown by alias)</label>
                      <Dropdown
                        menuKey="emergency-student"
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
                      {picked && (
                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary-100 bg-blue-50/60 px-3 py-2">
                          <UserSearch className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden />
                          <p className="min-w-0 truncate text-[12px] font-semibold text-ink">
                            {picked.alias}
                            <span className="ml-1.5 font-medium text-ink-muted">— identity stays hidden until reveal.</span>
                          </p>
                        </div>
                      )}
                      {role === "counselor" && (
                        <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-ink-faint">
                          {students.length
                            ? "Only students from your assigned appointments and referrals appear here."
                            : "No students on your caseload yet — emergency access unlocks once you have an assigned appointment or referral."}
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="block text-xs font-bold text-ink-muted">Emergency justification (min 20 chars)</label>
                        <span
                          className={cn(
                            "font-mono text-[11px] font-bold tabular-nums",
                            justificationLen >= 20 ? "text-emerald-600" : "text-ink-faint"
                          )}
                        >
                          {justificationLen}/20
                        </span>
                      </div>
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {JUSTIFICATION_TEMPLATES.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setValue("justification", t, { shouldValidate: true, shouldDirty: true })}
                            className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-cream/60 px-2.5 py-1 text-[11px] font-semibold text-ink-soft transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                          >
                            <Sparkles className="h-3 w-3 text-primary-500" aria-hidden />
                            {t}
                          </button>
                        ))}
                      </div>
                      <Textarea
                        rows={3}
                        placeholder="Why must this student's identity be revealed right now?"
                        {...register("justification")}
                      />
                      <FieldError message={formState.errors.justification?.message} />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/5 pt-3">
                      <p className="flex items-start gap-1.5 text-[11px] font-medium text-ink-faint">
                        <ScrollText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        Your name and reason are written to the audit log.
                      </p>
                      <div className="flex items-center gap-2">
                        {grant && (
                          <Button type="button" size="sm" variant="ghost" onClick={() => setFormOpen(false)}>
                            Cancel
                          </Button>
                        )}
                        <Button disabled={busy} className="gap-2">
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <ShieldAlert className="h-4 w-4" aria-hidden />
                          )}
                          {busy ? "Logging…" : "Log emergency access"}
                        </Button>
                      </div>
                    </div>
                  </form>
                )}
              </>
            )}
          </Card>

          {/* Step 2 — grant + review gate + reveal */}
          {grant && (
            <GrantBanner grant={grant} msLeft={msLeft}>
              {!identity ? (
                needsReview ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                      <div>
                        <p className="text-[13px] font-bold text-amber-900">Waiting for head review</p>
                        <p className="mt-0.5 text-[12.5px] leading-relaxed text-amber-800">
                          Your access is logged and the guidance head has been notified. Reveal unlocks here
                          automatically once they review it — this page re-checks every 15 seconds.
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" disabled={checking} onClick={() => void checkReview()} className="gap-2">
                      {checking ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Timer className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {checking ? "Checking…" : "Check review status"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                      <div>
                        <p className="text-[13px] font-bold text-emerald-900">
                          {isHead ? "Grant ready" : "Head review complete"}
                        </p>
                        <p className="mt-0.5 text-[12.5px] leading-relaxed text-emerald-800">
                          Resolving the real identity writes a second audit row tied to you. Only proceed if
                          the crisis requires it.
                        </p>
                      </div>
                    </div>
                    {/* `void` keeps Button's async auto-spinner off — this
                        button renders its own so only one spinner shows. */}
                    <Button size="sm" variant="danger" disabled={revealing} onClick={() => void reveal()} className="gap-2">
                      {revealing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {revealing ? "Resolving…" : "Reveal identity"}
                      {!revealing && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
                    </Button>
                  </div>
                )
              ) : (
                <IdentityCard identity={identity} onHide={hideIdentity} />
              )}
            </GrantBanner>
          )}

          {!grant && !loading && (
            <Card className="flex items-start gap-3 border-amber-200 bg-amber-50/50 p-4">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
              <p className="text-[12.5px] leading-relaxed text-amber-900">
                No active grant. Breaking anonymity on a suspected emergency is logged; routine record
                access follows normal staff permissions instead.
              </p>
            </Card>
          )}
        </div>

        {/* Right rail — protocol reminder + audit expectations */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
              <ShieldCheck className="h-4 w-4 text-primary-600" aria-hidden />
              How break-glass works
            </h2>
            <ol className="mt-3 space-y-3">
              {[
                { icon: FileText, title: "Log the access", body: "Pick the student and write a real justification — it is stored with your name." },
                { icon: FileCheck2, title: "Head reviews it", body: "A guidance head is notified and reviews the log from /security. Counselors can't skip this." },
                { icon: Eye, title: "Reveal, then close", body: "Revealing writes a second audit row. The window closes on its own after 30 minutes." },
              ].map((s) => (
                <li key={s.title} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary-700 ring-1 ring-blue-100">
                    <s.icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[12.5px] font-bold text-ink">{s.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="border-red-100 p-5">
            <h2 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
              <ScrollText className="h-4 w-4 text-red-600" aria-hidden />
              Audit trail
            </h2>
            <ul className="mt-2.5 space-y-1.5 text-[11.5px] leading-relaxed text-ink-muted">
              <li>· Log and reveal each create a row under your name.</li>
              <li>· Notifications carry no names, aliases, or reasons.</li>
              <li>· The head can review every event from /security.</li>
            </ul>
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-800">
              Emergency use only. Routine curiosity is a policy violation.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
