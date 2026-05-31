import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack for faster local dev compilation
  turbopack: {},

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Optimise packages that are imported in both server and client bundles
    optimizePackageImports: ['lucide-react', 'date-fns', 'sonner'],
  },

  // Compress responses with gzip
  compress: true,

  // Image optimization: allow Supabase storage URLs
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/**',
      },
    ],
    // Modern formats for smaller file sizes
    formats: ['image/avif', 'image/webp'],
  },

  // Security & caching headers
  async headers() {
    return [
      {
        // Long-lived cache for immutable Next.js static assets
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Moderate cache for public assets (icons, fonts, etc.)
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
