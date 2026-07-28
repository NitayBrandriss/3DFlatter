---
status: accepted
date: 2026-05-06
last_updated: 2026-07-19
---

## ADR 0001: MeshModel + topology baseline (PoC)

### Context
This PoC needs a mesh representation that supports:

- Loading mesh files (**OBJ** and **STL**)
- Rendering in Three.js / `@react-three/fiber`
- Selecting **seams** as mesh edges
- Building **adjacency** for island generation and unfolding
- Producing 2D output in a consistent plane (XY) for SVG/PDF export

### Decision

#### Import paths (v1)

OBJ and STL are **peer** I/O formats at the boundary. Both produce the same canonical `MeshModel` (packed triangulated vertices/faces, 0-based indices) before topology and seams.

##### OBJ import scope (v1)
- Support only `v` (vertex positions) and `f` (faces).
- Ignore materials/textures for now (`mtl`, `usemtl`).
- Ignore normals/UVs for now (`vn`, `vt`), groups/objects (`g`, `o`), and smoothing (`s`).
- Implementation: [`src/logic/io/obj/parseObj.ts`](../../../src/logic/io/obj/parseObj.ts).

##### STL import scope (v1)
- Support **ASCII** and **binary** STL (format detected from buffer layout / `solid` prefix heuristics).
- Each STL facet is already a triangle; no n-gon triangulation step.
- Degenerate facets (exact coincident corners pre-weld, and index-degenerate faces after weld) contribute to aggregate `degenerate_triangle` warnings — not per-triangle rows.
- Implementation: [`src/logic/io/stl/parseStl.ts`](../../../src/logic/io/stl/parseStl.ts).

##### Vertex welding (accepted consequence)
- Both OBJ and STL run [`weldVertices`](../../../src/logic/mesh/weldVertices.ts) on load (`epsilon` ≈ `1e-6`, same order as hinge/`SAT_EPS`).
- Welding may drop index-degenerate triangles; callers surface `removedDegenerateFaceCount` via load warnings where applicable.

#### Triangulation and indices
- **Triangulate on load** (OBJ): convert any polygon face into triangles.
- **Normalize indices to 0-based** immediately after parsing OBJ.
- STL facets are already triangles with 0-based indices after pack.

#### Triangulation strategy (OBJ n-gons)
*   **Decision:** For v1, use **fan triangulation** to convert n-gons to triangles during OBJ parsing.
*   **Reasoning:** Fast, simple, sufficient for triangles, quads, or convex polygons (typical papercraft/foam meshes).
*   **Risk & Future Change:** Fan triangulation produces invalid geometry on **concave** polygons. Concave `f` faces (`>3` vertices) emit a non-blocking `concave_ngon` warning; the UI shows an aggregate toast. Earcut / robust triangulation remains a future option.

#### Canonical in-memory mesh
- Store mesh geometry as:
  - `vertices`: packed xyz float array (length = `3 * vertexCount`)
  - `faces`: packed triangle index array (length = `3 * faceCount`)
- Triangles are the only face type after import.

#### Degeneracy (v1 definition)
- Topology treats a face as **degenerate** only when it has **duplicate vertex indices** (index degeneracy). See `isIndexDegenerateFace` / `buildTopology`.
- **Geometric** degeneracy (three distinct indices, near-zero area / collinear) is **out of scope for v1** topology skips. Near-coincident corners are mitigated primarily by weld-on-load, not by a geometric area test in `buildTopology`.
- Non-manifold edges (`edgeToFaces.length > 2`) remain unsupported/ambiguous for seam selection and unfold in the PoC; surface them to the user, do not hide them.

#### Stable edge identity and seams
- Represent an undirected edge by its two vertex indices sorted: `(min(vi), max(vi))`.
- Encode as a stable string key `EdgeKey = "min,max"` (e.g. `"12,98"`).
- Store seams as `Set<EdgeKey>`.

#### Topology / adjacency
- Build an adjacency structure derived from `faces`:
  - `edgeToFaces: Map<EdgeKey, FaceIndex[]>` (1 = boundary, 2 = manifold interior, >2 = non-manifold)
  - `neighborFaceAcrossEdge: (FaceIndex | null)[]` aligned to each triangle’s three edges
- Unfolding and island generation operate on this derived topology, and interpret seams as “cuts” across matching `EdgeKey`s.

#### 2D plane convention
- Flattened output lives in the **XY plane**.

### Rationale
- A single post-import `MeshModel` keeps topology, seams, and unfold format-agnostic.
- Triangulation and 0-based indices reduce downstream special-cases.
- Edge keys based on vertex indices are stable and avoid floating-point identity issues when storing user selections.
- Adjacency is required to walk connected faces during unfolding and to partition islands by cutting seams.
- Fixing 2D to XY removes ambiguity in export.

### Consequences
- Some OBJ files may not display “nicely” in v1 (no materials, no smoothing, no normals unless computed).
- STL has no materials/UVs by format; display relies on computed/flat shading in the viewer.
- Non-manifold edges are detected and treated as unsupported/ambiguous for unfolding in the PoC.
- **Concave n-gons (OBJ):** fan triangulation unchanged; concave faces emit `concave_ngon` warnings.
- Index-only degeneracy means rare zero-area triangles with three distinct indices can still enter unfold (known PoC limit; see audit LOGIC-004).

### Future options / revisit
- Optional `vn` / `vt` for better viewport rendering and UV-based heuristics.
- Geometric degeneracy filter at import or topology (amend this ADR if adopted).
- Unfold Step 1: [ADR 0002](0002-unfold-step-1-hinge-island.md). Mesh orchestration + quality: [ADR 0003](0003-unfold-quality-detection.md), [plans/poc/README.md](../../plans/poc/README.md).
- Introduce a half-edge structure if algorithms become complex, but keep `EdgeKey` compatibility so seam selections remain stable.
