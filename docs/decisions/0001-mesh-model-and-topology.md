---
status: accepted
date: 2026-05-06
---

## ADR 0001: MeshModel + topology baseline (PoC)

### Context
This PoC needs a mesh representation that supports:

- Loading an OBJ file
- Rendering in Three.js / `@react-three/fiber`
- Selecting **seams** as mesh edges
- Building **adjacency** for island generation and unfolding
- Producing 2D output in a consistent plane (XY) for SVG/PDF export

### Decision

#### OBJ import scope (v1)
- Support only `v` (vertex positions) and `f` (faces).
- Ignore materials/textures for now (`mtl`, `usemtl`).
- Ignore normals/UVs for now (`vn`, `vt`), groups/objects (`g`, `o`), and smoothing (`s`).

#### Triangulation and indices
- **Triangulate on load**: convert any polygon face into triangles.
- **Normalize indices to 0-based** immediately after parsing OBJ.

#### Canonical in-memory mesh
- Store mesh geometry as:
  - `vertices`: packed xyz float array (length = `3 * vertexCount`)
  - `faces`: packed triangle index array (length = `3 * faceCount`)
- Triangles are the only face type after import.

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
- Triangulation and 0-based indices reduce downstream special-cases and simplify all topology code.
- Edge keys based on vertex indices are stable and avoid floating-point identity issues when storing user selections.
- Adjacency is required to:
  - walk connected faces during unfolding (“hinge” across edges)
  - partition the mesh into islands by cutting seam edges
- Fixing 2D to XY removes ambiguity in export and keeps SVG/PDF generation straightforward.

### Consequences
- Some OBJ files may not display “nicely” in v1 (no materials, no smoothing, no normals unless computed).
- Non-manifold edges (adjacent to >2 faces) are detected and treated as unsupported/ambiguous for unfolding in the PoC.

### Future options / revisit
- Add optional support for `vn` / `vt` for better viewport rendering and potential UV-based heuristics.
- Add mesh cleaning/repair (welding, manifold enforcement) if real-world models require it.
- Introduce a half-edge structure if algorithms become complex, but keep `EdgeKey` compatibility so seam selections remain stable.

