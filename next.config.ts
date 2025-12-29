// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // REMOVER: output: 'export'  ← isso quebra /api
  // Se você tinha `images.unoptimized: true` só precisava para export estático.
  // Pode manter ou remover; não afeta as APIs.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
