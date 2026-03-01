import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["210.16.216.126:3000"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
