# 3D Mesh Flattener
> A browser-based PoC that turns 3D polygon meshes into 2D flat cut patterns with interactive seam selection and SVG export.

## 🎯 Overview
- **The Challenge:** The challenge was to turn 3D polygon meshes into accurate 2D cut patterns — the Pepakura-style workflow used in papercraft and physical prototyping.
- **The Solution:** Built a Next.js app with a pure TypeScript geometry core (26 Vitest unit tests, zero React/Three.js in the logic layer) and a React Three Fiber viewport for interactive seam selection — OBJ/STL import, manifold topology, island partitioning, BFS hinge unfolding, SAT collision detection, and SVG export.
- **The Result:** The result is a working PoC that converts 3D models into flat blueprints in the browser, demonstrating algorithm design, test-driven geometry code, and clean domain/UI separation.

## 💻 Tech Stack
- Next.js
- TypeScript
- Three.js
- Vitest
- Computational Geometry

## 🚀 How to Run Locally
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

Optional commands:
```bash
npm test       # vitest (src/**/*.test.ts)
npm run lint
npm run build
```

## Architecture

```
load mesh (OBJ / STL) → topology → seams → islands → unfold → export SVG
```

| Layer | Path | Role |
|-------|------|------|
| Logic | `src/logic/` | Pure geometry, I/O, unfold, export (no React/Three.js) |
| Viewer | `src/viewer/` | 3D viewport, picking, seam overlay |
| State | `src/state/` | Zustand session (mesh load, seam toggles) |
| UI | `src/ui/` | 2D viewer, toasts, download helpers |
| App | `app/` | Next.js page shell |

## Current Scope

OBJ (`v` + `f`) and STL (ASCII/binary) import, zero material thickness, output in the XY plane.

## PoC Status

| Feature | Status |
|---------|--------|
| OBJ upload + 3D viewport | Done |
| STL upload (ASCII / binary) | Done |
| Manual seam selection | Done |
| Flatten (unfold + layout) | Done |
| 2D blueprint viewer + seam overlay | Done |
| SVG export (preview tier) | Done |
| AI-assisted seaming | Not started |
| GLB input | Not started |

## Documentation

- **Contributors / agents:** [AGENTS.md](AGENTS.md)
- **ADRs and plans:** [docs/README.md](docs/README.md) — roadmap at [docs/plans/README.md](docs/plans/README.md)

## Local Assets

- `3d_models/` — manual QA meshes (gitignored)
- `tests/` — optional local test fixtures (gitignored)
- `thoghts.txt` — personal engineering notes (gitignored)

Unit-test fixtures live in `src/logic/io/obj/testMeshes.ts` and `src/logic/io/stl/testMeshes.ts` (tracked).
