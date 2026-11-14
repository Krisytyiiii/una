"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Clock,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  AVAILABILITY_BOARD_KEY,
  useAvailabilityBoard,
  type AvailabilityAppt,
  type AvailabilityBoardData,
  type AvailabilityCounselor,
  type AvailabilitySlot,
} from "@/lib/hooks/use-availability-board";
import { useMutationAction } from "@/lib/hooks/use-mutation-action";
import { patchBoard } from "@/lib/patch-board";
import { useManagedCounselor } from "@/lib/hooks/use-managed-counselor";
import { DAYS, MON_FIRST, fmtHours, slotMinutes } from "@/lib/availability";
import { Badge, Card, Input } from "@/components/ui/primitives";
import { Pager } from "@/components/shared/Pager";
import { CoverageGrid } from "@/components/availability/coverage-grid";
import { SLOT_ADD_BUSY_ID, SLOT_TOGGLE_BUSY_ID, SlotForm, type PendingSlots } from "@/components/availability/slot-form";
import { cn } from "@/lib/utils";

const EMPTY_COUNSELORS: AvailabilityCounselor[] = [];
const EMPTY_SLOTS: AvailabilitySlot[] = [];
const EMPTY_APPTS: AvailabilityAppt[] = [];
/** Roster pagination is fixed at 10 rows per page. */
const ROSTER_PAGE_SIZE = 10;

/**
 * Shared /availability — one URL, role-aware UI (same pattern as /appointments).
 * Counselors manage their own weekly slots; the head sees office coverage,
 * toggle counselor availability, and manage any counselor's slots.
 */
const byWeekday = (a: AvailabilitySlot, b: AvailabilitySlot) =>
  a.weekday - b.weekday || a.start_time.localeCompare(b.start_time);

export default function AvailabilityPage() {
  const qc = useQueryClient();
  const { data: board, isLoading, isError, refetch } = useAvailabilityBoard();
  const { busyId, run: runMutation } = useMutationAction();
  const role = board?.role ?? null;
  const ownId = board?.ownId ?? null;
  const counselors = board?.counselors ?? EMPTY_COUNSELORS;
  const slots = board?.slots ?? EMPTY_SLOTS;
  const appts = board?.appts ?? EMPTY_APPTS;
  const loading = isLoading && !board;
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [rosterQuery, setRosterQuery] = useState("");
  const [rosterPage, setRosterPage] = useState(1);

  const { managedId, setManagedId } = useManagedCounselor({
    ready: !!board,
    role,
    ownId,
    counselors,
  });

  useEffect(() => {
    if (isError) toast.error("Couldn't load availability right now.");
  }, [isError]);

  const isOffice = role === "guidance_head";
  // Slot management is counselor-only — the head view is strictly read-only.
  const canManage = role === "counselor";
  const managed = counselors.find((c) => c.id === (role === "counselor" ? ownId : managedId));
  const managedSlots = useMemo(
    () => slots.filter((s) => s.counselor_id === managed?.id).slice().sort(byWeekday),
    [slots, managed]
  );

  const stats = useMemo(() => {
    const now = Date.now();
    const weekOut = now + 7 * 24 * 60 * 60 * 1000;
    // Counselors only ever see their own availability — scope every figure to
    // their windows and their own queue.
    const personal = role === "counselor";
    const scopedSlots = personal ? managedSlots : slots;
    const scopedAppts = personal && ownId ? appts.filter((a) => a.counselor_id === ownId) : appts;
    const covered = new Set(scopedSlots.map((s) => s.weekday));
    return {
      personal,
      counselors: personal ? (managed ? 1 : 0) : counselors.length,
      available: personal
        ? managed?.available
          ? 1
          : 0
        : counselors.filter((c) => c.available).length,
      slots: scopedSlots.length,
      uncovered: 7 - covered.size,
      next7: scopedAppts.filter((a) => {
        const t = new Date(a.scheduled_at).getTime();
        return t >= now && t <= weekOut && ["pending", "confirmed"].includes(a.status);
      }).length,
      unassigned: personal
        ? 0
        : appts.filter((a) => !a.counselor_id && ["pending", "confirmed"].includes(a.status)).length,
      todaySlots: scopedSlots.filter((s) => s.weekday === new Date().getDay()).length,
    };
  }, [role, ownId, managed, managedSlots, counselors, slots, appts]);

  const upcomingBy = useMemo(() => {
    const m = new Map<string, number>();
    const now = Date.now();
    for (const a of appts) {
      if (!a.counselor_id || !["pending", "confirmed"].includes(a.status)) continue;
      if (new Date(a.scheduled_at).getTime() < now) continue;
      m.set(a.counselor_id, (m.get(a.counselor_id) ?? 0) + 1);
    }
    return m;
  }, [appts]);

  const hoursBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of slots) m.set(s.counselor_id, (m.get(s.counselor_id) ?? 0) + slotMinutes(s));
    return m;
  }, [slots]);

  const visibleCounselors = useMemo(() => {
    const q = rosterQuery.trim().toLowerCase();
    if (!q) return counselors;
    return counselors.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.spec ?? "").toLowerCase().includes(q)
    );
  }, [counselors, rosterQuery]);

  // Roster paging — fixed 10 rows per page.
  const rosterPages = Math.max(1, Math.ceil(visibleCounselors.length / ROSTER_PAGE_SIZE));
  const safeRosterPage = Math.min(rosterPage, rosterPages);
  const pagedCounselors = useMemo(
    () =>
      visibleCounselors.slice(
        (safeRosterPage - 1) * ROSTER_PAGE_SIZE,
        safeRosterPage * ROSTER_PAGE_SIZE
      ),
    [visibleCounselors, safeRosterPage]
  );
  // A new search always starts on the first page.
  useEffect(() => {
    setRosterPage(1);
  }, [rosterQuery]);

  // Standard mutation lifecycle (same as /appointments): busy resolves the
  // moment the DB write settles (inside the hook's finally) — the cache is
  // patched in place and the full-board refetch reconciles in the background,
  // so the spinner never waits on refetches or notification delivery.
  // Errors map through the hook (friendly service messages pass through,
  // everything else becomes a reload-and-retry prompt). Returns true only
  // when the write landed, so the confirm dialog can stay open for retry.
  const patchSlots = (fn: (prev: AvailabilitySlot[]) => AvailabilitySlot[]) =>
    patchBoard<AvailabilityBoardData>(qc, [...AVAILABILITY_BOARD_KEY], (prev) => ({
      ...prev,
      slots: fn(prev.slots),
    }));

  const patchAvailability = (counselorId: string, next: boolean) =>
    patchBoard<AvailabilityBoardData>(qc, [...AVAILABILITY_BOARD_KEY], (prev) => ({
      ...prev,
      counselors: prev.counselors.map((c) =>
        c.id === counselorId ? { ...c, available: next } : c
      ),
    }));

  const addSlots = async (p: PendingSlots, cid: string): Promise<boolean> => {
    const label = p.days.length > 1 ? `add ${p.days.length} slots` : "add this slot";
    const result = await runMutation(
      SLOT_ADD_BUSY_ID,
      async () => {
        const { data, error } = await createClient()
          .from("counselor_availability")
          .insert(
            p.days.map((weekday) => ({
              counselor_id: cid,
              weekday,
              start_time: p.startTime,
              end_time: p.endTime,
              is_recurring: p.isRecurring,
            }))
          )
          .select();
        if (error) throw error;
        return ((data ?? []) as AvailabilitySlot[]);
      },
      { label, friendly: /overlap|conflict|duplicate|valid|weekday|start|end|future/i }
    );
    if (!result.ok) return false;
    if (result.data.length) patchSlots((prev) => [...prev, ...result.data].sort(byWeekday));
    // Background reconcile — never awaited, never blocks the toast.
    void refetch().catch(() => {});
    toast.success(p.days.length > 1 ? `${p.days.length} slots added.` : "Slot added.", { position: "top-right" });
    return true;
  };

  const removeSlot = async (id: string): Promise<boolean> => {
    const result = await runMutation(
      id,
      async () => {
        const { error } = await createClient().from("counselor_availability").delete().eq("id", id);
        if (error) throw error;
      },
      { label: "remove this slot", friendly: /not found|permission|policy/i }
    );
    if (!result.ok) return false;
    patchSlots((prev) => prev.filter((s) => s.id !== id));
    // Background reconcile — never awaited, never blocks the toast.
    void refetch().catch(() => {});
    toast.success("Slot removed.", { position: "top-right" });
    return true;
  };

  /**
   * Pause / resume new student requests without deleting any window.
   * Writes `counselors.is_available` (RLS: counselor may update their own row).
   * Existing confirmed sessions and every slot stay untouched.
   */
  const setAvailability = async (next: boolean): Promise<boolean> => {
    if (!managed) return false;
    const result = await runMutation(
      SLOT_TOGGLE_BUSY_ID,
      async () => {
        const { error } = await createClient()
          .from("counselors")
          .update({ is_available: next })
          .eq("id", managed.id);
        if (error) throw error;
      },
      { label: next ? "resume bookings" : "pause bookings", friendly: /permission|policy|not found/i }
    );
    if (!result.ok) return false;
    patchAvailability(managed.id, next);
    // Background reconcile — never awaited, never blocks the toast.
    void refetch().catch(() => {});
    toast.success(next ? "You're accepting bookings again." : "Bookings paused — your slots are saved.", {
      position: "top-right",
    });
    return true;
  };

  // Live slot sync — the same realtime pipe as chat: inserts/updates/deletes
  // from any session patch the cached board in place, so a removal in another
  // tab (or the head's coverage view) lands here without a reload. The board
  // query uses keepPreviousData, so the list never flashes.
  useEffect(() => {
    if (role !== "counselor" && role !== "guidance_head") return;
    const ch = createClient()
      .channel("availability-board")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "counselor_availability" }, (p) => {
        const row = p.new as AvailabilitySlot;
        if (!row?.id) return;
        patchBoard<AvailabilityBoardData>(qc, [...AVAILABILITY_BOARD_KEY], (prev) =>
          prev.slots.some((s) => s.id === row.id)
            ? prev
            : { ...prev, slots: [...prev.slots, row].sort(byWeekday) }
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "counselor_availability" }, (p) => {
        const row = p.new as AvailabilitySlot;
        if (!row?.id) return;
        patchBoard<AvailabilityBoardData>(qc, [...AVAILABILITY_BOARD_KEY], (prev) => ({
          ...prev,
          slots: prev.slots.map((s) => (s.id === row.id ? { ...s, ...row } : s)),
        }));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "counselor_availability" }, (p) => {
        const old = p.old as { id?: string } | null;
        if (!old?.id) return;
        patchBoard<AvailabilityBoardData>(qc, [...AVAILABILITY_BOARD_KEY], (prev) => ({
          ...prev,
          slots: prev.slots.filter((s) => s.id !== old.id),
        }));
      })
      .subscribe();
    return () => {
      createClient().removeChannel(ch);
    };
  }, [role, qc]);

  if (!loading && (!role || !["counselor", "guidance_head"].includes(role))) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Availability</h1>
        <Card><p className="text-sm text-ink-muted">Only counselors and the guidance head can open availability.</p></Card>
      </div>
    );
  }

  const managedMinutes = managedSlots.reduce((a, s) => a + slotMinutes(s), 0);
  const personal = stats.personal;

  const statCards = personal
    ? ([
        {
          label: "My windows",
          value: stats.slots,
          hint: "Published this week",
          icon: CalendarClock,
          tone: "primary",
        },
        {
          label: "Open hours",
          value: fmtHours(managedMinutes),
          hint: "Total per week",
          icon: Clock,
          tone: "sky",
        },
        {
          label: "Days covered",
          value: 7 - stats.uncovered,
          hint: "of 7 days",
          icon: CalendarCheck,
          tone: "emerald",
        },
        {
          label: "Uncovered days",
          value: stats.uncovered,
          hint: stats.uncovered > 0 ? "Add a window" : "Full week",
          icon: AlertTriangle,
          tone: stats.uncovered > 0 ? "amber" : "emerald",
        },
        {
          label: "Today",
          value: stats.todaySlots,
          hint: "Windows today",
          icon: CalendarDays,
          tone: "violet",
        },
        {
          label: "Next 7 days",
          value: stats.next7,
          hint: "Sessions scheduled",
          icon: UserCheck,
          tone: "rose",
        },
      ] as const)
    : ([
        {
          label: "Counselors",
          value: stats.counselors,
          hint: "On the roster",
          icon: Users,
          tone: "sky",
        },
        {
          label: "Available now",
          value: stats.available,
          hint: "Open for booking",
          icon: UserCheck,
          tone: "emerald",
        },
        {
          label: "Weekly slots",
          value: stats.slots,
          hint: "Published windows",
          icon: CalendarClock,
          tone: "primary",
        },
        {
          label: "Uncovered days",
          value: stats.uncovered,
          hint: "No windows this week",
          icon: AlertTriangle,
          tone: stats.uncovered > 0 ? "amber" : "emerald",
        },
        {
          label: "Next 7 days",
          value: stats.next7,
          hint: "Sessions scheduled",
          icon: CalendarCheck,
          tone: "violet",
        },
        {
          label: "Unassigned",
          value: stats.unassigned,
          hint: "Need a counselor",
          icon: UserX,
          tone: "rose",
        },
      ] as const);

  const STAT_TONES: Record<string, string> = {
    primary: "bg-primary-50 text-primary-700 ring-primary-100",
    sky: "bg-sky-50 text-sky-700 ring-sky-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
  };

  const coveredDays = 7 - stats.uncovered;
  const coveragePct = Math.round((coveredDays / 7) * 100);
  const managedDays = [...new Set(managedSlots.map((s) => s.weekday))].sort(
    (a, b) => MON_FIRST.indexOf(a) - MON_FIRST.indexOf(b)
  );

  return (
    <div className="space-y-5">
      {/* Hero — role-aware, with a live coverage-health readout. */}
      <section className="relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-200/40 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-accent-200/30 blur-2xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary-700">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              Guidance office · Scheduling
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
                {role === "counselor" ? "My availability" : "Office availability"}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-primary-700">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                {isOffice ? "Guidance head" : "Counselor · your windows only"}
              </span>
            </div>
            <p className="mt-1.5 max-w-[620px] text-[13px] leading-relaxed text-ink-muted">
              {isOffice
                ? "See where the team is covered, spot gaps before students hit them, and keep every counselor's week realistic."
                : "Publish the windows you can take sessions. Students can only book inside these slots, and your appointment picker follows the same rules."}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-ink/5">
                <Clock className="h-3 w-3 text-primary-600" aria-hidden />
                Sessions sit inside a slot
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-ink/5">
                <CalendarCheck className="h-3 w-3 text-primary-600" aria-hidden />
                Booked times stay hidden
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-ink/5">
                <Sparkles className="h-3 w-3 text-primary-600" aria-hidden />
                Changes sync live
              </span>
            </div>
          </div>

          <div className="shrink-0 rounded-xl border border-white/70 bg-white/85 p-4 shadow-card backdrop-blur sm:min-w-[250px]">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Coverage health
            </p>
            <div className="mt-1 flex items-end gap-2">
              <span className="font-display text-3xl font-bold leading-none text-ink">
                {loading ? "—" : `${coveragePct}%`}
              </span>
              <span className="pb-1 text-[11px] font-medium text-ink-muted">of the week covered</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  coveragePct >= 85 ? "bg-emerald-500" : coveragePct >= 50 ? "bg-primary-600" : "bg-amber-500"
                )}
                style={{ width: `${coveragePct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-ink-faint">
              {loading
                ? "Reading the roster…"
                : `${coveredDays} of 7 days have at least one window.`}
            </p>
            <Link
              href="/appointments"
              className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 text-[12px] font-bold text-white shadow-soft transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              Open appointments
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-ink/10 bg-white p-3.5 shadow-card">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-md ring-1", STAT_TONES[s.tone])}>
                <s.icon className="h-3 w-3" aria-hidden />
              </span>
              {s.label}
            </span>
            {loading ? (
              <span className="mt-2 block h-7 w-10 animate-pulse rounded bg-ink/10" aria-hidden />
            ) : (
              <span className="mt-1 block font-display text-xl font-bold leading-none tabular-nums text-ink">
                {s.value}
              </span>
            )}
            <span className="mt-1 block truncate text-[10.5px] text-ink-faint">{s.hint}</span>
          </div>
        ))}
      </div>

      {/* Weekly coverage board — the counselor sees only their own windows. */}
      <CoverageGrid
        slots={personal ? managedSlots : slots}
        counselors={personal ? (managed ? [managed] : []) : counselors}
        loading={loading}
        personal={personal}
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {/* Slot manager — counselor only (head view stays read-only) */}
          {canManage && (
            <SlotForm
              role={role}
              isOffice={isOffice}
              counselors={counselors}
              managed={managed}
              managedId={managedId}
              onManagedChange={setManagedId}
              managedSlots={managedSlots}
              upcomingCount={managed ? (upcomingBy.get(managed.id) ?? 0) : 0}
              available={managed?.available ?? true}
              toggleBusy={busyId === SLOT_TOGGLE_BUSY_ID}
              busyId={busyId}
              addBusy={busyId === SLOT_ADD_BUSY_ID}
              openMenuKey={openMenuKey}
              onOpenMenuChange={setOpenMenuKey}
              onAdd={addSlots}
              onRemove={removeSlot}
              onToggleAvailable={setAvailability}
            />
          )}

          {/* Counselor roster (office view — read-only) */}
          {isOffice && (
            <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-card sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                    <Users className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h2 className="font-display text-base font-bold text-ink">Counselor roster</h2>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
                      Team load and published availability per counselor.
                    </p>
                  </div>
                </div>
                <Input
                  placeholder="Search counselors…"
                  value={rosterQuery}
                  onChange={(e) => setRosterQuery(e.target.value)}
                  aria-label="Search counselors"
                  className="w-full sm:w-56"
                />
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-[11px] uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-2.5 font-bold">Counselor</th>
                      <th className="px-4 py-2.5 font-bold">Status</th>
                      <th className="px-4 py-2.5 text-center font-bold">Slots</th>
                      <th className="px-4 py-2.5 text-center font-bold">Weekly hrs</th>
                      <th className="px-4 py-2.5 font-bold">Upcoming</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCounselors.map((c) => (
                      <tr key={c.id} className="border-b border-ink/5 last:border-0 hover:bg-cream/50">
                        <td className="px-4 py-3">
                          <p className="font-bold text-ink">{c.name}</p>
                          <p className="text-xs font-medium text-ink-muted">{c.spec ?? "Counselor"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={c.available ? "success" : "warning"}>
                            {c.available ? "Available" : "Unavailable"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold tabular-nums">
                          {slots.filter((s) => s.counselor_id === c.id).length}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold tabular-nums">
                          {fmtHours(hoursBy.get(c.id) ?? 0)}
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums">
                          {upcomingBy.get(c.id) ?? 0} sessions
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!loading && !counselors.length && (
                  <p className="px-4 py-8 text-center text-sm text-ink-muted">
                    No counselors yet — add them via the Users page.
                  </p>
                )}
                {!loading && !!counselors.length && !visibleCounselors.length && (
                  <p className="px-4 py-8 text-center text-sm text-ink-muted">
                    No counselors match “{rosterQuery.trim()}”.{" "}
                    <button
                      type="button"
                      onClick={() => setRosterQuery("")}
                      className="font-bold text-primary-700 hover:underline"
                    >
                      Clear search
                    </button>
                  </p>
                )}
              </div>
              {!loading && visibleCounselors.length > ROSTER_PAGE_SIZE && (
                <Pager
                  page={safeRosterPage}
                  size={ROSTER_PAGE_SIZE}
                  totalApprox={visibleCounselors.length}
                  hasMore={safeRosterPage < rosterPages}
                  onPage={setRosterPage}
                />
              )}
            </section>
          )}
        </div>

        <aside className="space-y-5">
          {/* Counselor's own week — a quick read of what the slots add up to. */}
          {role === "counselor" && (
            <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-card">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                </span>
                <h2 className="font-display text-sm font-bold text-ink">Your week at a glance</h2>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-cream/60 px-3 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">Open hours</dt>
                  <dd className="mt-0.5 font-display text-lg font-bold text-ink">{fmtHours(managedMinutes)}</dd>
                </div>
                <div className="rounded-lg bg-cream/60 px-3 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">Upcoming</dt>
                  <dd className="mt-0.5 font-display text-lg font-bold text-ink">
                    {managed ? (upcomingBy.get(managed.id) ?? 0) : 0}
                  </dd>
                </div>
              </dl>
              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">Days covered</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {MON_FIRST.map((d) => {
                    const on = managedDays.includes(d);
                    return (
                      <span
                        key={d}
                        className={cn(
                          "inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md text-[10.5px] font-bold",
                          on ? "bg-primary-600 text-white" : "bg-cream text-ink-faint ring-1 ring-ink/5"
                        )}
                      >
                        {DAYS[d]}
                      </span>
                    );
                  })}
                </div>
              </div>
              {!managedSlots.length && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] font-medium leading-snug text-amber-800">
                  No windows yet — you can&apos;t confirm a session until you add at least one.
                </p>
              )}
            </section>
          )}

          {/* How availability drives the appointments board. */}
          <section className="rounded-2xl border border-primary-100 bg-gradient-to-br from-blue-50/70 via-white to-cream p-5 shadow-card">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              </span>
              <h2 className="font-display text-sm font-bold text-ink">How it connects</h2>
            </div>
            <ul className="mt-3 space-y-2.5">
              {[
                "Confirm and reschedule only offer times inside these windows.",
                "Times already booked by an active session are greyed out.",
                "Remove a slot and new bookings stop immediately.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-muted">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
            <Link
              href="/appointments"
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-primary-700 hover:underline"
            >
              Go to appointments
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
