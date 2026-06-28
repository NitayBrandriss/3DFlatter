# Plans & roadmap

Single entry point for implementation plans. **ADRs** (`docs/decisions/`) hold architecture contracts; this folder holds phased delivery plans. **Prioritized backlog:** [thoughts.txt](../../thoughts.txt) (local, gitignored).

```mermaid
flowchart LR
  load["Load mesh (OBJ / STL)"]
  topo["Topology"]
  seams["Seams"]
  islands["Islands"]
  unfold["Unfold"]
  quality["Quality detect"]
  export["Export"]
  load --> topo --> seams --> islands --> unfold --> quality --> export
```

---

## Status

| Phase | Topic | Status | Detail |
|-------|-------|--------|--------|
| Step 1 | Hinge-island unfold (triangle soup) | **Complete** | [ADR 0002](../decisions/0002-unfold-step-1-hinge-island.md) |
| Step 2 | `unfoldMesh` + layout + 2D viewer | **Complete** | [archive/step-2-flattening.md](archive/step-2-flattening.md) |
| Step 2 stretch | 2D seam overlay on blueprint | **Complete** | [archive/step-2-seam-overlay.md](archive/step-2-seam-overlay.md) |
| I/O | STL import (ASCII / binary) | **Complete** | `src/logic/io/stl/parseStl` |
| Export | SVG preview (tier 1) | **Complete** | `src/logic/export/svg/` |
| Export | SVG manufacturing / laser (tier 2) | Planned | See [thoughts.txt](../../thoughts.txt) |
| Step 3 | Unfold quality detection (3a + 3b) | **In Progress** | [ADR 0003](../decisions/0003-unfold-quality-detection.md), [archive/step-3-quality-detection.md](archive/step-3-quality-detection.md) |
| Phase 2 | Auto seam suggestions | Planned | [thoughts.txt](../../thoughts.txt) |

---

## Shipped deliverables (quick reference)

| Area | Key modules |
|------|-------------|
| I/O | `parseObj`, `parseStl`, `polygonConvexity`, `weldVertices` |
| Topology | `buildTopology`, `partitionIslands` |
| Seams | `seamRegistry`, `edgeEligibility`, `resolvePick` |
| geom2d | `tolerances`, `segment2d`, `triangle2d`, `spatialGrid`, `vec2` |
| Unfold | `unfoldIsland`, `unfoldMesh`, `layoutIslands`, `seamSegments2d` |
| Quality (Step 3) | `soupToTriangles`, `buildUnfoldTreeEdges`, `detectCollisions`, `detectTears`, `analyzeUnfoldedIsland` |
| Export | `buildSvgDocument`, `tier1Preview` |
| UI | `MeshViewport`, `UnfoldViewer2D`, `useFlattenExport` |

Manual regression (Step 2): load cube → seam top face → Flatten → two separated islands + red cut lines (MT-1 … MT-6 in [step-2 archive](archive/step-2-flattening.md)).

---

## Backlog

See **[thoughts.txt](../../thoughts.txt)** for the prioritized engineering backlog (single source of truth).

When starting non-trivial work, add or extend an `archive/<phase>.md` spec and update the status table above.

---

## Archive

Completed implementation specs (historical detail, substeps, risks):

| Plan | Description |
|------|-------------|
| [step-2-flattening.md](archive/step-2-flattening.md) | Orchestration, layout, `UnfoldViewer2D`, manual test table |
| [step-2-seam-overlay.md](archive/step-2-seam-overlay.md) | `listSeamSegments2d`, `UnfoldMeshResult.seamSegments` |
| [step-3-quality-detection.md](archive/step-3-quality-detection.md) | ADR 0003 wiring: collision + tear detection |

When a backlog item ships, add an archive doc and update the status table above.

---

## How to add a plan

1. Add a row to **Status** in this file.
2. For non-trivial work, add `archive/<phase-name>.md` with scope, substeps, tests, and manual checks.
3. Link the archive from this README; link ADRs when contracts change.
4. Agents: see [AGENTS.md](../../AGENTS.md) planning workflow — plan before implement.
