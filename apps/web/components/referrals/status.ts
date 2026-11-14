import { AlertTriangle, Check, CheckCheck, X } from "lucide-react";
import type {
  ReferralsAction,
  ReferralsRow,
} from "@/lib/hooks/use-referrals-board";

/** Board row / trail aliases — single source of truth lives in use-referrals-board. */
export type Referral = ReferralsRow;
export type RefAction = ReferralsAction;

/** Core strict flow — mirrors appointment statuses (pending → assigned →
 * confirmed → resolved, plus rejected/escalated). Legacy acknowledged /
 * in_progress rows still render under "All" but have no pill and no entry
 * buttons; they exit via counselor resolve / escalate. */
export const STATUSES = ["pending", "assigned", "confirmed", "resolved", "escalated", "rejected"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

/**
 * Official sheet Case Classification (FM-DOrSU-GCTC-02) in paper order:
 * left column first, then right column. Keep in sync with
 * REFERRAL_CLASSIFICATIONS in @dorsu/shared-types.
 */
export const CLASSIFICATIONS = [
  "Behavioral",
  "Relational",
  "Financial",
  "Absenteeism",
  "Social Adjustment",
  "Academic-related",
  "Health",
  "Others",
] as const;

/** Left / right checkbox columns exactly as printed on the paper form. */
export const CLASSIFICATION_COLUMNS = [
  ["Behavioral", "Relational", "Financial", "Absenteeism"],
  ["Social Adjustment", "Academic-related", "Health", "Others"],
] as const;

/** "Academic-related, Health" or "Academic-related +2" for compact rows. */
export function classificationSummary(c: readonly string[] | null | undefined): string {
  const list = (c ?? []).filter(Boolean);
  if (!list.length) return "Not specified";
  if (list.length <= 2) return list.join(", ");
  return `${list.slice(0, 2).join(", ")} +${list.length - 2}`;
}

/**
 * Queue display name — privacy-safe alias for linked students, typed paper
 * name for walk-ins (no account yet), "Student" when neither resolves.
 */
export function referralStudentName(
  r: { student_id: string | null; student_name_text?: string | null },
  aliases: Map<string, string>
): string {
  if (r.student_id) return aliases.get(r.student_id) || r.student_name_text?.trim() || "Student";
  return r.student_name_text?.trim() || "Student";
}

export function statusTone(s: string): "info" | "success" | "warning" | "danger" {
  if (s === "resolved") return "success";
  if (s === "escalated" || s === "rejected") return "danger";
  if (s === "assigned" || s === "confirmed") return "info";
  return "warning";
}

export function priorityTone(p: string): "info" | "success" | "warning" | "danger" {
  if (p === "urgent") return "danger";
  if (p === "high") return "warning";
  if (p === "medium") return "info";
  return "success";
}

/**
 * Distinct badge hue per referral status/priority — same treatment as the
 * appointments board (one hue each) so rows stay scannable.
 */
export function statusBadgeClass(s: string): string {
  const base = "inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset";
  switch (s) {
    case "pending":
      return `${base} bg-amber-100 text-amber-800 ring-amber-200`;
    case "assigned":
      return `${base} bg-sky-100 text-sky-800 ring-sky-200`;
    case "confirmed":
      return `${base} bg-violet-100 text-violet-800 ring-violet-200`;
    case "resolved":
      return `${base} bg-emerald-100 text-emerald-800 ring-emerald-200`;
    case "escalated":
      return `${base} bg-rose-100 text-rose-700 ring-rose-200`;
    case "rejected":
      return `${base} bg-slate-100 text-slate-600 ring-slate-200`;
    default:
      return `${base} bg-ink/10 text-ink-muted ring-ink/10`;
  }
}

export function priorityBadgeClass(p: string): string {
  const base = "inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset";
  switch (p) {
    case "urgent":
      return `${base} bg-red-100 text-red-800 ring-red-200`;
    case "high":
      return `${base} bg-orange-100 text-orange-800 ring-orange-200`;
    case "medium":
      return `${base} bg-blue-100 text-blue-800 ring-blue-200`;
    case "low":
      return `${base} bg-slate-100 text-slate-600 ring-slate-200`;
    default:
      return `${base} bg-ink/10 text-ink-muted ring-ink/10`;
  }
}

/** Re-exported from shared lib — do not redefine locally. */
import { statusLabel } from "@/lib/format";
export { statusLabel };

/**
 * Assignment stays open only while the referral is waiting on the counselor:
 * pending (pick one) and assigned (reassign before confirmation). Everything
 * confirmed or later is locked — mirrors REFERRAL_ASSIGNABLE_STATUSES in
 * @dorsu/shared-services, which enforces the same rule server-side.
 */
export const ASSIGNABLE_STATUSES = ["pending", "assigned"] as const;

export function isReferralAssignable(status: string): boolean {
  return (ASSIGNABLE_STATUSES as readonly string[]).includes(status);
}

/** Short reason shown where the counselor picker would otherwise appear. */
export function assignmentLockNote(status: string): string {
  if (status === "confirmed") return "Confirmed — assignment is locked.";
  if (status === "resolved") return "Resolved — assignment is locked.";
  if (status === "rejected") return "Rejected — assignment is locked.";
  if (status === "escalated") return "Escalated — assignment is locked.";
  return "In progress — assignment is locked.";
}

export const HEAD_LEGEND: { icon: typeof Check; label: string; desc: string; variant: "accent" | "outline" }[] = [
  { icon: Check, label: "Assign", desc: "Pending → assigned (reassign until confirmed)", variant: "accent" },
  { icon: X, label: "Reject", desc: "Pending → rejected", variant: "outline" },
];

export const COUNSELOR_LEGEND: { icon: typeof Check; label: string; desc: string; variant: "accent" | "outline" }[] = [
  { icon: Check, label: "Confirm", desc: "Assigned → confirmed + creates session", variant: "accent" },
  { icon: CheckCheck, label: "Resolve", desc: "Confirmed → resolved (once session time passes)", variant: "accent" },
  { icon: AlertTriangle, label: "Escalate", desc: "Flag as urgent", variant: "outline" },
];

/** Strict triage moves — assign happens in the Counselor column, never here. */
export type TriageKind = "confirmed" | "resolved" | "escalated" | "rejected";

export const TRIAGE_COPY: Record<TriageKind, { title: string; body: string; ok: string }> = {
  confirmed: { title: "Confirm and schedule this session?", body: "Set the final session date and time plus how you'll meet. Confirming creates the session itself — the student is notified with the schedule.", ok: "Confirm session" },
  resolved: { title: "Resolve this referral?", body: "Closes the loop — the student needs a confirmed session with a schedule first, and the session time must have passed. Resolve stays blocked until then. After resolving you can attach the optional confidential record (notes, images, follow-up) for the linked session.", ok: "Resolve" },
  escalated: { title: "Escalate this referral?", body: "Flags it as needing urgent attention from leadership.", ok: "Escalate" },
  rejected: { title: "Reject this referral?", body: "The referral ends as Rejected and leaves the queue. This can't be undone.", ok: "Reject referral" },
};

/**
 * Next moves per status, split by role — same split as appointments:
 * admin assigns + rejects, counselor confirms + resolves + escalates. Pending
 * items wait for assignment; assigned items wait for counselor confirmation.
 * Legacy acknowledged / in_progress only exit via counselor resolve/escalate.
 */
export const COUNSELOR_NEXT: Record<string, TriageKind[]> = {
  pending: [],
  assigned: ["confirmed", "escalated"],
  confirmed: ["resolved", "escalated"],
  escalated: ["confirmed", "resolved"],
  acknowledged: ["resolved", "escalated"],
  in_progress: ["resolved", "escalated"],
  resolved: [],
  rejected: [],
};

export const HEAD_NEXT: Record<string, TriageKind[]> = {
  pending: ["rejected"],
  assigned: [],
  acknowledged: [],
  in_progress: [],
  confirmed: [],
  escalated: [],
  resolved: [],
  rejected: [],
};

export const ACTION_ICON: Record<TriageKind, typeof Check> = {
  confirmed: Check,
  resolved: CheckCheck,
  escalated: AlertTriangle,
  rejected: X,
};

/** Shown whenever resolve is attempted without a confirmed scheduled session. */
export const NO_SESSION_MSG =
  "Resolve needs a confirmed session first — confirm the student's appointment with its schedule before closing this referral.";

/** Role-split next moves for a status — counselors confirm/resolve/escalate, heads reject. */
export function nextMoves(status: string, isCounselor: boolean): TriageKind[] {
  return isCounselor ? (COUNSELOR_NEXT[status] ?? []) : (HEAD_NEXT[status] ?? []);
}
