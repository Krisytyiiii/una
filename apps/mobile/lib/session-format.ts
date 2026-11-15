import type { AppointmentRow } from '@dorsu/shared-types';

export type DayParts = {
  /** "NOV" */
  month: string;
  /** "19" */
  day: string;
  /** "Wed" */
  weekday: string;
  /** "2:30 PM" */
  time: string;
};

/** Local `HH:MM AM/PM` for a timestamp. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Date pieces used by the card's date badge and meta line (local time). */
export function dayParts(iso: string): DayParts {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    time: clockTime(iso),
  };
}

/** "Wednesday, November 19, 2026" — the details sheet's full date line. */
export function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "Wednesday, Nov 19" — compact date for secondary labels. */
export function weekdayDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/** "2:30 PM – 3:30 PM" when `ends_at` exists, otherwise the start time. */
export function timeRange(row: AppointmentRow): string {
  const start = clockTime(row.scheduled_at);
  if (!row.ends_at) return start;
  return `${start} – ${clockTime(row.ends_at)}`;
}

/** "Anxiety support session requested" -> "Anxiety support session". */
export function titleFor(row: AppointmentRow): string {
  const base = row.concern.replace(/\s+support session requested$/i, '').trim();
  return base === '' ? 'Counseling session' : `${base} session`;
}

export function modeLabel(row: AppointmentRow): string {
  return row.mode === 'online' ? 'Online · video call' : 'In person · Guidance Office';
}

/** Whole-calendar-day distance from today, used for the "next up" countdown. */
function dayDiff(iso: string, now: Date): number {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return 0;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOf(target) - startOf(now)) / 86_400_000);
}

/** "Today" / "Tomorrow" / "In 3 days" / "5 days ago". */
export function countdownLabel(iso: string, now: Date = new Date()): string {
  const diff = dayDiff(iso, now);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1) return `In ${diff} days`;
  if (diff === -1) return 'Yesterday';
  return `${Math.abs(diff)} days ago`;
}
