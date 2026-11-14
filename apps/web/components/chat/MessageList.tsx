"use client";

import { ArrowDown } from "lucide-react";
import { dayLabel, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

type MsgLike = {
  id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
};

/**
 * MessageList — grouped bubbles, day dividers, incoming avatar, jump-to-latest.
 * Consecutive messages from the same person collapse into one visual group, so
 * long back-and-forth reads like a real messenger instead of stacked cards.
 */
export function MessageList({
  messages,
  me,
  bottomRef,
  showJump,
  onScroll,
  onJump,
  emptyText,
  topSlot,
  peerLabel,
  peerTone = "from-slate-400 to-slate-600",
}: {
  messages: MsgLike[];
  me: string | null;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  showJump: boolean;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onJump: () => void;
  emptyText?: string | null;
  /** Optional header inside the scroll area (e.g. "Load older" paging). */
  topSlot?: React.ReactNode;
  /** Incoming participant name — drives the avatar on the left. */
  peerLabel?: string;
  /** Tailwind gradient classes for the incoming avatar. */
  peerTone?: string;
}) {
  let lastDay = "";

  return (
    <div className="relative h-[46vh] min-h-[320px] bg-cream/20 lg:h-auto lg:min-h-0 lg:flex-1">
      <div onScroll={onScroll} className="no-scrollbar h-full overflow-y-auto px-3 py-4 sm:px-4">
        {topSlot ? <div className="mb-3 flex justify-center">{topSlot}</div> : null}
        {messages.map((m, i) => {
          const mine = m.sender_profile_id === me;
          const day = dayLabel(m.created_at);
          const showDay = day !== lastDay;
          lastDay = day;

          const prev = messages[i - 1];
          const next = messages[i + 1];
          const prevSame =
            !!prev && !showDay && prev.sender_profile_id === m.sender_profile_id;
          const nextSame =
            !!next &&
            dayLabel(next.created_at) === day &&
            next.sender_profile_id === m.sender_profile_id;
          const lastOfGroup = !nextSame;

          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-ink/10" aria-hidden />
                  <span className="rounded-full bg-white px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-faint ring-1 ring-ink/10">
                    {day}
                  </span>
                  <span className="h-px flex-1 bg-ink/10" aria-hidden />
                </div>
              )}

              <div
                className={cn(
                  "flex items-end gap-2",
                  mine ? "justify-end" : "justify-start",
                  prevSame ? "mt-0.5" : "mt-3"
                )}
              >
                {!mine && (
                  <span
                    aria-hidden
                    className={cn(
                      "mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white shadow-sm",
                      peerTone,
                      lastOfGroup ? "opacity-100" : "opacity-0"
                    )}
                  >
                    {initials(peerLabel ?? "S")}
                  </span>
                )}

                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm sm:max-w-[70%]",
                    mine
                      ? "bg-primary-600 text-white"
                      : "bg-white text-ink ring-1 ring-ink/10",
                    mine && prevSame ? "rounded-tr-md" : "",
                    mine && nextSame ? "rounded-br-md" : "",
                    !mine && prevSame ? "rounded-tl-md" : "",
                    !mine && nextSame ? "rounded-bl-md" : ""
                  )}
                >
                  <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{m.body}</p>
                  {lastOfGroup && (
                    <p
                      className={cn(
                        "mt-1 text-right text-[9.5px] font-medium tabular-nums",
                        mine ? "text-white/65" : "text-ink-faint"
                      )}
                    >
                      {new Date(m.created_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {emptyText && !messages.length && (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-primary-600 shadow-sm ring-1 ring-ink/5">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                <path
                  d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 1 1 21 12Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <p className="mt-3 text-sm font-bold text-ink">No messages yet</p>
            <p className="mt-0.5 max-w-[280px] text-[12.5px] leading-relaxed text-ink-muted">
              {emptyText}
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {showJump && messages.length > 0 && (
        <button
          type="button"
          onClick={onJump}
          title="Jump to latest"
          aria-label="Jump to latest messages"
          className="absolute bottom-4 left-1/2 inline-flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-ink/10 bg-white text-primary-600 shadow-card transition hover:-translate-y-0.5 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <ArrowDown className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
