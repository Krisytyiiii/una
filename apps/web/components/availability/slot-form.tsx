"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, CalendarClock, CalendarDays, CalendarPlus, Clock, Loader2, Plus, Repeat, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type AvailabilityInput } from "@dorsu/shared-schemas";
import type { AvailabilityCounselor, AvailabilitySlot } from "@/lib/hooks/use-availability-board";
import { DAYS, MON_FIRST, fmtHours, hhmm, slotMinutes } from "@/lib/availability";
import { cn } from "@/lib/utils";
import { Button, FieldError } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import { TimePicker } from "@/components/shared/time-picker";
import { Tooltip } from "@/components/ui/tooltip";

export type PendingSlots = {
  days: number[];
  startTime: string;
  endTime: string;
  isRecurring: boolean;
};

/** Busy id for the add-slot mutation (removes use the slot id itself). */
export const SLOT_ADD_BUSY_ID = "slot-add";

/** Busy id for the accept-bookings toggle (counselors.is_available). */
export const SLOT_TOGGLE_BUSY_ID = "slot-toggle";

// Same time rules as the shared availabilitySchema, minus weekday and
// counselorId (days are picked as multi-chips and submitted as one row per
// day; the counselor is resolved by the page). Kept local on purpose — the
// shared schema requires counselorId + weekday, so it is not equivalent.
const slotTimeSchema = z
  .object({
    startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM"),
    endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM"),
    isRecurring: z.boolean().default(true),
  })
  .refine((v) => v.startTime < v.endTime, {
    message: "Start time must be before end time",
    path: ["endTime"],
  });

/**
 * Slot manager — counselor-only section: the managed counselor's slot list,
 * the add-slot form (day chips + shared TimePickers), and the add/remove
 * confirm dialogs. The page owns persistence via onAdd/onRemove.
 */
export function SlotForm({
  role,
  isOffice,
  counselors,
  managed,
  managedId,
  onManagedChange,
  managedSlots,
  upcomingCount,
  available,
  toggleBusy,
  busyId,
  addBusy,
  openMenuKey,
  onOpenMenuChange,
  onAdd,
  onRemove,
  onToggleAvailable,
}: {
  role: string | null;
  isOffice: boolean;
  counselors: AvailabilityCounselor[];
  managed: AvailabilityCounselor | undefined;
  managedId: string;
  onManagedChange: (id: string) => void;
  managedSlots: AvailabilitySlot[];
  upcomingCount: number;
  /** Whether the managed counselor is currently accepting bookings. */
  available: boolean;
  /** True while the availability toggle is writing. */
  toggleBusy: boolean;
  /** In-flight mutation id (slot id for removes) — same contract as the appointments board. */
  busyId: string | null;
  /** True while the add-slot confirm is writing. */
  addBusy: boolean;
  openMenuKey: string | null;
  onOpenMenuChange: (k: string | null) => void;
  onAdd: (p: PendingSlots, counselorId: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  onToggleAvailable: (next: boolean) => Promise<boolean>;
}) {
  const { register, handleSubmit, formState, setValue, watch } = useForm<Omit<AvailabilityInput, "weekday" | "counselorId">>({
    resolver: zodResolver(slotTimeSchema),
    defaultValues: { startTime: "09:00", endTime: "12:00", isRecurring: true },
  });
  const [slotDays, setSlotDays] = useState<number[]>([1]);
  const [removeTarget, setRemoveTarget] = useState<AvailabilitySlot | null>(null);
  const [pendingSlots, setPendingSlots] = useState<PendingSlots | null>(null);
  // Group the slot list by weekday so the week reads top-to-bottom instead of
  // as one long undifferentiated list.
  const groupedSlots = useMemo(
    () =>
      MON_FIRST.map((d) => ({
        day: d,
        items: managedSlots
          .filter((s) => s.weekday === d)
          .slice()
          .sort((a, b) => a.start_time.localeCompare(b.start_time)),
      })).filter((g) => g.items.length > 0),
    [managedSlots]
  );
  const weeklyMinutes = managedSlots.reduce((a, s) => a + slotMinutes(s), 0);
  const coveredDays = new Set(managedSlots.map((s) => s.weekday)).size;

  const META_TONES: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    sky: "bg-sky-50 text-sky-700 ring-sky-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    primary: "bg-primary-50 text-primary-700 ring-primary-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  };

  // Compact meta badges — replaces the old dot-separated subtitle so each
  // figure reads as its own fact.
  const metaBadges = [
    {
      key: "days",
      icon: CalendarDays,
      label: `${coveredDays}/7 days covered`,
      tone: coveredDays === 7 ? "emerald" : coveredDays === 0 ? "rose" : "sky",
      hint: "Days with at least one published window.",
    },
    {
      key: "slots",
      icon: CalendarClock,
      label: `${managedSlots.length} slot${managedSlots.length === 1 ? "" : "s"}`,
      tone: "primary",
      hint: "Bookable windows in the weekly schedule.",
    },
    {
      key: "hours",
      icon: Clock,
      label: `${fmtHours(weeklyMinutes)}/week`,
      tone: "violet",
      hint: "Total bookable time across all windows.",
    },
    {
      key: "upcoming",
      icon: CalendarCheck,
      label: `${upcomingCount} upcoming`,
      tone: "amber",
      hint: "Upcoming sessions already on the calendar.",
    },
  ] as const;

  // The remove confirm stays open while its mutation is in flight (busyId
  // tracks the slot id) — same loading contract as the appointment dialogs:
  // spinner + blocked close, dialog closes only when the write lands so a
  // failure can be retried without reopening.
  const removing = removeTarget !== null && busyId === removeTarget.id;
  // Confirm dialogs: Escape closes, background stays put while open. Escape
  // and backdrop are blocked mid-write so a mutation is never orphaned.
  useEffect(() => {
    if (!pendingSlots && !removeTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (addBusy || removing) return;
      setPendingSlots(null);
      setRemoveTarget(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [pendingSlots, removeTarget, addBusy, removing]);

  return (
    <>
      <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent-700 ring-1 ring-accent-200">
              <CalendarPlus className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-ink">
                {role === "counselor" ? "My weekly availability" : "Manage availability"}
              </h2>
              {managed ? (
                <p className="mt-0.5 text-[12.5px] font-semibold text-ink-muted">{managed.name}</p>
              ) : (
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
                  Pick a counselor to manage their slots.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5 sm:flex-none">
            {managed &&
              metaBadges.map((b) => (
                <Tooltip
                  key={b.key}
                  content={b.hint}
                  align="end"
                  className={cn(
                    "inline-flex cursor-default items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ring-inset",
                    META_TONES[b.tone]
                  )}
                >
                  <b.icon className="h-3 w-3" aria-hidden />
                  {b.label}
                </Tooltip>
              ))}
            {isOffice && (
              <div className="w-full max-w-xs sm:w-56">
                <Dropdown
                  menuKey="managed-counselor"
                  openMenuKey={openMenuKey}
                  onOpenChange={onOpenMenuChange}
                  value={managedId}
                  onChange={onManagedChange}
                  ariaLabel="Choose counselor to manage"
                  options={counselors.map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>
            )}
          </div>
        </div>

        {/* Accepting-bookings switch — pauses new student requests without
            deleting a single window. Backed by counselors.is_available. */}
        {managed && (
          <div
            className={cn(
              "mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5",
              available
                ? "border-emerald-200 bg-emerald-50/60"
                : "border-amber-200 bg-amber-50/70"
            )}
          >
            <div className="flex items-start gap-2.5">
              <span className="relative mt-0.5 flex h-2.5 w-2.5 shrink-0" aria-hidden>
                {available && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                )}
                <span
                  className={cn(
                    "relative inline-flex h-2.5 w-2.5 rounded-full",
                    available ? "bg-emerald-500" : "bg-amber-500"
                  )}
                />
              </span>
              <div>
                <p className="text-[12.5px] font-bold text-ink">
                  {available ? "Accepting bookings" : "Bookings paused"}
                </p>
                <p className="mt-0.5 text-[11px] font-medium leading-snug text-ink-muted">
                  {available
                    ? "Students can request sessions inside your windows."
                    : "Your slots are saved — students just can't book new sessions until you switch this back on."}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={available}
              aria-label={available ? "Pause new bookings" : "Resume accepting bookings"}
              disabled={toggleBusy}
              onClick={() => void onToggleAvailable(!available)}
              className={cn(
                "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 disabled:opacity-60",
                available ? "bg-emerald-500" : "bg-ink/25"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform",
                  available ? "translate-x-5" : "translate-x-0"
                )}
              >
                {toggleBusy && <Loader2 className="h-3 w-3 animate-spin text-ink-muted" aria-hidden />}
              </span>
            </button>
          </div>
        )}

        {groupedSlots.length ? (
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {groupedSlots.map((g) => (
              <div key={g.day} className="rounded-xl border border-ink/10 bg-cream/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-soft">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[9px] font-bold text-white">
                      {DAYS[g.day].slice(0, 1)}
                    </span>
                    {DAYS[g.day]}
                  </span>
                  <span className="text-[10.5px] font-bold text-ink-faint">
                    {fmtHours(g.items.reduce((a, s) => a + slotMinutes(s), 0))}
                  </span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {g.items.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-ink/5"
                    >
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden />
                        <span className="truncate text-[13px] font-semibold text-ink">
                          {hhmm(s.start_time)}–{hhmm(s.end_time)}
                        </span>
                        {s.is_recurring && (
                          <Repeat className="h-3 w-3 shrink-0 text-ink-faint" aria-label="Repeats weekly" />
                        )}
                      </span>
                      <button
                        type="button"
                        disabled={busyId === s.id}
                        onClick={() => setRemoveTarget(s)}
                        aria-label={`Remove ${DAYS[s.weekday]} ${hhmm(s.start_time)}–${hhmm(s.end_time)} slot`}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        {busyId === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        )}
                        <span className="sr-only">Remove</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink/10 bg-cream/20 px-4 py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink-faint ring-1 ring-ink/10">
              <CalendarPlus className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-2 text-sm font-bold text-ink">No availability yet</p>
            <p className="mt-0.5 max-w-[320px] text-[12.5px] leading-relaxed text-ink-muted">
              {managed
                ? "Add your first weekly window below — students can only book times that fall inside it."
                : "Pick a counselor above to see and manage their windows."}
            </p>
          </div>
        )}

        {managed && (
          <div
            id="add-availability"
            className="mt-4 scroll-mt-24 rounded-xl border border-primary-100 bg-gradient-to-br from-blue-50/60 via-white to-cream p-4"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-white">
                <Plus className="h-3.5 w-3.5" aria-hidden />
              </span>
              <h3 className="text-[13px] font-bold text-ink">Add availability</h3>
            </div>
            <form
              className="mt-3 space-y-3"
              onSubmit={handleSubmit(async (v) => {
                if (!slotDays.length) {
                  toast.error("Choose at least one day for the slot.");
                  return;
                }
                setPendingSlots({
                  days: [...slotDays].sort((a, b) => MON_FIRST.indexOf(a) - MON_FIRST.indexOf(b)),
                  startTime: v.startTime,
                  endTime: v.endTime,
                  isRecurring: v.isRecurring,
                });
              })}
            >
              <div>
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                  Days
                </span>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Slot days">
                  {MON_FIRST.map((d) => {
                    const on = slotDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setSlotDays((prev) =>
                            prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                          )
                        }
                        className={
                          on
                            ? "h-8 min-w-[2.5rem] rounded-lg bg-primary-600 px-2.5 text-xs font-bold text-white shadow-soft"
                            : "h-8 min-w-[2.5rem] rounded-lg bg-white px-2.5 text-xs font-bold text-ink-soft ring-1 ring-ink/10 transition hover:bg-cream-dark"
                        }
                      >
                        {DAYS[d]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[120px]">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                    Start
                  </span>
                  <TimePicker
                    id="slot-start"
                    value={watch("startTime")}
                    onChange={(v) => setValue("startTime", v, { shouldValidate: true })}
                    ariaLabel="Start time"
                  />
                </div>
                <div className="min-w-[120px]">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                    End
                  </span>
                  <TimePicker
                    id="slot-end"
                    value={watch("endTime")}
                    onChange={(v) => setValue("endTime", v, { shouldValidate: true })}
                    ariaLabel="End time"
                  />
                  <FieldError message={formState.errors.endTime?.message} />
                </div>
                <label className="flex items-center gap-2 pb-2 text-[13px] font-semibold text-ink-soft">
                  <input type="checkbox" className="h-4 w-4 accent-[#2563EB]" {...register("isRecurring")} />
                  Repeats weekly
                </label>
                <Button disabled={busyId !== null} className="mb-0.5">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  {slotDays.length > 1 ? `Add ${slotDays.length} slots` : "Add slot"}
                </Button>
              </div>
              <p className="text-[11px] font-medium text-ink-faint">
                {slotDays.length
                  ? `${slotDays.map((d) => DAYS[d]).join(", ")} · ${watch("startTime")}–${watch("endTime")} · ${watch("isRecurring") ? "repeats weekly" : "one-off"}`
                  : "Pick at least one day to continue."}
              </p>
            </form>
          </div>
        )}
      </section>

      {/* Add-slots confirm */}
      {pendingSlots && managed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="slot-add-title"
          aria-describedby="slot-add-desc"
        >
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => { if (!addBusy) setPendingSlots(null); }} />
          <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-card">
            <h2 id="slot-add-title" className="font-display text-lg font-bold text-ink">
              Add {pendingSlots.days.length} slot{pendingSlots.days.length === 1 ? "" : "s"}?
            </h2>
            <p id="slot-add-desc" className="mt-1 text-sm leading-relaxed text-ink-muted">
              This opens new bookings for {managed.name}.
            </p>
            <div className="mt-3 space-y-1.5 rounded-lg bg-cream px-3 py-2.5 text-[13px] font-semibold text-ink-soft">
              <p>{pendingSlots.days.map((d) => DAYS[d]).join(", ")}</p>
              <p>
                {pendingSlots.startTime}–{pendingSlots.endTime} · {pendingSlots.isRecurring ? "Repeats weekly" : "One-off"}
              </p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={addBusy} onClick={() => setPendingSlots(null)} autoFocus>
                Back
              </Button>
              <Button
                size="sm"
                variant="primary"
                loading={addBusy}
                onClick={() => {
                  const p = pendingSlots;
                  const cid = managed.id;
                  void (async () => {
                    const ok = await onAdd(p, cid);
                    if (ok) setPendingSlots(null);
                  })();
                }}
              >
                {addBusy ? "Adding…" : pendingSlots.days.length > 1 ? `Add ${pendingSlots.days.length} slots` : "Add slot"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove-slot confirm */}
      {removeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="slot-remove-title"
          aria-describedby="slot-remove-desc"
        >
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => { if (!removing) setRemoveTarget(null); }} />
          <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-card">
            <h2 id="slot-remove-title" className="font-display text-lg font-bold text-ink">Remove this slot?</h2>
            <p id="slot-remove-desc" className="mt-1 text-sm leading-relaxed text-ink-muted">
              {DAYS[removeTarget.weekday]} · {hhmm(removeTarget.start_time)}–{hhmm(removeTarget.end_time)} will stop
              accepting new bookings. This can&apos;t be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={removing} onClick={() => setRemoveTarget(null)} autoFocus>
                Back
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={removing}
                onClick={() => {
                  const id = removeTarget.id;
                  void (async () => {
                    const ok = await onRemove(id);
                    if (ok) setRemoveTarget(null);
                  })();
                }}
              >
                {removing ? "Removing…" : "Remove slot"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
