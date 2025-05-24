/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.tiktok.com',
      },
      {
        protocol: 'https',
        hostname: 'p16-sign-*.tiktokcdn.com',
      }
    ]
  },
  // Your custom settings here if needed
};

module.exports = nextConfig; 