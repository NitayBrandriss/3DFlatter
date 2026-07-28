# Product QA audits

Living index for **post-PoC / product-phase** QA audits. PoC-era audit (frozen): [../poc/qa-audit.md](../poc/qa-audit.md).

**Rules for every audit in this file**

1. Prefer **Vitest in `src/logic/`** (or other pure layers) that try to break the code — do not paper over failures by weakening assertions without recording a finding.
2. **Do not fix production code** during the audit pass; remediation is a separate plan/slice.
3. Each finding gets: **Issue**, **Severity**, **Root Cause & Proposed Strategy**, plus a link to failing/characterizing tests when available.
4. Append new audits below (newest first). Keep older audits intact as historical snapshots.

**Severity scale**

| Level | Meaning |
|-------|---------|
| **Critical** | Topological corruption, crash, or invalid mesh that can break unfold/export |
| **High** | Incorrect subdivision / missed cuts / false accepts that yield wrong derived mesh or seams |
| **Medium** | Wrong warnings, tolerance/scale bugs, incomplete ADR coverage under common use |
| **Low** | Style, minor optimization, dead paths, future-proofing notes |

---

## How to add a future audit

1. Run adversarial Vitest against the slice under review; leave source unchanged.
2. Insert a new `## Audit — <date> — <slice/title>` section **above** older audits (newest first).
3. Fill: Scope, Method, Test baseline, Executive summary, Findings table, per-finding detail, Structural risks, Recommended next steps.
4. Link characterizing tests under `src/logic/**/*.audit.test.ts` (or colocated `*.test.ts`).

---

## Audit — 2026-07-28 — Phase 1 Slice 1: `materializeCutStrokes`

**Status:** Remediated (2026-07-28) — CUT-001–010 addressed in logic; see [Remediation](#remediation-2026-07-28).  
**Date:** 2026-07-28  
**Scope:** Pure geometry only — [`src/logic/cuts/`](../../../src/logic/cuts/) (`materializeCutStrokes`, `WorkingMesh`, `vec3` snap helpers). No React / Zustand / viewer.  
**ADR:** [0100 — Freeform cut strokes](../../decisions/product/0100-freeform-cut-strokes.md)  
**Plan:** [phase-1-freeform-cut-strokes.md](phase-1-freeform-cut-strokes.md)  
**Method:** Static review of cut pipeline + adversarial Vitest suite. Production cut sources **not** modified during the audit pass.  
**Characterizing tests:** [`src/logic/cuts/materializeCutStrokes.audit.test.ts`](../../../src/logic/cuts/materializeCutStrokes.audit.test.ts)  
**Test baseline (audit day):** audit file **50 tests — 6 failed, 44 passed**; existing [`materializeCutStrokes.test.ts`](../../../src/logic/cuts/materializeCutStrokes.test.ts) **8/8 passed**. Full repo `npm test`: **6 failed | 220 passed (226)** — all failures confined to the new audit file.  
**Test baseline (post-remediation):** cuts suite **57/57 passed** (audit + baseline).

### Remediation (2026-07-28)

| ID | Status | Fix summary |
|----|--------|-------------|
| CUT-001 | **Resolved** | First↔last self-intersect skip only when stroke is geometrically closed |
| CUT-002 | **Resolved** | Separate `surfaceEpsilonForMesh`; plane gate uses surface eps² (no `eps²·100`) |
| CUT-003 | **Resolved** | Face-to-face clip walk replaces adjacent-only bridge heuristic |
| CUT-004 | **Resolved** | Relative snap (`bbox * 1e-4`); warn on snap collapse; relative barycentric denom |
| CUT-005 | **Resolved** | Dimensionless `BARY_SLACK`; surface eps for plane distance |
| CUT-006 | **Resolved** | Warning copy clarifies free-boundary / closed-shell semantics (ADR definition unchanged) |
| CUT-007 | **Resolved** | ADR 0100 amended: Phase 1 whole-stroke 3D; per-face 2D deferred |
| CUT-008 | **Resolved** | `vertex → faces` cache on `WorkingMesh` (rebuild on topology edits) |
| CUT-009 | **Resolved** | Dimensionless `PARAM_EPS` for edge-split / hit parameters |
| CUT-010 | **Resolved** | Removed dead same-face `markSeam` branch |

**Still deferred (not CUT IDs):** true per-face 2D self-intersect; geometric sliver cull after splits; BVH locate; Web Worker flatten; seam-cycle detection for closed shells.

### Executive summary

Slice 1 happy-path coverage (edge→edge, interior dart, zigzag, snap, multi-stroke T, manual seam remap) is solid. Adversarial probing finds **three High defects** that will bite real Flatten inputs: self-intersection rejection blind spots on open polylines, scale-broken face locate on large meshes, and a **bridge heuristic that cannot span ≥3 faces in one segment**. No Critical crash/index-degeneracy was observed on the fixtures exercised; manifold incidence stayed ≤2 when cuts applied.

**Verdict (audit day):** Do **not** wire Flatten UX on long freehand strokes until CUT-001 and CUT-003 are fixed (or strokes are densely resampled onto consecutive face pairs). CUT-002 should land with scale-aware plane/bary tolerances before trusting large OBJ/STL assets.

**Verdict (post-remediation):** High blockers closed; proceed to Slice 2 (state / Flatten wiring).

### Findings count

| Severity | Open (audit) | Open (now) | Notes |
|----------|--------------|------------|-------|
| Critical | 0 | 0 | — |
| High | 3 | **0** | CUT-001–003 remediated |
| Medium | 4 | **0** | CUT-004–007 remediated |
| Low | 3 | **0** | CUT-008–010 remediated |

### Findings table

| ID | Severity | Issue | Tests | Status |
|----|----------|-------|-------|--------|
| CUT-001 | **High** | Open-stroke self-intersection missed when crossing pair is first↔last segment | bowtie / 4-point / skew | **Resolved** |
| CUT-002 | **High** | Face locate plane gate scales with `eps²·100` → huge meshes accept far off-surface samples | huge off-plane reject | **Resolved** |
| CUT-003 | **High** | Adjacent-only bridge — long segments across ≥3 faces fail | grid long-cut | **Resolved** |
| CUT-004 | **Medium** | `WELD_EPSILON` floor over-snaps on sub-micron meshes | tiny mesh subdivides | **Resolved** |
| CUT-005 | **Medium** | Absolute bary / plane policy | tiny/huge suite | **Resolved** |
| CUT-006 | **Medium** | Open-loop warnings on closed solids — UX copy | cube open-loop | **Resolved** (copy) |
| CUT-007 | **Medium** | ADR per-face vs whole-stroke drift | ADR amend | **Resolved** |
| CUT-008 | **Low** | O(V+E+F) locate / incidence | vertex→faces cache | **Resolved** |
| CUT-009 | **Low** | Distance eps used as parameter clamp | `PARAM_EPS` | **Resolved** |
| CUT-010 | **Low** | Dead same-face seam branch | removed | **Resolved** |

---

### CUT-001 — Blind self-intersection on first↔last segment pair

- **Issue:** Classic open bowties (4-point crossing polylines) are **not** rejected. Crossing strokes can still materialize, violating ADR 0100 (“Reject self-intersecting stroke polylines”).
- **Severity:** High
- **Root Cause & Proposed Strategy:** In `strokeSelfIntersects`, this skip always runs:

  ```ts
  if (i === 0 && j === points.length - 2) continue;
  ```

  That exclusion is meant for **closed** loops (first≈last). For open strokes it skips the **only** non-adjacent pair when `points.length === 4`, and always skips first↔last for longer open polylines. Middle crossings **are** detected (audit control test passes).

  **Fix:** Only apply the first/last exclusion when the stroke is geometrically closed (`distSq(first,last) ≤ eps²`). Prefer proper 2D intersection in a face-local frame (see CUT-007) rather than 3D closest-point alone.

---

### CUT-002 — Scale-broken face locate accepts off-surface points

- **Issue:** On a ~1e6-scale triangle, an interior sample **1000 units off the plane** is accepted with no warning; the mesh still subdivides. Steiner points are projected onto the plane (`locate` stores `planePoint`), so vertices do not float — but Flatten silently “repairs” bad input and can place cuts at the wrong surface location relative to the stroke.
- **Severity:** High
- **Root Cause & Proposed Strategy:** `WorkingMesh.locate` uses `bestFaceD = epsSq * 100` and absolute bary slack `1e-4`. For large bbox, `snapEpsilonForMesh` grows (`bboxDiagonal * 1e-4`), so the plane gate becomes enormous.

  **Fix:** Separate **snap epsilon** from **on-surface epsilon**. Plane distance and bary slack should be scale-aware fractions of local edge length (or bbox diagonal) with tight caps — e.g. `max(WELD_EPSILON, localEdgeLen * 1e-6)` for plane distance, not `eps² * 100`. Reject (warn) when the pre-projection sample exceeds that gate.

---

### CUT-003 — Multi-face segment connectivity gap

- **Issue:** A single segment whose endpoints lie on faces that only meet through a chain of ≥2 edges (e.g. left→right across a 2×2 grid) fails with `could not connect segment across faces; skipped`. Real freehand strokes will often span many triangles between samples.
- **Severity:** High
- **Root Cause & Proposed Strategy:** `connectCut` only (1) marks an existing edge, or (2) splits one **shared bridge edge** between the two vertex face-stars. There is no segment–mesh intersection walk.

  **Fix (ADR-aligned):** Clip each stroke segment against the triangle set: intersect the 3D chord with face planes / edge crossings, insert Steiner points at every surface crossing in order, then seam the resulting chain. Dense client-side resampling onto consecutive faces is an acceptable **interim** UX mitigation but must not be the sole long-term geometry contract.

---

### CUT-004 — `WELD_EPSILON` floor collapses micro-scale cuts

- **Issue:** On a 1e-6-scale triangle, edge/interior samples within `WELD_EPSILON` of a corner both snap to the same vertex → `v0 === v1` → empty cut, no warning beyond silence.
- **Severity:** Medium
- **Root Cause & Proposed Strategy:** `snapEpsilonForMesh = max(WELD_EPSILON, bboxDiagonal * 1e-4)` floors at `1e-6`, which dominates tiny meshes.

  **Fix:** Document supported mesh scale range for Phase 1, **or** use pure relative epsilon when `bboxDiagonal > 0` and only floor when diagonal is zero/degenerate. Emit an explicit warning when a segment collapses under snap.

---

### CUT-005 — Absolute barycentric slack

- **Issue:** Face-boundary demotion uses hardcoded `slack = 1e-4`, independent of mesh scale — too loose on tiny meshes, too tight or inconsistent vs snap eps on huge ones.
- **Severity:** Medium
- **Root Cause & Proposed Strategy:** Same locate path as CUT-002.

  **Fix:** Derive slack from `eps` / local edge length; share one tolerance policy module for cuts (mirror `geom2d/tolerances.ts` patterns).

---

### CUT-006 — Open-loop warnings on closed manifolds

- **Issue:** Any non-closed stroke on a closed cube is flagged as an open loop because `isBoundaryVertex` is never true (every edge incidence = 2). Edge-to-edge face cuts that users consider “valid slits” still warn.
- **Severity:** Medium
- **Root Cause & Proposed Strategy:** ADR 0100 defines open loops via **mesh boundary** edges. That is topologically honest for island split, but poor UX on closed solids.

  **Fix:** Keep ADR semantics for island connectivity, but refine messaging (“endpoints not on a free boundary — may not split a closed shell”) and/or add a secondary check: whether the cut seam chain connects two distinct boundary components **or** forms a cycle capable of splitting. Defer cycle detection if needed; at least avoid implying the cut was invalid when seams were applied correctly.

---

### CUT-007 — Per-face vs whole-stroke self-intersection (ADR drift)

- **Issue:** ADR: reject self-intersecting polylines **per face**. Code rejects (when it works) on the whole stroke in 3D.
- **Severity:** Medium
- **Root Cause & Proposed Strategy:** Implementation shortcut; also misses surface-meaningful crossings that are 3D-skewed (partially overlapping CUT-001).

  **Fix:** After assigning samples to faces (or during clip walk from CUT-003), run 2D segment intersection in each face’s local orthonormal frame. Skip only adjacent segments and closed-loop endpoint touch when `first≈last`.

---

### CUT-008 — Locate / incidence performance

- **Issue:** Each `locate` rebuilds unique edges and scans all vertices/faces; `facesIncidentToVertex` scans all faces; `isBoundaryVertex` rebuilds full edge incidence maps per endpoint. Fine for PoC fixtures; Flatten on dense meshes + many stroke samples will be CPU-heavy on the main thread (Worker still deferred).
- **Severity:** Low
- **Root Cause & Proposed Strategy:** No spatial index / adjacency cache on `WorkingMesh`.

  **Fix:** Maintain `vertex→faces` and edge maps incrementally on split; optional BVH/grid for locate. Not blocking Slice 1 correctness if CUT-001–003 land first.

---

### CUT-009 — Parameter clamp uses distance epsilon

- **Issue:** Bridge split clamps `t` with `working.eps` (a length), not a dimensionless parameter epsilon. On short edges relative to `eps`, the clamp can pin `t` near endpoints incorrectly.
- **Severity:** Low
- **Root Cause & Proposed Strategy:** Unit mix-up in `connectCut`.

  **Fix:** Clamp with a parameter epsilon (e.g. `1e-6` or `eps / edgeLength`) and refuse split when the closest point is within snap of an existing endpoint (reuse vertex instead).

---

### CUT-010 — Dead same-face seam branch

- **Issue:** After `hasEdge` fails, code still `markSeam` if both vertices appear in one triangle. For a valid triangle those two corners already form an edge — branch is unreachable / confusing. If ever hit with a non-triangle face, it would create a **ghost seam** (CUT risk).
- **Severity:** Low
- **Root Cause & Proposed Strategy:** Defensive leftover.

  **Fix:** Remove or assert `hasEdge`; never mark seams for non-edges. Audit invariant already asserted: `seamEdgesExistOnMesh` (keep in regression suite).

---

### Structural / future-proofing risks (no dedicated failing test)

| Risk | Severity | Notes |
|------|----------|-------|
| Segment-by-segment materialize ≠ ordered face-local polyline split (ADR text) | High (design) | Same root as CUT-003; zigzag that revisits a subdivided face may accumulate brittle bridge lookups |
| No geometric (area) degeneracy cull after splits | Medium | Sliver tris possible near snaps; unfold/quality may later flag tears/overlaps |
| `CutManifest` segment→edgeKeys incomplete when connect fails mid-stroke | Medium | Later SVG edge-ID matching will see holes; surface empty `edgeKeys` to UI |
| Closed-stroke self-intersect exclusion + CUT-001 interaction | Medium | Closing a stroke that crosses itself mid-path needs explicit tests once CUT-001 fixed |
| Recompute-every-Flatten without Worker | Low | Already ADR non-goal; watch cost after CUT-008 caches |

### What passed (confidence)

- Area conservation on simple edge→edge triangle cut
- No index-degenerate faces on interior Steiner / quad cuts in suite
- Manifold edge incidence ≤2 on cube face cut and slipped bowtie materialize
- Manual seam remap to children; untouched manual seams survive
- Input mesh / stroke purity; deterministic seam sets
- `WorkingMesh.splitEdge` seam remap + idempotent same-`t` split
- Middle-segment self-intersection detection (proves the 3D predicate works when not skipped)
- Baseline Slice 1 unit tests still green

### Recommended next steps (remediation order)

**Done (2026-07-28):** CUT-001–010 remediated per table above.

**Next product work:** Slice 2 (Zustand stroke CRUD + Flatten wiring). Keep [`materializeCutStrokes.audit.test.ts`](../../../src/logic/cuts/materializeCutStrokes.audit.test.ts) green as a regression gate.

### Audit hygiene

- Audit pass left production cut sources unchanged; remediation edited `src/logic/cuts/` + ADR/plan docs afterward.
- This document is the product-track QA home for future slices (state wiring, viewer draw tool, etc.).
