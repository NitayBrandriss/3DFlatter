---
status: accepted
date: 2026-07-28
depends_on: 0001, 0002
---

## ADR 0100: Freeform cut strokes (overlay + lazy materialize)

### Context

PoC seam editing is limited to toggling existing mesh edges (`EdgeKey` / [ADR 0001](../poc/0001-mesh-model-and-topology.md)). Product Phase 1 needs **freeform cuts** across face interiors while keeping editing non-destructive and preserving triangle-soup unfold ([ADR 0002](../poc/0002-unfold-step-1-hinge-island.md)).

### Decision

#### Overlay vs materialized mesh

- Session **base** `MeshModel` is unchanged while the user draws, edits, or deletes cut strokes.
- Strokes live as an overlay (`cutStrokes`: stable `id` + canonical 3D polyline `points`).
- Coordinates are **canonical mesh space** (inverse of display normalization), not display-scaled.
- File reload clears strokes. Stroke edits do **not** bump `meshLoadVersion`.
- `materializeCutStrokes(baseMesh, strokes, manualSeams)` runs on **Flatten** (pure `src/logic/`). It returns a **derived** mesh + topology + seam set; the session base mesh is not replaced in v1 (recompute each Flatten; memo optional).

#### Stroke order and purity

- Strokes are applied in **array order**. Materialize is a pure function of `(mesh, strokes, manualSeams)`.
- Multi-stroke T-junctions rely on snap/weld after earlier strokes have subdivided the mesh.

#### Final seam identity

- After materialize, cut identity remains `EdgeKey` on the **derived** mesh ([ADR 0001](../poc/0001-mesh-model-and-topology.md)).
- Manual edge-pick seams are **unioned** with cut-derived seams. When a manual-seam edge is split, seam membership remaps to the child edge keys.
- `unfoldIsland` / `partitionIslands` / `unfoldMesh` consume materialized inputs only — their APIs stay unchanged.

#### Snapping

- Before inserting vertices, snap stroke samples to existing vertices, then to edge chords, using a **scale-aware** epsilon:
  - `max(WELD_EPSILON, bboxDiagonal * 1e-4)` (same order as weld / `SAT_EPS`).
- Snapping prevents sliver triangles at near-miss endpoints.

#### Subdivision rules

- Segment–triangle surface cuts: edge chord splits propagate to all incident faces; interior Steiner points use **fan triangulation** from the interior point (or ordered face-local polyline splits).
- Output remains strict triangles, manifold where the input was, non-degenerate indices.
- Reject **self-intersecting** stroke polylines **per face** (warning; skip that stroke or face cut). Concave fan risk matches OBJ fan limits ([ADR 0001](../poc/0001-mesh-model-and-topology.md)).

#### Open-loop validation

- A stroke is an **open loop** when it is not closed (first ≉ last within snap eps) **and** at least one endpoint is **not** on a boundary edge of the derived mesh (interior Steiner or interior-face endpoint).
- Semantics: open loops **subdivide** and mark cut edges as seams, but may **not** disconnect islands the way a closed seam cycle would ([`partitionIslands`](../../../src/logic/mesh/partitionIslands.ts) only cuts adjacency on seams).
- Flatten **warns** (toast) and **continues** — user may proceed. Triangle-soup unfold supports duplicate 2D corners along slit paths in principle ([ADR 0002](../poc/0002-unfold-step-1-hinge-island.md)).

#### CutManifest (hooks only in Phase 1)

```text
{ strokeId, segmentIndex, edgeKeys[] }
```

Reserved for later SVG edge-ID matching / folds / tabs. Not required for Flatten UX in Phase 1.

#### Optional stroke metadata (v1 fields, unused in UI)

- `role: cut | fold`, `foldKind: mountain | valley` — deferred; schema may reserve optional fields.

### Explicit non-goals (v1)

- Glue flaps / tabs, page scale, fold line styling in SVG.
- Persisting strokes across reload.
- Editing strokes in the 2D blueprint.
- Persisting the materialized mesh in session state.
- Web Worker flatten (still deferred).

### Consequences

- Flatten fingerprint must include strokes + seams + `meshLoadVersion` (not mesh load alone).
- Viewer shows a **stroke overlay** while editing; `SeamOverlay` / 2D seams reflect cuts only after materialize.
- Agents implement logic first (`materializeCutStrokes` + Vitest), then Zustand wiring, then draw UX.

### Implementation

| Path | Role |
|------|------|
| [`src/logic/cuts/`](../../../src/logic/cuts/) | `materializeCutStrokes`, snap, face splits |
| Plan | [phase-1-freeform-cut-strokes.md](../../plans/product/phase-1-freeform-cut-strokes.md) |
| Roadmap | [PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md) Phase 1 |

### References

- [ADR 0001](../poc/0001-mesh-model-and-topology.md) — mesh / `EdgeKey` / seams
- [ADR 0002](../poc/0002-unfold-step-1-hinge-island.md) — triangle-soup unfold
