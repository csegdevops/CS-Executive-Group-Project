import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "50mb",
    // Server Component fetch() responses (e.g. Supabase queries) would
    // otherwise be cached across HMR refreshes in dev, even for cache:
    // 'no-store' requests — router.refresh() polling (CV parse status,
    // etc.) would show stale data until a full page reload cleared it.
    serverComponentsHmrCache: false,
  },
};

export default nextConfig;
