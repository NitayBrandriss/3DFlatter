# Product QA audits

Living index for **post-PoC / product-phase** QA audits. PoC-era audit (frozen): [../poc/qa-audit.md](../poc/qa-audit.md).

**Polyline cut audits (promoted from proposals)**

| Audit | Topic | Status |
|-------|-------|--------|
| [2026-08-16 Slice D](#audit--2026-08-16--polyline-cut-slice-d-committed-re-edit) | Committed stroke re-edit (drag / append-end / cancel / Done+Flatten) | Characterizing tests green; two Medium viewer issues (unsaved discard, accidental append) |
| [2026-08-16 Slice C](#audit--2026-08-16--polyline-cut-slice-c-node-drag) | Draft node drag + overlay retessellate | Chord-through-volume remediated; opposite-face walk still incomplete |
| [2026-08-03 Slice B](#audit--2026-08-03--polyline-cut-slice-b-markers--closed-rings--islands) | Markers + closed rings → islands | Remediated / regression-guarded |
| [2026-08-02 Slice A](#audit--2026-08-02--polyline-cut-slice-a-draft-lifecycle) | Draft lifecycle | Remediated for required findings |

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

## Audit — 2026-08-16 — Polyline cut Slice D (committed re-edit)

**Status:** Intended-scope contracts hold in logic/store (characterizing Vitest green). Viewer has two Medium issues that affect re-edit. **No production code was changed in this pass.**  
**Date:** 2026-08-16  
**Scope (only):** (1) marker drag updates the mesh overlay path; (2) mesh click in edit appends **strictly at the end**; (3) Esc / Cancel restores the original committed stroke; (4) Done/`updateCutStroke` persists points and Flatten uses the new polyline for 2D islands.  
**Out of scope (do not treat as bugs):** mid-segment insert (**CUT-UX-001**), general undo stack (**CUT-UX-002**), snap/weld (**CUT-UX-003**). Slice C overlay walk limits (**POLYCUT-C-002**, **POLYCUT-C-003**) are inherited, not new Slice D defects. Slice E QA matrix is still on hold.  
**ADR:** [0100](../../decisions/product/0100-freeform-cut-strokes.md)  
**Blueprint:** [polyline_cut_tool plan](../../../.cursor/plans/polyline_cut_tool_318885f7.plan.md) (`editingCommitted` → `updateCutStroke` on finalize; discard on cancel; overlay hides edited id).  
**Method:** Static review of `useCutPolylineDraft`, `MeshViewport`, `PickableMesh`, `CommittedStrokePickables`, store + flatten snapshot; characterizing Vitest (no source fixes).  
**Characterizing tests:** [`src/logic/cuts/sliceD.committedEdit.audit.test.ts`](../../../src/logic/cuts/sliceD.committedEdit.audit.test.ts) — **9/9 passed** (`vitest run src/logic/cuts/sliceD.committedEdit.audit.test.ts`).

### Intended-scope results

| Check | Result |
|-------|--------|
| **1. Marker drag** | **Pass (logic).** `writePlacedTwin` mutates only the edit clones; store copy unchanged until Done. Overlay rebuilds via `tessellateDraftDisplayPath` / `tessellateSurfaceSegment` (same path as Slice C). Drag uses pointer capture + `raycastDisplayMesh` on the pickable mesh (`CutPolylineSession`). |
| **2. Append at end** | **Pass (logic).** `addPointFromHit` in `editingCommitted` still calls `appendPolylineDraftPoint` (tail only; no mid-segment splice). Characterizing test asserts prefix preserved and a “would-be mid-edge” hit is still appended as last. |
| **3. Cancel / Esc** | **Pass (store).** `cancel` → `clearDraft` only; no `updateCutStroke`. Zustand points and `patternRevision` stay as committed. Leaving the Cut tool also calls `cancel` (same discard). |
| **4. Done + Flatten** | **Pass (store + pipeline).** `finalize` / Done → `{ kind: "update", id, points }` → `updateCutStroke` (deep copy, `patternRevision++`, `meshLoadVersion` unchanged). `flattenWithCutStrokes` on the updated polyline changes island topology vs a closed loop vs an open dart. 2D panel **does not auto-run**; snapshot stales on `patternRevision` until the user clicks Flatten (ADR 0100 / `useFlattenExport`) — **expected**, not a Slice D miss. |

### Manual / triggered (for the parallel manual QA)

| Gesture | Expected if Slice D is correct |
|---------|--------------------------------|
| Cut tool idle → click a committed stroke | Enters `editingCommitted`; committed overlay for that id hidden (`excludeCutStrokeById`); draft line + markers show a clone. |
| Drag a marker on the mesh | Line retessellates with the new vertex; other committed strokes unchanged; Flatten/2D unchanged until Done. |
| Click empty mesh (not a marker) | New vertex **only at the tail**. No insert on a segment. |
| Esc or Cancel | Stroke looks and stores as before the pick; `patternRevision` unchanged. |
| Done (or Enter) then Flatten | Store points match the edit; 2D islands follow the new cut. |
| Opposite-face drag | Incomplete overlay (**C-002**), must not tunnel (**C-001**). Do not file as D. |

### Findings table

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| POLYCUT-D-001 | **Medium** | Picking a **different** committed stroke while editing **silently discards** unsaved edits | Open |
| POLYCUT-D-002 | **Medium** | Draft polyline `raycast` is disabled, so a click on the edited stroke body hits the mesh and **appends a tail vertex** | Open |
| POLYCUT-D-003 | **Low** | Rubber-band tip runs in `editingCommitted` (plan said tip only in `drafting`) | Open — plan deviation; supports append preview |
| POLYCUT-C-002 | **Medium** | Opposite-face walk incomplete while dragging in re-edit | Inherited — not a D regression |
| POLYCUT-C-003 | **Low** | Closed-loop last marker occludes first | Inherited |

### POLYCUT-D-001 — Switching committed strokes drops the in-progress edit

- **Issue:** `canPickCommittedStroke(true, editingId, false)` is **true**, so other strokes stay pickable. `enterEditCommitted` overwrites refs when `stroke.id` differs; it never writes the previous clone. The previous stroke remains as last committed in Zustand (good for cancel semantics) but **unsaved drags/appends are lost** with no confirm.
- **Severity:** Medium (data loss of the current edit session, not of the stored stroke).
- **Root cause:** Re-entry is “load this stroke into refs.” There is no dirty flag or “commit or discard current edit first.”
- **Proposed strategy (for the remediation agent, not implemented here):** Ignore picks of other strokes while `editingCommitted`; or treat pick as cancel-then-enter; or prompt. Same class: switching **off** the Cut tool already `cancel()`s.
- **Tests:** `sliceD.committedEdit.audit.test.ts` documents the pick gate; discard is viewer-only (no failing unit).
- **Status:** Open.

### POLYCUT-D-002 — Click on the edited line appends at the end

- **Issue:** `InProgressPolylineLine` sets `lineObj.raycast = () => undefined`. Committed pick proxies exclude the stroke being edited. A click that looks like “click the stroke” often hits `PickableMesh` → `addPointFromHit` → **tail append**. That matches “append at end” mechanically, but it is easy to add an accidental vertex while trying to select the line or orbit-adjacent mesh.
- **Severity:** Medium (wrong vertex list until Cancel; Done would persist the extra point and change Flatten).
- **Root cause:** Mesh is the only click target for append; the visible draft polyline does not consume the pick.
- **Proposed strategy:** Optionally raycast-block the draft line (still append only via explicit mesh hits away from the polyline), or require a modifier / “add point” mode. Do **not** interpret this as a request for mid-segment insert.
- **Status:** Open.

### POLYCUT-D-003 — Rubber-band during committed edit

- **Issue:** Plan: rubber-band only in `drafting`; clear tip in `editingCommitted` / drag. Code: `setHoverTip` uses `isLiveMode`, so edit mode also shows a tip from the **last** vertex to the hover hit (`tessellateDraftDisplayPath`).
- **Severity:** Low (preview of the in-scope append-at-end gesture; not insert-on-segment).
- **Status:** Open — decide whether to match the plan (no tip) or keep tip as append affordance.

### Not bugs / expected

| Topic | Why it is not a Slice D defect |
|-------|--------------------------------|
| No mid-segment insert, undo stack, or snap/weld | Explicit v2 backlog (CUT-UX-001/002/003). |
| 2D view clears until Flatten | `updateCutStroke` bumps `patternRevision`; `useFlattenExport` stales the snapshot. User must Flatten again. |
| Cancel “revert” is vacuous until Done | Edits live only in refs; Esc never needs to restore Zustand. |
| First-vertex marker click / Enter / double-click also finalize | Same as new-draft Slice B; `commitPoints` then `updateCutStroke`. Done is not the only commit path. |
| Backspace removes the last vertex of the **edit clone** | Draft vertex undo, not the v2 undo stack. Empty clone → `clearDraft` (same as cancel). |
| Append after a closed ring | New point is after the duplicate close vertex → loop is no longer closed until the user closes again. Matches “end of stroke.” |
| Overlay gap on opposite faces | **POLYCUT-C-002**. |

### Structural risks (Slice D)

- Dirty state exists only in `placedCanonicalRef` / `placedDisplayRef`. Any path that calls `enterEditCommitted` or `clearDraft` without `commitPoints` drops it (**D-001**, tool switch, Backspace-to-empty).
- Flatten correctness after Done is the existing materialize pipeline; Slice D only swaps `cutStrokes[id].points`. Island bugs that appear on **unedited** closed loops are Slice B, not D.

### Recommended next steps

This audit does **not** include a remediation implementation or a fix plan beyond the per-finding strategy notes. A separate agent should triage **D-001** / **D-002** (and optionally **D-003**) before Slice E. Manual QA should still walk the four-row table above on a real mesh.

---

## How to add a future audit

1. Run adversarial Vitest against the slice under review; leave source unchanged.
2. Insert a new `## Audit — <date> — <slice/title>` section **above** older audits (newest first).
3. Fill: Scope, Method, Test baseline, Executive summary, Findings table, per-finding detail, Structural risks, Recommended next steps.
4. Link characterizing tests under `src/logic/**/*.audit.test.ts` (or colocated `*.test.ts`).

---

## Audit — 2026-08-16 — Polyline cut Slice C (node drag)

**Status:** POLYCUT-C-001 remediated (no piercing overlay chord). Opposite-face surface walk still cannot leave the start face (documented).  
**Date:** 2026-08-16  
**Scope:** Slice C draft node drag (`beginNodeDrag` / `applyNodeDragHit` / `endNodeDrag`), marker capture, orbit gate, overlay retessellate via `tessellateDraftDisplayPath` / `tessellateSurfaceSegment`. Not Slice D.  
**ADR:** [0100](../../decisions/product/0100-freeform-cut-strokes.md)  
**Blueprint:** [polyline_cut_tool plan](../../../.cursor/plans/polyline_cut_tool_318885f7.plan.md)  
**Method:** Static review + characterizing Vitest. User report: intermittent line through the solid after Slice C; could not re-trigger by hand.  
**Characterizing tests:** [`src/logic/cuts/sliceC.polylineDrag.audit.test.ts`](../../../src/logic/cuts/sliceC.polylineDrag.audit.test.ts)

### Manual / triggered

| Observation | Finding |
|-------------|---------|
| Line through the model (hard to reproduce) | **POLYCUT-C-001** — overlay tessellate appended a straight 3D chord whenever the face-local walk failed (`pushDedupe(p1)`). Opposite cube faces: walk length 2 (no hops) → chord through the origin. Adjacent dihedral still tessellates on-surface (does not reproduce). |
| Drag / rubber-band to the far side of a solid | Same C-001; one-frame / one-gesture then hop succeeds on a nearer face → “can’t do it again.” |

### Remediation (2026-08-16)

| ID | Status | Fix summary |
|----|--------|-------------|
| POLYCUT-C-001 | **Resolved** | `tessellateSurfaceSegment` joins `p1` only if current and goal share an incident face (or walk reached `p1`). No volume chord on walk/locate fail. |
| POLYCUT-C-002 | Open | Face-local 2D clip cannot leave a face when the 3D goal projects inside that face (opposite cube faces). Overlay now **stops** (incomplete) instead of tunneling. Full geodesic around the shell is not in this slice. |
| POLYCUT-C-003 | Open (Low) | Closed draft: last duplicate marker sits on top of first; short-click close only if `index === 0`. |
| POLYCUT-010/011 | **Resolved** (Slice C gates) | `writePlacedTwin` + `pairClosedOnDragRef` |

### Executive summary

**Critical: 0.** User-visible through-model line is the old tessellate **chord fallback**, not a new drag Raycaster bug. It is intermittent because it needs a **failed** surface walk (opposite/far faces, off-surface locate) — adjacent-face drags stay on-surface. Freeze-on-fail removes the tunnel; opposite-face sparse segments still do not wrap around the solid.

**Verdict:** C-001 overlay tunnel fixed and regression-guarded. C-002 is remaining walk limitation (incomplete line, not a chord). C-003 optional.

### Findings table

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| POLYCUT-C-001 | **Medium** | Overlay / draft line chords through the volume when tessellate walk fails | **Resolved** — no piercing `p1` append |
| POLYCUT-C-002 | **Medium** | Opposite-face (and similar) segments do not tessellate around the shell | Open — freeze; geodesic later |
| POLYCUT-C-003 | **Low** | Closed-loop last marker occludes first; click may not close | Open |
| POLYCUT-010 | **Low** (gate) | Display/canonical twin write | **Resolved** — `writePlacedTwin` |
| POLYCUT-011 | **Low** (gate) | Closed 0 / n−1 pairing while dragging | **Resolved** — `pairClosedOnDragRef` |

### POLYCUT-C-001 — Tessellate fallback chord through the solid

- **Issue:** `tessellateSurfaceSegment` always appended `p1` after a failed walk (`if (!exit) break` then `pushDedupe(path, p1)`), and returned `[p0, p1]` when locate failed. On a cube, +Z interior → −Z interior produces a 2-point path through the origin. Same path is used for **drag retessellate** and **rubber-band tip**, so Slice C made the old POLYCUT-003 class visible again during node move / hover.
- **Severity:** Medium (preview/trust). Flatten still uses sparse clicks + materialize walk (separate).
- **Root cause:** Face-local 2D clip has no exit when the goal projects inside the current face (goal is “through” the volume). Fallback treated “cannot walk” as “draw the 3D chord.”
- **Fix:** Append `p1` only when it shares an incident face with the current sample (on-face join) or the walk reached `p1`. Off-surface / opposite-face → keep last on-surface point.
- **Tests:** `sliceC.polylineDrag.audit.test.ts` (cube opposite, drag +Z→−Z, rubber-band tip, interior goal); packing test that off-mesh points do not emit a segment.
- **Status:** Resolved (2026-08-16).

### POLYCUT-C-002 — Opposite-face walk does not wrap the shell

- **Issue:** After C-001, +Z→−Z tessellate stays on the start face (incomplete polyline). Markers still jump to the far hit; the line does not follow the surface around the cube.
- **Severity:** Medium (honest but incomplete overlay). Product may later want a geodesic / multi-face search that is not “project goal onto current plane.”
- **Status:** Open — characterized (`characterizes opposite-face walk…`).

### POLYCUT-C-003 — Closed stroke duplicate marker vs close click

- **Issue:** Marker-close duplicates first as last. Both spheres are pickable; the last is drawn later. `pointerup` calls `closeOnFirstMarkerClick` only when `index === 0` and the gesture did not move. A click on the stacked pair may hit `n−1` and neither close nor drag usefully.
- **Severity:** Low.
- **Strategy:** Treat `index === last` on a closed draft as close, or skip drawing the duplicate last marker.
- **Status:** Open.

### Recommended next steps

1. Manual: drag a node onto the **opposite** side of a cube — line must not tunnel; it may stop short (C-002). Drag across a **fold / adjacent faces** — line should hug the surface.
2. Slice D re-edit; optional geodesic for C-002; optional C-003.

---

## Audit — 2026-08-03 — Polyline cut Slice B (markers + closed rings → islands)

**Status:** Remediated (2026-08-03) — characterizing suite green; B-001/B-004/B-005 shipped; B-002 regression-guarded (fixtures pass).  
**Date:** 2026-08-03 (revised same day after exact manual QA)  
**Scope:** Slice B markers + first-vertex close; Flatten / island contract for closed rings; overlay chords. Not Slice C/D.  
**ADR:** [0100 — Freeform cut strokes](../../decisions/product/0100-freeform-cut-strokes.md)  
**Blueprint:** [`.cursor/plans/polyline_cut_tool_318885f7.plan.md`](../../../.cursor/plans/polyline_cut_tool_318885f7.plan.md)  
**Method:** Static + domain review; exact manual QA correction (single-tri OK / multi-tri fail).  
**Characterizing tests:** [`src/logic/cuts/polylineClosedLoop.audit.test.ts`](../../../src/logic/cuts/polylineClosedLoop.audit.test.ts) (P0-B01 / B02 / B02b / **B02c** / B03 + B-004).

### Remediation (2026-08-03)

| ID | Status | Fix summary |
|----|--------|-------------|
| POLYCUT-B-001 | **Resolved** | Sidebar label “Islands (base / edge seams)”; hint cuts apply on Flatten |
| POLYCUT-B-002 | **Resolved** | Face-local 2D surface walk in `findExitEdge` (was 3D chord proximity; missed dihedral edges). P0-B02c `foldedDihedralQuad` regression |
| POLYCUT-B-003 | **Resolved** | Overlay tessellates via `surfacePath.ts` (same face-local walk as materialize) |
| POLYCUT-B-004 | **Resolved** | Warn on gapped closed cycle / closed-no-island-increase |
| POLYCUT-B-005 | **Resolved** | Marker `depthTest={false}` |
| POLYCUT-B-006 | Deferred | Optional flash fix |
| POLYCUT-B-007 | Deferred | Digon min-3 |
| POLYCUT-B-008 | **Resolved** | Covered by audit test file |
| POLYCUT-B-009 | **Resolved** | Flatten card shows `flattenResult.islands.length` |

### Manual QA correction

| Observation | Finding |
|-------------|---------|
| Sidebar Islands never updates on loop close | **POLYCUT-B-001** — ADR-expected; UX labeling |
| Closed loop entirely inside one triangle → Flatten separates | Happy path (not a Flatten bug) |
| Closed loop spanning ≥2 triangles → no separation; 2D overlaps | **POLYCUT-B-002 High** — coplanar fixtures passed; dihedral (D20) failed until surface walk |
| Through-volume overlay chords | **POLYCUT-B-003** — **Resolved** (surface tessellation preview) |

### Executive summary

**Critical: 0.** B-002 remediated: `connectCut` exit-edge discovery now uses face-local 2D clip + plane projection (not Euclidean 3D chord proximity). Coplanar multi-face loops and 90° dihedral loops (`foldedDihedralQuad` / D20-class) regression-guarded. Overlay chords remain Medium trust (B-003).

**Verdict:** B-002 fixed in `cutSurfaceWalk.ts` / `materializeCutStrokes`; B-001/B-004/B-005/B-009 shipped; B-006/B-007 deferred.

### Findings count

| Severity | Open (audit) | Notes |
|----------|--------------|-------|
| Critical | 0 | — |
| High | 0 | B-002 resolved |
| Medium | 5 | B-001, B-003–B-006 |
| Low | 3 | B-007–B-009 |

### Findings table

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| POLYCUT-B-001 | **Medium** | Sidebar / session `islandCount` ignores `cutStrokes` | **Resolved** — label + Flatten-card count |
| POLYCUT-B-002 | **High** | Multi-tri closed loop: no Flatten split on dihedral meshes (D20); coplanar fixtures falsely green | **Resolved** — surface walk + P0-B02c |
| POLYCUT-B-003 | **Medium** | Overlay chords may tunnel through volume | **Resolved** — surface path preview |
| POLYCUT-B-004 | **Medium** | Closed-but-gapped seam cycle (quiet open-loop) | **Resolved** — warn |
| POLYCUT-B-005 | **Medium** | First-vertex marker hard to pick (`depthTest`) | **Resolved** — `depthTest={false}` |
| POLYCUT-B-006 | **Medium** | Marker spawn flash at origin | Deferred (optional) |
| POLYCUT-B-007 | **Low** | Digon close `A,B,A` allowed | Deferred |
| POLYCUT-B-008 | **Low** | No island/overlap Vitest for multi-face closed loops | **Resolved** — audit tests |
| POLYCUT-B-009 | **Low** | Post-Flatten sidebar still shows base islands | **Resolved** — Flatten-card count |

### POLYCUT-B-001 — Session / sidebar islands ignore cut strokes

- **Issue:** After marker-close → `addCutStroke`, sidebar Islands does not increase. Stats use base mesh + manual seams only (ADR 0100). Confirmed even when Flatten/2D correctly adds an island (single-triangle case).
- **Severity:** Medium (UX).
- **Root Cause & Proposed Strategy:** `computeSessionStats` never feeds `cutStrokes` into `partitionIslands`.

  **Fix:** Label Islands as base / edge-seam only; show Flatten island count on Flatten card when `flattenResult` exists. Do not live-materialize for sidebar preview.

  **Status:** Resolved (remediation).

### POLYCUT-B-002 — Multi-triangle closed loop fails Flatten split (+ overlaps)

- **Issue:** Closed loop inside one triangle Flatten-separates correctly. Closed loop spanning ≥2 triangles on **non-coplanar** meshes (e.g. D20 adjacent faces) subdivided but did not separate — coplanar fixtures (`unitQuad`, grid, cube face) passed.
- **Severity:** High.
- **Root Cause & Proposed Strategy:** `findExitEdge` used 3D segment–segment proximity (`bbox * 1e-4`). Across a dihedral, the straight chord tunnels through the solid and misses the shared edge → gapped seam cycle. Not primarily B-003 (overlay).

  **Fix:** Face-local 2D clip walk in [`cutSurfaceWalk.ts`](../../../src/logic/cuts/cutSurfaceWalk.ts): project goal onto each incident face plane, intersect in 2D, pick smallest forward exit. P0-B02c `foldedDihedralQuad` (90° hinge) regression.

  **Status:** Resolved (2026-08-06).

### POLYCUT-B-003 — Through-volume stroke overlay

- **Issue:** Viewer drew straight 3D chords between on-surface samples; could tunnel through solids across dihedrals.
- **Severity:** Medium (trust). Not primary B-002 cause.
- **Fix:** Display-only tessellation in [`surfacePath.ts`](../../../src/logic/cuts/surfacePath.ts) wired to [`CutStrokesOverlay`](../../../src/viewer/CutStrokesOverlay.tsx) and draft line via [`tessellateDraftDisplayPath`](../../../src/viewer/cutPolyline/tessellateDraftDisplayPath.ts). Storage stays sparse clicks.
- **Status:** Resolved (2026-08-06).

### POLYCUT-B-004 — Closed-but-gapped seam cycle

- **Issue:** Geometrically closed (`first≈last`) suppresses open-loop warnings while segments may skip/collapse → single island / overlaps without clear toast.
- **Severity:** Medium.
- **Fix:** Warn when a closed stroke leaves empty segment seams or does not increase derived island count.
- **Status:** Resolved (remediation).

### POLYCUT-B-005 — First marker pick occlusion

- **Issue:** Amber first marker with `depthTest` can be half-buried; click falls through to mesh → append instead of close.
- **Severity:** Medium.
- **Fix:** Marker `depthTest={false}`; keep `stopPropagation`.
- **Status:** Resolved (remediation).

### POLYCUT-B-006 / B-007 — Deferred

- B-006 marker flash at origin — optional / Slice C-friendly pool.
- B-007 digon close — Low; leave min length 2 for now.

### POLYCUT-B-008 / B-009

- B-008: coverage gap closed by characterizing tests.
- B-009: worsener of B-001; fixed with Flatten-card island count.

### Recommended next steps

1. Manual D20: closed loop on two adjacent faces → Flatten ≥2 islands; single-face loop still OK.
2. Continue blueprint Slice C→E.

---

## Audit — 2026-08-02 — Polyline cut Slice A (draft lifecycle)

**Status:** Remediated for required findings (2026-08-03).  
**Date:** 2026-08-02 (updated 2026-08-03)  
**Scope:** Click-to-place polyline draft (`cutPolyline/*`, `PickableMesh`, session wiring). Not freehand Slice 3 path.  
**ADR:** [0100](../../decisions/product/0100-freeform-cut-strokes.md)  
**Blueprint:** [polyline_cut_tool plan](../../../.cursor/plans/polyline_cut_tool_318885f7.plan.md)  
**Method:** Static SDET review + helper Vitest; product decisions locked then remediated.  
**Tests:** [`src/viewer/cutPolyline/cutPolylineHelpers.test.ts`](../../../src/viewer/cutPolyline/cutPolylineHelpers.test.ts)

### Locked decisions (remediation)

| Topic | Decision |
|-------|----------|
| Close-loop | Disable mesh Euclidean auto-close; restore via first-vertex marker (Slice B) |
| Overlay through-volume | **Resolved** (POLYCUT-003) — surface tessellation preview |
| modelScale mid-draft | Freeze slider while `cutDraftActive` |
| Esc dual handler | Deferred (POLYCUT-009 Low) |

### Executive summary

No Critical. High false-close / dblclick-close races mitigated by disabling mesh auto-close. Medium UX/input items 004–007 remediated. POLYCUT-003 overlay surface path shipped. Low 008–011 deferred / Slice C gates.

**Verdict:** Slice A draft path remediation-closed for required findings.

### Findings table

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| POLYCUT-001 | **High** | Display-space close radius false-close on thin meshes | **Resolved (mitigated)** — mesh auto-close off; marker close in B |
| POLYCUT-002 | **High** | Dblclick finalize races with close-loop commit | **Resolved (mitigated)** — no mesh close path |
| POLYCUT-003 | **Medium** | Overlay straight chords tunnel through solid | **Resolved** — surface tessellation |
| POLYCUT-004 | **Medium** | `pointerleave` clears pending click | **Resolved** — tip only |
| POLYCUT-005 | **Medium** | Done/Enter/dblclick &lt;2 points silent | **Resolved** — Done gated + toast |
| POLYCUT-006 | **Medium** | modelScale mid-draft visual desync | **Resolved** — scale frozen |
| POLYCUT-007 | **Medium** | Cap toast spam | **Resolved** — once per draft |
| POLYCUT-008 | **Low** | Rubber-band buffer realloc every move | Open (optional) |
| POLYCUT-009 | **Low** | Esc cancels draft and closes sidebar | Open (deferred) |
| POLYCUT-010 | **Low** | Display/canonical twin desync (Slice C) | Open — **Slice C gate** |
| POLYCUT-011 | **Low** | Closed endpoints 0/n−1 not paired under drag | Open — **Slice C gate** |

### Recommended next steps

Continue blueprint B→E; keep POLYCUT-010/011 as Slice C merge gates.

---

## Audit — 2026-07-28 — Phase 1 Slice 2: cut stroke state + Flatten wiring

**Status:** Remediated (2026-07-29) — STATE-S2-001–006 addressed; see [Remediation](#remediation-2026-07-29-slice-2).  
**Date:** 2026-07-28  
**Scope:** Slice 2 only — [`meshSessionStore`](../../../src/state/meshSessionStore.ts) cut-stroke CRUD / `patternRevision` / `flattenSnapshotKey`; [`flattenWithCutStrokes`](../../../src/logic/cuts/flattenWithCutStrokes.ts); static review of [`useFlattenExport`](../../../src/ui/useFlattenExport.ts) + [`useHomeSession`](../../../src/ui/hooks/useHomeSession.ts). No viewer draw tool (Slice 3). **No production code changes.**  
**ADR:** [0100 — Freeform cut strokes](../../decisions/product/0100-freeform-cut-strokes.md)  
**Plan:** [phase-1-freeform-cut-strokes.md](phase-1-freeform-cut-strokes.md)  
**Method:** Adversarial Vitest + static ADR/STATE contract review.  
**Characterizing tests:** [`src/state/meshSessionStore.audit.test.ts`](../../../src/state/meshSessionStore.audit.test.ts)  
**Test baseline (audit day):** audit file **17 tests — 2 failed, 15 passed**; baseline store + `flattenWithCutStrokes` tests still green.

### Remediation (2026-07-29 Slice 2)

| ID | Status | Fix summary |
|----|--------|-------------|
| STATE-S2-001 | **Resolved** | Deep-copy each `Vec3` on add/update via `cloneStrokePoints` |
| STATE-S2-002 | **Resolved** | Honor ADR 0100: `flattenSnapshotKey(load, rev, seamsContentKey)`; seam edits stale 2D |
| STATE-S2-003 | **Resolved** | `addCutStroke` replace-on-add (upsert by `id`) |
| STATE-S2-004 | **Resolved** | Collapse materialize warnings into one toast (`formatMaterializeWarningsToast`) |
| STATE-S2-005 | **Resolved** | Stroke CRUD no-ops when `session === null` |
| STATE-S2-006 | **Resolved** | Collapsed toast prioritizes open-loop via structured `openLoops` |

### Executive summary

Slice 2 correctly keeps the base `session.mesh` immutable, clears strokes on successful load, bumps `patternRevision` only on stroke CRUD (not seam toggles), and wires Flatten through `flattenWithCutStrokes` → materialize → unfold with materialize warnings toasted. Happy-path coverage is good.

Two defects need attention before Slice 3 draw UX:

1. **STATE-S2-001 (High):** `addCutStroke` / `updateCutStroke` only shallow-copy the points array — mutating `Vec3` fields after insert corrupts store overlay (and thus Flatten).
2. **STATE-S2-002 (High vs ADR / Medium vs PoC UX):** ADR 0100 requires the Flatten fingerprint to include **seams**; `flattenSnapshotKey(meshLoadVersion, patternRevision)` omits seams, preserving STATE-002 “stale pattern until re-Flatten.” Export/2D can disagree with live seam picks after a toggle.

Duplicate stroke ids are allowed and make `update`/`delete` ambiguous (Medium). Toast flooding on many materialize warnings is Low/Medium.

**Verdict (audit day):** Fix deep-copy before Slice 3 pointer sampling writes into the store. Resolve ADR vs STATE-002 fingerprint explicitly (amend ADR **or** include `seamsContentKey` in the snapshot key) before treating Flatten UX as ADR-complete.

**Verdict (post-remediation):** STATE-S2-001–006 closed; proceed to Slice 3 draw UX.

### Findings count

| Severity | Open (audit) | Open (now) | Notes |
|----------|--------------|------------|-------|
| Critical | 0 | 0 | — |
| High | 1–2 | **0** | STATE-S2-001–002 remediated |
| Medium | 2 | **0** | STATE-S2-003–004 remediated |
| Low | 2 | **0** | STATE-S2-005–006 remediated |

### Findings table

| ID | Severity | Issue | Evidence |
|----|----------|-------|----------|
| STATE-S2-001 | **High** | Shallow point copy — external `Vec3` mutation corrupts `cutStrokes` | Remediated — deep-copy regression green |
| STATE-S2-002 | **High** (ADR) | Flatten snapshot key omitted seams | Remediated — fingerprint includes `seamsContentKey` |
| STATE-S2-003 | **Medium** | Duplicate stroke `id`s allowed | Remediated — replace-on-add |
| STATE-S2-004 | **Medium** | Many `materializeWarnings` each call `notifyToast` | Remediated — single summary toast |
| STATE-S2-005 | **Low** | Strokes with `session === null` | Remediated — CRUD requires session |
| STATE-S2-006 | **Low** | `openLoops` unused in Flatten hook | Remediated — prioritizes open-loop in collapsed toast |

---

### STATE-S2-001 — Shallow `Vec3` copy in stroke CRUD

- **Issue:** After `addCutStroke` / `updateCutStroke`, mutating a caller-owned point’s `.x`/`.y`/`.z` changes the Zustand overlay. Slice 3 live drawing will hold mutable refs into in-progress polylines — high corruption risk at Flatten.
- **Severity:** High
- **Root Cause & Proposed Strategy:** Store does `{ ...stroke, points: [...stroke.points] }` (array clone, shared objects).

  **Fix:** Deep-copy points, e.g. `points.map((p) => ({ ...p }))` on add/update (and optionally freeze). Add regression tests from the audit file.

  **Status:** Resolved (2026-07-29).

---

### STATE-S2-002 — Flatten fingerprint omits seams (ADR vs STATE-002)

- **Issue:** ADR 0100: “Flatten fingerprint must include strokes + seams + `meshLoadVersion`.” Implementation keys snapshots by `meshLoadVersion:patternRevision` only. Seam toggles do not bump `patternRevision`, so after Flatten → toggle seam, the 2D panel/SVG still show the **previous** unfold until the user hits Flatten again.
- **Severity:** High against ADR; Medium if PoC STATE-002 “keep prior pattern visible” remains the product choice.
- **Root Cause & Proposed Strategy:** Intentional STATE-002 carryover; ADR text was not reconciled in Slice 2.

  **Fix applied:** Honor ADR — `flattenSnapshotKey(load, rev, seamsContentKey(seams))`. Stale panel clears when seams change. `meshLoadVersion` / `patternRevision` still not bumped on seam edits.

  **Status:** Resolved (2026-07-29).

---

### STATE-S2-003 — Duplicate stroke identities

- **Issue:** `addCutStroke` does not reject duplicate `id`. `updateCutStroke` updates the first match; `deleteCutStroke` removes **all** with that id.
- **Severity:** Medium
- **Root Cause & Proposed Strategy:** No uniqueness check.

  **Fix applied:** Replace-on-add (upsert by `id`).

  **Status:** Resolved (2026-07-29).

---

### STATE-S2-004 — Materialize warning toast spam / drop

- **Issue:** Each materialize warning becomes its own toast; store keeps only the last 4. Long strokes with many skipped segments can hide open-loop or self-intersect messages.
- **Severity:** Medium
- **Root Cause & Proposed Strategy:** 1:1 toast per warning string.

  **Fix applied:** Collapse into one summary toast via `formatMaterializeWarningsToast`.

  **Status:** Resolved (2026-07-29).

---

### STATE-S2-005 — Strokes without a session

- **Issue:** Overlay CRUD does not require `session`. Harmless today (Flatten no-ops without session; load clears strokes) but odd if UI exposes stroke actions pre-load.
- **Severity:** Low
- **Root Cause & Proposed Strategy:** Overlay is session-orthogonal by design.

  **Fix applied:** Store guard — stroke CRUD no-ops when `session === null`.

  **Status:** Resolved (2026-07-29).

---

### STATE-S2-006 — `openLoops` unused in Flatten hook

- **Issue:** `flattenWithCutStrokes` returns structured `openLoops`; `useFlattenExport` only iterates `materializeWarnings` (which already include open-loop text). Structured field is dead at the UI boundary.
- **Severity:** Low
- **Root Cause & Proposed Strategy:** Adequate for Phase 1 toasts; structured data unused.

  **Fix applied:** Collapsed toast prioritizes open-loop using structured `openLoops`.

  **Status:** Resolved (2026-07-29).

---

### What passed (confidence)

- Base mesh buffers unchanged after Flatten with/without strokes
- Successful load clears strokes + resets `patternRevision`; failed load preserves both
- Seam toggle / clearAllSeams do not bump `patternRevision` or `meshLoadVersion`
- Self-intersecting stroke surfaces warning and still unfolds
- Open-loop warnings propagate from materialize through `flattenWithCutStrokes`
- Multi-stroke Flatten completes without error
- Baseline Slice 2 unit tests remain green

### Structural / future-proofing

| Risk | Severity | Notes |
|------|----------|-------|
| Sync Flatten on main thread with materialize + unfold | Medium | ADR defers Worker; long strokes on dense meshes may hitch UI (watch after Slice 3) |
| Snapshot key ignores stroke **content** if revision not bumped | Low | All CRUD paths bump revision today; don’t add silent in-place point edits later |
| Quality overlay auto-enable keyed only by `meshLoadVersion` | Low | Stroke-only re-flatten still works via new snapshot; overlay state may feel sticky across pattern revisions |

### Recommended next steps

1. Proceed to Slice 3 draw UX (unique stroke ids at generation time).
2. Keep [`meshSessionStore.audit.test.ts`](../../../src/state/meshSessionStore.audit.test.ts) as regression gate.

### Audit hygiene

- Remediation edited production Slice 2 sources (store + Flatten hook + toast helper).
- Slice 1 audit remains below (remediated).

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

---

## Slice 3 — Viewer: draw tool + CutStrokesOverlay

**Date:** 2026-07-29  
**Scope:** `PickableMesh.tsx` (draw-tool pointer logic), `CutStrokesOverlay.tsx`, `InProgressCutStrokeLine.tsx`, `packCutStrokeDisplaySegments.ts`, `displayNormalization.ts` round-trip, `page.tsx` wiring.  
**Test file:** `src/viewer/slice3.audit.test.ts` (12 tests, all pass)

### Summary

Slice 3 is primarily React/R3F UI code. The testable pure-logic surface (`packCutStrokeDisplaySegments`, `displayToCanonical`/`canonicalToDisplay`) is **robust** — all adversarial tests pass including degenerate meshes, extreme scales, and zero-scale normalization. The static review of the React draw-tool identified several low-to-medium issues but **no critical or high-severity bugs**.

### Findings

#### VIEW-S3-001 — `appendSample` closes over stale `normalization`
| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Component** | `PickableMesh.tsx` line 77–96 |
| **Issue** | `appendSample` captures `normalization` in its closure. If the mesh is reloaded (new normalization) while a draw is in progress, the remaining samples will be converted with the old normalization. The `canonicalPoints` accumulated so far would be in a different coordinate frame from the new mesh. |
| **Root cause** | `normalization` is a `useMemo` dep of `appendSample` but `drawing.current` persists across re-renders. |
| **Risk** | Low in practice — mesh reload resets the Canvas via `key={sceneKey}` which unmounts `PickableMesh`, aborting any in-progress draw. Only a risk if `normalization` changes without remount (currently impossible). |
| **Strategy** | No fix needed now. If normalization ever becomes mutable mid-draw, store it in a ref that `appendSample` reads. |

#### VIEW-S3-002 — No feedback when `MAX_STROKE_POINTS` is hit
| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Component** | `PickableMesh.tsx` line 86 |
| **Issue** | When the user drags a very long stroke exceeding 512 samples, additional points are silently dropped. The polyline appears to "freeze" with no visual or auditory feedback. |
| **Root cause** | The `if (displayPoints.current.length >= MAX_STROKE_POINTS) return;` guard is silent. |
| **Strategy** | Optional UX: change cursor or line color when cap is reached. Low priority — 512 samples at MIN_SAMPLE_DIST of 0.015 display units covers a very long stroke. |

#### VIEW-S3-003 — `MIN_SAMPLE_DIST_SQ` is in display space, not canonical
| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Component** | `PickableMesh.tsx` line 19, 80–85 |
| **Issue** | The minimum distance between consecutive samples (0.015 display units) is fixed in display space. Since display normalization scales all meshes to a uniform radius, this is actually correct and scale-independent. No bug — documenting for clarity. |
| **Strategy** | None needed. |

#### VIEW-S3-004 — `pointerCapture` failure is swallowed silently
| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Component** | `PickableMesh.tsx` lines 116–118, 149–151 |
| **Issue** | `setPointerCapture` / `releasePointerCapture` failures are caught and ignored. If capture fails, the pointer can leave the mesh during drawing and the stroke commits short. |
| **Root cause** | Defensive try/catch for environments where capture is unsupported. |
| **Risk** | Minimal — the document-level `pointerup` listener (line 197–203) acts as a fallback and still commits the stroke. |
| **Strategy** | Acceptable as-is. |

#### VIEW-S3-005 — `onPointerMove` drops samples when pointer leaves mesh surface
| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Component** | `PickableMesh.tsx` line 134–135 |
| **Issue** | During `cut` drawing, if the pointer moves off the mesh surface (e.g., the user overshoots an edge), `e.faceIndex` is null and the sample is skipped. This creates a gap in the stroke. When the pointer re-enters the mesh, the next sample connects to the last valid sample with a straight line that may cut across empty space. |
| **Root cause** | R3F only fires `onPointerMove` with a faceIndex when the ray hits the mesh geometry. Off-mesh moves don't provide a hit point. |
| **Risk** | The materialization pass (`materializeCutStrokes`) will handle the off-surface segment by failing to locate those points (returning `kind: "none"`), so no topological corruption. But the drawn polyline may look misleading — the user sees a straight jump. |
| **Strategy** | Future UX: clamp the last sample to the mesh edge, or show a dashed line for off-mesh segments. Not a correctness issue. |

#### VIEW-S3-006 — `cutStrokeIdSeq` in page.tsx is not reset on mesh load
| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Component** | `app/page.tsx` line 111–113 |
| **Issue** | `cutStrokeIdSeq` is a `useRef` that increments forever across mesh loads. The ID format `cut-${meshLoadVersion}-${seq}` prevents collisions since `meshLoadVersion` differs per load, so this is cosmetic only — IDs like `cut-2-15` are fine. |
| **Strategy** | No fix needed. Optionally reset to 0 on mesh load for tidiness. |

#### VIEW-S3-007 — `CutStrokesOverlay` geometry disposal race
| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Component** | `CutStrokesOverlay.tsx` lines 31–33 |
| **Issue** | The cleanup effect disposes the geometry when `lineGeometry` changes. If React runs the cleanup after the new geometry is attached to the `<lineSegments>`, this is correct. React guarantees cleanup runs before the next effect, so this is safe. |
| **Strategy** | None needed — React lifecycle handles this correctly. |

#### VIEW-S3-008 — `InProgressCutStrokeLine` creates new `BufferAttribute` every `setPoints` call
| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Component** | `InProgressCutStrokeLine.tsx` lines 43–52 |
| **Issue** | Every pointer-move sample that passes the distance threshold creates a brand-new `Float32Array` and `BufferAttribute`. This generates garbage. For 512 max samples, this is at most 512 allocations during a single drag — trivial for modern GC but suboptimal. |
| **Strategy** | Optional optimization: pre-allocate a buffer of `MAX_STROKE_POINTS * 3` floats and use `setDrawRange` to control visible length. Low priority. |

### Test results

All 12 adversarial tests pass:
- `packCutStrokeDisplaySegments`: empty, degenerate, mixed, ordering, zero-scale, extreme large/small coordinates
- `display↔canonical round-trip`: large coords, tiny coords, zero-scale normalization
- Static constants sanity checks

### Verdict

**Slice 3 is clean.** No critical or high-severity issues. The two medium findings (VIEW-S3-001, VIEW-S3-005) are not correctness bugs — they're UX edge cases that the materialization layer already handles gracefully. The pure-logic packing and coordinate transform code is solid across all adversarial inputs.

### Remediation priority

| ID | Severity | Action |
|----|----------|--------|
| VIEW-S3-001 | Medium | No fix needed now (unmount prevents the scenario) |
| VIEW-S3-002 | Low | Optional UX polish |
| VIEW-S3-003 | Low | Documentation only (no bug) |
| VIEW-S3-004 | Low | Acceptable defensive code |
| VIEW-S3-005 | Medium | Future UX enhancement, not a correctness issue |
| VIEW-S3-006 | Low | Cosmetic only |
| VIEW-S3-007 | Low | React lifecycle handles correctly |
| VIEW-S3-008 | Low | Optional micro-optimization |

---

## Slice 4 — Docs + Cross-Slice Integration Audit

**Date:** 2026-07-29  
**Scope:** Full end-to-end audit across all 4 slices; docs verification; integration seams between logic → state → viewer → page.

### Docs verification (Slice 4)

- `docs/plans/product/phase-1-freeform-cut-strokes.md` exists, status is complete in `README.md`.
- `docs/plans/product/README.md` marks the phase as **Complete** with link to ADR 0100.
- ADR 0100 (`docs/decisions/product/0100-freeform-cut-strokes.md`) is present and up to date.
- No archive folder created yet (spec says "move to `product/archive/` if the folder grows") — acceptable for a single completed phase.
- `.cursor/plans/freeform_3d_cuts_466c5d0b.plan.md` still exists — per the plan's slice-4 todo it should be deleted/archived after promotion. **Minor doc hygiene issue.**

### Full test suite

**280 tests, 41 files, all passing.** Zero `TODO`/`FIXME`/`HACK` markers. Zero `as any` / `@ts-ignore` casts.

### Cross-slice integration analysis

#### XSLICE-001 — Data flow integrity: stroke → store → materialize → unfold ✅
| Field | Value |
|-------|-------|
| **Severity** | None (passing) |
| **Detail** | `PickableMesh.onPointerUp` → `onCutStrokeCommit` → `page.tsx` wraps in `{id, points}` → `addCutStroke` (deep-copies points) → `flattenWithCutStrokes` (materializes + unfolds). The chain is type-safe and deep-copy-protected per STATE-S2-001 fix. Verified by `meshSessionStore.audit.test.ts`. |

#### XSLICE-002 — Display↔canonical coordinate round-trip ✅
| Field | Value |
|-------|-------|
| **Severity** | None (passing) |
| **Detail** | `PickableMesh` records pointer hits in display space → `displayToCanonical` → stored as canonical `Vec3[]`. `CutStrokesOverlay` reads canonical → `canonicalToDisplay` for rendering. Round-trip verified by `displayNormalization.test.ts` + `slice3.audit.test.ts`. |

#### XSLICE-003 — Seam + cut flatten fingerprint ✅
| Field | Value |
|-------|-------|
| **Severity** | None (passing) |
| **Detail** | `flattenSnapshotKey` includes `seamsContentKey` (STATE-S2-002 fix). Seam toggles do not bump `meshLoadVersion`. Cut stroke edits bump `patternRevision`. All invariants verified by `meshSessionStore.audit.test.ts`. |

#### XSLICE-004 — Canvas remount on mesh load isolates draw state ✅
| Field | Value |
|-------|-------|
| **Severity** | None (passing) |
| **Detail** | `MeshViewport` uses `key={sceneKey}` where `sceneKey = mesh-${meshLoadVersion}`. Loading a new mesh unmounts the entire R3F tree, which discards any in-progress draw refs. This prevents VIEW-S3-001 (stale normalization) from ever triggering. |

#### XSLICE-005 — `.cursor/plans/` not cleaned up after promotion
| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Detail** | `.cursor/plans/freeform_3d_cuts_466c5d0b.plan.md` still exists after the plan was promoted to `docs/plans/product/`. Per the Slice 4 todo ("Archive phase-2-freeform-cut-strokes.md + promote plan from .cursor when active"), this file should be deleted or archived. No impact on functionality. |

### Summary

| Area | Status |
|------|--------|
| Slice 1 (geometry) | ✅ All 52 adversarial + 8 unit tests pass; remediations (CUT-001–010) verified |
| Slice 2 (state) | ✅ All 16 adversarial + 9 unit tests pass; remediations (STATE-S2-001–006) verified |
| Slice 3 (viewer) | ✅ All 12 adversarial + existing tests pass; 2 medium UX issues (no correctness bugs) |
| Slice 4 (docs) | ✅ Plan promoted, ADR present, README updated; minor hygiene: `.cursor/plans/` not deleted |
| Cross-slice integration | ✅ Data flow, coordinates, fingerprinting, and Canvas lifecycle are all sound |
| Full suite | **280/280 passing** |

### Verdict

**Phase 1 (Freeform Cut Strokes) is production-quality.** No critical, high, or medium-severity integration issues remain. The only outstanding items are UX polish (VIEW-S3-002 silent point cap, VIEW-S3-005 off-mesh gap display) and minor doc hygiene (XSLICE-005).

---

## Test suite consolidation (2026-07-29)

Adversarial cases from QA audit passes were merged into canonical Vitest files; `*.audit.test.ts` files were removed.

| Former audit file | Canonical home |
|-------------------|----------------|
| `materializeCutStrokes.audit.test.ts` | [`materializeCutStrokes.adversarial.test.ts`](../../../src/logic/cuts/materializeCutStrokes.adversarial.test.ts) + [`workingMesh.test.ts`](../../../src/logic/cuts/workingMesh.test.ts); shared helpers in `cutTestFixtures.ts` / `cutTestAssertions.ts` |
| `meshSessionStore.audit.test.ts` | [`meshSessionStore.test.ts`](../../../src/state/meshSessionStore.test.ts); flatten integration in [`flattenWithCutStrokes.test.ts`](../../../src/logic/cuts/flattenWithCutStrokes.test.ts) |
| `slice3.audit.test.ts` | [`packCutStrokeDisplaySegments.test.ts`](../../../src/viewer/packCutStrokeDisplaySegments.test.ts), [`displayNormalization.test.ts`](../../../src/viewer/displayNormalization.test.ts); draw sampling in [`cutDrawSampling.test.ts`](../../../src/viewer/cutDrawSampling.test.ts) |
