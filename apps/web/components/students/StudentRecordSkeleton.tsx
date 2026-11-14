/**
 * Skeleton for /students/[id] — mirrors the real record layout (back link,
 * header + badges, four summary cards, timeline panel with filter pills and
 * event rows) so opening a student never feels stuck or causes a layout jump.
 */
export function StudentRecordSkeleton() {
  return (
    <div className="animate-pulse space-y-5" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading student record…</span>

      {/* Back link */}
      <div className="h-4 w-32 rounded-full bg-ink/10" aria-hidden />

      {/* Header */}
      <div aria-hidden>
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-8 w-48 rounded-lg bg-ink/10" />
          <div className="h-5 w-24 rounded-full bg-ink/10" />
          <div className="h-5 w-28 rounded-full bg-ink/10" />
        </div>
        <div className="mt-2 h-4 w-72 max-w-full rounded-full bg-ink/10" />
        <div className="mt-2 h-3 w-80 max-w-full rounded-full bg-ink/10" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-ink/10 bg-white p-4 shadow-card">
            <div className="h-2.5 w-24 max-w-full rounded-full bg-ink/10" />
            <div className="mt-2 h-7 w-12 rounded bg-ink/10" />
          </div>
        ))}
      </div>

      {/* Timeline panel */}
      <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-card" aria-hidden>
        <div className="h-5 w-36 rounded-lg bg-ink/10" />
        <div className="mt-2 h-3 w-80 max-w-full rounded-full bg-ink/10" />

        {/* Filter pills */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[56, 72, 80, 78, 56, 72, 78].map((w, i) => (
            <div key={i} className="h-6 rounded-full bg-ink/10" style={{ width: w }} />
          ))}
        </div>

        {/* Month + event rows */}
        <div className="mt-5 space-y-5">
          {[0, 1].map((group) => (
            <div key={group}>
              <div className="mb-2 h-3 w-24 rounded-full bg-ink/10" />
              <div className="space-y-3">
                {Array.from({ length: group === 0 ? 3 : 2 }).map((_, i) => (
                  <div key={i} className="relative pl-8">
                    <div className="absolute left-0 top-1 h-6 w-6 rounded-full bg-ink/10" />
                    <div className="rounded-lg border border-ink/10 bg-white p-3 shadow-card">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-20 rounded-full bg-ink/10" />
                        <div className="h-3 w-16 rounded-full bg-ink/10" />
                        <div className="ml-auto h-3 w-24 rounded-full bg-ink/10" />
                      </div>
                      <div className="mt-2 h-4 w-2/3 max-w-full rounded bg-ink/10" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
