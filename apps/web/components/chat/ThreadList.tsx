"use client";

import { Plus, Search, X } from "lucide-react";
import { initials, timeAgoShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChatDm, ChatMsg, ChatThread } from "@/lib/hooks/use-chat-board";

export type Convo =
  | { kind: "thread"; key: string; at: string; thread: ChatThread }
  | { kind: "dm"; key: string; at: string; peer: string; last: ChatDm; unread: number };

/** Deterministic avatar gradients so a person keeps the same color everywhere. */
const AVATAR_TONES = [
  "from-sky-500 to-blue-600",
  "from-violet-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-sky-600",
  "from-fuchsia-500 to-purple-600",
];

function toneFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/** Same deterministic gradient used by the rail — reuse for header avatars. */
export const avatarToneFor = toneFor;

/**
 * ThreadList — conversation rail with search, status filters, and previews.
 * Threads and staff DMs share one recency-sorted list; the rail keeps the
 * unread / needs-reply signals visible at a glance.
 */
export function ThreadList({
  convos,
  loading,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  isOffice,
  isFaculty,
  isCounselor,
  showThreadMobile,
  aliases,
  previews,
  staffNames,
  me,
  activeId,
  activeDm,
  openThread,
  openDm,
  needsReply,
  onNewMessage,
  threadCounts,
}: {
  convos: Convo[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  isOffice: boolean;
  /** Faculty inbox is DMs only — shows the compose button, hides thread pills. */
  isFaculty?: boolean;
  /** Counselors get the compose button to message faculty (threads stay). */
  isCounselor?: boolean;
  showThreadMobile: boolean;
  aliases: Map<string, { alias: string; profileId: string }>;
  previews: Map<string, ChatMsg>;
  staffNames: Map<string, string>;
  me: string | null;
  activeId: string | null;
  activeDm: string | null;
  openThread: (id: string) => void;
  openDm: (peer: string) => void;
  needsReply: (t: ChatThread) => boolean;
  onNewMessage: () => void;
  /** Status counts for the segmented filter (threads only). */
  threadCounts?: { all: number; open: number; closed: number };
}) {
  const filters = [
    { id: "all", label: "All", count: threadCounts?.all },
    { id: "open", label: "Open", count: threadCounts?.open },
    { id: "closed", label: "Closed", count: threadCounts?.closed },
  ] as const;

  return (
    <section
      aria-label="Conversations"
      className={cn(
        "overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-card",
        "lg:h-full lg:min-h-0 lg:flex lg:flex-col",
        showThreadMobile ? "hidden lg:flex" : "flex flex-col"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-ink/5 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-bold text-ink">Conversations</h2>
          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700 ring-1 ring-primary-100">
            {convos.length}
          </span>
        </div>
        {(isOffice || isFaculty || isCounselor) && (
          <button
            type="button"
            onClick={onNewMessage}
            title={isFaculty ? "Message the office" : isCounselor ? "Message faculty" : "Message a counselor"}
            aria-label={isFaculty ? "Message the office" : isCounselor ? "Message faculty" : "Message a counselor"}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-soft transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="px-4 pt-3">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats…"
            aria-label="Search chats"
            className="h-9 w-full rounded-xl border border-ink/15 bg-cream/40 pl-9 pr-9 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint transition hover:bg-ink/10 hover:text-ink"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Thread open/closed segmented control — counselors only; the head and
          faculty inboxes are DMs. */}
      {!isOffice && !isFaculty && (
        <div className="px-4 pt-3">
          <div
            role="tablist"
            aria-label="Filter conversations"
            className="inline-flex w-full rounded-xl bg-cream/60 p-0.5 ring-1 ring-inset ring-ink/5"
          >
            {filters.map((f) => {
              const active = statusFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(f.id)}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1 rounded-[10px] px-3 py-1.5 text-[12px] font-bold transition-colors",
                    active
                      ? "bg-white text-primary-700 shadow-sm ring-1 ring-ink/5"
                      : "text-ink-muted hover:text-ink"
                  )}
                >
                  {f.label}
                  {typeof f.count === "number" && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums",
                        active ? "bg-primary-50 text-primary-700" : "bg-ink/10 text-ink-muted"
                      )}
                    >
                      {f.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ul className="no-scrollbar mt-3 max-h-[52vh] space-y-0.5 overflow-y-auto px-2 pb-3 lg:max-h-none lg:min-h-0 lg:flex-1">
        {loading &&
          Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex animate-pulse items-center gap-3 rounded-xl px-2 py-2.5" aria-hidden>
              <div className="h-10 w-10 shrink-0 rounded-full bg-ink/10" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3 w-2/3 rounded-full bg-ink/10" />
                <div className="h-3 w-full rounded-full bg-ink/10" />
              </div>
            </li>
          ))}

        {!loading &&
          convos.map((c) => {
            if (c.kind === "thread") {
              const t = c.thread;
              const alias = aliases.get(t.student_id)?.alias ?? "Student";
              const last = previews.get(t.id);
              const flag = needsReply(t);
              const selected = t.id === activeId;
              const open = t.status === "open";
              return (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => openThread(t.id)}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                      selected ? "bg-primary-50 ring-1 ring-primary-100" : "hover:bg-cream/70"
                    )}
                  >
                    {selected && (
                      <span
                        aria-hidden
                        className="absolute bottom-2.5 left-0 top-2.5 w-0.5 rounded-full bg-primary-600"
                      />
                    )}
                    <span className="relative shrink-0">
                      <span
                        aria-hidden
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br font-display text-sm font-bold text-white shadow-sm",
                          open ? toneFor(alias) : "from-slate-400 to-slate-500"
                        )}
                      >
                        {initials(alias)}
                      </span>
                      {flag && (
                        <span
                          aria-label="Waiting on a counselor reply"
                          title="Waiting on a counselor reply"
                          className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-bold text-ink">{alias}</span>
                        <span className="shrink-0 text-[10.5px] font-medium text-ink-faint">
                          {timeAgoShort(c.at)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        {!open && (
                          <span className="shrink-0 rounded-full bg-ink/10 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-ink-muted">
                            Closed
                          </span>
                        )}
                        <span
                          className={cn(
                            "truncate text-[12.5px]",
                            flag ? "font-semibold text-amber-800" : "text-ink-muted"
                          )}
                        >
                          {last
                            ? `${last.sender_profile_id === me ? "You: " : ""}${last.body}`
                            : open
                              ? "No messages yet."
                              : "No messages."}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            }

            const name = staffNames.get(c.peer) ?? "Staff";
            const selected = c.peer === activeDm;
            return (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => openDm(c.peer)}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                    selected ? "bg-primary-50 ring-1 ring-primary-100" : "hover:bg-cream/70"
                  )}
                >
                  {selected && (
                    <span
                      aria-hidden
                      className="absolute bottom-2.5 left-0 top-2.5 w-0.5 rounded-full bg-primary-600"
                    />
                  )}
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-display text-sm font-bold text-white shadow-sm",
                      toneFor(name)
                    )}
                  >
                    {initials(name)}
                  </span>
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-bold text-ink">{name}</span>
                      <span className="shrink-0 text-[10.5px] font-medium text-ink-faint">
                        {timeAgoShort(c.at)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <span className="shrink-0 rounded-full bg-primary-50 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-primary-700 ring-1 ring-primary-100">
                        Direct
                      </span>
                      <span
                        className={cn(
                          "truncate text-[12.5px] text-ink-muted",
                          c.unread > 0 && "font-semibold text-ink"
                        )}
                      >
                        {`${c.last.sender_profile_id === me ? "You: " : ""}${c.last.body}`}
                      </span>
                      {c.unread > 0 && (
                        <span
                          aria-label={`${c.unread} unread`}
                          className="ml-auto shrink-0 rounded-full bg-primary-600 px-1.5 py-px text-[10px] font-bold text-white"
                        >
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}

        {!loading && !convos.length && (
          <li className="flex flex-col items-center px-4 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-ink-faint ring-1 ring-ink/5">
              <Search className="h-4 w-4" aria-hidden />
            </span>
            <p className="mt-2 text-sm font-bold text-ink">No conversations found</p>
            <p className="mt-0.5 max-w-[240px] text-[12px] leading-relaxed text-ink-muted">
              Try a different search, or switch the filter back to All.
            </p>
          </li>
        )}
      </ul>
    </section>
  );
}
