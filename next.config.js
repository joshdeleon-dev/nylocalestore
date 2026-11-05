/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Inlined so client components (the site bar) know whether the marketplace is live
  env: {
    MARKETPLACE_ENABLED: process.env.MARKETPLACE_ENABLED ?? '',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'nylocalestore.com' },
      { protocol: 'https', hostname: 'order.nylocalestore.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

module.exports = nextConfig;
