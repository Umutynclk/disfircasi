const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  images: {
    unoptimized: false,
    domains: ['firebasestorage.googleapis.com'],
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

  serverExternalPackages: ['firebase', '@firebase/app', '@firebase/auth', '@firebase/firestore', '@firebase/storage'],
  transpilePackages: ['three'],
  compress: true,
  poweredByHeader: false,

  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },



  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
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

