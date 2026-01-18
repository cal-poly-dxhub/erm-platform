/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure client-side routing works properly
  trailingSlash: false,
};

module.exports = nextConfig;

