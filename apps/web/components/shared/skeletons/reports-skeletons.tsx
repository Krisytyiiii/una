import {
  ChartBlockSkeleton,
  CreamListSkeleton,
  DivideListSkeleton,
  DonutBlockSkeleton,
  KpiGridSkeleton,
  PanelShellSkeleton,
  ProgressBarsSkeleton,
  SkeletonRoot,
} from "./primitives";

/**
 * Reports skeletons — exact layout match per role.
 * All share: H1 + max-w-[560px] desc + right-aligned range pill, then the
 * report column beside the vertical section rail (rail on the right).
 */

/** Right-hand section rail + report column (title and range sit inside it). */
function ReportsLayoutSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="order-2 flex min-w-0 flex-1 flex-col gap-4 lg:order-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="h-7 w-56 max-w-full rounded-lg bg-ink/10" />
          <div className="h-7 w-32 shrink-0 rounded-full bg-ink/10" />
        </div>
        {children}
      </div>
      <aside className="order-1 lg:order-2 lg:w-[224px] lg:shrink-0">
        <div className="rounded-xl border border-ink/10 bg-white p-3 shadow-card">
          <div className="mb-2 h-3 w-16 rounded bg-ink/10" />
          <div className="flex flex-col divide-y divide-ink/[0.07]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="py-1">
                <div className="h-8 rounded-md bg-ink/[0.06]" />
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function SessionsSectionSkeleton() {
  return (
    <>
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card sm:col-span-2">
        <div className="h-4 w-48 rounded-full bg-ink/10" />
        <ChartBlockSkeleton />
      </section>
      <PanelShellSkeleton>
        <DonutBlockSkeleton />
      </PanelShellSkeleton>
      <PanelShellSkeleton>
        <ProgressBarsSkeleton rows={4} />
      </PanelShellSkeleton>
    </>
  );
}

function ReferralsSectionSkeleton({ pipeline = true }: { pipeline?: boolean }) {
  return (
    <>
      <PanelShellSkeleton>
        <DonutBlockSkeleton />
      </PanelShellSkeleton>
      <PanelShellSkeleton>
        <ChartBlockSkeleton />
      </PanelShellSkeleton>
      {pipeline && (
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card sm:col-span-2">
          <div className="h-4 w-44 rounded-full bg-ink/10" />
          <CreamListSkeleton rows={3} />
        </section>
      )}
    </>
  );
}

/** Counselor: 6 KPIs + sessions/referrals/satisfaction/wellbeing/operations + guide. */
export function CounselorReportsSkeleton() {
  return (
    <SkeletonRoot>
      <ReportsLayoutSkeleton>
        <KpiGridSkeleton count={6} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" />
        <div className="grid gap-4 sm:grid-cols-2">
          <SessionsSectionSkeleton />
          <ReferralsSectionSkeleton />
          <PanelShellSkeleton>
            <ChartBlockSkeleton />
          </PanelShellSkeleton>
          <PanelShellSkeleton>
            <DivideListSkeleton rows={3} />
          </PanelShellSkeleton>
          <PanelShellSkeleton>
            <DonutBlockSkeleton />
          </PanelShellSkeleton>
          <PanelShellSkeleton>
            <CreamListSkeleton rows={3} />
          </PanelShellSkeleton>
          <PanelShellSkeleton>
            <CreamListSkeleton rows={3} />
          </PanelShellSkeleton>
          <PanelShellSkeleton>
            <ProgressBarsSkeleton rows={4} />
          </PanelShellSkeleton>
        </div>
        <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
          <div className="h-4 w-48 rounded-full bg-ink/10" />
          <div className="mt-3 h-3 w-full rounded-full bg-ink/10" />
          <div className="mt-2 h-3 w-2/3 rounded-full bg-ink/10" />
        </div>
      </ReportsLayoutSkeleton>
    </SkeletonRoot>
  );
}

/** Head: 6 KPIs + same sections, workload ranked list uses divide rows. */
export function HeadReportsSkeleton() {
  return (
    <SkeletonRoot>
      <ReportsLayoutSkeleton>
        <KpiGridSkeleton count={6} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" />
        <div className="grid gap-4 sm:grid-cols-2">
          <SessionsSectionSkeleton />
          <ReferralsSectionSkeleton />
          <PanelShellSkeleton>
            <ChartBlockSkeleton />
          </PanelShellSkeleton>
          <PanelShellSkeleton>
            <DivideListSkeleton rows={3} />
          </PanelShellSkeleton>
          <PanelShellSkeleton>
            <DonutBlockSkeleton />
          </PanelShellSkeleton>
          <PanelShellSkeleton>
            <CreamListSkeleton rows={3} />
          </PanelShellSkeleton>
          <PanelShellSkeleton>
            <DonutBlockSkeleton />
          </PanelShellSkeleton>
          <PanelShellSkeleton>
            <DonutBlockSkeleton />
          </PanelShellSkeleton>
        </div>
        <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
          <div className="h-4 w-48 rounded-full bg-ink/10" />
          <div className="mt-3 h-3 w-full rounded-full bg-ink/10" />
          <div className="mt-2 h-3 w-2/3 rounded-full bg-ink/10" />
        </div>
      </ReportsLayoutSkeleton>
    </SkeletonRoot>
  );
}

/** Faculty: 4 KPIs + referrals (trend full-width + status/priority/classification) + operations. */
export function FacultyReportsSkeleton() {
  return (
    <SkeletonRoot>
      <ReportsLayoutSkeleton>
        <KpiGridSkeleton count={4} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card sm:col-span-2">
            <div className="h-4 w-48 rounded-full bg-ink/10" />
            <ChartBlockSkeleton />
          </section>
          <PanelShellSkeleton>
            <DonutBlockSkeleton />
          </PanelShellSkeleton>
          <PanelShellSkeleton>
            <ChartBlockSkeleton />
          </PanelShellSkeleton>
          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card sm:col-span-2">
            <div className="h-4 w-48 rounded-full bg-ink/10" />
            <ChartBlockSkeleton />
          </section>
          <PanelShellSkeleton>
            <CreamListSkeleton rows={3} />
          </PanelShellSkeleton>
          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
            <div className="h-4 w-44 rounded-full bg-ink/10" />
            <div className="mt-4 space-y-2.5">
              <div className="h-3 w-full rounded-full bg-ink/10" />
              <div className="h-3 w-5/6 rounded-full bg-ink/10" />
              <div className="h-3 w-4/6 rounded-full bg-ink/10" />
            </div>
          </section>
        </div>
        <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
          <div className="h-4 w-48 rounded-full bg-ink/10" />
          <div className="mt-3 h-3 w-full rounded-full bg-ink/10" />
        </div>
      </ReportsLayoutSkeleton>
    </SkeletonRoot>
  );
}
