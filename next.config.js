const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),

  images: {
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '**.firebasestorage.googleapis.com',
      },
    ],
  },

  serverExternalPackages: [
    'firebase',
    '@firebase/app',
    '@firebase/auth',
    '@firebase/firestore',
    '@firebase/storage',
  ],
  transpilePackages: ['three'],
  compress: true,
  poweredByHeader: false,

  experimental: {
    optimizePackageImports: [
      'framer-motion',
      'react-icons',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
    ],
  },

  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

module.exports = nextConfig;
