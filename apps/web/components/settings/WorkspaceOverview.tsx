"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  FileSpreadsheet,
  Inbox,
  MapPin,
  Megaphone,
  Phone,
  Users,
} from "lucide-react";
import { Button, Input } from "@/components/ui/primitives";
import { ExportReportsButton } from "@/components/shared/reports-actions";
import { timeAgo } from "@/lib/format";
import type { SettingsPost } from "@/lib/hooks/use-settings-board";
import { cn } from "@/lib/utils";

/**
 * Head-only workspace edit form (overview tab).
 */
export function WorkspaceForm({
  officeName,
  officeLocation,
  officeContact,
  saving,
  onOfficeName,
  onOfficeLocation,
  onOfficeContact,
  onSave,
}: {
  officeName: string;
  officeLocation: string;
  officeContact: string;
  saving: string | null;
  onOfficeName: (v: string) => void;
  onOfficeLocation: (v: string) => void;
  onOfficeContact: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
      <div className="flex items-start justify-between gap-3 border-b border-ink/10 bg-cream/20 px-5 py-3.5">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <Building2 className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-ink">Workspace identity</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">Shown in the sidebar on every staff page.</p>
          </div>
        </div>
        <span className="hidden shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold text-ink-muted ring-1 ring-ink/10 sm:inline-flex">
          Head only
        </span>
      </div>

      <div className="p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="office-name">Office name</label>
            <Input id="office-name" value={officeName} onChange={(e) => onOfficeName(e.target.value)} placeholder="DOrSU Guidance" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="office-location">Location</label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
              <Input id="office-location" className="pl-8" value={officeLocation} onChange={(e) => onOfficeLocation(e.target.value)} placeholder="Mati City" />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="office-contact">Contact (optional)</label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
              <Input id="office-contact" className="pl-8" value={officeContact} onChange={(e) => onOfficeContact(e.target.value)} placeholder="guidance@dorsu.edu.ph" />
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3">
          <p className="text-[11px] font-medium text-ink-faint">Changes reach the sidebar within a minute.</p>
          <Button size="sm" loading={saving === "office"} onClick={onSave}>
            {saving === "office" ? "Saving…" : "Save workspace"}
          </Button>
        </div>
      </div>
    </section>
  );
}

/**
 * Head-only right column — office at a glance, latest posts, data export.
 * Stat cards now link straight to the owning page.
 */
export function WorkspaceOverview({
  loading,
  counselorsCount,
  sessionsToday,
  openReferrals,
  published,
  posts,
}: {
  loading: boolean;
  counselorsCount: number;
  sessionsToday: number;
  openReferrals: number;
  published: number;
  posts: SettingsPost[];
}) {
  const stats: {
    label: string;
    value: number;
    icon: typeof Users;
    href: string;
    tone: string;
    iconTone: string;
  }[] = [
    { label: "Counselors", value: counselorsCount, icon: Users, href: "/users", tone: "border-primary-100 bg-primary-50/50", iconTone: "text-primary-700 bg-primary-100" },
    { label: "Sessions today", value: sessionsToday, icon: CalendarDays, href: "/sessions", tone: "border-blue-100 bg-blue-50/50", iconTone: "text-blue-700 bg-blue-100" },
    { label: "Referrals waiting", value: openReferrals, icon: Inbox, href: "/referrals", tone: "border-accent-200 bg-accent-50/60", iconTone: "text-accent-700 bg-accent-100" },
    { label: "Posts live", value: published, icon: Megaphone, href: "/announcements", tone: "border-green-100 bg-green-50/50", iconTone: "text-green-700 bg-green-100" },
  ];

  return (
    <div className="min-w-0 space-y-4">
      <section className="rounded-xl border border-ink/10 bg-white p-5 shadow-card">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-ink">Office at a glance</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">Tap a card to jump to its workspace.</p>
          </div>
        </div>
        {loading ? (
          <div className="mt-3 grid animate-pulse grid-cols-2 gap-2.5" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[74px] rounded-xl bg-ink/10" />
            ))}
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {stats.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className={cn(
                  "group rounded-xl border p-3 transition hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                  s.tone
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("flex h-6 w-6 items-center justify-center rounded-lg", s.iconTone)}>
                    <s.icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-ink-faint opacity-0 transition group-hover:opacity-100" aria-hidden />
                </div>
                <p className="mt-1.5 font-display text-2xl font-bold leading-none tabular-nums text-ink">{s.value}</p>
                <p className="mt-0.5 truncate text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">{s.label}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-ink/10 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold text-ink">Latest posts</h2>
          <Link
            href="/announcements"
            className="inline-flex items-center gap-1 text-[12px] font-bold text-primary-600 hover:underline"
          >
            View all
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
        {loading ? (
          <div className="animate-pulse space-y-2 pt-3" aria-hidden>
            <div className="h-10 rounded-lg bg-ink/10" />
            <div className="h-10 rounded-lg bg-ink/10" />
          </div>
        ) : posts.length ? (
          <ul className="mt-2 divide-y divide-ink/10">
            {posts.slice(0, 3).map((p) => (
              <li key={p.id} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
                <span
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    p.published_at ? "bg-green-500" : "bg-accent-400"
                  )}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-bold text-ink">{p.title}</p>
                  <p className="text-[10.5px] font-medium text-ink-faint">
                    {p.published_at ? "Published" : "Draft"} · {timeAgo(p.published_at ?? p.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[12.5px] text-ink-muted">No posts yet.</p>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
        <div className="flex items-start gap-2.5 border-b border-ink/10 bg-cream/20 px-5 py-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-ink">Data export</h2>
            <p className="mt-0.5 text-[12px] text-ink-muted">Aliases only — never student names.</p>
          </div>
        </div>
        <div className="p-5">
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            One styled workbook — cover, summary, sessions, referrals, feedback, wellbeing, team &amp; posts.
            Print-ready with filters, totals &amp; proper spacing.
          </p>
          <div className="mt-3 print:hidden">
            <ExportReportsButton />
          </div>
        </div>
      </section>
    </div>
  );
}
