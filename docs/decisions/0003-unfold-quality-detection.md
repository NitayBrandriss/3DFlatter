---
status: accepted
date: 2026-06-17
depends_on: 0002
---

## ADR 0003: Unfold quality detection (3a collision + 3b tears)

### Context

[ADR 0002](0002-unfold-step-1-hinge-island.md) documents hinge-island unfold into triangle soup and explicitly lists **known non-invariants**:

1. **Global injectivity** — closed shells unfolded as one island overlap in 2D.
2. **Non-tree edge agreement** — sibling faces may disagree on shared vertex 2D positions.
3. Mixed OBJ winding preserved.

Step 3 turns these into **measurable diagnostics** after unfold and before layout. Users can flatten a bad pattern and inspect it; detection does not block export.

### Decision

#### Orthogonality to unfold

- `unfoldIsland` and the triangle-soup contract from ADR 0002 are **unchanged**.
- Detection runs in a separate pass (`analyzeUnfoldedIsland`) on local island soup coordinates.
- **Detect and report only** — no BFS root flip, hinge branch flip, subtree placement, or 2D re-weld in this phase.
- Detection **never sets** `UnfoldMeshResult.error`; flatten still succeeds when unfold succeeds.

#### 3a — Intra-island triangle collision

Report each **unordered pair of distinct faces** `(faceA, faceB)` in the same island whose **2D interiors overlap with positive area** after numeric tolerancing.

**Not a collision:**

- Edge-only contact (shared boundary segment, zero area).
- Vertex-only contact with no interior overlap.
- Misaligned shared-edge segments (reported by **3b**, not 3a).

**Is a collision:**

- Non-adjacent faces with overlapping interiors (primary case: closed shell folded onto itself).
- **Adjacent** faces (share a 3D `EdgeKey`) that fold back with interior overlap beyond the shared edge — **must not** be skipped in broad phase.

**Pair filtering (broad phase only):**

| Skip when | Reason |
|-----------|--------|
| Same soup index | Same triangle |
| AABBs separated by `SAT_EPS` | No possible overlap |

| Do not skip | Reason |
|-------------|--------|
| Pairs sharing a 3D `EdgeKey` | Fold-back can cause interior overlap while still adjacent in 3D |
| Vertex-only adjacency | Corner contact can accompany interior penetration |

**Broad phase:** uniform spatial grid over per-triangle AABBs. Cell size `clamp(medianTriangleBBoxMaxSide, GRID_MIN_CELL, islandBBoxMaxSide / 4)`. Degenerate triangles (`|signedArea2d| < DEGEN_AREA_EPS`) are skipped.

**Narrow phase:** 2D SAT over edge perpendiculars (up to 6 axes) with `SAT_EPS` slop. When SAT reports overlap, compute intersection polygon area via Sutherland–Hodgman clip. Collision if `overlapArea > collisionAreaThreshold(avgEdgeLength2d)` and `!isEdgeOnlyContact(...)`.

**`isEdgeOnlyContact`:** When the pair shares a 3D edge, reject collision if overlap area is below threshold **or** all intersection polygon vertices lie within `SAT_EPS` of the 2D shared-edge segment on both face slices. Suppresses hinge-aligned adjacent false positives while catching fold-back (intersection extends off the shared edge).

#### 3b — Edge disagreement (tears)

For each **manifold interior edge** (`edgeToFaces.length === 2`) with both faces in the island, if the edge is **not** on the BFS unfold tree, compare the two face-local 2D segments for that 3D edge. Report a **tear** when endpoints disagree beyond `tearThreshold(edgeLen3d)`.

**Out of scope:**

- Seam / boundary edges (`incidents.length !== 2`).
- **Tree edges** — ADR 0002 invariant #3; disagreement indicates an unfold bug, not re-reported as tears.

**BFS tree** must mirror `unfoldIsland` exactly (root = `islandFaces[0]`, FIFO queue, slot order `[0,1,2]`). See `buildUnfoldTreeEdges` (Slice 3+).

**Tear kinds:** `gap` | `overlap` | `skew` — classified by segment geometry (`ANGLE_EPS` for collinearity).

#### 3a vs 3b responsibility

| Scenario | 3a collision | 3b tear |
|----------|--------------|---------|
| Non-tree edge, parallel offset | No | Yes |
| Non-tree edge, fold-back with interior overlap | Yes | Possibly also Yes |
| Non-adjacent faces overlapping | Yes | No |
| Tree edge, correct hinge | No | No |
| Closed cube, no seams | Many 3a pairs | Many 3b non-tree edges |

Complementary reports on the same bad pattern are **intentional**; no deduplication pass.

#### Public result types

```typescript
TriangleCollision2d — islandIndex, faceA, faceB, overlapArea, centroid (layout-global XY)
EdgeTear2d — islandIndex, edgeKey, faceA, faceB, kind, maxGap, segmentA/B (layout-global XY)
UnfoldMeshResult.collisions / .tears — empty when clean; do not imply error
```

Local analysis runs pre-layout; `toGlobalReport` applies `LayoutedIsland.offset`.

### Tolerances

All constants live in [`src/logic/geom2d/tolerances.ts`](../../src/logic/geom2d/tolerances.ts):

| Constant | Value | Used for |
|----------|-------|----------|
| `SAT_EPS` | `1e-6` | SAT interval separation (matches `placeTriangle2d` `EPS` order of magnitude) |
| `COLLISION_AREA_ABS` | `1e-10` | Minimum overlap area |
| `COLLISION_AREA_REL` | `1e-8` | × `avgEdgeLength²` |
| `TEAR_ABS` | `1e-4` | Endpoint gap (matches unfold tests) |
| `TEAR_REL` | `1e-6` | × 3D edge length |
| `ANGLE_EPS` | `1e-3` rad | Collinearity for tear `kind` |
| `DEGEN_AREA_EPS` | `1e-12` | Skip collapsed 2D triangles |
| `GRID_MIN_CELL` | `1e-6` | Spatial grid floor |
| `GRID_MAX_CELL_DIVISOR` | `4` | `maxCell = islandBBoxMaxSide / 4` |

Scale-aware helpers: `collisionAreaThreshold(avgEdgeLength2d)`, `tearThreshold(edgeLen3d)`.

### Explicit non-goals

- Auto-fix (BFS root, hinge flip, subtree placement, 2D re-weld).
- Inter-island collision (handled by `layoutIslands`).
- Changing triangle soup / `unfoldIsland` API.
- New npm dependencies.
- Capping or summarizing collision lists in logic (UI may summarize counts only).

### Weak spots and mitigations (PoC)

| # | Weak spot | Mitigation |
|---|-----------|------------|
| W1 | `O(n²)` narrow phase when all triangles co-locate | Documented; SAT is cheap; area clip only on SAT overlap; acceptable island sizes |
| W2 | Duplicate BFS tree vs `unfoldIsland` | `buildUnfoldTreeEdges` mirrors queue/slot order; `\|treeEdges\| === \|F\|-1` assertion |
| W3 | Floating-point slop on SAT / clip | Central tolerances; `Math.max(0, …)` pattern consistent with hinge math |
| W4 | Complementary 3a + 3b redundancy | ADR documents orthogonality; UI shows separate counts |
| W5 | Large collision/tear arrays on closed meshes | UI counts only; complete detect-and-report in v1 |
| W6 | Degenerate 2D soup slices | Skip in broad phase when `\|area\| < DEGEN_AREA_EPS` |
| W7 | `skew` tear kind on coplanar unfold | Still report; low UI priority |
| W8 | Non-manifold edges | 3b skips; 3a unaffected |
| W9 | Root-face sensitivity | Detection tied to same root as unfold (`islandFaces[0]`) |
| W10 | No per-mesh automatic threshold tuning | Scale with edge length; amend via ADR only |

### Implementation files

| File | Role |
|------|------|
| `src/logic/geom2d/tolerances.ts` | Constants + scale helpers |
| `src/logic/geom2d/segment2d.ts` | Segment distance, angle, collinearity |
| `src/logic/geom2d/triangle2d.ts` | SAT, clip area, edge-only contact |
| `src/logic/geom2d/spatialGrid.ts` | Uniform grid broad phase |
| `src/logic/mesh/types.ts` | `TriangleCollision2d`, `EdgeTear2d`, extended `UnfoldMeshResult` |
| `src/logic/unfold/analyzeUnfoldedIsland.ts` | Orchestrator (Slice 3+) |
| `src/logic/unfold/detectCollisions.ts` | 3a (Slice 3+) |
| `src/logic/unfold/detectTears.ts` | 3b (Slice 3+) |

### References

- [ADR 0001](0001-mesh-model-and-topology.md) — mesh, topology, XY plane
- [ADR 0002](0002-unfold-step-1-hinge-island.md) — hinge unfold, known non-invariants
- [Plans & roadmap](../plans/README.md) — Step 3 backlog
