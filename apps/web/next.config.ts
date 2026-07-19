import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": process.cwd(),
    };
    return config;
  },
};

export default nextConfig;
