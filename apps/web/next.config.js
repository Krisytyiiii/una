const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");

/**
 * @type {(phase: string) => import('next').NextConfig}
 */
module.exports = (phase) => {
  // `next dev` keeps the default `.next`; `next build` / `next start` compile
  // into `.next-build` so a verification build can run beside a live dev
  // server without wiping its chunks and CSS (which caused `_next/static/...`
  // 404s). Vercel expects `.next`, so hosted builds keep the default.
  // `NEXT_DIST_DIR` still wins when set explicitly.
  const distDir =
    process.env.NEXT_DIST_DIR ||
    (phase === PHASE_DEVELOPMENT_SERVER || process.env.VERCEL
      ? ".next"
      : ".next-build");

  return {
    distDir,
    transpilePackages: [
      "@dorsu/shared-types",
      "@dorsu/shared-schemas",
      "@dorsu/shared-services",
      "@dorsu/supabase-client",
      "@dorsu/ui-tokens",
    ],
    images: {
      remotePatterns: [
        { protocol: "https", hostname: "images.unsplash.com" },
        { protocol: "https", hostname: "source.unsplash.com" },
        { protocol: "https", hostname: "illustrations.undraw.co" },
      ],
    },
  };
};
