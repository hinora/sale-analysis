import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,

  // Enable standalone output for Docker production builds
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default nextConfig;
