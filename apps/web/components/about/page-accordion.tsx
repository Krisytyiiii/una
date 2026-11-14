"use client";

import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageDoc } from "@/lib/about-content";

/**
 * Per-page handbook entry — purpose, displayed, actions, handoff.
 * Controlled (open/onToggle) so the page guide can expand or collapse every
 * card at once and animate height with a grid-rows transition.
 */
export function PageAccordion({
  doc,
  open,
  onToggle,
}: {
  doc: PageDoc;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = doc.icon;
  const panelId = `page-doc-${doc.href.replace(/\W+/g, "-")}`;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-white shadow-card transition-colors",
        open ? "border-primary-200" : "border-ink/10 hover:border-primary-200/70"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-cream/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400 sm:px-5"
      >
        <span
          aria-hidden
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
            open
              ? "border-primary-200 bg-primary-600 text-white"
              : "border-ink/10 bg-cream text-ink-soft"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[15px] font-bold text-ink">{doc.label}</span>
          <span className="mt-0.5 block truncate text-[12.5px] text-ink-muted">{doc.purpose}</span>
        </span>
        <span className="hidden shrink-0 rounded-full border border-ink/10 bg-cream/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-faint sm:inline">
          {doc.actions.length} action{doc.actions.length === 1 ? "" : "s"}
        </span>
        <ChevronDown
          aria-hidden
          className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", open && "rotate-180 text-primary-600")}
        />
      </button>

      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-ink/10 px-4 py-4 sm:px-5">
            <div className="grid gap-4 md:grid-cols-2">
              <DocList
                title="What you see"
                icon={<CircleDot className="h-3.5 w-3.5" aria-hidden />}
                items={doc.displayed}
                tone="blue"
              />
              <DocList
                title="What you can do"
                icon={<Check className="h-3.5 w-3.5" aria-hidden />}
                items={doc.actions}
                tone="amber"
                numbered
              />
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-primary-100 bg-primary-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] leading-relaxed text-ink-soft">
                <span className="font-bold text-ink">Then what: </span>
                {doc.handoff}
              </p>
              <Link
                href={doc.href}
                className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg bg-primary-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-soft transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 sm:self-auto"
              >
                Open {doc.label}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function DocList({
  title,
  icon,
  items,
  tone,
  numbered = false,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  tone: "blue" | "amber";
  numbered?: boolean;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-faint">
        {icon}
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-ink-soft">
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                tone === "blue" ? "bg-blue-100 text-blue-800" : "bg-accent-100 text-accent-700"
              )}
            >
              {numbered ? i + 1 : "•"}
            </span>
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
