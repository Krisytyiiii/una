"use client";

import { Check, Lock, Loader2, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { initials, timeAgoShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { UsersProfile } from "@/lib/hooks/use-users-board";
import { RolePill } from "./RolePill";

/** Deterministic avatar gradients — the same person keeps the same color. */
const AVATAR_TONES = [
  "from-sky-500 to-blue-600",
  "from-violet-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-sky-600",
  "from-fuchsia-500 to-purple-600",
];

function avatarTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  inactive: "bg-ink/5 text-ink-muted ring-ink/10",
} as const;

/**
 * One directory table row — avatar, role pill, detail, status, joined, access.
 * Pending accounts get a faint amber wash so the approval queue stands out
 * without a second column of noise.
 */
export function UserRow({
  user,
  isSelf,
  busy,
  detail,
  onAccessToggle,
  onApprove,
}: {
  user: UsersProfile;
  isSelf: boolean;
  busy: boolean;
  detail: string | undefined;
  onAccessToggle: (user: UsersProfile) => void;
  onApprove: (user: UsersProfile) => void;
}) {
  const u = user;
  const pending = u.approval_status === "pending";
  const rejected = u.approval_status === "rejected";
  const status = pending ? "pending" : rejected ? "rejected" : u.is_active ? "active" : "inactive";
  const statusLabel = pending ? "Pending approval" : rejected ? "Rejected" : u.is_active ? "Active" : "Deactivated";
  const joined = new Date(u.created_at);
  // Only append "ago" to relative ages — timeAgoShort falls back to a date
  // label for anything older than a week.
  const shortAge = timeAgoShort(u.created_at);
  const ageLabel = /^(now|\d+[mhd])$/.test(shortAge)
    ? shortAge === "now"
      ? "just now"
      : `${shortAge} ago`
    : null;

  return (
    <tr
      className={cn(
        "group border-b border-ink/5 align-middle transition-colors last:border-0",
        pending ? "bg-amber-50/40 hover:bg-amber-50/70" : "hover:bg-cream/50"
      )}
    >
      <td className="px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-display text-xs font-bold text-white shadow-sm ring-2 ring-white",
              avatarTone(u.id)
            )}
          >
            {initials(u.full_name ?? u.email)}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-bold text-ink">{u.full_name ?? "Unnamed"}</span>
              {isSelf && (
                <span className="shrink-0 rounded-full bg-primary-50 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-primary-700 ring-1 ring-inset ring-primary-100">
                  You
                </span>
              )}
            </span>
            <span className="block truncate text-xs font-medium text-ink-muted">{u.email}</span>
          </span>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <RolePill role={u.role} />
      </td>
      <td className="max-w-[220px] truncate px-4 py-3 text-[13px] text-ink-muted" title={detail ?? ""}>
        {detail ?? "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-center">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset",
            STATUS_STYLES[status]
          )}
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
          {statusLabel}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <span className="block text-[13px] font-medium text-ink-soft">
          {joined.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
        {ageLabel && (
          <span className="block text-[10.5px] font-medium text-ink-faint">{ageLabel}</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        {isSelf ? (
          <span
            className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-faint"
            title="You can't change your own access"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Locked
          </span>
        ) : pending ? (
          <Button
            size="sm"
            variant="primary"
            disabled={busy}
            onClick={() => onApprove(u)}
            className="ml-auto gap-1.5"
            aria-busy={busy}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Check className="h-3.5 w-3.5" aria-hidden />
            )}
            {busy ? "Approving…" : "Approve"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant={u.is_active ? "danger" : "outline"}
            disabled={busy}
            onClick={() => onAccessToggle(u)}
            className={cn(
              "ml-auto gap-1.5",
              u.is_active
                ? "h-6 rounded-full px-3 text-[11px] shadow-none"
                : "hover:border-emerald-300 hover:text-emerald-700"
            )}
            aria-busy={busy}
          >
            {busy ? (
              <Loader2 className={cn("animate-spin", u.is_active ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden />
            ) : u.is_active ? (
              <PowerOff className="h-3 w-3" aria-hidden />
            ) : (
              <Power className="h-3.5 w-3.5" aria-hidden />
            )}
            {busy ? (u.is_active ? "Deactivating…" : "Activating…") : u.is_active ? "Deactivate" : "Activate"}
          </Button>
        )}
      </td>
    </tr>
  );
}
