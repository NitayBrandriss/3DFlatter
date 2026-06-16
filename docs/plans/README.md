# Plans & roadmap

Single entry point for implementation plans. **ADRs** (`docs/decisions/`) hold architecture contracts; this folder holds phased delivery plans and backlog.

```mermaid
flowchart LR
  load["Load OBJ"]
  topo["Topology"]
  seams["Seams"]
  islands["Islands"]
  unfold["Unfold"]
  export["Export"]
  load --> topo --> seams --> islands --> unfold --> export
```

---

## Status

| Phase | Topic | Status | Detail |
|-------|-------|--------|--------|
| Step 1 | Hinge-island unfold (triangle soup) | **Complete** | [ADR 0002](../decisions/0002-unfold-step-1-hinge-island.md) |
| Step 2 | `unfoldMesh` + layout + 2D viewer | **Complete** | [archive/step-2-flattening.md](archive/step-2-flattening.md) |
| Step 2 stretch | 2D seam overlay on blueprint | **Complete** | [archive/step-2-seam-overlay.md](archive/step-2-seam-overlay.md) |
| Export | SVG preview (tier 1) | **Complete** | `src/logic/export/svg/` |
| Export | SVG manufacturing / laser (tier 2) | Planned | See backlog below |
| Step 3a | Intra-island collision detection | Planned | Backlog |
| Step 3b | Non-tree edge disagreement | Planned | Backlog |
| Phase 2 | Auto seam suggestions | Planned | Backlog |

---

## Shipped deliverables (quick reference)

| Area | Key modules |
|------|-------------|
| I/O | `parseObj`, `polygonConvexity` |
| Topology | `buildTopology`, `partitionIslands` |
| Seams | `seamRegistry`, `edgeEligibility`, `resolvePick` |
| Unfold | `unfoldIsland`, `unfoldMesh`, `layoutIslands`, `seamSegments2d` |
| Export | `buildSvgDocument`, `tier1Preview` |
| UI | `MeshViewport`, `UnfoldViewer2D`, `useFlattenExport` |

Manual regression (Step 2): load cube → seam top face → Flatten → two separated islands + red cut lines (MT-1 … MT-6 in [step-2 archive](archive/step-2-flattening.md)).

---

## Backlog (next work)

Prioritize in order when starting a new slice. Write or extend a plan section here (or a new `archive/` doc) before large implementation.

### SVG export — tier 2 (manufacturing)

- Cut paths: outer boundary per island + explicit seam edges, or export-time edge merge
- Keep unfold as triangle soup; weld/merge is export-only ([ADR 0002](../decisions/0002-unfold-step-1-hinge-island.md))
- New pure helpers under `src/logic/export/` — no React

### Step 3a — Intra-island collision

- Detect triangle overlap within one island
- Mitigate via BFS root choice, hinge branch flip, subtree placement
- UI hint when a closed mesh self-overlaps

### Step 3b — Edge disagreement (non-tree shared edges)

- Sibling faces with different 2D coords on the same 3D edge
- Mitigate via 2D corner re-weld or unfold tree optimization
- Document in a new ADR 0003 before changing unfold contracts

### 2D seam pick

- Face-aware edge click in 2D viewer → `toggleSeam(EdgeKey)`
- Resolve soup duplicate vertices: `(faceIndex, edgeSlot)` picking

### Auto seam suggestions (README Phase 2)

- Curvature / junction heuristics; user approve/reject workflow

### Deferred / polish

- 2D face drag editor
- STL/GLB loaders (PoC remains OBJ v1)
- Face index labels, 3D/2D tab on narrow screens

---

## Archive

Completed implementation specs (historical detail, substeps, risks):

| Plan | Description |
|------|-------------|
| [step-2-flattening.md](archive/step-2-flattening.md) | Orchestration, layout, `UnfoldViewer2D`, manual test table |
| [step-2-seam-overlay.md](archive/step-2-seam-overlay.md) | `listSeamSegments2d`, `UnfoldMeshResult.seamSegments` |

When a backlog item ships, add an archive doc and update the status table above.

---

## How to add a plan

1. Add a row to **Status** (or **Backlog**) in this file.
2. For non-trivial work, add `archive/<phase-name>.md` with scope, substeps, tests, and manual checks.
3. Link the archive from this README; link ADRs when contracts change.
4. Agents: see [AGENTS.md](../../AGENTS.md) planning workflow — plan before implement.
