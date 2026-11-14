import { PageHeaderSkeleton, PanelShellSkeleton, DivideListSkeleton, SkeletonRoot } from "./primitives";

/**
 * Specialized skeletons — asymmetric / single-column layouts where the
 * generic 3-card + 2-panel shape is actively misleading.
 */

/** /chat: gradient hero, 340px conversation rail + 1fr thread + composer. */
export function ChatSkeleton() {
  return (
    <SkeletonRoot>
      <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-primary-200/60" />
            <div>
              <div className="h-2.5 w-36 rounded-full bg-ink/10" />
              <div className="mt-2 h-7 w-44 rounded-lg bg-ink/10" />
              <div className="mt-2 h-3.5 w-80 max-w-full rounded-full bg-ink/10" />
            </div>
          </div>
          <div className="flex gap-1.5">
            <div className="h-6 w-32 rounded-full bg-white/80" />
            <div className="h-6 w-20 rounded-full bg-white/80" />
          </div>
        </div>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-ink/5 px-4 pb-3 pt-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-28 rounded-full bg-ink/10" />
              <div className="h-4 w-6 rounded-full bg-primary-100" />
            </div>
            <div className="h-8 w-8 rounded-xl bg-primary-600/20" />
          </div>
          <div className="px-4 pt-3">
            <div className="h-9 rounded-xl bg-ink/10" />
          </div>
          <div className="px-4 pt-3">
            <div className="h-8 rounded-xl bg-ink/5" />
          </div>
          <ul className="mt-3 space-y-1 px-2 pb-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                <div className="h-10 w-10 shrink-0 rounded-full bg-ink/10" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="h-3.5 w-2/5 rounded-full bg-ink/10" />
                    <div className="h-2.5 w-8 rounded-full bg-ink/5" />
                  </div>
                  <div className="mt-2 h-3 w-3/4 rounded-full bg-ink/10" />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-card">
          <div className="flex items-center gap-3 border-b border-ink/10 bg-gradient-to-b from-white to-cream/40 px-4 py-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-ink/10" />
            <div className="flex-1">
              <div className="h-3.5 w-1/4 rounded-full bg-ink/10" />
              <div className="mt-1.5 h-3 w-1/3 rounded-full bg-ink/10" />
            </div>
            <div className="h-5 w-16 rounded-full bg-ink/10" />
          </div>
          <div className="h-[46vh] min-h-[300px] space-y-3 overflow-hidden bg-cream/20 px-4 py-4">
            <div className="flex justify-center pb-1">
              <div className="h-4 w-24 rounded-full bg-ink/10" />
            </div>
            <div className="flex items-end gap-2">
              <div className="h-7 w-7 shrink-0 rounded-full bg-ink/10" />
              <div className="h-10 w-2/3 rounded-2xl bg-ink/10" />
            </div>
            <div className="flex justify-end">
              <div className="h-10 w-1/2 rounded-2xl bg-primary-600/20" />
            </div>
            <div className="flex justify-end">
              <div className="h-12 w-2/3 rounded-2xl bg-primary-600/20" />
            </div>
            <div className="flex items-end gap-2">
              <div className="h-7 w-7 shrink-0 rounded-full bg-ink/10" />
              <div className="h-10 w-3/5 rounded-2xl bg-ink/10" />
            </div>
          </div>
          <div className="border-t border-ink/10 px-4 py-3">
            <div className="flex items-end gap-2 rounded-2xl bg-ink/5 py-1.5 pl-3 pr-1.5">
              <div className="h-6 flex-1 rounded-full bg-ink/10" />
              <div className="h-8 w-8 rounded-xl bg-ink/10" />
            </div>
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /sessions: hero + stats, then calendar + right rail. */
export function SessionsSkeleton() {
  return (
    <SkeletonRoot>
      <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
        <div className="h-3 w-28 rounded-full bg-ink/10" />
        <div className="mt-3 h-7 w-56 rounded-lg bg-ink/10" />
        <div className="mt-3 h-4 w-96 max-w-full rounded-full bg-ink/10" />
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[68px] rounded-xl bg-white/70" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-16 rounded-lg bg-ink/10" />
              <div className="h-8 w-20 rounded-lg bg-ink/10" />
              <div className="h-5 w-36 rounded-full bg-ink/10" />
            </div>
            <div className="h-9 w-48 rounded-lg bg-ink/10" />
          </div>
          <div className="p-5">
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={`h-${i}`} className="h-4 rounded-full bg-ink/10" />
              ))}
              {Array.from({ length: 42 }).map((_, i) => (
                <div key={`c-${i}`} className="min-h-[112px] rounded-xl bg-ink/10" />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-ink/10 bg-cream/40 px-5 py-2.5">
            <div className="h-3 w-64 rounded-full bg-ink/10" />
            <div className="h-3 w-32 rounded-full bg-ink/10" />
          </div>
        </section>
        <div className="space-y-4">
          <div className="h-[104px] rounded-xl bg-ink/10" />
          <div className="h-[220px] rounded-xl bg-ink/10" />
          <div className="h-[180px] rounded-xl bg-ink/10" />
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /availability: title + 6 visible stat cards + compact 7-col coverage board + form. */
export function AvailabilitySkeleton() {
  return (
    <SkeletonRoot>
      <div className="h-7 w-64 max-w-full rounded-lg bg-ink/10" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-ink/10 bg-white p-4 shadow-card">
            <div className="h-3 w-24 max-w-full rounded-full bg-ink/10" />
            <div className="mt-2 h-8 w-12 rounded bg-ink/10" />
          </div>
        ))}
      </div>
      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-card">
        <div className="h-4 w-40 rounded-full bg-ink/10" />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-16 rounded-md bg-ink/10" />
          ))}
        </div>
      </section>
      <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="h-4 w-48 rounded-full bg-ink/10" />
        <div className="mt-4 space-y-3">
          <div className="h-10 rounded-lg bg-ink/10" />
          <div className="h-10 rounded-lg bg-ink/10" />
          <div className="h-10 rounded-lg bg-ink/10" />
        </div>
      </div>
    </SkeletonRoot>
  );
}

/**
 * /settings: identity hero (banner + avatar + completeness ring) +
 * sticky section rail + content panel (with a head-only right column).
 */
export function SettingsSkeleton() {
  return (
    <SkeletonRoot>
      <div className="w-full space-y-4">
        <div className="overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card">
          <div className="h-24 bg-ink/10 sm:h-28" />
          <div className="px-5 pb-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="-mt-11 flex items-end gap-3 sm:-mt-12">
                <div className="h-20 w-20 shrink-0 rounded-full bg-ink/10 ring-4 ring-white sm:h-24 sm:w-24" />
                <div className="pb-1">
                  <div className="h-5 w-48 rounded-full bg-ink/10" />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <div className="h-5 w-20 rounded-full bg-ink/10" />
                    <div className="h-3 w-32 rounded-full bg-ink/10" />
                    <div className="h-3 w-24 rounded-full bg-ink/10" />
                  </div>
                </div>
              </div>
              <div className="h-8 w-24 rounded-lg bg-ink/10" />
            </div>
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream/40 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 rounded-full bg-ink/10" />
                <div>
                  <div className="h-3.5 w-40 rounded-full bg-ink/10" />
                  <div className="mt-1.5 h-3 w-52 rounded-full bg-ink/10" />
                </div>
              </div>
              <div className="h-7 w-28 rounded-full bg-ink/10" />
            </div>
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[236px_minmax(0,1fr)]">
          <div className="rounded-xl border border-ink/10 bg-white p-2 shadow-card">
            <div className="flex gap-1 overflow-hidden lg:flex-col lg:gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-9 flex-1 rounded-lg bg-ink/10 lg:h-11" />
              ))}
            </div>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card">
                <div className="h-4 w-40 rounded-full bg-ink/10" />
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-lg bg-ink/10" />
                  ))}
                </div>
              </div>
              <PanelShellSkeleton rows={2} />
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card">
                <div className="h-4 w-36 rounded-full bg-ink/10" />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-[74px] rounded-xl bg-ink/10" />
                  ))}
                </div>
              </div>
              <PanelShellSkeleton rows={2} />
            </div>
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /refer-student: stacked CTA card + 9-col history table. */
export function ReferStudentSkeleton() {
  return (
    <SkeletonRoot>
      <PageHeaderSkeleton action="buttons" breadcrumb={false} />
      <div className="rounded-lg border border-ink/10 bg-white p-6 text-center shadow-card">
        <div className="mx-auto h-4 w-56 rounded-full bg-ink/10" />
        <div className="mx-auto mt-2 h-3 w-96 max-w-full rounded-full bg-ink/10" />
        <div className="mx-auto mt-4 h-10 w-48 rounded-lg bg-ink/10" />
      </div>
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
        <div className="h-4 w-48 rounded-full bg-ink/10" />
        <div className="mt-4 grid grid-cols-9 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-3 rounded-full bg-ink/10" />
          ))}
        </div>
        <div className="mt-3 space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-ink/10" />
          ))}
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /emergency: wide hero + 3-step rail, then main form/grant column + right rail. */
export function EmergencySkeleton() {
  return (
    <SkeletonRoot>
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-white via-cream to-red-50 p-5 shadow-card sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="h-2.5 w-28 rounded-full bg-ink/10" />
              <div className="mt-3 flex items-center gap-2">
                <div className="h-7 w-56 rounded-lg bg-ink/10" />
                <div className="h-6 w-28 rounded-full bg-ink/10" />
              </div>
              <div className="mt-3 h-3.5 w-full max-w-[560px] rounded-full bg-ink/10" />
              <div className="mt-2 h-3.5 w-3/4 max-w-[420px] rounded-full bg-ink/10" />
            </div>
            <div className="h-[86px] w-full rounded-xl border border-white/70 bg-white/70 lg:w-44" />
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[58px] rounded-xl border border-white/70 bg-white/60" />
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-4">
            <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
              <div className="h-4 w-52 rounded-full bg-ink/10" />
              <div className="mt-4 h-10 rounded-lg bg-ink/10" />
              <div className="mt-3 flex gap-2">
                <div className="h-6 w-40 rounded-full bg-ink/10" />
                <div className="h-6 w-48 rounded-full bg-ink/10" />
              </div>
              <div className="mt-3 h-20 rounded-lg bg-ink/10" />
              <div className="mt-3 flex justify-end">
                <div className="h-6 w-40 rounded-full bg-ink/10" />
              </div>
            </div>
            <div className="h-[120px] rounded-lg border border-red-100 bg-white shadow-card" />
          </div>
          <div className="space-y-4">
            <div className="h-[190px] rounded-lg border border-ink/10 bg-white shadow-card" />
            <div className="h-[150px] rounded-lg border border-red-100 bg-white shadow-card" />
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /about: wide max-w-6xl workspace (hero + sticky tabs + panel). */
export function AboutSkeleton() {
  return (
    <SkeletonRoot>
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-6 shadow-card sm:p-8">
          <div className="h-3 w-36 rounded-full bg-ink/10" />
          <div className="mt-3 h-7 w-64 rounded-lg bg-ink/10" />
          <div className="mt-3 h-4 w-96 max-w-full rounded-full bg-ink/10" />
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[70px] rounded-xl bg-white/70" />
            ))}
          </div>
        </div>
        <div className="h-12 rounded-xl bg-ink/10" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-64 rounded-xl bg-ink/10" />
          <div className="h-64 rounded-xl bg-ink/10" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-ink/10" />
          ))}
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /users/new: hero + two-column form/checklist layout. */
export function UserFormSkeleton() {
  return (
    <SkeletonRoot>
      {/* Hero */}
      <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="w-full max-w-[560px]">
            <div className="h-3 w-40 rounded-full bg-ink/10" />
            <div className="mt-3 flex items-center gap-2">
              <div className="h-8 w-36 rounded-lg bg-ink/10" />
              <div className="h-5 w-28 rounded-full bg-ink/10" />
            </div>
            <div className="mt-2 h-3 w-full rounded-full bg-ink/10" />
          </div>
          <div className="h-6 w-32 shrink-0 rounded-full bg-ink/10" />
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Form card */}
        <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-card">
          <div className="flex items-start gap-3 border-b border-ink/5 bg-gradient-to-b from-white to-cream/40 px-5 py-4 sm:px-6">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-ink/10" />
            <div className="w-full">
              <div className="h-4 w-32 rounded-full bg-ink/10" />
              <div className="mt-2 h-3 w-48 rounded-full bg-ink/10" />
            </div>
          </div>
          <div className="space-y-6 px-5 py-5 sm:px-6">
            {[2, 3, 2].map((fields, section) => (
              <div key={section}>
                <div className="h-3 w-24 rounded-full bg-ink/10" />
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: fields }).map((_, i) => (
                    <div key={i} className={fields === 2 && section === 0 ? "sm:col-span-2" : undefined}>
                      <div className="h-3 w-20 rounded-full bg-ink/10" />
                      <div className="mt-2 h-9 rounded-lg bg-ink/10" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-ink/5 bg-cream/40 px-5 py-3 sm:px-6">
            <div className="h-3 w-44 rounded-full bg-ink/10" />
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full bg-ink/10" />
              <div className="h-6 w-28 rounded-full bg-ink/10" />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-4 shadow-card">
            <div className="h-3 w-24 rounded-full bg-ink/10" />
            <div className="mt-3 flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-ink/10" />
              <div className="w-full">
                <div className="h-3.5 w-24 rounded-full bg-ink/10" />
                <div className="mt-1.5 h-2.5 w-32 rounded-full bg-ink/10" />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-2.5 w-full rounded-full bg-ink/10" />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded-full bg-ink/10" />
              <div className="h-4 w-10 rounded-full bg-ink/10" />
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-ink/10" />
            <div className="mt-3 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-3 w-full rounded-full bg-ink/10" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** Generic inbox-list reuse for future routes. */
export function InboxListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <PanelShellSkeleton>
      <DivideListSkeleton rows={rows} />
    </PanelShellSkeleton>
  );
}
