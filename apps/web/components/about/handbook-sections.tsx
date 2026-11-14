"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Check,
  CheckCheck,
  EyeOff,
  Info,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { APPOINTMENT_FLOW, REFERRAL_FLOW, SPLIT_ROWS } from "@/lib/about-content";
import { cn } from "@/lib/utils";
import { FlowStrip } from "./flow-strip";

/** Master pipeline — the two flows everything else serves. */
export function PipelineSection() {
  const rules = [
    {
      icon: ShieldCheck,
      title: "Terminal is forever",
      body: "Rejected, cancelled, completed, resolved, and no-show never move again.",
    },
    {
      icon: Bell,
      title: "Every move notifies",
      body: "The affected student, referrer, counselor, and heads hear about it live and get a nav badge until read.",
    },
    {
      icon: EyeOff,
      title: "Aliases by default",
      body: "Student names stay aliased everywhere except audited break-glass reveals.",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-ink/10 bg-white p-5 shadow-card">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
          <BookOpen className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-ink">How a case moves</h2>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
            Two start lines, one discipline: the head routes, the counselor runs and closes.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-full bg-primary-100 px-2.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-primary-700">
              Sessions
            </span>
            <span className="text-[11px] font-medium text-ink-faint">student books → counselor closes</span>
          </div>
          <FlowStrip steps={APPOINTMENT_FLOW} />
        </div>

        <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-full bg-accent-100 px-2.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-accent-700">
              Referrals
            </span>
            <span className="text-[11px] font-medium text-ink-faint">faculty flags → counselor resolves</span>
          </div>
          <FlowStrip steps={REFERRAL_FLOW} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {rules.map((r) => (
          <div key={r.title} className="rounded-xl border border-ink/10 bg-white p-4 shadow-card">
            <p className="flex items-center gap-2 text-[13px] font-bold text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cream text-ink-soft">
                <r.icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              {r.title}
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">{r.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Role daily checklist with locally saved progress. */
export function ChecklistSection({
  checklist,
  title,
  storageKey,
}: {
  checklist: string[];
  title: string;
  storageKey: string;
}) {
  const key = `dorsu:about-checklist:${storageKey}`;
  const [done, setDone] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as number[]) : [];
      setDone(new Set(parsed.filter((n) => Number.isInteger(n) && n >= 0 && n < checklist.length)));
    } catch {
      // Corrupt storage is not worth blocking the page over — start fresh.
      setDone(new Set());
    }
    setReady(true);
  }, [key, checklist.length]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(key, JSON.stringify([...done]));
    } catch {
      // Private-mode quota failures are fine; the checklist still works in memory.
    }
  }, [done, key, ready]);

  const total = checklist.length;
  const complete = done.size;
  const percent = total ? Math.round((complete / total) * 100) : 0;

  const toggle = (index: number) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
      <div className="flex flex-col gap-4 border-b border-ink/10 bg-cream/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary-700 ring-1 ring-primary-100">
            <CheckCheck className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              Tick each item as you clear it — progress is saved on this device.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ProgressRing percent={percent} />
          <div>
            <p className="text-lg font-bold leading-none tabular-nums text-ink">
              {complete}
              <span className="text-[13px] font-semibold text-ink-faint">/{total}</span>
            </p>
            <p className="mt-1 text-[11px] font-semibold text-ink-muted">
              {percent === 100 ? "All clear for today" : "items cleared"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDone(new Set())}
            disabled={complete === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-2.5 text-[11.5px] font-bold text-ink-muted transition hover:border-primary-200 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Reset
          </button>
        </div>
      </div>

      <div className="h-1 w-full bg-primary-50" aria-hidden>
        <div
          className="h-full rounded-r-full bg-gradient-to-r from-primary-500 to-primary-700 transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="divide-y divide-ink/5">
        {checklist.map((item, i) => {
          const checked = done.has(i);
          return (
            <li key={item}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(i)}
                className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-cream/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all",
                    checked
                      ? "border-primary-600 bg-primary-600 text-white"
                      : "border-ink/25 bg-white text-transparent"
                  )}
                >
                  <Check className="h-3 w-3" strokeWidth={3.5} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mr-2 text-[11px] font-bold text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                  <span
                    className={cn(
                      "text-[13.5px] leading-relaxed transition-colors",
                      checked ? "text-ink-faint line-through" : "text-ink-soft"
                    )}
                  >
                    {item}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {percent === 100 && (
        <div className="flex items-center gap-2 border-t border-primary-100 bg-primary-50 px-5 py-3 text-[12.5px] font-semibold text-primary-700">
          <Sparkles className="h-4 w-4" aria-hidden />
          Today&apos;s checklist is clear — reset it tomorrow morning.
        </div>
      )}
    </section>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  return (
    <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90" aria-hidden>
      <circle cx="18" cy="18" r="15.5" fill="none" stroke="#DBEAFE" strokeWidth="3.5" />
      <circle
        cx="18"
        cy="18"
        r="15.5"
        fill="none"
        stroke="#2563EB"
        strokeWidth="3.5"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${percent} ${100 - percent}`}
        className="transition-[stroke-dasharray] duration-500 ease-out"
      />
    </svg>
  );
}

/** Non-negotiable rules — scoped to the viewer's role. */
export function RulesSection({ isHead, isFaculty }: { isHead: boolean; isFaculty?: boolean }) {
  if (isFaculty) {
    const rules = [
      {
        icon: AlertTriangle,
        title: "Flag with context",
        body: "Describe what you observed and pick the right urgency; urgent + high are triaged first.",
      },
      {
        icon: ShieldCheck,
        title: "Track, don't triage",
        body: "Assigning, confirming, and resolving belong to the office — enforced server-side.",
      },
      {
        icon: Bell,
        title: "Badges equal unread inbox",
        body: "Visiting a page never clears them; marking the notification read does.",
      },
      {
        icon: EyeOff,
        title: "Aliases stay on",
        body: "Student names stay aliased everywhere except audited break-glass reveals.",
      },
    ];
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary-700" aria-hidden />
          <h2 className="font-display text-lg font-bold text-ink">Rules you live by</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {rules.map((r) => (
            <div key={r.title} className="rounded-xl border border-ink/10 bg-white p-4 shadow-card">
              <p className="flex items-center gap-2 text-[13px] font-bold text-ink">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cream text-ink-soft">
                  <r.icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                {r.title}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">{r.body}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const rows = SPLIT_ROWS.filter((r) => (isHead ? r.admin : r.counselor));
  const safety = [
    {
      icon: Video,
      title: "Online sessions need a Meet link at confirm",
      body: "Google blocks Meet inside iframes, so the board and calendar offer Join buttons that open the meeting.",
    },
    {
      icon: AlertTriangle,
      title: "Resolve is counselor-only, enforced server-side",
      body: "A referral can never read Resolved unless a counselor resolved it, even bypassing the UI.",
    },
    {
      icon: Bell,
      title: "Badges equal unread inbox",
      body: "Visiting a page never clears them; marking the notification read does.",
    },
    {
      icon: Info,
      title: "Student booking needs a fresh PSS-10",
      body: "A check-in from the last 30 days gates every new booking.",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
        <div className="flex items-start gap-3 border-b border-ink/10 bg-cream/30 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary-700 ring-1 ring-primary-100">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Rules you live by</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              Your permitted moves, scoped to the {isHead ? "head" : "counselor"} role.
            </p>
          </div>
        </div>

        <div className="hidden grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1.7fr)] items-center gap-3 border-b border-ink/10 bg-white px-5 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-faint sm:grid">
          <span>Move</span>
          <span className="text-center">{isHead ? "Head" : "You"}</span>
          <span>What it means</span>
        </div>

        <ul className="divide-y divide-ink/5">
          {rows.map((r) => (
            <li
              key={r.move}
              className="grid gap-1 px-5 py-3 transition-colors hover:bg-cream/30 sm:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1.7fr)] sm:items-center sm:gap-3"
            >
              <span className="flex items-center gap-2 text-[13px] font-bold text-ink">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-50 text-primary-700 sm:hidden">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
                {r.move}
              </span>
              <span className="hidden justify-self-center sm:flex">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
              </span>
              <span className="pl-7 text-[12px] leading-relaxed text-ink-muted sm:pl-0">{r.note}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {safety.map((s) => (
          <div key={s.title} className="rounded-xl border border-ink/10 bg-white p-4 shadow-card">
            <p className="flex items-start gap-2 text-[12.5px] font-bold leading-snug text-ink">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cream text-ink-soft">
                <s.icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              {s.title}
            </p>
            <p className="mt-1.5 pl-8 text-[12px] leading-relaxed text-ink-muted">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
