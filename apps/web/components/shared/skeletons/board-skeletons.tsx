import {
  ChartBlockSkeleton,
  DivideListSkeleton,
  DonutBlockSkeleton,
  FilterBarSkeleton,
  PageHeaderSkeleton,
  PanelShellSkeleton,
  SkeletonRoot,
  TableSkeleton,
} from "./primitives";

/** Shared board chrome: header + tabs/filter + single Card table. */
function BoardShell({
  action = "stats",
  tabs = false,
  menus = 3,
  cols = 7,
  rows = 4,
}: {
  action?: "stats" | "cta" | "filters" | "tabs" | "buttons" | "none";
  tabs?: boolean;
  menus?: number;
  cols?: number;
  rows?: number;
}) {
  return (
    <SkeletonRoot>
      <PageHeaderSkeleton action={action} />
      {tabs && (
        <div className="flex gap-2">
          <div className="h-9 w-40 rounded-lg bg-ink/10" />
          <div className="h-9 w-48 rounded-lg bg-ink/10" />
        </div>
      )}
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
        <FilterBarSkeleton menus={menus} />
        <TableSkeleton rows={rows} cols={cols} />
      </div>
    </SkeletonRoot>
  );
}

/**
 * /appointments: hero with role pill + next-step strip + 6 stat cards,
 * the Appointments / Follow-ups tabs, then the filter bar and 7-col table.
 */
export function AppointmentsSkeleton() {
  return (
    <SkeletonRoot>
      <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
        <div className="h-3 w-28 rounded-full bg-ink/10" />
        <div className="mt-3 flex items-center gap-2">
          <div className="h-7 w-56 rounded-lg bg-ink/10" />
          <div className="h-6 w-24 rounded-full bg-ink/10" />
        </div>
        <div className="mt-3 h-4 w-96 max-w-full rounded-full bg-ink/10" />
        <div className="mt-4 h-11 rounded-xl bg-accent-100/70" />
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/70 bg-white/75 p-3">
              <div className="h-2.5 w-20 rounded-full bg-ink/10" />
              <div className="mt-3 h-6 w-10 rounded-lg bg-ink/10" />
              <div className="mt-2 h-2.5 w-16 rounded-full bg-ink/10" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-9 w-40 rounded-lg bg-ink/10" />
        <div className="h-9 w-48 rounded-lg bg-ink/10" />
      </div>
      <div className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-card">
        <div className="border-b border-ink/10 bg-cream/20 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="h-8 w-64 rounded-lg bg-ink/10" />
            <div className="flex gap-2">
              <div className="h-9 w-72 rounded-lg bg-ink/10" />
              <div className="h-9 w-44 rounded-lg bg-ink/10" />
            </div>
          </div>
          <div className="mt-2 h-3 w-80 rounded-full bg-ink/10" />
        </div>
        <div className="px-5 py-4">
          <TableSkeleton rows={10} cols={6} />
        </div>
      </div>
    </SkeletonRoot>
  );
}

/**
 * /referrals: hero with role pill + next-step strip + 6 stat cards, then the
 * filter bar and the referral table (same chrome as /appointments).
 */
export function ReferralsSkeleton() {
  return (
    <SkeletonRoot>
      <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
        <div className="h-3 w-28 rounded-full bg-ink/10" />
        <div className="mt-3 flex items-center gap-2">
          <div className="h-7 w-48 rounded-lg bg-ink/10" />
          <div className="h-6 w-24 rounded-full bg-ink/10" />
        </div>
        <div className="mt-3 h-4 w-96 max-w-full rounded-full bg-ink/10" />
        <div className="mt-4 h-11 rounded-xl bg-accent-100/70" />
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/70 bg-white/75 p-3">
              <div className="h-2.5 w-20 rounded-full bg-ink/10" />
              <div className="mt-3 h-6 w-10 rounded-lg bg-ink/10" />
              <div className="mt-2 h-2.5 w-16 rounded-full bg-ink/10" />
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-card">
        <div className="border-b border-ink/10 bg-cream/20 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <div className="h-9 w-64 rounded-lg bg-ink/10" />
              <div className="h-9 w-56 rounded-lg bg-ink/10" />
            </div>
            <div className="h-8 w-64 rounded-lg bg-ink/10" />
          </div>
          <div className="mt-2 h-3 w-80 rounded-full bg-ink/10" />
        </div>
        <div className="px-5 py-4">
          <TableSkeleton rows={10} cols={6} />
        </div>
      </div>
    </SkeletonRoot>
  );
}

/**
 * /students: hero + 6 clickable stat tiles + needs-attention/screening bento +
 * program spread + filter bar and directory table.
 */
export function StudentsSkeleton() {
  return (
    <SkeletonRoot>
      <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
        <div className="h-3 w-28 rounded-full bg-ink/10" />
        <div className="mt-3 flex items-center gap-2">
          <div className="h-7 w-44 rounded-lg bg-ink/10" />
          <div className="h-6 w-24 rounded-full bg-ink/10" />
        </div>
        <div className="mt-3 h-4 w-96 max-w-full rounded-full bg-ink/10" />
        <div className="mt-3 h-3 w-64 max-w-full rounded-full bg-ink/10" />
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/70 bg-white/75 p-3">
              <div className="h-2.5 w-20 rounded-full bg-ink/10" />
              <div className="mt-3 h-6 w-10 rounded-lg bg-ink/10" />
              <div className="mt-2 h-2.5 w-16 rounded-full bg-ink/10" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <PanelShellSkeleton withHint>
            <DivideListSkeleton rows={4} />
          </PanelShellSkeleton>
        </div>
        <div className="xl:col-span-5">
          <PanelShellSkeleton withHint>
            <DonutBlockSkeleton />
          </PanelShellSkeleton>
        </div>
        <div className="xl:col-span-12">
          <PanelShellSkeleton withHint>
            <ChartBlockSkeleton />
          </PanelShellSkeleton>
        </div>
      </div>
      <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-card">
        <FilterBarSkeleton menus={3} />
        <TableSkeleton rows={5} cols={7} />
      </div>
    </SkeletonRoot>
  );
}

/** /announcements: wide hero + stat cards, filter bar, composer + feed + rail. */
export function AnnouncementsSkeleton() {
  return (
    <SkeletonRoot>
      <div className="w-full space-y-4">
        <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="h-2.5 w-28 rounded-full bg-ink/10" />
              <div className="mt-3 flex items-center gap-2">
                <div className="h-7 w-52 rounded-lg bg-ink/10" />
                <div className="h-6 w-24 rounded-full bg-ink/10" />
              </div>
              <div className="mt-3 h-3.5 w-full max-w-[540px] rounded-full bg-ink/10" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-44 rounded-lg bg-white/70" />
              <div className="h-9 w-28 rounded-lg bg-ink/10" />
            </div>
          </div>
          <div className="mt-4 h-11 rounded-xl bg-accent-100/70" />
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/70 bg-white/75 p-3">
                <div className="h-2.5 w-20 rounded-full bg-ink/10" />
                <div className="mt-3 h-6 w-10 rounded-lg bg-ink/10" />
                <div className="mt-2 h-2.5 w-16 rounded-full bg-ink/10" />
              </div>
            ))}
          </div>
        </div>

        <div className="h-[300px] rounded-lg border border-ink/10 bg-white shadow-card" />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-4">
            <div className="rounded-lg border border-ink/10 bg-white p-3 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <div className="h-8 w-64 rounded-lg bg-ink/10" />
                <div className="h-9 w-72 rounded-lg bg-ink/10" />
              </div>
              <div className="mt-2 h-3 w-64 rounded-full bg-ink/10" />
            </div>
            <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-card">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-ink/10" />
                <div className="h-9 flex-1 rounded-full bg-ink/10" />
                <div className="h-6 w-20 rounded-full bg-ink/10" />
              </div>
            </div>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-ink/10 bg-white p-5 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-ink/10" />
                  <div className="flex-1">
                    <div className="h-3.5 w-1/3 rounded-full bg-ink/10" />
                    <div className="mt-1.5 h-3 w-1/4 rounded-full bg-ink/10" />
                  </div>
                </div>
                <div className="mt-3 h-4 w-2/3 rounded-full bg-ink/10" />
                <div className="mt-2 h-16 rounded-lg bg-ink/10" />
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="h-[170px] rounded-lg border border-ink/10 bg-white shadow-card" />
            <div className="h-[180px] rounded-lg border border-ink/10 bg-white shadow-card" />
            <div className="h-[140px] rounded-lg border border-primary-100 bg-blue-50/40 shadow-card" />
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /notifications: hidden 4 stats + Mark-all-read + 1 inbox card, h-16 rows. */
export function NotificationsSkeleton() {
  return (
    <SkeletonRoot>
      <PageHeaderSkeleton action="buttons" breadcrumb={false} />
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
        <FilterBarSkeleton menus={2} />
        <ul className="mt-3 divide-y divide-ink/10" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-start gap-3 py-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-ink/10" />
              <div className="min-w-0 flex-1">
                <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
                <div className="mt-1.5 h-3 w-full rounded-full bg-ink/10" />
                <div className="mt-1.5 h-3 w-1/4 rounded-full bg-ink/10" />
              </div>
              <div className="h-5 w-16 shrink-0 rounded-full bg-ink/10" />
            </li>
          ))}
        </ul>
      </div>
    </SkeletonRoot>
  );
}

/**
 * /feedback: gradient hero (scorecard + nudge + 6 KPI cards), then the
 * distribution/trend row, follow-up/sentiment/coverage row, and the
 * recent-feedback list + themes rail.
 */
export function FeedbackSkeleton() {
  return (
    <SkeletonRoot>
      <div className="w-full space-y-4">
        <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="h-2.5 w-28 rounded-full bg-ink/10" />
              <div className="mt-3 flex items-center gap-2">
                <div className="h-7 w-48 rounded-lg bg-ink/10" />
                <div className="h-6 w-28 rounded-full bg-ink/10" />
              </div>
              <div className="mt-3 h-3.5 w-full max-w-[560px] rounded-full bg-ink/10" />
            </div>
            <div className="h-[108px] w-full rounded-xl border border-white/70 bg-white/85 lg:w-52" />
          </div>
          <div className="mt-4 h-11 rounded-xl bg-accent-100/70" />
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/70 bg-white/75 p-3">
                <div className="h-2.5 w-20 rounded-full bg-ink/10" />
                <div className="mt-3 h-6 w-12 rounded-lg bg-ink/10" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <PanelShellSkeleton>
            <ChartBlockSkeleton />
          </PanelShellSkeleton>
          <div className="xl:col-span-2">
            <PanelShellSkeleton>
              <ChartBlockSkeleton />
            </PanelShellSkeleton>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <PanelShellSkeleton rows={3} rowHeight="h-16" />
          <PanelShellSkeleton>
            <DonutBlockSkeleton />
          </PanelShellSkeleton>
          <PanelShellSkeleton>
            <DivideListSkeleton rows={3} />
          </PanelShellSkeleton>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-card">
            <div className="px-5 pt-4">
              <div className="h-4 w-40 rounded-full bg-ink/10" />
              <div className="mt-2 h-3 w-56 rounded-full bg-ink/10" />
            </div>
            <div className="mt-3 border-y border-ink/10 bg-cream/20 px-5 py-3">
              <div className="flex flex-wrap gap-2">
                <div className="h-8 w-64 rounded-lg bg-ink/10" />
                <div className="h-9 w-72 rounded-lg bg-ink/10" />
              </div>
              <div className="mt-2 h-3 w-64 rounded-full bg-ink/10" />
            </div>
            <div className="divide-y divide-ink/10">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="h-3.5 w-48 rounded-full bg-ink/10" />
                  <div className="mt-2 h-3 w-full rounded-full bg-ink/10" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <PanelShellSkeleton>
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-7 w-20 rounded-full bg-ink/10" />
                ))}
              </div>
            </PanelShellSkeleton>
            <div className="h-[140px] rounded-lg border border-primary-100 bg-blue-50/40 shadow-card" />
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /users (admin): gradient hero + 6 clickable stat cards + directory card (6-col table, 10 rows). */
export function UsersSkeleton() {
  return (
    <SkeletonRoot>
      <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="h-2.5 w-40 rounded-full bg-ink/10" />
            <div className="mt-2 h-7 w-48 rounded-lg bg-ink/10" />
            <div className="mt-2 h-3.5 w-80 max-w-full rounded-full bg-ink/10" />
          </div>
          <div className="h-9 w-28 rounded-xl bg-primary-600/20" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/70 bg-white/70 p-3">
              <div className="h-2.5 w-24 max-w-full rounded-full bg-ink/10" />
              <div className="mt-2 h-6 w-10 rounded bg-ink/10" />
              <div className="mt-1.5 h-2.5 w-16 max-w-full rounded-full bg-ink/10" />
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-card">
        <div className="border-b border-ink/5 px-5 pb-0 pt-4">
          <FilterBarSkeleton menus={2} />
          <div className="mt-3 flex gap-2 pb-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-7 w-20 rounded-full bg-ink/10" />
            ))}
          </div>
        </div>
        <TableSkeleton rows={10} cols={6} />
      </div>
    </SkeletonRoot>
  );
}

/**
 * /security (admin): gradient hero (review queue + nudge + 4 KPI), then
 * break-glass form + access-events preview, the audit preview, and the
 * access matrix.
 */
export function SecuritySkeleton() {
  return (
    <SkeletonRoot>
      <div className="w-full space-y-4">
        <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="h-2.5 w-32 rounded-full bg-ink/10" />
              <div className="mt-3 flex items-center gap-2">
                <div className="h-7 w-40 rounded-lg bg-ink/10" />
                <div className="h-6 w-24 rounded-full bg-ink/10" />
              </div>
              <div className="mt-3 h-3.5 w-full max-w-[560px] rounded-full bg-ink/10" />
            </div>
            <div className="h-[104px] w-full rounded-xl border border-white/70 bg-white/85 lg:w-48" />
          </div>
          <div className="mt-4 h-11 rounded-xl bg-primary-100/60" />
          <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/70 bg-white/75 p-3">
                <div className="h-2.5 w-20 rounded-full bg-ink/10" />
                <div className="mt-3 h-6 w-12 rounded-lg bg-ink/10" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl border border-ink/10 bg-white p-1 shadow-card">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-28 flex-1 rounded-lg bg-ink/10 sm:flex-none" />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
          <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card">
            <div className="h-4 w-44 rounded-full bg-ink/10" />
            <div className="mt-4 space-y-3">
              <div className="h-10 rounded-lg bg-ink/10" />
              <div className="h-20 rounded-lg bg-ink/10" />
              <div className="h-10 rounded-lg bg-ink/10" />
            </div>
          </div>
          <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card">
            <div className="h-4 w-36 rounded-full bg-ink/10" />
            <div className="mt-4 space-y-3">
              <div className="h-16 rounded-lg bg-ink/10" />
              <div className="h-16 rounded-lg bg-ink/10" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-4 w-40 rounded-full bg-ink/10" />
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-ink/10" />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-4 w-48 rounded-full bg-ink/10" />
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 rounded-lg bg-ink/10" />
            ))}
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /security/events: breadcrumb + hero (posture + 4 KPI) + filters + timeline. */
export function AccessEventsSkeleton() {
  return (
    <SkeletonRoot>
      <div className="w-full space-y-4">
        <div className="h-4 w-56 rounded-full bg-ink/10" />
        <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="h-2.5 w-32 rounded-full bg-ink/10" />
              <div className="mt-3 flex items-center gap-2">
                <div className="h-7 w-48 rounded-lg bg-ink/10" />
                <div className="h-6 w-28 rounded-full bg-ink/10" />
              </div>
              <div className="mt-3 h-3.5 w-full max-w-[560px] rounded-full bg-ink/10" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-24 rounded-lg border border-white/70 bg-white/85" />
              <div className="h-9 w-28 rounded-lg border border-white/70 bg-white/85" />
            </div>
          </div>
          <div className="mt-4 h-11 rounded-xl bg-primary-100/60" />
          <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/70 bg-white/75 p-3">
                <div className="h-2.5 w-20 rounded-full bg-ink/10" />
                <div className="mt-3 h-6 w-12 rounded-lg bg-ink/10" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-ink/10 bg-white shadow-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 bg-cream/20 px-5 py-3">
            <div className="h-8 w-72 rounded-lg bg-ink/10" />
            <div className="h-9 w-64 rounded-lg bg-ink/10" />
          </div>
          <div className="px-5 py-2.5">
            <div className="h-3 w-52 rounded-full bg-ink/10" />
          </div>
        </div>

        <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-3 w-40 rounded-full bg-ink/10" />
          <div className="mt-3 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-ink/10" />
            ))}
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /security/audit: hero + sparkline + 5 KPI + command bar + trail table. */
export function AuditTrailSkeleton() {
  return (
    <SkeletonRoot>
      <div className="w-full space-y-4">
        <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="h-2.5 w-32 rounded-full bg-ink/10" />
              <div className="mt-3 flex items-center gap-2">
                <div className="h-7 w-44 rounded-lg bg-ink/10" />
                <div className="h-6 w-28 rounded-full bg-ink/10" />
                <div className="h-6 w-24 rounded-full bg-ink/10" />
              </div>
              <div className="mt-3 h-3.5 w-full max-w-[560px] rounded-full bg-ink/10" />
              <div className="mt-3 flex items-center gap-2">
                <div className="h-9 w-28 rounded-lg border border-white/70 bg-white/85" />
                <div className="h-3 w-24 rounded-full bg-ink/10" />
              </div>
            </div>
            <div className="w-full shrink-0 rounded-xl border border-white/70 bg-white/80 p-3 lg:w-[320px]">
              <div className="flex items-center justify-between">
                <div className="h-2.5 w-28 rounded-full bg-ink/10" />
                <div className="h-2.5 w-16 rounded-full bg-ink/10" />
              </div>
              <div className="mt-3 flex h-16 items-end gap-[3px]">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="flex-1 rounded-sm bg-ink/10" style={{ height: `${30 + ((i * 13) % 55)}%` }} />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/70 bg-white/75 p-3">
                <div className="h-2.5 w-20 rounded-full bg-ink/10" />
                <div className="mt-3 h-6 w-12 rounded-lg bg-ink/10" />
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
          <div className="flex flex-wrap gap-2 border-b border-ink/10 bg-cream/20 px-5 py-3">
            <div className="h-9 w-64 rounded-lg bg-ink/10 sm:flex-1" />
            <div className="h-9 w-44 rounded-lg bg-ink/10" />
            <div className="h-9 w-44 rounded-lg bg-ink/10" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
            <div className="flex items-center gap-3">
              <div className="h-8 w-40 rounded-lg bg-ink/10" />
              <div className="h-8 w-32 rounded-lg bg-ink/10" />
            </div>
            <div className="h-8 w-36 rounded-lg bg-ink/10" />
          </div>
          <div className="flex flex-wrap gap-1.5 border-t border-ink/5 px-5 py-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-6 w-20 rounded-full bg-ink/10" />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card">
          <TableSkeleton rows={6} cols={6} />
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /backups: hero (actions + health panel + 4 KPI) + search/filter bar + 7-col history + runbook steps. */
export function BackupsSkeleton() {
  return (
    <SkeletonRoot>
      <div className="w-full space-y-4">
        <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="h-2.5 w-32 rounded-full bg-ink/10" />
              <div className="mt-3 flex items-center gap-2">
                <div className="h-7 w-40 rounded-lg bg-ink/10" />
                <div className="h-6 w-24 rounded-full bg-ink/10" />
                <div className="h-6 w-24 rounded-full bg-ink/10" />
              </div>
              <div className="mt-3 h-3.5 w-full max-w-[560px] rounded-full bg-ink/10" />
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="h-9 w-36 rounded-lg bg-accent-200/70" />
                <div className="h-9 w-24 rounded-lg border border-white/70 bg-white/85" />
                <div className="h-9 w-36 rounded-lg border border-primary-200 bg-primary-50/80" />
              </div>
            </div>
            <div className="w-full shrink-0 rounded-xl border border-white/70 bg-white/85 p-3.5 lg:w-[330px]">
              <div className="flex items-center justify-between">
                <div className="h-2.5 w-28 rounded-full bg-ink/10" />
                <div className="h-2.5 w-12 rounded-full bg-ink/10" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-ink/10" />
                <div className="h-6 w-32 rounded-full bg-ink/10" />
              </div>
              <div className="mt-2 h-3 w-48 rounded-full bg-ink/10" />
              <div className="mt-3 h-1.5 w-full rounded-full bg-ink/10" />
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-ink/10 pt-2.5">
                <div className="h-6 rounded bg-ink/10" />
                <div className="h-6 rounded bg-ink/10" />
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/70 bg-white/75 p-3">
                <div className="h-2.5 w-20 rounded-full bg-ink/10" />
                <div className="mt-3 h-6 w-12 rounded-lg bg-ink/10" />
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 px-5 py-3">
            <div>
              <div className="h-4 w-32 rounded-full bg-ink/10" />
              <div className="mt-2 h-3 w-56 rounded-full bg-ink/10" />
            </div>
            <div className="h-9 w-72 rounded-lg bg-ink/10" />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 bg-cream/20 px-5 py-2.5">
            <div className="h-9 w-64 rounded-lg bg-ink/10 sm:flex-1" />
            <div className="h-8 w-32 rounded-lg bg-ink/10" />
          </div>
          <div className="p-4">
            <TableSkeleton rows={4} cols={7} />
          </div>
        </div>

        <div className="rounded-xl border border-primary-100 bg-blue-50/40 p-5 shadow-card">
          <div className="h-4 w-52 rounded-full bg-ink/10" />
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl border border-ink/10 bg-white/80" />
            ))}
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}
