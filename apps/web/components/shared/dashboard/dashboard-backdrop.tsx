/**
 * Workspace canvas behind the guidance routes.
 *
 * Deliberately quiet: a flat brand-tinted page with one soft top highlight.
 * The old navy gradient mesh, dot grid, and diagonal beam added visual noise
 * behind the data, so they were removed when the product moved to a single
 * light surface.
 */
export function DashboardBackdrop() {
  return (
    <div
      aria-hidden
      data-dashboard-backdrop
      className="pointer-events-none absolute inset-0 overflow-hidden bg-cream"
    >
      <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(90%_100%_at_50%_-30%,#ffffff,rgba(255,255,255,0))]" />
    </div>
  );
}
