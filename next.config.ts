import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["210.16.216.126"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tigqwrehpzwaksnvcrrx.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
