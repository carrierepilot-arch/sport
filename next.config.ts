import type { NextConfig } from "next";
import path from "path";

const isAPKBuild = process.env.BUILD_TARGET === 'apk';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  ...(isAPKBuild ? {
    output: 'export',
    trailingSlash: true,
    images: { unoptimized: true },
  } : {}),
};

export default nextConfig;
