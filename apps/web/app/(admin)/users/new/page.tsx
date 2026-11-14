"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  GraduationCap,
  IdCard,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  UserCog,
  UserPlus,
  X,
} from "lucide-react";
import { registerStaffSchema, type RegisterStaffInput } from "@dorsu/shared-schemas";
import { Button, FieldError, Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS = [
  {
    value: "counselor",
    label: "Counselor",
    blurb: "Sessions, referrals & availability",
    icon: UserCog,
    permissions: [
      "Assigned sessions and referrals",
      "Student check-ins and session notes",
      "Weekly availability windows",
    ],
  },
  {
    value: "faculty",
    label: "Faculty",
    blurb: "Refer students & message the office",
    icon: GraduationCap,
    permissions: [
      "Refer students to the guidance office",
      "Track their referral status",
      "Message the office directly",
    ],
  },
  {
    value: "guidance_head",
    label: "Guidance head",
    blurb: "Office-wide assignments & oversight",
    icon: ShieldCheck,
    permissions: [
      "Assign sessions and referrals",
      "Approve staff and manage access",
      "Office-wide reports and security",
    ],
  },
] as const satisfies ReadonlyArray<{
  value: RegisterStaffInput["role"];
  label: string;
  blurb: string;
  icon: typeof UserCog;
  permissions: string[];
}>;

/** Head-only staff provisioning — the only writer of staff accounts (see /api/auth/register). */
export default function AddStaffPage() {
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const { register, handleSubmit, formState, setValue, watch, reset } = useForm<RegisterStaffInput>({
    resolver: zodResolver(registerStaffSchema),
    defaultValues: { role: "counselor" },
  });
  const role = watch("role");
  const pw = watch("password") ?? "";
  const fullName = watch("fullName") ?? "";
  const email = watch("email") ?? "";
  const pwReg = register("password");
  const rules = [
    { label: "8+ characters", ok: pw.length >= 8 },
    { label: "Upper & lowercase", ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { label: "At least one number", ok: /\d/.test(pw) },
  ];
  const passedRules = rules.filter((r) => r.ok).length;
  const matchState = !confirm ? null : confirm === pw && pw.length > 0;
  const selectedRole = ROLE_OPTIONS.find((r) => r.value === role) ?? ROLE_OPTIONS[0];

  const checks = [
    { label: "Role chosen", ok: !!role },
    { label: "Full name", ok: fullName.trim().length > 0 },
    { label: "Valid email", ok: /\S+@\S+\.\S+/.test(email) },
    { label: "Password rules", ok: rules.every((r) => r.ok) },
    { label: "Confirmation matches", ok: matchState === true },
  ];
  const doneCount = checks.filter((c) => c.ok).length;
  const progress = Math.round((doneCount / checks.length) * 100);

  const onSubmit = handleSubmit(async (v) => {
    if (confirm !== v.password) return setError("Those passwords don't match. Please try again.");
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) return setError(body?.error ?? "Couldn't create that account.");
    setCreated(v.fullName);
    reset({ role: "counselor" });
    setConfirm("");
    setPwFocused(false);
  });

  return (
    <div className="space-y-4">
      {/* Hero — same access-control language as the directory. */}
      <section className="relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-200/40 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-accent-200/30 blur-2xl"
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary-700">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Guidance office · Staff provisioning
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Add staff</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-primary-700">
                <UserPlus className="h-3 w-3" aria-hidden />
                Guidance head only
              </span>
            </div>
            <p className="mt-1.5 max-w-[640px] text-[13px] leading-relaxed text-ink-muted">
              Create a staff account and pick its role. The account is active as soon as you save —
              share the email and temporary password with them directly.
            </p>
          </div>

          <Link
            href="/users"
            className="inline-flex h-6 shrink-0 items-center gap-1.5 self-start rounded-full border border-ink/10 bg-white/90 px-3 text-[12px] font-bold text-ink-soft shadow-card backdrop-blur transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to directory
          </Link>
        </div>
      </section>

      {created && (
        <section
          role="status"
          className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-white via-cream to-emerald-50 p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-soft">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-display text-sm font-bold text-ink">Account created for {created}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">
                They can sign in now and finish their profile. The form below is ready for another staff member.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/users"
              className="inline-flex h-6 items-center gap-1.5 rounded-full bg-primary-600 px-3 text-[11.5px] font-bold text-white shadow-soft transition hover:bg-primary-700"
            >
              View in directory
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
            <Button size="sm" variant="outline" onClick={() => setCreated(null)}>
              Add another
            </Button>
          </div>
        </section>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Form card */}
        <form
          onSubmit={onSubmit}
          noValidate
          className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-card"
        >
          <div className="flex items-start gap-3 border-b border-ink/5 bg-gradient-to-b from-white to-cream/40 px-5 py-4 sm:px-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-soft">
              <UserPlus className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-ink">Account details</h2>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
                Fields marked with * are required. Nothing is created until you submit.
              </p>
            </div>
          </div>

          <div className="space-y-6 px-5 py-5 sm:px-6">
            {/* Identity */}
            <section aria-labelledby="identity-heading">
              <div className="flex items-center gap-2">
                <IdCard className="h-3.5 w-3.5 text-primary-600" aria-hidden />
                <h3 id="identity-heading" className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                  Identity
                </h3>
                <span className="h-px flex-1 bg-ink/5" aria-hidden />
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11.5px] font-bold text-ink-soft" htmlFor="staff-name">
                    Full name *
                  </label>
                  <Input
                    id="staff-name"
                    placeholder="Maria C. Santos"
                    autoComplete="name"
                    className="h-9"
                    {...register("fullName")}
                  />
                  <FieldError message={formState.errors.fullName?.message} />
                </div>
                <div>
                  <label className="mb-1 block text-[11.5px] font-bold text-ink-soft" htmlFor="staff-email">
                    Email *
                  </label>
                  <div className="relative">
                    <Mail
                      aria-hidden
                      className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
                    />
                    <Input
                      id="staff-email"
                      type="email"
                      placeholder="msantos@dorsu.edu.ph"
                      autoComplete="email"
                      className="h-9 pl-9"
                      {...register("email")}
                    />
                  </div>
                  <FieldError message={formState.errors.email?.message} />
                </div>
                <div>
                  <label className="mb-1 block text-[11.5px] font-bold text-ink-soft" htmlFor="staff-employee">
                    Employee no.
                    <span className="ml-1 font-medium text-ink-faint">optional</span>
                  </label>
                  <Input
                    id="staff-employee"
                    placeholder="EMP-2024-001"
                    className="h-9"
                    {...register("employeeNo")}
                  />
                  <FieldError message={formState.errors.employeeNo?.message} />
                </div>
              </div>
            </section>

            {/* Role */}
            <section aria-labelledby="role-heading">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-primary-600" aria-hidden />
                <h3 id="role-heading" className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                  Access level
                </h3>
                <span className="h-px flex-1 bg-ink/5" aria-hidden />
              </div>
              <div
                role="radiogroup"
                aria-label="Staff role"
                className="mt-3 grid gap-2 sm:grid-cols-3"
              >
                {ROLE_OPTIONS.map((opt) => {
                  const active = role === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setValue("role", opt.value, { shouldValidate: true })}
                      className={cn(
                        "group relative rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                        active
                          ? "border-primary-300 bg-primary-50/70 ring-1 ring-primary-200"
                          : "border-ink/10 bg-white hover:border-primary-200 hover:bg-cream/40"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg transition",
                          active ? "bg-primary-600 text-white shadow-soft" : "bg-cream text-primary-600"
                        )}
                      >
                        <opt.icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="mt-2 flex items-center gap-1.5">
                        <span className="block text-[13px] font-bold text-ink">{opt.label}</span>
                        {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden />}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">{opt.blurb}</span>
                    </button>
                  );
                })}
              </div>
              <FieldError message={formState.errors.role?.message} />

              {role === "counselor" && (
                <div className="mt-3 rounded-xl border border-primary-100 bg-blue-50/50 p-3">
                  <label className="mb-1 block text-[11.5px] font-bold text-ink-soft" htmlFor="staff-specialization">
                    Specialization
                    <span className="ml-1 font-medium text-ink-faint">optional</span>
                  </label>
                  <Input
                    id="staff-specialization"
                    placeholder="e.g. Academic stress"
                    className="h-9 bg-white"
                    {...register("specialization")}
                  />
                  <FieldError message={formState.errors.specialization?.message} />
                </div>
              )}
              {role === "faculty" && (
                <div className="mt-3 rounded-xl border border-primary-100 bg-blue-50/50 p-3">
                  <label className="mb-1 block text-[11.5px] font-bold text-ink-soft" htmlFor="staff-department">
                    Department
                    <span className="ml-1 font-medium text-ink-faint">optional</span>
                  </label>
                  <Input
                    id="staff-department"
                    placeholder="e.g. College of Arts and Sciences"
                    className="h-9 bg-white"
                    {...register("department")}
                  />
                  <FieldError message={formState.errors.department?.message} />
                </div>
              )}
            </section>

            {/* Password */}
            <section aria-labelledby="password-heading">
              <div className="flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5 text-primary-600" aria-hidden />
                <h3 id="password-heading" className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                  Sign-in password
                </h3>
                <span className="h-px flex-1 bg-ink/5" aria-hidden />
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11.5px] font-bold text-ink-soft" htmlFor="staff-password">
                    Password *
                  </label>
                  <div className="relative">
                    <Input
                      id="staff-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="8+ chars, upper, lower & number"
                      autoComplete="new-password"
                      className="h-9 pr-10"
                      {...pwReg}
                      onFocus={() => setPwFocused(true)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted transition hover:bg-cream-dark hover:text-ink"
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>
                  </div>
                  <FieldError message={formState.errors.password?.message} />
                </div>
                <div>
                  <label className="mb-1 block text-[11.5px] font-bold text-ink-soft" htmlFor="staff-confirm">
                    Confirm password *
                  </label>
                  <div className="relative">
                    <Input
                      id="staff-confirm"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repeat the password"
                      autoComplete="new-password"
                      className="h-9 pr-10"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? "Hide confirmation" : "Show confirmation"}
                      className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted transition hover:bg-cream-dark hover:text-ink"
                    >
                      {showConfirm ? (
                        <EyeOff className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>
                  </div>
                  {matchState !== null && (
                    <p
                      className={cn(
                        "mt-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold",
                        matchState ? "text-emerald-700" : "text-red-600"
                      )}
                    >
                      {matchState ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                      {matchState ? "Passwords match" : "Passwords don't match"}
                    </p>
                  )}
                </div>
              </div>

              {/* Live strength + rule chips */}
              <div className="mt-3 rounded-xl border border-ink/10 bg-cream/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-muted">
                    Password strength
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-bold",
                      passedRules === 3
                        ? "text-emerald-700"
                        : passedRules === 2
                          ? "text-amber-700"
                          : "text-ink-muted"
                    )}
                  >
                    {pw ? (passedRules === 3 ? "Strong" : passedRules === 2 ? "Fair" : "Weak") : "Waiting for input"}
                  </span>
                </div>
                <div className="mt-1.5 flex gap-1" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors",
                        i < passedRules
                          ? passedRules === 3
                            ? "bg-emerald-500"
                            : passedRules === 2
                              ? "bg-amber-400"
                              : "bg-red-400"
                          : "bg-ink/10"
                      )}
                    />
                  ))}
                </div>
                <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Password requirements">
                  {rules.map((r) => (
                    <li
                      key={r.label}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ring-inset transition-colors",
                        r.ok
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-white text-ink-faint ring-ink/10"
                      )}
                    >
                      {r.ok ? <Check className="h-3 w-3" aria-hidden /> : <X className="h-3 w-3" aria-hidden />}
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[12.5px] font-semibold leading-snug text-red-700"
              >
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/5 bg-cream/40 px-5 py-3 sm:px-6">
            <p className="text-[11px] leading-snug text-ink-faint">
              {pwFocused && passedRules < 3
                ? "Finish the password rules above to continue."
                : "The account becomes active immediately after saving."}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/users"
                className="inline-flex h-6 items-center rounded-full border border-ink/15 bg-white px-3 text-[11.5px] font-bold text-ink-soft transition hover:border-primary-300 hover:text-primary-700"
              >
                Cancel
              </Link>
              <Button disabled={formState.isSubmitting} className="gap-1.5">
                {formState.isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                {formState.isSubmitting ? "Creating…" : "Create account"}
              </Button>
            </div>
          </div>
        </form>

        {/* Sidebar — live preview + readiness checklist */}
        <aside className="space-y-3 lg:sticky lg:top-4">
          <section className="overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-4 shadow-card">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-700">
              <Sparkles className="h-3 w-3" aria-hidden />
              Access preview
            </p>
            <div className="mt-2.5 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white shadow-soft">
                <selectedRole.icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold text-ink">{selectedRole.label}</p>
                <p className="truncate text-[11px] font-medium text-ink-muted">{selectedRole.blurb}</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5">
              {selectedRole.permissions.map((p) => (
                <li key={p} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-ink-soft">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-lg bg-white/70 px-2.5 py-1.5 text-[10.5px] leading-snug text-ink-muted ring-1 ring-inset ring-ink/5">
              Access is enforced by role policies and database rules — not just the menu.
            </p>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">Readiness</p>
              <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-primary-700 ring-1 ring-inset ring-primary-100">
                {doneCount}/{checks.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden>
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  progress === 100 ? "bg-emerald-500" : "bg-primary-500"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <ul className="mt-3 space-y-1.5">
              {checks.map((c) => (
                <li
                  key={c.label}
                  className={cn(
                    "flex items-center gap-2 text-[11.5px] font-semibold",
                    c.ok ? "text-ink-soft" : "text-ink-faint"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
                      c.ok
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-cream text-ink-faint ring-ink/10"
                    )}
                  >
                    {c.ok ? <Check className="h-2.5 w-2.5" aria-hidden /> : <ChevronRight className="h-2.5 w-2.5" aria-hidden />}
                  </span>
                  {c.label}
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-start gap-1.5 border-t border-ink/5 pt-2.5 text-[10.5px] leading-snug text-ink-faint">
              <Mail className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              Share the sign-in email and password with them privately. Ask them to change it after first login.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
