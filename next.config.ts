import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ['fsrs-rs-nodejs'],
};

export default nextConfig;
