import { ShieldAlert, Timer } from "lucide-react";
import { fmtLeft, type EmergencyGrant } from "@/lib/hooks/use-emergency-grant";
import { cn } from "@/lib/utils";

/** Full grant window — drives the remaining-time progress bar. */
const GRANT_WINDOW_MS = 30 * 60 * 1000;

/**
 * Active-grant shell — alias, live countdown, and remaining-time bar. The page
 * composes the step body inside (waiting for review, reveal CTA, or identity).
 */
export function GrantBanner({
  grant,
  msLeft,
  children,
}: {
  grant: EmergencyGrant;
  msLeft: number;
  children: React.ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, (msLeft / GRANT_WINDOW_MS) * 100));
  const critical = msLeft <= 5 * 60 * 1000;

  return (
    <section
      id="active-grant"
      className="scroll-mt-24 overflow-hidden rounded-xl border border-red-200 bg-white shadow-card"
      aria-label="Active emergency grant"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-red-100 bg-red-50/60 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 ring-1 ring-red-200">
            <ShieldAlert className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-red-700">Active grant</p>
            <h2 className="mt-0.5 truncate font-display text-lg font-bold leading-tight text-ink">{grant.alias}</h2>
            <p className="mt-0.5 text-[11.5px] font-medium text-ink-faint">
              Log <span className="font-mono">{grant.logId.slice(0, 8)}</span> ·{" "}
              {grant.reviewed ? "Head-reviewed" : "Awaiting head review"}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2",
            critical ? "border-red-200 bg-white" : "border-amber-200 bg-white"
          )}
          role="timer"
          aria-live="off"
        >
          <Timer className={cn("h-4 w-4", critical ? "text-red-600" : "text-amber-600")} aria-hidden />
          <div className="leading-none">
            <p
              className={cn(
                "font-mono text-lg font-bold tabular-nums",
                critical ? "text-red-700" : "text-ink"
              )}
            >
              {fmtLeft(msLeft)}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ink-faint">remaining</p>
          </div>
        </div>
      </div>

      <div className="h-1 w-full bg-red-100" aria-hidden>
        <div
          className={cn("h-full transition-[width] duration-1000 ease-linear", critical ? "bg-red-600" : "bg-amber-500")}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}
