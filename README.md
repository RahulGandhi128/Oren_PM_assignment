# Horizon — Nimbus Cement climate exposure (v1 prototype)

Spec: [SPEC.md](SPEC.md). Single Vercel project: Next.js 15 (App Router) + FastAPI Python function under `/api`.

## Run locally
```bash
npm install
npm run setup:py   # uv venv (Python 3.12) + runtime and dev requirements
npm run dev        # Next on :3000, FastAPI (uvicorn) on :8000; Next rewrites /api/* to it
```
Pages: http://localhost:3000 · token showcase (dev only): http://localhost:3000/_tokens · API docs: http://localhost:8000/api/docs

## Data sources (one folder)
Raw inputs live in `backend/data/source/`:
- `nimbus_cement_plants.csv`: the plant register. The API reads it directly (`backend/app/loaders.py`).
- `india-osm.json`: the India boundary from OpenStreetMap (admin_level 2, 5.6 MB). It includes the full J&K, Ladakh/Aksai Chin and Arunachal claim lines.

Derived files:
- `public/geo/india.json`: the simplified outline (49 KB), rebuilt with `.venv-pipeline/bin/python -I backend/pipeline/build_geo.py`.
- `backend/data/network.json`: clinker edges, taken from the CSV's `clinker_shipped` and `notes`.

## Checks
```bash
npm run typecheck
npm run check:hex   # no hex colours in src outside src/theme/
```

## Deploy
```bash
vercel link --project horizon
vercel deploy --prod
```
`api/index.py` is the Python function. In production `next.config.ts` rewrites `/api/:path*` to it. `vercel.json` keeps node_modules, the pipeline and the tests out of the Python bundle.

## Theme
All visual values live in `src/theme/tokens.ts`. `generate-css.ts` turns them into `--hz-*` CSS variables, which the root layout inlines. `globals.css` maps Tailwind v4 `@theme` onto those variables, with Tailwind's default palette, spacing, radii and fonts reset. Charts and the map read literal values through `useTokens()`.
