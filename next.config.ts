import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Disable Turbopack for production builds due to font loading issues
  // Use webpack instead which handles Google Fonts more reliably
};

export default nextConfig;
