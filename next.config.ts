import * as path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
