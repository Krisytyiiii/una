import { cn } from "@/lib/utils";
import type { FlowStep } from "@/lib/about-content";

/**
 * Pipeline stepper — numbered rail with connector line, status pill, and
 * who-acts copy. Vertical inside the flow cards so long labels wrap cleanly.
 */
export function FlowStrip({ steps }: { steps: readonly FlowStep[] }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => (
        <li key={s.status} className="relative flex gap-3 pb-3 last:pb-0">
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className="absolute left-[15px] top-8 h-[calc(100%-1.75rem)] w-px bg-gradient-to-b from-primary-300 to-primary-100"
            />
          )}
          <span
            aria-hidden
            className={cn(
              "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold shadow-sm",
              i === steps.length - 1
                ? "border-accent-200 bg-accent-50 text-accent-700"
                : "border-primary-200 bg-white text-primary-700"
            )}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 rounded-lg border border-ink/10 bg-cream/40 px-3 py-2">
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]",
                s.tone
              )}
            >
              {s.status}
            </span>
            <p className="mt-1 text-[12px] font-medium leading-snug text-ink-muted">{s.who}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
