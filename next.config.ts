import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org" }],
    // TMDB already serves posters pre-sized (w185 / w342 / w500) from its own CDN,
    // so re-processing them on Vercel only adds delay and eats the free image quota.
    unoptimized: true,
  },
};

export default nextConfig;
