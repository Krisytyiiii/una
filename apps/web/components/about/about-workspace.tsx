"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  ChevronRight,
  GitBranch,
  LayoutGrid,
  ListChecks,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  COUNSELOR_CHECKLIST,
  COUNSELOR_PAGES,
  FACULTY_CHECKLIST,
  FACULTY_PAGES,
  HEAD_CHECKLIST,
  HEAD_PAGES,
  SPLIT_ROWS,
} from "@/lib/about-content";
import { cn } from "@/lib/utils";
import { PageAccordion } from "./page-accordion";
import { ChecklistSection, PipelineSection, RulesSection } from "./handbook-sections";

type TabKey = "workflow" | "checklist" | "pages" | "rules";

const TABS: { key: TabKey; label: string; icon: typeof GitBranch }[] = [
  { key: "workflow", label: "How a case moves", icon: GitBranch },
  { key: "checklist", label: "Daily checklist", icon: ListChecks },
  { key: "pages", label: "Page guide", icon: LayoutGrid },
  { key: "rules", label: "Rules", icon: ShieldCheck },
];

/**
 * Interactive /about handbook shell — role-aware hero, sticky section tabs,
 * a saved-progress checklist, and a searchable page guide.
 */
export function AboutWorkspace({ role }: { role: string }) {
  const isHead = role === "guidance_head";
  const isFaculty = role === "faculty";
  const pages = isHead ? HEAD_PAGES : isFaculty ? FACULTY_PAGES : COUNSELOR_PAGES;
  const checklist = isHead ? HEAD_CHECKLIST : isFaculty ? FACULTY_CHECKLIST : COUNSELOR_CHECKLIST;
  const roleLabel = isHead ? "Guidance head" : isFaculty ? "Faculty" : "Counselor";
  const roleKey = isHead ? "head" : isFaculty ? "faculty" : "counselor";
  const description = isHead
    ? "The head handbook — the whole office: how cases move, what each page shows, what you may touch, and where every action goes next."
    : isFaculty
      ? "Your faculty handbook — your referrals, your pipeline, your rules: how cases move, what each page shows, what you may touch, and where every action goes next."
      : "Your counselor handbook — your queues, your pipeline, your rules: how cases move, what each page shows, what you may touch, and where every action goes next.";
  const checklistTitle = isFaculty ? "Faculty daily checklist" : isHead ? "Head daily checklist" : "Counselor daily checklist";
  const ruleCount = isFaculty ? 4 : SPLIT_ROWS.filter((r) => (isHead ? r.admin : r.counselor)).length;

  const [tab, setTab] = useState<TabKey>("workflow");
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const idOf = (href: string, label: string) => href + label;

  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter((doc) =>
      [doc.label, doc.purpose, doc.handoff, ...doc.displayed, ...doc.actions]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [pages, query]);

  const allOpen =
    filteredPages.length > 0 && filteredPages.every((doc) => openIds.has(idOf(doc.href, doc.label)));

  const toggleDoc = (href: string, label: string) => {
    const id = idOf(href, label);
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setOpenIds(
      allOpen ? new Set() : new Set(filteredPages.map((doc) => idOf(doc.href, doc.label)))
    );
  };

  const stats = [
    { label: "Pages documented", value: pages.length, hint: "for your role" },
    { label: "Daily steps", value: checklist.length, hint: "saved on this device" },
    { label: "Core flows", value: 2, hint: "sessions + referrals" },
    { label: "Your rules", value: ruleCount, hint: "scoped to your role" },
  ];

  const tabCount: Record<TabKey, number | null> = {
    workflow: null,
    checklist: checklist.length,
    pages: pages.length,
    rules: ruleCount,
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-6 shadow-card sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-200/40 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-accent-200/30 blur-2xl"
        />
        <div className="relative">
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary-700">
            <BookMarked className="h-3.5 w-3.5" aria-hidden />
            Workspace handbook
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">About this workspace</h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-primary-700">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              {roleLabel} view
            </span>
          </div>
          <p className="mt-2 max-w-[760px] text-[13.5px] leading-relaxed text-ink-muted">{description}</p>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-white/70 bg-white/70 px-3.5 py-2.5 backdrop-blur"
              >
                <p className="font-display text-xl font-bold leading-none tabular-nums text-ink">{s.value}</p>
                <p className="mt-1 truncate text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  {s.label}
                </p>
                <p className="truncate text-[10.5px] text-ink-faint">{s.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sticky section switcher */}
      <div className="sticky top-14 z-20 -mx-1 px-1 py-1">
        <div
          role="tablist"
          aria-label="Handbook sections"
          className="flex gap-1 overflow-x-auto rounded-xl border border-ink/10 bg-white/90 p-1.5 shadow-card backdrop-blur"
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = tabCount[t.key];
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                  active
                    ? "bg-primary-600 text-white shadow-soft"
                    : "text-ink-muted hover:bg-primary-50 hover:text-ink"
                )}
              >
                <t.icon className="h-3.5 w-3.5" aria-hidden />
                {t.label}
                {count != null && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                      active ? "bg-white/20 text-white" : "bg-ink/5 text-ink-faint"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panels */}
      <div
        key={tab}
        role="tabpanel"
        aria-label={TABS.find((t) => t.key === tab)?.label}
        className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
      >
        {tab === "workflow" && <PipelineSection />}

        {tab === "checklist" && (
          <ChecklistSection checklist={checklist} title={checklistTitle} storageKey={roleKey} />
        )}

        {tab === "pages" && (
          <section className="space-y-3">
            <div className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-ink">Page guide</h2>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">
                  Search or open a page to see its purpose, exactly what is displayed, what you may do, and where the work goes next.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-lg border border-ink/15 bg-white px-3 text-[11.5px] font-bold text-ink-muted transition hover:border-primary-200 hover:text-ink sm:self-auto"
              >
                {allOpen ? "Collapse all" : "Expand all"}
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pages, actions, or handoffs…"
                  aria-label="Search the page guide"
                  className="h-10 w-full rounded-lg border border-ink/15 bg-white pl-9 pr-9 text-[13px] text-ink placeholder:text-ink-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint transition hover:bg-ink/5 hover:text-ink"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                )}
              </div>
              <p className="shrink-0 text-[11.5px] font-semibold text-ink-faint">
                {filteredPages.length} of {pages.length} page{pages.length === 1 ? "" : "s"}
              </p>
            </div>

            {filteredPages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink/15 bg-white px-6 py-12 text-center">
                <p className="text-sm font-bold text-ink">No pages match “{query}”</p>
                <p className="mt-1 text-[13px] text-ink-muted">Try a page name, an action, or a plainer word.</p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="mt-3 inline-flex h-8 items-center rounded-lg bg-primary-600 px-3 text-[12px] font-bold text-white transition hover:bg-primary-700"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPages.map((doc) => (
                  <PageAccordion
                    key={doc.href + doc.label}
                    doc={doc}
                    open={openIds.has(idOf(doc.href, doc.label))}
                    onToggle={() => toggleDoc(doc.href, doc.label)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "rules" && <RulesSection isHead={isHead} isFaculty={isFaculty} />}
      </div>

      {/* Footer nudge */}
      <section className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent-700">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-[13px] font-bold text-ink">Ready to put the handbook to work?</p>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              Jump back into your dashboard or open the queue that needs you now.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 text-[12px] font-bold text-ink transition hover:border-primary-200"
          >
            Dashboard
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <Link
            href={isFaculty ? "/referrals" : "/appointments"}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary-600 px-3 text-[12px] font-bold text-white shadow-soft transition hover:bg-primary-700"
          >
            {isFaculty ? "Open referrals" : "Open appointments"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
