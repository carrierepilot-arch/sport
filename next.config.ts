import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Keep server mode for API routes
  // Capacitor will embed assets and run Next server locally in Android
};

export default nextConfig;
