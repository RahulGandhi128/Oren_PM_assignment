import type { NextConfig } from "next";

// Vercel Next.js + FastAPI pattern (vercel/nextjs-fastapi starter):
// dev → local uvicorn on :8000; production → the Python function at api/index.py.
// FastAPI routes keep the /api prefix because Vercel forwards the original path.
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://127.0.0.1:8000/api/:path*"
            : "/api/",
      },
    ];
  },
};

export default nextConfig;
