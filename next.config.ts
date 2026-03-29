import type { NextConfig } from "next";
import path from "path";

const isAPKBuild = process.env.BUILD_TARGET === 'apk';

const nextConfig: NextConfig = {
  ...(isAPKBuild ? {
    output: 'export',
    trailingSlash: true,
    images: { unoptimized: true },
  } : {
    turbopack: {
      root: path.resolve(__dirname),
    },
  }),
};

export default nextConfig;
