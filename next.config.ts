import type { NextConfig } from "next";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Avoid build-time telemetry codepaths that attempt to shell out to git on Windows.
process.env.NEXT_TELEMETRY_DISABLED = process.env.NEXT_TELEMETRY_DISABLED || "1";

function withOptionalBundleAnalyzer(config: NextConfig): NextConfig {
  if (process.env.ANALYZE !== "true") {
    return config;
  }

  try {
    const bundleAnalyzer = require("@next/bundle-analyzer");
    return bundleAnalyzer({
      enabled: true,
      openAnalyzer: true,
    })(config);
  } catch {
    console.warn("[next.config] ANALYZE=true but @next/bundle-analyzer is missing; skipping analyzer.");
    return config;
  }
}

const nextConfig: NextConfig = {
  // Allow overriding build output dir when default .next is locked by another process.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Lock Turbopack root to this project directory to avoid workspace-root drift.
  turbopack: {
    root: path.resolve(__dirname),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default withOptionalBundleAnalyzer(nextConfig);
