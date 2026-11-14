"use client";

import { Check, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, X } from "lucide-react";
import { Button, Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Security tab — change-password and change-email forms.
 * Behaviour is unchanged; the presentation now includes a live strength
 * meter, always-on requirement chips, and a clearer email hand-off note.
 */
export function PasswordForm({
  newPw,
  confirmPw,
  showPw,
  showConfirm,
  pwDone,
  pwRules,
  pwMatch,
  saving,
  email,
  newEmail,
  onNewPw,
  onConfirmPw,
  onShowPw,
  onShowConfirm,
  onPwBlur,
  onNewEmail,
  onChangePassword,
  onChangeEmail,
}: {
  newPw: string;
  confirmPw: string;
  showPw: boolean;
  showConfirm: boolean;
  pwDone: boolean;
  pwRules: { label: string; ok: boolean }[];
  pwMatch: boolean | null;
  saving: string | null;
  email: string;
  newEmail: string;
  onNewPw: (v: string) => void;
  onConfirmPw: (v: string) => void;
  onShowPw: () => void;
  onShowConfirm: () => void;
  onPwBlur: () => void;
  onNewEmail: (v: string) => void;
  onChangePassword: (e: React.FormEvent) => void;
  onChangeEmail: (e: React.FormEvent) => void;
}) {
  const passed = pwRules.filter((r) => r.ok).length;
  const score = Math.min(4, passed + (newPw.length >= 12 ? 1 : 0));
  const strengthLabel = !newPw ? "Not set" : score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";
  const strengthTone =
    !newPw ? "bg-ink/10" : score <= 1 ? "bg-red-500" : score === 2 ? "bg-yellow-500" : score === 3 ? "bg-primary-500" : "bg-green-500";
  const strengthText =
    !newPw ? "text-ink-faint" : score <= 1 ? "text-red-600" : score === 2 ? "text-yellow-700" : score === 3 ? "text-primary-700" : "text-green-700";

  return (
    <div className="space-y-4" role="tabpanel">
      {/* Password */}
      <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 bg-cream/20 px-5 py-3.5">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <KeyRound className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-ink">Change password</h2>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">Takes effect immediately on your next login.</p>
            </div>
          </div>
          <span className="hidden shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold text-ink-muted ring-1 ring-ink/10 sm:inline-flex">
            <Lock className="h-3 w-3" aria-hidden />
            Encrypted
          </span>
        </div>

        <form className="p-5" onSubmit={onChangePassword}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="sec-password">New password</label>
              <div className="relative">
                <Input
                  id="sec-password"
                  type={showPw ? "text" : "password"}
                  placeholder="8+ chars, upper, lower & number"
                  autoComplete="new-password"
                  className="pr-10"
                  value={newPw}
                  onChange={(e) => onNewPw(e.target.value)}
                  onBlur={onPwBlur}
                />
                <button
                  type="button"
                  onClick={onShowPw}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted transition hover:bg-cream-dark hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  {showPw ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>

              {/* Strength meter */}
              <div className="mt-2">
                <div className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-[0.08em]">
                  <span className="text-ink-faint">Strength</span>
                  <span className={strengthText}>{strengthLabel}</span>
                </div>
                <div className="mt-1 flex gap-1" aria-hidden>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-colors",
                        newPw && i < score ? strengthTone : "bg-ink/10"
                      )}
                    />
                  ))}
                </div>
              </div>

              <ul className="mt-2 space-y-1" aria-label="Password requirements">
                {pwRules.map((r) => (
                  <li
                    key={r.label}
                    className={cn(
                      "flex items-center gap-1.5 text-[11px] font-semibold transition-colors",
                      r.ok ? "text-green-700" : "text-ink-faint"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full",
                        r.ok ? "bg-green-100 text-green-700" : "bg-ink/5 text-ink-faint"
                      )}
                    >
                      {r.ok ? <Check className="h-3 w-3" aria-hidden /> : <X className="h-2.5 w-2.5" aria-hidden />}
                    </span>
                    {r.label}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="sec-confirm">Confirm new password</label>
              <div className="relative">
                <Input
                  id="sec-confirm"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat the password"
                  autoComplete="new-password"
                  className="pr-10"
                  value={confirmPw}
                  onChange={(e) => onConfirmPw(e.target.value)}
                />
                <button
                  type="button"
                  onClick={onShowConfirm}
                  aria-label={showConfirm ? "Hide confirmation" : "Show confirmation"}
                  className="absolute right-1 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted transition hover:bg-cream-dark hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
              {pwMatch !== null && (
                <p
                  className={cn(
                    "mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold",
                    pwMatch ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                  )}
                >
                  {pwMatch ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                  {pwMatch ? "Passwords match" : "Passwords don't match"}
                </p>
              )}
              {!pwDone && !confirmPw && (
                <p className="mt-2 rounded-lg bg-cream px-2.5 py-1.5 text-[11.5px] leading-relaxed text-ink-muted">
                  Use a unique passphrase you don&apos;t reuse anywhere else.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-faint">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              Your password is never stored in the app database.
            </p>
            <Button size="sm" loading={saving === "password"}>
              {saving === "password" ? "Saving…" : "Change password"}
            </Button>
          </div>
        </form>
      </section>

      {/* Email */}
      <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
        <div className="flex items-start gap-2.5 border-b border-ink/10 bg-cream/20 px-5 py-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <Mail className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-ink">Email address</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              Used for sign-in and office notifications.
            </p>
          </div>
        </div>
        <form className="p-5" onSubmit={onChangeEmail}>
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-cream/60 px-3 py-2">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-faint">Current</span>
            <span className="text-[12.5px] font-bold text-ink">{email || "—"}</span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold text-primary-700 ring-1 ring-primary-100">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              Auth managed
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="sec-email">New email</label>
              <Input id="sec-email" type="email" value={newEmail} onChange={(e) => onNewEmail(e.target.value)} autoComplete="email" />
            </div>
            <Button size="sm" loading={saving === "email"} className="shrink-0">
              {saving === "email" ? "Sending…" : "Send confirmation"}
            </Button>
          </div>

          <p className="mt-3 rounded-lg border border-primary-100 bg-primary-50/60 px-3 py-2 text-[11.5px] leading-relaxed text-ink-muted">
            Supabase sends a confirmation to <span className="font-bold text-ink">both</span> the old and new address.
            Approve both and the switch completes automatically.
          </p>
        </form>
      </section>
    </div>
  );
}
