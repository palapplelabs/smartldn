import type { NextConfig } from "next";

// NEXT_PUBLIC_BASE_PATH serves the site under a prefix, e.g. "/smartldn" on
// labs.palapple.com. Leave it unset to serve from the root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  basePath,
};

export default nextConfig;
