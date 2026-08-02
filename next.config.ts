import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Cover Art Archive serves the image itself...
      { protocol: "https", hostname: "coverartarchive.org" },
      // ...but redirects to an Internet Archive node for the actual bytes.
      { protocol: "https", hostname: "*.archive.org" },
      { protocol: "https", hostname: "archive.org" },
    ],
    // Artwork is square; these are the widths the grid and detail page ask for.
    imageSizes: [96, 128, 192, 256, 384],
    deviceSizes: [640, 750, 828, 1080, 1200],
  },
  serverExternalPackages: ["@libsql/client"],
  // Migrations are read from disk at startup, so they have to survive tracing.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**"],
  },
};

export default nextConfig;
