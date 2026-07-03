# Step 3 — Unfold quality detection

**Status:** In progress  
**ADR:** [0003 — Unfold quality detection](../../decisions/0003-unfold-quality-detection.md)  
**Backlog:** [thoughts.txt](../../../thoughts.txt)

## Scope

Detect-and-report intra-island unfold quality issues after hinge unfold, before layout promotion:

- **3a** — Triangle interior collisions (self-overlap)
- **3b** — Non-tree shared-edge tears (2D disagreement)

**Non-goals:** auto-fix unfold, inter-island collision, UI overlay (follow-up slice).

## Pipeline

```
partitionIslands → unfoldIsland (per island)
                 → analyzeUnfoldedIsland (local XY)
                 → layoutIslands
                 → toGlobalQualityReports (apply offset)
                 → UnfoldMeshResult
```

## Foundation (shipped — consume only)

| Module | Role |
|--------|------|
| `src/logic/geom2d/tolerances.ts` | `SAT_EPS`, `collisionAreaThreshold`, `tearThreshold`, `ANGLE_EPS` |
| `src/logic/geom2d/spatialGrid.ts` | `buildSoupItems`, `buildUniformGrid`, `forEachCandidatePair` |
| `src/logic/geom2d/triangle2d.ts` | SAT, clip area, `isEdgeOnlyContact`, `polygonCentroid` |
| `src/logic/geom2d/segment2d.ts` | Scale-aware `areCollinear`, tear kind helpers |

## New modules

| File | Role |
|------|------|
| `soupToTriangles.ts` | `UnfoldIslandResult` → face-aligned `Triangle2d[]` |
| `buildUnfoldTreeEdges.ts` | BFS tree `Set<EdgeKey>` mirroring `unfoldIsland` |
| `detectCollisions.ts` | 3a narrow/broad phase |
| `detectTears.ts` | 3b non-tree edge comparison |
| `analyzeUnfoldedIsland.ts` | Per-island orchestrator |
| `toGlobalQualityReports.ts` | Offset promotion after layout |

## Tests

- `buildUnfoldTreeEdges.test.ts` — `|tree| === |F| - 1`
- `detectCollisions.test.ts` — closed cube → many; seamed cube → fewer
- `detectTears.test.ts` — closed cube → many non-tree tears
- `unfoldMesh.test.ts` — end-to-end `collisions` / `tears` populated

## Manual QA

1. Cube, no seams → Flatten → collisions and tears non-empty; export still works
2. Cube, top face seamed → Flatten → cleaner pattern, fewer issues on separated islands
