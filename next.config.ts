import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Allow production builds to successfully complete even if ESLint errors are present
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
