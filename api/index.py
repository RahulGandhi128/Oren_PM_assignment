# Vercel entry point. Vercel serves this file as a Python function; Next.js
# rewrites /api/:path* here in production (see next.config.ts).
from backend.app.main import app  # noqa: F401
