# QA audit — P2-E2 Slice 1 (isolation logic)

**Status:** Open — awaiting remediation decisions (do not start Slice 2 until this is resolved or explicitly waived)  
**Date:** 2026-09-03  
**Scope:** Static review of `src/logic/isolation/` + Slice 1 tests. No production or test edits in the audit pass.  
**ADR:** [0101 — Mesh isolation](../../decisions/product/0101-mesh-isolation.md)  
**Plan:** [epic-mesh-isolation.md](epic-mesh-isolation.md)  
**Index:** [qa-audits.md](qa-audits.md#audit--2026-09-03--p2-e2-slice-1-isolation-logic)  
**Method:** Independent QA / 3D-math review of flood, fence-from-strokes, mask, subset extract, and colocated Vitest. Fixtures and assertions were treated as evidence, not as proof.

**IDs:** `ISO-S1-*` (slice audit). Do not confuse with deferred product items **ISO-001…004** on [PRODUCT_ROADMAP.md — Deferred backlog](../../../PRODUCT_ROADMAP.md#deferred-backlog-not-scheduled).

---

## How to continue from this file

1. Decide the **policy** row in [Decision queue](#decision-queue) (blockers vs ribbon; whole-mesh heuristic).
2. Pick a remediation set from [Recommended next steps](#recommended-next-steps) (tests only / logic / both).
3. Check off findings as they land. Keep this file as the working SSOT; append status, do not rewrite history.
4. Only then start epic Slice 2 (Zustand isolation overlay).

---

## Verdict

First-try green is unsurprising. The suite is small, the fixtures are built to match the implementation, and several “canonical” assertions would still pass if fence `EdgeKey`s were ignored.

Slice 1 is **not proven** for the ADR target (dense connected body, ~84k tris, path through the torso). Max fixture is an **open 6-gon prism, 48 triangles**. There is no branched body, no capped limb, no torus, no dense tube, no incomplete bracelet.

---

## Findings count

| Severity | Open | Notes |
|----------|------|-------|
| Critical | 0 | No crash / `EdgeKey` remap in this slice |
| High | 3 | ISO-S1-001, ISO-S1-002, ISO-S1-003 |
| Medium | 6 | ISO-S1-004 … ISO-S1-009 |
| Low | 4 | ISO-S1-010 … ISO-S1-013 |

---

## Findings table

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| ISO-S1-001 | **High** | Canonical stroke-bracelet flood is not shown to be cut by fence `EdgeKey`s; blockers alone would pass the integration test | Open |
| ISO-S1-002 | **High** | `coversAllNonOrphanFaces` is false whenever a stroke tags blocker faces, even if the flood is “whole mesh minus a ribbon” | Open |
| ISO-S1-003 | **High** | No branched / second-path fixture; cylinder tests cannot catch leak-through-torso | Open |
| ISO-S1-004 | **Medium** | Stroke fences always paint traversed faces as blockers (ADR says fallback-only); vertex-ring bracelet can eat the adjacent band | Open |
| ISO-S1-005 | **Medium** | Incomplete bracelet / gapped cycle untested; the product failure mode for two loops | Open |
| ISO-S1-006 | **Medium** | Non-manifold edges are silent dual walls (`getNeighborAcrossEdge` only pairs `incidents.length === 2`) | Open |
| ISO-S1-007 | **Medium** | Truncated surface walk / `locate === none` emit a gapped or empty fence with no warning | Open |
| ISO-S1-008 | **Medium** | Per-segment `WorkingMesh` + brute `locate` will hitch on the 84k-tri asset this epic exists for | Open |
| ISO-S1-009 | **Medium** | Disjoint-mask extract, empty-mask → `buildTopology` throw, remapped subset `FaceIndex` for Flatten are untested / Slice 3 landmines | Open |
| ISO-S1-010 | **Low** | Under-specified assertions (`size > 0`, `.not.toBe("inside")`); redundant leak test | Open |
| ISO-S1-011 | **Low** | Single-point stroke, empty stroke, perfectly overlapping strokes untested | Open |
| ISO-S1-012 | **Low** | `floodFromFace` is DFS (`queue.pop`), not BFS; fine for the set, wrong for later ring-grow | Open |
| ISO-S1-013 | **Low** | Fence walk is a fork of `tessellateSurfaceSegment`; drift already possible | Open |

---

## 1. Test quality

### Fixtures are a cylinder plus 2-triangle toys

| Fixture | Faces | Used as |
|---------|-------|---------|
| `openTube(5, 6)` | 48 | “arm / wrist / torso”, bracelets, flood, extract |
| `openTube(4, 4)` / `(3, 4)` | 24 / 16 | extract packing, empty mask |
| `unitQuad` / diamond / orphan | 2 | fence walk, classify, seams, degeneracy |

ADR 0101’s target is a **connected full-body avatar**. The test named “does not leak past a bracelet into the hand or torso bands” is still one cylinder. Bands 0 and 3 are renamed slices of the same prism. A leak-through-the-chest bug cannot fail these tests.

### Several assertions are tautological or under-specified

**Stroke bracelets do not prove fence edges work.** `fenceEdgesFromStrokes` always adds every traversed face to `blockerFaces`, including when exit edges exist. ADR 0101: treat touched faces as opaque blockers **if a walk cannot produce exit edges** (fallback). For `tubeBraceletStroke` (midpoints of longitudinal edges), the walk stays inside one band, so **the entire bracelet band becomes opaque**. Flood from the next band then stops because neighbors are blockers, not because the dual hit a separating `EdgeKey` cycle.

The integration test still passes both `fenceEdges` and `blockerFaces`. There is no test of stroke-derived `fenceEdges` *only*. If `floodFromFace` ignored `fenceEdges` entirely, **“two stroke bracelets + seed isolate the arm band” would still pass**.

The only non-tautological separator test injects `tubeCircumferentialLoop` as a hand-built `Set<EdgeKey>` — a perfect vertex ring, not a stroke walk.

**`> 0` and `not.toBe("inside")` are not oracles.**

- Tube fence test: `fenceEdges.size > 0` and `blockerFaces.size > 0`. No expected keys, no “does this set actually separate the dual?”
- Wall bracelet vs mask: `.not.toBe("inside")` plus a comment that the result might be `outside` or `crossing`. That encodes uncertainty, not a contract.
- Folded-quad fence: `fenceEdges.size > 0` — any leftover key satisfies it.

**Redundant tests inflate confidence.** “Stops at two circumferential loops” already asserts the exact face set. “Does not leak into hand or torso” is the same fixture with weaker checks. Diamond seam is the 2-triangle case `partitionIslands` already covers.

**Fixtures collude with the algorithm.** Bracelets are exact edge midpoints on a 6-sided prism. `locate` cannot miss. Incomplete loops, off-surface points, overlapping polylines, and vertex-snapped rings (what a real wrist stroke will hit) are absent.

---

## 2. Edge cases missed

### ISO-S1-006 — Non-manifold edges

`buildTopology` only writes neighbors when `incidents.length === 2`. Flood uses `getNeighborAcrossEdge`, so a non-manifold edge is a **hard stop with no warning** on `FloodFromFaceResult`. Project rule: surface non-manifold, do not hide it. Three faces around one edge never meet in the dual; vertex-only fans (bowtie) never flood across. Zero isolation tests.

### ISO-S1-011 — Single-point / empty / overlapping strokes

- One point: `traceStrokeFences` records incident faces, no exit edges, warns “approximate fence”. **Untested.** A click-as-stroke becomes a local blocker island.
- Empty `points`: silent (no warning, empty fences).
- Duplicate bracelets: set union is algebraically harmless; **untested** (duplicate warnings, two identical single-face loops).

### ISO-S1-004 — Vertex-ring bracelet eats both bands

`recordExit` adds **all** faces incident to each crossed edge. A circumferential snap (user traces a vertex ring between band 0 and band 1) marks **both** bands as blockers and eats a ring of the arm. The midpoint fixture never hits that.

### Seed on a fence / blocker face

Blocker seed → `[seed]`, no expand: implemented and tested. Not tested:

- Seed on a **cut-through ribbon** that is blocked even though exit edges exist (click near the bracelet → one triangle, not the arm).
- Seed on a face **incident to a fence `EdgeKey` but not in `blockerFaces`**.
- Seed on a **ghost-side** face after add (Slice 2, but the combine logic is already here).

### ISO-S1-005 — Incomplete bracelet

One missing segment on a 6-gon is a dual gap; flood wraps and takes the whole tube. **No test.** This is why `coversAllNonOrphanFaces` exists.

### ISO-S1-002 — Whole-mesh warning vs blockers

```ts
coversAllNonOrphanFaces: faces.length === nonOrphanCount
```

Blocker faces are non-orphan but never entered (unless they are the seed). After any successful stroke trace, flood is at most “all faces minus the ribbon”, so **`coversAllNonOrphanFaces` is false even when the user selected the whole mesh minus a scar**. ADR: warn and do not auto-isolate if the flood takes every non-orphan face. Implementation: a chest scribble + seed auto-isolates the avatar minus the scribble, with no warning.

Tests only check `true` on an empty-fence tube and `false` on a successful band — they cannot catch this.

### Other holes

| Case | Behavior | Tested? |
|------|----------|---------|
| Off-surface `locate` → `none` | Empty segment, **no warning** (warning needs `faces.size > 0`) | No |
| Walk hits 2048 hops | Partial edges, **no warning** | No |
| Seams **and** stroke fences together | Independent flags exist | No |
| Closed cube / capped cylinder | Open tube only | No |
| Two bodies, Shift-add | `combineFloodIntoMask("add")` on length-8 bit arrays, not two meshes | No |
| Empty isolate then `buildTopology` | `extractFaceSubset` allows `faceCount === 0`; `buildTopology` **throws** | Extract empty yes; topology no |

---

## 3. Memory / performance / infinite loops

**Flood will not spin on a valid dual.** `visited` is set before enqueue; each face is pushed at most once. `queue.pop()` is DFS, not BFS — same component, different order (ISO-S1-012). Queue size is O(faces); 84k ints is fine.

**Theoretical infinite loop:** `visited` is `Uint8Array(mesh.faceCount)`. An out-of-range neighbor does not stick in that buffer, so it can be pushed forever. `buildTopology` will not emit that; a stale topology could. No defensive range check.

**ISO-S1-008 — The real cost is fences, not BFS.** Every **segment** of every stroke constructs a new `WorkingMesh`: copy all vertices to a JS `number[]`, copy all faces, rebuild vertex–face incidence, rebuild the full edge cache. Then `locate` is O(V+E+F) **twice**. A 100-point bracelet on an 84k-tri mesh is ~99 full copies plus ~200 linear scans. Two bracelets double that. Slice 1 will hitch on the asset the epic exists for. Tests use 7 points on 48 tris.

Hop cap: `min(2048, 2F+4)` per segment. Bounded, good. Exhaustion is silent (ISO-S1-007) — a long chord on a dense arm can leave a **gap in the fence** and look like a flood bug.

`countNonOrphanFaces` rescans the whole mesh on every seed. Cheap next to `WorkingMesh`.

`extractFaceSubset` copies the **entire** vertex buffer (`new Float32Array(mesh.vertices)`). That matches ADR 0101 (keep indices). Isolate 0.5% of faces still duplicates all verts. Fine compared to the fence walk; extra copy vs sharing the session buffer.

---

## 4. Subset extraction and disjoint faces (ISO-S1-009)

**Index contract holds** for the cases they wrote: full vertex array, packed faces keep original vertex indices, isolation rings become `edgeToFaces.length === 1` after `buildTopology`. That test is one of the few with a real oracle.

**Disjoint islands are untested.** `extractFaceSubset` walks `mask[i] === 1` in index order. Two separate components stay two components in the dual; shared original vertex indices stay shared (bowtie / Shift-add of two bodies). No test that `partitionIslands` on that subset returns two islands, that unused verts in the hole are inert, or that a cherry-picked pair of faces that share an edge become one island.

**Face indices are remapped; vertex indices are not.** Subset face 0 is “first kept original face”, not original 0. Stroke classification uses original `FaceIndex` via `traceStrokeFences`. Flatten (Slice 3) that materializes on the subset will see **different face ids** in `WorkingMesh`. That landmine is not in Slice 1 tests.

**Empty mask:** `faceCount === 0`, verts kept. Next `buildTopology` throws. Confirm-isolate with an empty mask is a Slice 3 crash unless UI forbids it.

---

## Logic bugs the tests cannot see

1. **Canonical bracelet separation is a face ribbon, not virtual seams.** Stroke fences as `EdgeKey` cycles are unproven; the midpoint bracelet’s diagonals/longitudinals do not cut the tube by themselves. Isolation thickness is “whatever faces the walk touched,” not the stroke curve.

2. **ADR deviation:** blockers are always applied, not fallback-only. Defensible for a cut-through triangle (the face sits on both sides of the cut) but it is why ISO-S1-001 and ISO-S1-002 fail.

3. **Walk logic is a fork of `tessellateSurfaceSegment`.** Drift (hop cap, `locate` none, finish-if-on-face) is already possible; fence walk does not warn on truncation.

4. **`isTopologyOrphanFace` export** is the only `partitionIslands` change. No mask-aware partition. Sidebar stats while isolated are still a later slice; extract-then-topology is the Flatten path.

---

## Decision queue

Resolve before writing tests or code that assume one story.

| # | Question | Option A (ADR as written) | Option B (match current code) |
|---|----------|---------------------------|-------------------------------|
| D1 | What is a stroke fence? | Separating `EdgeKey` cycle (virtual seams). Blockers only when the walk has **no** exit edges. | Always opaque walked faces + whatever exit keys fall out. Document the ADR deviation. |
| D2 | Whole-mesh warn | Flood ≈ all non-orphan faces, **including** treating “all but the stroke ribbon” as whole-mesh. | Keep `faces.length === nonOrphanCount` and accept auto-isolate of mesh-minus-ribbon. |
| D3 | Vertex-ring bracelet | Must not eat the adjacent isolate band (`recordExit` only the walked face, or fence the ring without dual-side blockers). | Eating one extra ring is accepted v1 thickness. |

Until D1 is chosen, a “fix” can fight the tests: tightening fence-only flood will fail the current bracelet integration test if blockers are the real separator.

---

## Recommended next steps

**Must (before Slice 2), after D1–D3:**

1. **ISO-S1-001** — Separating-cycle test from strokes with `blockerFaces` omitted. If it fails, either fix fences or adopt Option B in D1.
2. **ISO-S1-002** — Incomplete / non-separating stroke still trips whole-mesh warn (or redefine the flag explicitly).
3. **ISO-S1-004** — Vertex-ring bracelet fixture (circumferential snap).
4. **ISO-S1-003** — Branched mesh (two tubes on a shared loop): bracelet on one limb must not flood the other.

**Should:**

5. ISO-S1-011 — Single-point, empty, duplicate overlapping strokes.
6. ISO-S1-006 — Non-manifold edge: flood stops; result carries a warning (or document “treated as boundary”).
7. ISO-S1-009 — Disjoint mask → extract → `partitionIslands` length 2; vertex indices unchanged. Empty subset must not reach `buildTopology` unguarded.
8. ISO-S1-007 — Truncated walk / `locate === none` must warn, not emit a gapped fence.
9. ISO-S1-010 — Exact `StrokeMaskRelation` for the wall bracelet (`outside` vs `crossing`).

**Performance (can slip to Slice 2+ if a hitch is accepted):**

10. ISO-S1-008 — One `WorkingMesh` per stroke (or per `fenceEdgesFromStrokes` call), not per segment.

---

## Code map (Slice 1)

| Path | Role |
|------|------|
| [`src/logic/isolation/types.ts`](../../../src/logic/isolation/types.ts) | `FaceMask`, `FloodBarriers`, `FenceFromStrokesResult` |
| [`src/logic/isolation/faceMask.ts`](../../../src/logic/isolation/faceMask.ts) | Overlay bits; `combineFloodIntoMask` |
| [`src/logic/isolation/floodFromFace.ts`](../../../src/logic/isolation/floodFromFace.ts) | Dual DFS; seams / fence keys / blocker faces |
| [`src/logic/isolation/fenceEdgesFromStrokes.ts`](../../../src/logic/isolation/fenceEdgesFromStrokes.ts) | Read-only walk; always unions `blockerFaces` |
| [`src/logic/isolation/extractFaceSubset.ts`](../../../src/logic/isolation/extractFaceSubset.ts) | Keep verts; pack masked faces |
| [`src/logic/isolation/classifyStrokeVsMask.ts`](../../../src/logic/isolation/classifyStrokeVsMask.ts) | inside / outside / crossing via same walk faces |
| [`src/logic/isolation/testMeshes.ts`](../../../src/logic/isolation/testMeshes.ts) | `openTube`, `tubeBraceletStroke`, circumferential loops |
| [`src/logic/mesh/partitionIslands.ts`](../../../src/logic/mesh/partitionIslands.ts) | `isTopologyOrphanFace` exported only |

---

## Audit hygiene

- Audit pass did not modify `src/logic/isolation/` or tests.
- Continue work from **Decision queue** then **Recommended next steps**; mark finding **Status** in the table when a slice lands.
- Characterizing tests, when added, should live next to the modules (or `*.audit.test.ts` then merge, per [qa-audits.md](qa-audits.md) history).
