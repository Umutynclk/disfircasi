/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production build için optimize edildi
  output: 'standalone', // Vercel, Docker vb. için optimize edilmiş build
  
  images: {
    unoptimized: false, // Production'da image optimization aktif
    domains: ["firebasestorage.googleapis.com"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "**.firebasestorage.googleapis.com",
      },
    ],
  },
  
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  
  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

module.exports = nextConfig;
