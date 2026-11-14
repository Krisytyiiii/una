"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  Eraser,
  Search,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { Badge, Input } from "@/components/ui/primitives";
import { initials, timeAgo } from "@/lib/format";
import type { SettingsCounselor, SettingsFeedItem } from "@/lib/hooks/use-settings-board";
import { cn } from "@/lib/utils";

/**
 * Head-only counseling team section (team tab) — searchable and filterable.
 */
export function TeamSection({
  loading,
  counselors,
}: {
  loading: boolean;
  counselors: SettingsCounselor[];
}) {
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return counselors.filter((c) => {
      if (availableOnly && !c.available) return false;
      if (!q) return true;
      return `${c.name} ${c.spec ?? ""}`.toLowerCase().includes(q);
    });
  }, [counselors, query, availableOnly]);

  const availableCount = counselors.filter((c) => c.available).length;

  return (
    <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card" role="tabpanel">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 bg-cream/20 px-5 py-3.5">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <Users className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-ink">Counseling team</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              {counselors.length} counselor{counselors.length === 1 ? "" : "s"} · {availableCount} available now
            </p>
          </div>
        </div>
        <Link
          href="/users"
          className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-[11.5px] font-bold text-primary-700 transition hover:bg-primary-100"
        >
          Manage accounts
          <ArrowUpRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 px-5 py-2.5">
        <div className="relative w-full sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or specialization…"
            aria-label="Search counselors"
            className="h-8 pl-8"
          />
        </div>
        <button
          type="button"
          aria-pressed={availableOnly}
          onClick={() => setAvailableOnly((v) => !v)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
            availableOnly
              ? "bg-green-600 text-white shadow-sm"
              : "border border-ink/10 bg-white text-ink-soft hover:border-green-300 hover:text-green-700"
          )}
        >
          <UserCheck className="h-3.5 w-3.5" aria-hidden />
          Available only
        </button>
        {(query || availableOnly) && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setAvailableOnly(false);
            }}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-ink/15 bg-white px-2.5 text-[11.5px] font-bold text-ink-soft transition hover:border-red-300 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden />
            Clear
          </button>
        )}
        <span className="ml-auto text-[11px] font-medium text-ink-faint">
          {shown.length} of {counselors.length}
        </span>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2 p-5" aria-hidden>
          <div className="h-14 rounded-lg bg-ink/10" />
          <div className="h-14 rounded-lg bg-ink/10" />
        </div>
      ) : shown.length ? (
        <ul className="divide-y divide-ink/10 px-5">
          {shown.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-3 transition-colors hover:bg-cream/30">
              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 font-display text-sm font-bold text-white">
                {initials(c.name)}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13px] font-bold text-ink">{c.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-ink-muted">
                  <span className="truncate">{c.spec ?? "Counselor"}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-cream px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">
                    <CalendarCheck className="h-2.5 w-2.5" aria-hidden />
                    {c.sessions} session{c.sessions === 1 ? "" : "s"}
                  </span>
                </p>
              </div>
              <Badge tone={c.available ? "success" : "warning"}>{c.available ? "Available" : "Off"}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-ink-faint">
            <Users className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-2 text-[13px] font-bold text-ink">
            {counselors.length ? "No counselors match these filters" : "No counselors yet"}
          </p>
          <p className="mt-0.5 max-w-[300px] text-[12px] text-ink-muted">
            {counselors.length ? (
              "Clear the search or the availability filter to see everyone."
            ) : (
              <Link href="/users/new" className="font-bold text-primary-600 hover:underline">Add the first counselor</Link>
            )}
          </p>
        </div>
      )}
    </section>
  );
}

const TONES = [
  { value: "all", label: "All" },
  { value: "info", label: "Triage" },
  { value: "success", label: "Posts" },
  { value: "warning", label: "Access" },
] as const;

type ToneFilter = (typeof TONES)[number]["value"];

/**
 * My activity section (activity tab) — filter chips + grouped timeline.
 */
export function ActivitySection({
  loading,
  feed,
}: {
  loading: boolean;
  feed: SettingsFeedItem[];
}) {
  const [tone, setTone] = useState<ToneFilter>("all");

  const counts = useMemo(() => {
    const by = { info: 0, success: 0, warning: 0, danger: 0 };
    for (const f of feed) by[f.tone] += 1;
    return by;
  }, [feed]);

  const shown = useMemo(() => (tone === "all" ? feed : feed.filter((f) => f.tone === tone)), [feed, tone]);

  return (
    <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card" role="tabpanel">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 bg-cream/20 px-5 py-3.5">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <Activity className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-ink">My activity</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              Triage moves, posts, and emergency accesses you made.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-ink/10 bg-white p-1" role="group" aria-label="Filter activity">
          {TONES.map((t) => {
            const active = tone === t.value;
            const count = t.value === "all" ? feed.length : counts[t.value];
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={active}
                onClick={() => setTone(t.value)}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                  active ? "bg-primary-600 text-white shadow-sm" : "text-ink-soft hover:bg-cream"
                )}
              >
                {t.label}
                <span className={active ? "text-primary-100" : "text-ink-faint"}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3 p-5" aria-hidden>
          <div className="h-10 rounded-lg bg-ink/10" />
          <div className="h-10 rounded-lg bg-ink/10" />
        </div>
      ) : shown.length ? (
        <ol className="relative mx-5 my-4 border-l border-ink/10 pl-4">
          {shown.map((f) => {
            const meta =
              f.tone === "success"
                ? { Icon: CheckCircle2, dot: "bg-green-500", icon: "text-green-700 bg-green-100" }
                : f.tone === "warning"
                  ? { Icon: ShieldAlert, dot: "bg-accent-500", icon: "text-accent-700 bg-accent-100" }
                  : f.tone === "danger"
                    ? { Icon: ShieldAlert, dot: "bg-red-500", icon: "text-red-700 bg-red-100" }
                    : { Icon: Sparkles, dot: "bg-primary-500", icon: "text-primary-700 bg-primary-100" };
            return (
              <li key={f.id} className="relative pb-4 last:pb-0">
                <span aria-hidden className={cn("absolute -left-[21px] top-2.5 h-2 w-2 rounded-full ring-2 ring-white", meta.dot)} />
                <div className="flex items-start gap-2.5 rounded-xl border border-ink/5 bg-cream/30 px-3 py-2.5">
                  <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", meta.icon)}>
                    <meta.Icon className="h-3 w-3" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-ink">{f.text}</p>
                    <p className="mt-0.5 text-[10.5px] font-medium text-ink-faint">{timeAgo(f.at)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-ink-faint">
            <Activity className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-2 text-[13px] font-bold text-ink">
            {feed.length ? "Nothing in this category" : "Nothing yet"}
          </p>
          <p className="mt-0.5 max-w-[300px] text-[12px] text-ink-muted">
            {feed.length
              ? "Pick another category to see the rest of your activity."
              : "Triage a referral or publish a post and it shows up here."}
          </p>
        </div>
      )}
    </section>
  );
}
