import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // The Docker image builds a standalone server. Local builds keep the regular
  // output so `next start` works and Windows doesn't need symlink privileges.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;
