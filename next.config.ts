import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@openai/codex-sdk",
    "@openai/codex",
    "@openai/codex-linux-x64",
  ],
};

export default nextConfig;
