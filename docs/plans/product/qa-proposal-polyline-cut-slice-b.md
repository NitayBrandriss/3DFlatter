# QA proposal — Polyline cut tool Slice B (markers + closed rings → islands)

**Status:** Proposal / dialogue — findings severity assigned (static + domain review); **characterizing Vitest for island/chord bridge not written yet**; awaiting scope feedback.  
**Date:** 2026-08-03  
**Owner posture:** Staff SDET + domain (mesh flatten / Pepakura-style cuts)  
**Blueprint:** [`.cursor/plans/polyline_cut_tool_318885f7.plan.md`](../../../.cursor/plans/polyline_cut_tool_318885f7.plan.md) (Slice B **shipped**)  
**ADR:** [0100 — Freeform cut strokes](../../decisions/product/0100-freeform-cut-strokes.md)  
**Prior:** [qa-proposal-polyline-cut-tool.md](qa-proposal-polyline-cut-tool.md) (Slice A / POLYCUT-001–011)  
**Index:** Linked from [qa-audits.md](qa-audits.md)

**User-reported (this pass):**

1. Closing a ring with the polyline does **not** show / count as a new island.  
2. Drawn lines go **through** the shape instead of along surfaces (same class as POLYCUT-003; elevated here because marker-close encourages rings).

**User confirmation (2026-08-03):** Island failure is **both** — sidebar Islands unchanged (**POLYCUT-B-001**) **and** Flatten / 2D still does not treat the closed ring as a new island (**POLYCUT-B-002**). Not sidebar-only. Through-volume overlay (**POLYCUT-B-003**) remains in play as a likely input to B-002 (piercing chords → incomplete / wrong seam cycle).

---

## 0. Intent

Same posture as the Slice A proposal: deep risk analysis, strategic QA, extreme cases, dialogue — **not** test code yet. Findings use the [qa-audits.md](qa-audits.md) severity scale and Issue / Severity / Root Cause & Proposed Strategy format.

Slice B shipped marker visuals + **close via first-vertex marker**. This brief covers that surface **and** the Flatten / island contract users hit when they close a ring — which is mostly **logic + session stats**, not the amber sphere itself.

---

## 1. Scope under review

### In scope

| Layer | Files / contracts |
|-------|-------------------|
| Markers | `DraftVertexMarkers.tsx` (imperative positions; first marker pickable) |
| Close path | `closePolylineByDuplicatingFirst`, `closeOnFirstMarkerClick` |
| Session wiring | `CutPolylineSession` → markers + line sync |
| Island expectation | `computeSessionStats` / sidebar Islands vs Flatten `unfold.islands` |
| Cut → islands | `materializeCutStrokes` → seams → `partitionIslands` / `unfoldMesh` |
| Overlay chords | `InProgressPolylineLine`, `CutStrokesOverlay` (straight 3D segments) |

### Out of scope (do not pretend covered)

- Slice C node drag / orbit-on-grab  
- Slice D committed re-edit  
- Implementing surface-geodesic preview (product feature)

---

## 2. Deep analysis

### 2.1 Why “closed ring ≠ new island” in the sidebar (very likely)

Sidebar **Islands** comes from `computeSessionStats` → `partitionIslands(session.mesh, session.topology, session.seams)`.

- `session.mesh` is the **base** mesh (ADR 0100: unchanged while editing cuts).  
- `session.seams` are **manual edge-pick seams only**.  
- `cutStrokes` are an overlay; they are **not** fed into session island partition.

So after marker-close commits a closed `CutStroke`, **Islands in the sidebar will not increase**. That is consistent with ADR “base mesh unchanged until Flatten,” but it **violates user mental model**: “I closed a ring → I should see another island.”

Even **after Flatten**, the sidebar still shows base-mesh islands; the multi-island result lives in the **2D unfold** (`flattenResult`), not in `stats.islandCount`.

**Severity:** High for product trust if undocumented; Medium if intentional and Flatten 2D is the only island UI.

### 2.2 Why Flatten may still show one island after a “ring”

`partitionIslands` only splits when a **complete seam cut** disconnects the face dual graph. A closed polyline (`first≈last`) avoids the open-loop *warning*, but islands still require the materialized seam chain to form a **separating cycle**.

Failure modes that keep **one** island after Flatten:

| Mode | What happens |
|------|----------------|
| **Piercing chords** | Screen-space “ring” uses long straight segments through the volume; `connectCut` walks the **chord**, not the silhouette. Segments may skip, warn (`could not connect` / `not on mesh surface`), or seam the wrong faces → **incomplete cycle**. |
| **Sparse clicks around a solid** | Few points on opposite sides → chords tunnel (same as user report #2) → same incomplete/wrong seams. |
| **Self-intersect skip** | Whole-stroke reject → stroke skipped → zero new seams. |
| **Collapsed / snap** | Segments vanish under snap eps → gaps in the cycle. |
| **True open loop on closed shell** | If close failed (marker not used; Done on open path), ADR warns: may not split a closed shell. |

There is **no** adversarial test today that asserts `partitionIslands(...).length >= 2` (or `unfold.islands.length >= 2`) for a closed on-face loop on a multi-face mesh. Closed-loop tests check self-intersect / openLoops flags, not island count.

### 2.3 Overlay through volume vs materialize (causal link)

Viewer draws `THREE.Line` between samples (**POLYCUT-003**). Marker-close duplicates first as last — visually a closed polygon of **chords**, not a surface ribbon.

For Flatten, each segment still does **face-to-face chord walk** (ADR 0100). So:

- Overlay “through the shape” is **expected** for sparse rings.  
- That same geometry can make Flatten **fail to produce the island the overlay suggests**.

Treating #2 as “cosmetic only” understates risk when users close rings on solids.

### 2.4 Slice B marker / close mechanics

| Topic | Risk |
|-------|------|
| Close only via first marker | POLYCUT-001/002 remediations held; mesh near-first no longer auto-closes. Good. |
| `setPositions` → `setCount` | New sphere meshes mount; positions applied in `useLayoutEffect` — possible **one-frame flash at origin** when adding a vertex. |
| First marker larger + amber | Affordances OK; `depthTest: true` → marker half-buried in the surface can be **hard to hit** at grazing angles; click may fall through to mesh → **extra vertex** instead of close. |
| `stopPropagation` on first marker | Prevents place-on-mesh; good. Until Slice C, other markers are non-pickable. |
| Close with exactly 2 points | Builds digon `A,B,A` — odd topology; materialize may collapse or produce weak seams. |
| Twin arrays | Close path uses `closePolylineByDuplicatingFirst` (paired push) — sound for POLYCUT-010 until drag. |

### 2.5 Architectural cornering

- Users will judge Slice B “broken” if island UX is wrong — even when markers work.  
- Surface-following preview (future) would reduce piercing chords **and** false ring expectations together.  
- Optional: derived “preview island count” on Flatten-only is not enough if sidebar never updates.

---

## 3. Strategic QA proposal

### 3.1 Principles

1. Split **stats UX** (sidebar ignores cuts) from **Flatten topology** (did the closed stroke actually split?).  
2. Bridge tests: closed on-face loop on a **multi-triangle** mesh → `materialize` + `partitionIslands` / `flattenWithCutStrokes` island count.  
3. Adversarial: sparse “screen ring” on a cube (piercing chords) → expect warnings and/or **still 1 island** — characterize honesty.  
4. Marker tests stay pure where possible (`closePolylineByDuplicatingFirst` already); pointer/occlusion stays manual or light harness.  
5. Do not weaken island assertions to match piercing behavior — record findings.

### 3.2 Must-cover (P0)

| ID | Scenario | Why |
|----|----------|-----|
| P0-B01 | Sidebar / `computeSessionStats` island count unchanged after `addCutStroke` closed ring | Explains user report #1 without Flatten |
| P0-B02 | After Flatten, 2D/`unfold.islands` for a **dense on-face** closed loop on a quad/grid ≥ 2 islands | Proves happy-path domain contract |
| P0-B03 | Closed stroke via `closePolylineByDuplicatingFirst` → `first≈last` within snap → not open-loop | Marker-close → ADR closedness |
| P0-B04 | Sparse piercing “ring” on `unitCube` (few opposite-face points + close) → warnings and/or island count stays 1 | Links report #2 to Flatten |
| P0-B05 | Incomplete seam cycle (inject skipped segment warning path) → 1 island | Gaps don’t silently claim success |
| P0-B06 | Marker close with &lt;2 points → null + too-few feedback | Slice B UX |

### 3.3 P1

| ID | Scenario |
|----|----------|
| P1-B01 | Digon close `A,B,A` on a face — document island/seam outcome |
| P1-B02 | First-marker occlusion / miss → accidental mesh append (manual) |
| P1-B03 | Count change marker flash at origin (manual / visual) |
| P1-B04 | Self-intersecting closed click path skipped → toast; islands unchanged |
| P1-B05 | Sidebar copy: “Islands (edge seams)” vs “Cuts apply on Flatten” |

### 3.4 Non-goals (until decided)

- Pixel CI for cyan chords  
- Full geodesic preview implementation  
- Changing ADR so session mesh materializes live (architectural — ask first)

---

## 4. Extreme edge cases

### X1 — “Jordan ring” that is only a silhouette

User orbits so a cube looks like a hexagon, clicks around the **outline**, marker-closes. Overlay looks like a perfect ring; almost every chord **bores through the cube**. Flatten may warn, skip segments, and leave **one** island. User concludes “close ring is broken.” Root cause: **screen polygon ≠ surface cycle**.

### X2 — Sidebar lies after successful Flatten

User draws a correct on-face closed loop, Flatten produces two 2D islands, sidebar still says **Islands: 1**. Support/debug hell: “islands work in 2D but stats say 1.”

### X3 — Close succeeds, last chord collapses

Marker-close duplicates first; if the last user point already snapped near first, the final segment collapses under `eps` → gap in seam cycle → closed flag true (first≈last) but **no separating cycle** → 1 island, **no open-loop warning** (because geometrically closed). Silent wrong topology class.

---

## 5. Dialogue — decisions needed

1. **Island UX:** Keep sidebar = base+manual seams only (document + label), or show “cuts pending Flatten”, or compute a **preview** island count from a dry-run materialize (cost/ADR ask)?  
2. **Success criterion for closed rings:** Must Flatten 2D show ≥2 islands for on-face loops? What about rings spanning multiple faces along the surface?  
3. **Piercing chords:** Accept + educate (dense clicks), warn when segment length ≫ bbox feature size, or schedule surface-following stroke preview?  
4. **Silent closed-but-gapped (X3):** Treat as High defect if reproduced — add gap detection / warning when closed polyline’s seam graph isn’t a cycle?  
5. **Audit timing:** Characterizing tests for P0-B01/B02/B04 **now**, or after copy/UX decision in (1)?

---

## 6. Findings (static / domain review — Slice B + closed ring → islands)

**Status:** Open — static + ADR/domain review; island/chord bridge Vitest not run in this pass.  
**Severity scale:** Same as [qa-audits.md](qa-audits.md) — Critical / High / Medium / Low.

### Executive summary

**Critical: 0** (no proven crash / corrupt index buffer in this review).  

User confirmed island failure is **both** sidebar (**POLYCUT-B-001 High**) and Flatten/2D (**POLYCUT-B-002 High**). B-001 alone cannot explain the report; B-002 is an active domain defect class (closed ring does not separate islands after materialize), with through-volume chords (**POLYCUT-B-003**) a prime suspected cause when rings are sparse or silhouette-based. Marker UX issues remain Medium/Low.

**Verdict:** Prioritize characterizing **P0-B02** (dense on-face closed loop → expect ≥2 Flatten islands) and **P0-B04** (piercing cube ring → document actual island count + warnings). Fix or product-decide B-002 before treating Slice B as quality-closed; B-001 UX labeling remains required so stats stop lying even after B-002 is fixed.

### Findings count

| Severity | Open |
|----------|------|
| Critical | 0 |
| High | 2 |
| Medium | 4 |
| Low | 3 |

### Findings table

| ID | Severity | Issue | Evidence |
|----|----------|-------|----------|
| POLYCUT-B-001 | **High** | Sidebar / session `islandCount` ignores `cutStrokes` (closed ring never changes Islands) | `computeSessionStats` → base `session.seams` only; user report |
| POLYCUT-B-002 | **High** | Closed ring fails to split islands on Flatten/2D (user-confirmed; pierce/gap suspected) | User report; `connectCut` chord walk; no island-count tests for closed loops |
| POLYCUT-B-003 | **Medium** | Overlay (and committed stroke) draws straight chords through the volume | `InProgressPolylineLine` / `CutStrokesOverlay`; user report; elevates POLYCUT-003 |
| POLYCUT-B-004 | **Medium** | Closed polyline with collapsed last segment: closed flag, no open-loop warn, may not separate | `cutSegment` collapse skip + `first≈last` closed check (X3) |
| POLYCUT-B-005 | **Medium** | First-vertex marker hard to pick (depthTest / half-buried) → miss close, append instead | `DraftVertexMarkers` `depthTest`, sphere on surface |
| POLYCUT-B-006 | **Medium** | Marker count change may flash spheres at origin for a frame | `setCount` then `useLayoutEffect` positions |
| POLYCUT-B-007 | **Low** | Digon close `A,B,A` allowed (≥2 points) — weak / surprising seams | `closePolylineByDuplicatingFirst` min length 2 |
| POLYCUT-B-008 | **Low** | No Vitest asserts island count after closed on-face materialize | adversarial suite checks openLoops / self-intersect only |
| POLYCUT-B-009 | **Low** | After Flatten, sidebar still shows pre-cut islands (2D is source of truth) | same stats path as B-001; worsens confusion |

---

### POLYCUT-B-001 — Session / sidebar islands ignore cut strokes

- **Issue:** After closing a polyline ring (marker close → `addCutStroke`), sidebar **Islands** does not increase. Stats are derived only from the base mesh and **manual** seams. Cut strokes never enter `partitionIslands` in the session.
- **Severity:** High (user-facing contract / trust). Not a topology bug by itself if Flatten is correct.
- **Root Cause & Proposed Strategy:** ADR 0100 non-destructive overlay + `computeSessionStats` keyed on session mesh/seams only.

  **Strategy:** Product choose — (a) label Islands as “edge seams only; cuts apply on Flatten”, (b) show cut-stroke count + hint, (c) optional expensive dry-run materialize for preview count (ask before architecture). Characterizing test: add closed stroke → `computeSessionStats.islandCount` unchanged (P0-B01).

  **Status:** Open — **user-confirmed** (co-occurs with B-002). Awaiting §5 island UX.

---

### POLYCUT-B-002 — Closed ring may not create a new island on Flatten

- **Issue:** A user-closed ring (first duplicated as last) does not guarantee `unfold.islands.length >= 2`. **User-confirmed (2026-08-03):** after marker-close + Flatten, 2D still does not show a new island (co-occurs with B-001 sidebar). Piercing chords, skipped segments, or a gapped seam cycle leave the dual graph connected → still one island after Flatten.
- **Severity:** **High** (user-confirmed Flatten/2D non-split on closed ring; not hypothetical).
- **Root Cause & Proposed Strategy:** Materialize seams follow **3D chord walks**, not screen rings or geodesics; island split needs a complete separating seam cycle. Through-volume overlay (B-003) is a likely contributor. Test gap: no island-count assertion on closed loops.

  **Strategy:** Add P0-B02 happy path (dense on-face loop → ≥2 islands) and P0-B04 piercing cube ring characterization. Remediations depend on §5 (education vs preview vs gap detection / connectCut fixes).

  **Status:** Open — **user-confirmed** Flatten/2D still one island after closed ring (with B-001). Needs characterizing fixtures before blaming a specific `connectCut` path.

---

### POLYCUT-B-003 — Through-volume stroke overlay (ring workflows)

- **Issue:** Same as POLYCUT-003: consecutive points are on the surface; segments are straight chords that tunnel through the solid. Marker-close makes closed “rings” common, so the artifact is more visible and more often paired with island expectations.
- **Severity:** Medium (trust). Becomes input to **High** POLYCUT-B-002 when Flatten follows those chords.
- **Root Cause & Proposed Strategy:** Overlay uses polyline chords by design; ADR materialize also chord-walks (surface along the chord, not through empty space as a boolean carve — but the chord may leave the intended face path).

  **Strategy:** Document in Slice E; denser clicks; optional length warning; future surface preview. Do not “fix” overlay alone without island bridge tests.

  **Status:** Open — product stance in §5.

---

### POLYCUT-B-004 — Closed-but-gapped seam cycle (silent non-split)

- **Issue:** Stroke can be geometrically closed (`first≈last`) so open-loop validation is skipped, while one or more segments were skipped (collapse / connect failure). Result: no open-loop toast, still one island.
- **Severity:** Medium (High if common on marker-close near first).
- **Root Cause & Proposed Strategy:** Closedness is point-based; separability is seam-graph-based; no check that marked cut edges form a cycle separating faces.

  **Strategy:** Post-stroke validation: warn if closed stroke did not increase island count on derived mesh, or if any segment produced empty `edgeKeys`. Characterize with X3 fixture.

  **Status:** Open.

---

### POLYCUT-B-005 — First marker pick occlusion / fall-through

- **Issue:** Close requires clicking the amber first marker. With `depthTest` and the sphere centered on the surface, the handle can be partially occluded; the click may hit the mesh instead and **append** a point near the start rather than close.
- **Severity:** Medium
- **Root Cause & Proposed Strategy:** Pickable marker shares depth buffer with body mesh; no polygon offset / always-on-top affordance.

  **Strategy:** `depthTest={false}` or polygon offset / slight normal extrude for markers; keep `stopPropagation`. Manual QA.

  **Status:** Open.

---

### POLYCUT-B-006 — Marker spawn flash at origin

- **Issue:** When point count changes, React mounts new sphere meshes before layout positions them → possible brief flash at `(0,0,0)`.
- **Severity:** Medium (visual glitch)
- **Root Cause & Proposed Strategy:** Count-driven React children + imperative position in `useLayoutEffect`.

  **Strategy:** Object pool / InstancedMesh (Slice C-friendly); or hide until positioned (`visible=false` until first `setPositions`).

  **Status:** Open (optional).

---

### POLYCUT-B-007 — Digon close allowed

- **Issue:** Marker close with exactly two distinct points commits `A,B,A`. Surprising seams / possible collapse.
- **Severity:** Low
- **Root Cause & Proposed Strategy:** `closePolylineByDuplicatingFirst` only requires `length >= 2`.

  **Strategy:** Require ≥3 distinct points to close (triangle minimum), or warn.

  **Status:** Open.

---

### POLYCUT-B-008 — No island-count characterizing tests for closed loops

- **Issue:** Existing tests ensure closed polylines are not flagged open-loop / self-intersect; they do **not** assert island split.
- **Severity:** Low (coverage). Enables High escapes (B-002).
- **Root Cause & Proposed Strategy:** Phase 1 adversarial focus was snap/manifold/open-loop strings.

  **Strategy:** P0-B02 / P0-B04.

  **Status:** Open.

---

### POLYCUT-B-009 — Post-Flatten sidebar still shows base islands

- **Issue:** After a successful multi-island Flatten, sidebar Islands can still read `1` while the 2D view shows multiple islands. Reinforces POLYCUT-B-001 confusion.
- **Severity:** Low as duplicate of B-001; call out as **worsening factor**.
- **Root Cause & Proposed Strategy:** Flatten result not wired into `computeSessionStats`.

  **Strategy:** Same as B-001; or show flatten island count in Flatten card when `flattenResult` exists.

  **Status:** Open.

---

## 7. Recommended next step (after your feedback)

1. Lock §5 (especially island UX + piercing-chord policy).  
2. Agree P0-B01–B04 as the characterizing set.  
3. Run Vitest-only audit pass (no prod fixes); promote into dated section in [qa-audits.md](qa-audits.md).  
4. Remediate separately; keep Slice C gates (POLYCUT-010/011) independent unless close/drag interaction changes B-005.

---

*End of Slice B proposal. Waiting on feedback before writing tests or changing product code.*
