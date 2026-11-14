/**
 * Dashboard skeletons — light, data-first silhouettes that mirror the real
 * page: page header, metric strip, an 8/4 analytics grid, and the queue rows.
 * Shared by the route `loading.tsx` and each view's first-load state.
 */

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 border-b border-ink/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="h-2.5 w-24 rounded bg-ink/10" />
        <div className="mt-2 h-6 w-48 rounded bg-ink/10" />
        <div className="mt-2 h-3 w-72 max-w-full rounded bg-ink/[0.07]" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-8 w-36 rounded-lg border border-ink/10 bg-white" />
        <div className="h-8 w-8 rounded-lg border border-ink/10 bg-white" />
      </div>
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="min-h-[108px] rounded-xl border border-ink/10 bg-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="h-2.5 w-24 rounded bg-ink/10" />
        <div className="h-4 w-4 rounded bg-ink/[0.07]" />
      </div>
      <div className="mt-3 h-7 w-16 rounded bg-ink/10" />
      <div className="mt-2.5 h-2.5 w-20 rounded bg-ink/[0.07]" />
    </div>
  );
}

function PanelSkeleton({ height = "h-[260px]" }: { height?: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-ink/10 bg-white">
      <div className="border-b border-ink/[0.07] px-5 py-3.5">
        <div className="h-3.5 w-36 rounded bg-ink/10" />
        <div className="mt-2 h-2.5 w-52 rounded bg-ink/[0.07]" />
      </div>
      <div className="p-5">
        <div className={`${height} rounded-lg bg-ink/[0.05]`} />
      </div>
    </section>
  );
}

function RowsSkeleton({ rows = 4, height = "h-[260px]" }: { rows?: number; height?: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-ink/10 bg-white">
      <div className="border-b border-ink/[0.07] px-5 py-3.5">
        <div className="h-3.5 w-32 rounded bg-ink/10" />
        <div className="mt-2 h-2.5 w-44 rounded bg-ink/[0.07]" />
      </div>
      <div className={`divide-y divide-ink/[0.07] ${height}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0 space-y-1.5">
              <div className="h-3 w-36 rounded bg-ink/10" />
              <div className="h-2.5 w-48 rounded bg-ink/[0.07]" />
            </div>
            <div className="h-5 w-14 rounded bg-ink/[0.07]" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function CounselorDashboardBodySkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden>
      <section className="space-y-2.5">
        <div className="h-3 w-40 rounded bg-ink/10" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricSkeleton key={i} />
          ))}
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-8">
          <RowsSkeleton rows={3} height="h-[190px]" />
          <RowsSkeleton rows={3} height="h-[210px]" />
          <div className="grid gap-4 md:grid-cols-2">
            <PanelSkeleton height="h-[220px]" />
            <PanelSkeleton height="h-[180px]" />
          </div>
          <PanelSkeleton height="h-[220px]" />
        </div>
        <div className="flex flex-col gap-4 xl:col-span-4">
          <RowsSkeleton rows={4} height="h-[220px]" />
          <RowsSkeleton rows={3} height="h-[200px]" />
          <RowsSkeleton rows={6} height="h-[260px]" />
        </div>
      </div>
    </div>
  );
}

export function HeadDashboardBodySkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden>
      <section className="space-y-2.5">
        <div className="h-3 w-44 rounded bg-ink/10" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricSkeleton key={i} />
          ))}
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-8">
          <PanelSkeleton height="h-[240px]" />
          <div className="grid gap-4 md:grid-cols-2">
            <PanelSkeleton height="h-[200px]" />
            <PanelSkeleton height="h-[200px]" />
          </div>
          <PanelSkeleton height="h-[240px]" />
          <PanelSkeleton height="h-[220px]" />
        </div>
        <div className="flex flex-col gap-4 xl:col-span-4">
          <RowsSkeleton rows={6} height="h-[300px]" />
          <RowsSkeleton rows={3} height="h-[190px]" />
          <RowsSkeleton rows={4} height="h-[240px]" />
        </div>
      </div>
    </div>
  );
}

export function FacultyDashboardBodySkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden>
      <section className="space-y-2.5">
        <div className="h-3 w-44 rounded bg-ink/10" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <MetricSkeleton key={i} />
          ))}
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-8">
          <RowsSkeleton rows={3} height="h-[190px]" />
          <PanelSkeleton height="h-[240px]" />
          <div className="grid gap-4 md:grid-cols-2">
            <PanelSkeleton height="h-[200px]" />
            <PanelSkeleton height="h-[200px]" />
          </div>
          <PanelSkeleton height="h-[230px]" />
          <RowsSkeleton rows={4} height="h-[240px]" />
        </div>
        <div className="flex flex-col gap-4 xl:col-span-4">
          <RowsSkeleton rows={3} height="h-[190px]" />
          <RowsSkeleton rows={7} height="h-[300px]" />
        </div>
      </div>
    </div>
  );
}

function DashboardShellSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-label="Loading" aria-hidden className="animate-pulse space-y-5">
      <HeaderSkeleton />
      {children}
    </div>
  );
}

export function CounselorDashboardSkeleton() {
  return (
    <DashboardShellSkeleton>
      <CounselorDashboardBodySkeleton />
    </DashboardShellSkeleton>
  );
}

export function HeadDashboardSkeleton() {
  return (
    <DashboardShellSkeleton>
      <HeadDashboardBodySkeleton />
    </DashboardShellSkeleton>
  );
}

export function FacultyDashboardSkeleton() {
  return (
    <DashboardShellSkeleton>
      <FacultyDashboardBodySkeleton />
    </DashboardShellSkeleton>
  );
}
