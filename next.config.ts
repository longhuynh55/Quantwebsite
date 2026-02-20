import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Allow overriding build output dir when default .next is locked by another process.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Lock Turbopack root to this project directory to avoid workspace-root drift.
  turbopack: {
    root: path.resolve(__dirname),
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

export default nextConfig;
