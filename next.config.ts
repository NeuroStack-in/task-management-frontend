import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // **This app is its own root.** A stray `package-lock.json` one folder up (the four-repo workspace
  // root, which is not a package) made `next build` infer *that* folder as the workspace root —
  // a warning on every build, and output-file tracing anchored outside the repo (QA audit
  // 2026-10-08, WP-374). Pinned here so no file outside the repo can move it.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
