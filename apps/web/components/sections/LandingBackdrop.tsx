/**
 * Ambient background shared by the whole landing page. A soft light wash
 * (cream base, cool blue glow, gentle yellow warmth, dotted texture, and a
 * single diagonal light beam) so the public landing stays calm and readable.
 */
export function LandingBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-cream"
    >
      <div className="absolute inset-0 bg-[radial-gradient(110%_80%_at_80%_10%,rgba(37,99,235,0.10),transparent_55%)]" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(rgba(30,58,95,0.10) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 35%, black 20%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 35%, black 20%, transparent 75%)",
        }}
      />
      <div className="absolute -top-56 right-[-10%] h-[640px] w-[640px] rounded-full bg-blue-200/40 blur-[160px]" />
      <div className="absolute bottom-[-30%] left-[-15%] h-[520px] w-[520px] rounded-full bg-yellow-200/30 blur-[160px]" />
      <div className="absolute left-1/2 top-1/3 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-blue-100/60 blur-[160px]" />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id="landing-beam" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0" />
            <stop offset="35%" stopColor="#F59E0B" stopOpacity="0.24" />
            <stop offset="70%" stopColor="#2563EB" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M-110 800 C 320 690, 660 500, 1560 180"
          stroke="url(#landing-beam)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
