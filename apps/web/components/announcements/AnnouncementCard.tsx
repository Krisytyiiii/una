"use client";

import {
  CalendarClock,
  Check,
  Clock,
  Image as ImageIcon,
  Send,
  Trash2,
  Undo2,
  Users,
} from "lucide-react";
import { timeAgoWithDate, initials } from "@/lib/format";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export type Announcement = {
  id: string;
  author_profile_id: string;
  title: string;
  body: string;
  audience: string[] | null;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
};

export function statusOf(a: Announcement, now: number): "published" | "draft" | "scheduled" {
  if (!a.published_at) return "draft";
  return new Date(a.published_at).getTime() <= now ? "published" : "scheduled";
}

export function statusTone(s: string): "success" | "warning" | "info" {
  if (s === "published") return "success";
  if (s === "scheduled") return "info";
  return "warning";
}

export function audienceLabel(a: string[] | null): string {
  if (!a || !a.length) return "Everyone";
  const names: Record<string, string> = { student: "Students", counselor: "Counselors", faculty: "Faculty", guidance_head: "Head" };
  return a.map((r) => names[r] ?? r).join(", ");
}

const STATUS_META = {
  published: { label: "Published", chip: "bg-emerald-100 text-emerald-800 ring-emerald-200", icon: Check },
  scheduled: { label: "Scheduled", chip: "bg-violet-100 text-violet-800 ring-violet-200", icon: CalendarClock },
  draft: { label: "Draft", chip: "bg-amber-100 text-amber-800 ring-amber-200", icon: Clock },
} as const;

/**
 * Single newsfeed post. Page owns publishing/mutations; this is pure
 * presentation — status strip, author row, body, optional photo, actions.
 */
export function AnnouncementCard({
  a,
  now,
  authorName,
  isHead,
  busyId,
  onPublish,
  onUnpublish,
  onDelete,
  focused,
}: {
  a: Announcement;
  now: number;
  authorName: string;
  isHead: boolean;
  busyId: string | null;
  onPublish: (a: Announcement) => void;
  onUnpublish: (a: Announcement) => void;
  onDelete: (a: Announcement) => void;
  focused?: boolean;
}) {
  const st = statusOf(a, now);
  const meta = STATUS_META[st];
  const StatusIcon = meta.icon;

  return (
    <article
      key={a.id}
      id={`focus-${a.id}`}
      className={cn(
        "group overflow-hidden rounded-xl border bg-white shadow-card transition-colors",
        st === "draft" ? "border-amber-200" : st === "scheduled" ? "border-violet-200" : "border-ink/10",
        "hover:border-primary-200",
        focused && "scroll-mt-24 ring-2 ring-primary-500 ring-offset-2 ring-offset-white"
      )}
    >
      {/* Status strip — only non-live posts carry one so the live feed stays calm. */}
      {st !== "published" && (
        <div className={cn("h-1 w-full", st === "draft" ? "bg-amber-400" : "bg-violet-400")} aria-hidden />
      )}

      <div className="p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-600 to-primary-700 font-display text-sm font-bold text-white ring-2 ring-primary-100"
          >
            {initials(authorName)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-sm font-bold text-ink">{authorName}</p>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ring-inset",
                  meta.chip
                )}
              >
                <StatusIcon className="h-2.5 w-2.5" aria-hidden />
                {meta.label}
              </span>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] font-medium text-ink-muted">
              <span>{timeAgoWithDate(a.published_at ?? a.created_at)}</span>
              <span aria-hidden className="text-ink-faint">·</span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" aria-hidden />
                {audienceLabel(a.audience)}
              </span>
              {a.image_url && (
                <>
                  <span aria-hidden className="text-ink-faint">·</span>
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" aria-hidden />
                    Photo
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <h2 className="mt-3 font-display text-lg font-bold leading-snug text-ink">{a.title}</h2>
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{a.body}</p>

        {a.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.image_url}
            alt=""
            loading="lazy"
            className="mt-3 max-h-96 w-full rounded-lg border border-ink/10 object-cover"
          />
        )}

        {isHead && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-ink/10 pt-3">
            {st !== "published" ? (
              <Button
                size="sm"
                variant="accent"
                loading={busyId === `pub-${a.id}`}
                onClick={() => onPublish(a)}
                className="gap-1.5"
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                {busyId === `pub-${a.id}` ? "Publishing…" : "Publish"}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                loading={busyId === `unpub-${a.id}`}
                onClick={() => onUnpublish(a)}
                className="gap-1.5"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden />
                {busyId === `unpub-${a.id}` ? "Unpublishing…" : "Unpublish"}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              loading={busyId === a.id}
              onClick={() => onDelete(a)}
              className="gap-1.5 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              {busyId === a.id ? "Deleting…" : "Delete"}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
