"use client";

import { useEffect, useRef } from "react";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Composer — auto-growing draft box + circular send.
 * Enter sends, Shift+Enter inserts a newline; the hint below spells that out.
 */
export function Composer({
  draft,
  onDraftChange,
  sending,
  onSubmit,
  placeholder,
  inputLabel,
  sendLabel,
}: {
  draft: string;
  onDraftChange: (v: string) => void;
  sending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  placeholder: string;
  inputLabel: string;
  sendLabel: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !!draft.trim() && !sending;

  // Grow with the draft up to ~5 lines, then scroll inside the box.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [draft]);

  return (
    <form onSubmit={onSubmit} className="border-t border-ink/10 bg-white px-3 py-3 sm:px-4">
      <div className="flex items-end gap-2 rounded-2xl border border-ink/15 bg-cream/30 py-1.5 pl-3 pr-1.5 transition-colors focus-within:border-primary-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-100">
        <textarea
          ref={taRef}
          rows={1}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (canSend) e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={placeholder}
          aria-label={inputLabel}
          disabled={sending}
          className="max-h-[132px] min-h-[2rem] flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={sendLabel}
          className={cn(
            "mb-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1",
            canSend
              ? "bg-primary-600 text-white shadow-soft hover:bg-primary-700"
              : "bg-ink/10 text-ink-faint"
          )}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
      <p className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[10.5px] font-medium text-ink-faint">
        <span>Enter to send · Shift + Enter for a new line</span>
        {draft.length > 0 && <span className="tabular-nums">{draft.length}</span>}
      </p>
    </form>
  );
}
