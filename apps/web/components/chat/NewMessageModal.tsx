"use client";

import { MessageSquarePlus, Send, X } from "lucide-react";
import { Button, Textarea } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import { cn } from "@/lib/utils";

/**
 * NewMessageModal — message-a-counselor dialog (head only), reused for the
 * faculty "message the office" dialog via the optional title/description/
 * options overrides.
 *
 * Presentation matches the /chat workspace: icon header, soft backdrop, and a
 * live character counter on the composer.
 */
export function NewMessageModal({
  open,
  onClose,
  counselor,
  onCounselorChange,
  body,
  onBodyChange,
  busy,
  onSend,
  counselorNames,
  openMenuKey,
  onOpenMenuChange,
  title = "Message a counselor",
  description = "Opens a direct conversation shown right in this list.",
  options,
  pickerLabel = "Choose counselor",
}: {
  open: boolean;
  onClose: () => void;
  counselor: string;
  onCounselorChange: (v: string) => void;
  body: string;
  onBodyChange: (v: string) => void;
  busy: boolean;
  onSend: () => void;
  counselorNames: Map<string, string>;
  openMenuKey: string | null;
  onOpenMenuChange: (k: string | null) => void;
  title?: string;
  description?: string;
  /** Explicit recipient options (value = profile id). Defaults to the counselor directory. */
  options?: { value: string; label: string }[];
  pickerLabel?: string;
}) {
  if (!open) return null;
  const recipientOptions =
    options ?? [...counselorNames.entries()].map(([id, name]) => ({ value: id, label: name }));
  const count = body.trim().length;
  const canSend = !!counselor && count > 0 && !busy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="msg-counselor-title"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-ink/5">
        <div className="flex items-start gap-3 border-b border-ink/5 bg-gradient-to-br from-white via-cream to-blue-50 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-soft">
            <MessageSquarePlus className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="msg-counselor-title" className="font-display text-lg font-bold leading-tight text-ink">
              {title}
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-faint transition hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">
              Recipient
            </p>
            <Dropdown
              menuKey="msg-counselor"
              openMenuKey={openMenuKey}
              onOpenChange={onOpenMenuChange}
              value={counselor}
              onChange={onCounselorChange}
              ariaLabel={pickerLabel}
              options={recipientOptions}
            />
          </div>
          <div>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">
                Message
              </p>
              <p
                className={cn(
                  "text-[11px] font-medium tabular-nums",
                  count >= 2000 ? "text-amber-700" : "text-ink-faint"
                )}
              >
                {count}/2000
              </p>
            </div>
            <Textarea
              rows={4}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              placeholder="Write your message…"
              aria-label="Message"
              maxLength={2000}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-ink/5 bg-cream/40 px-5 py-3">
          <p className="text-[11px] leading-snug text-ink-faint">Seen only by the recipient.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onClose} autoFocus>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={busy}
              disabled={!canSend}
              onClick={onSend}
            >
              {!busy && <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
              {busy ? "Sending…" : "Send message"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
