import { colors } from "@dorsu/ui-tokens";

/**
 * Chart palette for the light dashboard canvas.
 *
 * The reports palette (`lib/report-palette.ts`) uses deep primary/accent steps.
 * These mirror its semantic keys with readable steps on white, so the strict
 * blue/yellow rule survives: blues carry flow and progression, yellows carry
 * attention and terminal states.
 */

/** Deeper steps for the light dashboard canvas (same semantics). */
export const LIGHT_STATUS_COLORS: Record<string, string> = {
  pending: colors.yellow[500],
  assigned: colors.blue[400],
  acknowledged: colors.blue[500],
  in_progress: colors.blue[600],
  confirmed: colors.blue[700],
  escalated: colors.yellow[600],
  resolved: colors.blue[800],
  rejected: colors.yellow[700],
};

export const LIGHT_PRIORITY_COLORS: Record<string, string> = {
  urgent: colors.yellow[600],
  high: colors.yellow[500],
  medium: colors.blue[600],
  low: colors.blue[400],
};

export const LIGHT_APPOINTMENT_COLORS: Record<string, string> = {
  pending: colors.yellow[500],
  assigned: colors.yellow[600],
  confirmed: colors.blue[400],
  completed: colors.blue[700],
  no_show: colors.yellow[700],
  cancelled: colors.blue[200],
  rejected: colors.yellow[700],
};

export const LIGHT_MODE_COLORS: Record<string, string> = {
  online: colors.blue[600],
  in_person: colors.blue[400],
};

/**
 * Fixed office-snapshot metrics. These are different units (sessions, people,
 * chats), so the shades are categorical rather than a single-hue ramp: blues
 * for throughput, yellow for the one queue that needs attention.
 */
export const LIGHT_SNAPSHOT_COLORS: Record<string, string> = {
  upcomingSessions: colors.blue[800],
  sessionsToday: colors.blue[600],
  activeStudents: colors.blue[400],
  activeCounselors: colors.blue[300],
  referralsWaiting: colors.yellow[500],
  openChats: colors.blue[200],
};

/** Deeper steps for the light dashboard canvas (same semantics). */
export const LIGHT_CLASSIFICATION_COLORS: Record<string, string> = {
  Behavioral: colors.yellow[500],
  Relational: colors.blue[500],
  Financial: colors.blue[400],
  Absenteeism: colors.yellow[600],
  "Social Adjustment": colors.blue[400],
  "Academic-related": colors.blue[700],
  Health: colors.yellow[600],
  Others: colors.blue[300],
};

const LIGHT_FALLBACK = colors.blue[500];

export function lightStatusColor(key: string): string {
  return LIGHT_STATUS_COLORS[key] ?? LIGHT_FALLBACK;
}

export function lightPriorityColor(key: string): string {
  return LIGHT_PRIORITY_COLORS[key] ?? LIGHT_FALLBACK;
}

export function lightClassificationColor(key: string): string {
  return LIGHT_CLASSIFICATION_COLORS[key] ?? LIGHT_FALLBACK;
}

export function lightSnapshotColor(key: string): string {
  return LIGHT_SNAPSHOT_COLORS[key] ?? LIGHT_FALLBACK;
}

export function lightAppointmentStatusColor(key: string): string {
  return LIGHT_APPOINTMENT_COLORS[key] ?? LIGHT_FALLBACK;
}

export function lightModeColor(key: string): string {
  return LIGHT_MODE_COLORS[key] ?? LIGHT_FALLBACK;
}
