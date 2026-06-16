# 3D Flatter (PoC)

Web utility that turns 3D polygonal meshes into 2D flat patterns (Pepakura-style): load mesh → define seams → partition islands → unfold → export SVG.

**Current scope:** OBJ v1 only (`v` + `f`), zero material thickness, output in the XY plane.

## Quick start

```bash
npm install
npm run dev    # http://localhost:3000
npm test       # vitest (src/**/*.test.ts)
npm run lint
npm run build
```

## Pipeline

```
load OBJ → topology → seams → islands → unfold → export SVG
```

| Layer | Path | Role |
|-------|------|------|
| Logic | `src/logic/` | Pure geometry, I/O, unfold, export (no React/Three.js) |
| Viewer | `src/viewer/` | 3D viewport, picking, seam overlay |
| State | `src/state/` | Zustand session (mesh load, seam toggles) |
| UI | `src/ui/` | 2D viewer, toasts, download helpers |
| App | `app/` | Next.js page shell |

## Documentation

- **Contributors / agents:** [AGENTS.md](AGENTS.md)
- **ADRs and plans:** [docs/README.md](docs/README.md)

## PoC status

| Feature | Status |
|---------|--------|
| OBJ upload + 3D viewport | Done |
| Manual seam selection | Done |
| Flatten (unfold + layout) | Done |
| 2D blueprint viewer + seam overlay | Done |
| SVG export (preview tier) | Done |
| AI-assisted seaming | Not started |
| STL / GLB input | Not started |

## Local assets (gitignored)

- `3d_models/` — manual QA meshes
- `tests/` — optional local test fixtures
- `thoghts.txt` — personal engineering notes

Unit-test fixtures live in `src/logic/io/obj/testMeshes.ts` (tracked).
