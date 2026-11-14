"use client";

import { Check, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { formatWhen, initials, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export type GlassLog = {
  id: string;
  accessor_profile_id: string;
  student_id: string;
  justification: string;
  accessed_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

/**
 * One break-glass access event row.
 * Shared by app/(admin)/security/page.tsx ("preview") and
 * app/(admin)/security/events/page.tsx ("full").
 * The variant switch keeps both pages' density appropriate while sharing the
 * review affordance; security-sensitive review logic stays in the pages and
 * arrives via onMarkReviewed.
 */
export function EventRow({
  log,
  accessorName,
  studentAlias,
  reviewerName,
  busy,
  variant,
  onMarkReviewed,
}: {
  log: GlassLog;
  accessorName: string | undefined;
  studentAlias: string | undefined;
  reviewerName: string | undefined;
  busy: boolean;
  variant: "preview" | "full";
  onMarkReviewed: (log: GlassLog) => void;
}) {
  const compact = variant === "preview";
  const reviewed = !!log.reviewed_at;

  return (
    <li
      className={cn(
        "relative border-l-2 pl-3 transition-colors sm:pl-4",
        reviewed ? "border-l-primary-400" : "border-l-red-400",
        compact ? "py-2.5 first:pt-0 last:pb-0" : "py-3.5 first:pt-0 last:pb-0",
        !compact && "hover:bg-cream/30"
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[11px] font-bold",
            reviewed ? "bg-primary-100 text-primary-700" : "bg-red-100 text-red-700"
          )}
        >
          {initials(accessorName ?? "Staff")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone={reviewed ? "success" : "danger"}>{reviewed ? "Reviewed" : "Unreviewed"}</Badge>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-faint">
              <Clock className="h-3 w-3" aria-hidden />
              {compact ? timeAgo(log.accessed_at) : formatWhen(log.accessed_at)}
            </span>
            {!reviewed && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onMarkReviewed(log)}
                className="ml-auto inline-flex h-6 items-center gap-1 rounded-full bg-primary-600 px-2.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-3 w-3" aria-hidden />
                )}
                {busy ? "Marking…" : "Mark reviewed"}
              </button>
            )}
          </div>

          <p className="mt-1 text-sm font-bold text-ink">
            {accessorName ?? "Staff"}
            <span className="font-medium text-ink-muted"> opened </span>
            {studentAlias ?? "Student"}
          </p>
          <p
            className={cn(
              "mt-0.5 text-[13px] text-ink-muted",
              compact ? "line-clamp-2" : "leading-relaxed"
            )}
          >
            {log.justification}
          </p>
          {reviewed && (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-ink-faint">
              <Check className="h-3 w-3 text-primary-500" aria-hidden />
              Reviewed by {reviewerName ?? "Head"} · {timeAgo(log.reviewed_at!)}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
