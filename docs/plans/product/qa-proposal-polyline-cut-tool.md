# QA proposal — Polyline cut tool (viewer draft lifecycle)

**Status:** Proposal / dialogue — findings severity assigned (static review); **characterizing tests not written yet**; awaiting scope feedback.  
**Date:** 2026-08-02  
**Owner posture:** Staff SDET + domain (mesh flatten / Pepakura-style cuts)  
**Blueprint:** [`.cursor/plans/polyline_cut_tool_318885f7.plan.md`](../../../.cursor/plans/polyline_cut_tool_318885f7.plan.md)  
**ADR:** [0100 — Freeform cut strokes](../../decisions/product/0100-freeform-cut-strokes.md)  
**Prior Phase 1 audits:** [qa-audits.md](qa-audits.md) (Slices 1–4; freehand draw era)  
**Index:** Linked from [qa-audits.md](qa-audits.md)

---

## 0. Intent of this document

This is **not** a rigid test checklist and **not** a completed audit with findings IDs.

It is a **quality ownership brief** for the new click-to-place polyline draft stack (Slice A shipped; B–E planned):

1. Deep risk analysis (what unit tests usually miss)
2. A high-value test strategy (what we must cover to be bulletproof)
3. Extreme failure modes worth arguing about
4. Open questions for product / eng before any Vitest or remediation

When we agree scope, a later pass should land as a dated `## Audit — …` section in [qa-audits.md](qa-audits.md) with characterizing tests — same rules as existing product audits (break the code; do not fix in the audit pass).

---

## 1. Scope under review

### In scope (current + imminent)

| Layer | Files / contracts |
|-------|-------------------|
| Pure helpers | `cutPolylineHelpers.ts`, `cutDrawSampling.ts` |
| Draft controller | `useCutPolylineDraft.ts` (idle / drafting only today) |
| Imperative GPU | `InProgressPolylineLine.tsx` (`setPlaced` / `setPreviewTip` / `updatePlacedVertex`) |
| Input | `PickableMesh.tsx` (click place, rubber-band tip, dblclick finalize) |
| Composition | `CutPolylineSession.tsx`, `MeshViewport.tsx`, sidebar Done/Cancel, page commit → `addCutStroke` |
| Contract with logic | Canonical `Vec3[]` polyline → Zustand → `materializeCutStrokes` on Flatten (already audited) |

### Explicitly deferred (call out, do not pretend covered)

- Slice B markers (visual)
- Slice C node drag + mesh Raycaster + orbit grab
- Slice D committed re-edit / `updateCutStroke`
- Surface-following **preview** of chords (overlay remains straight 3D segments by design)
- Touch / stylus / multi-pointer (unless we expand scope)

### What Phase 1 Slice 3 audit does **not** cover anymore

VIEW-S3-* assumed **freehand drag-sample → commit on pointer-up**. That path is gone. Cap toast (VIEW-S3-002) was partially addressed; rubber-band / close-loop / dblclick strip / orbit-while-draft are **new**.

---

## 2. Deep analysis — hidden risks

### 2.1 Domain: overlay chord ≠ surface cut

**Risk:** Users see a cyan line tunnel through the solid when consecutive clicks land on distant faces. Flatten still **chord-walks** the surface (ADR 0100). Overlay honesty and topological outcome can diverge sharply on concave meshes, thin shells, and opposite-side placements.

**Why tests miss it:** Pure packing tests only check buffer layout; materialize tests use hand-authored polylines that already “make sense.” No fixture asserts “visual chord through volume but Flatten seams lie on surface.”

**Severity if wrong Flatten:** High (wrong seams). **Severity if only misleading overlay:** Medium UX / trust.

### 2.2 Close-loop ball vs mesh thickness (false close)

`isClosedClick` uses a **fixed display-space Euclidean radius** (`CUT_POLYLINE_CLOSE_RADIUS = 0.06`) against the **first** vertex, checked **before** min-distance append.

Display normalization puts meshes near `SCENE_TARGET_RADIUS ≈ 1.5`, so 0.06 is ~4% of radius — reasonable on a sphere, **dangerous on thin sheets / folded paper-like models**: two surface points on opposite sides of a crease can fall inside the same 3D ball → accidental close + commit (`first` duplicated as last).

Also: close is **not** screen-space or geodesic. After orbit, a click that *looks* near the first marker on screen may hit a different face and either fail to close or close spuriously if that hit is near `first` in 3D.

### 2.3 Double-click vs close-loop gesture collision

Event order: `pointerup` (may **add** or **close-commit**) → … → `dblclick` → `finalizeFromDoubleClick` (strip last if `lastPointerUpAdded`, then finalize).

Failure modes:

| Sequence | Possible outcome |
|----------|------------------|
| ≥2 pts, second click of dblclick lands in close radius of first | **Close-loop commits** on the click; dblclick runs on empty draft → no-op. User thought “finalize open stroke,” got **closed** polyline. |
| Second click adds a point far from previous (min-dist ok) | Strip removes it; finalize keeps prior pts — intended. |
| Second click rejected (min-dist); `lastPointerUpAdded = false` | No strip; finalize includes all — intended. |
| Exactly 2 pts, dblclick with second click rejected | Finalize open digon — OK. |
| Enter / Done with 1 pt | Silent no-op (`canFinalizeDraft`) — easy to misread as “broken Done.” |

Helpers cover strip logic; **they do not cover the close-vs-dblclick product interaction**.

### 2.4 Pointer lifecycle races (silent missed clicks)

`PickableMesh`:

- `pointerleave` **clears** `pointerDown` (same as canceling a pending click).
- Document `pointerup` also clears `pointerDown`.
- Place only if drag ≤ 5px **and** `faceIndex != null` on `pointerup`.

Hidden UX bugs:

- Micro-jitter or R3F leave/re-enter across silhouette during a “click” → **no vertex**, no toast.
- Orbit drag correctly suppresses place (>5px); good. Accidental 6px twitch on trackpad → orbit starts, click lost — expected but harsh on precision pads.
- `cutDraftApiRef` is filled in `useEffect` after mount — theoretical first-frame null API (low practical risk).

### 2.5 React / Zustand boundary (coarse flags vs refs)

Invariant from the blueprint: **no per-move React/Zustand**. Slice A largely honors this (tip via imperative line). Remaining re-render hotspots:

- First vertex → `cutDraftActive` true → **page + sidebar** re-render (Done/Cancel appear). Acceptable; must not remount Canvas (`sceneKey` stable).
- Cap → `notifyToast` per capped click → toast spam if user hammers.
- Unmount cleanup sets `onDraftActiveChange(false)` — good; verify no **stuck Done/Cancel** after mesh reload (`Canvas` key remount) or tool switch.

`commitPoints` deep-clones before `onCommit` — aligns with STATE-S2-001. Display/canonical **twin arrays** must stay length-aligned forever; Slice C drag is the first real desync risk.

### 2.6 Imperative line / GC / scale

- `setPreviewTip` rebuilds a full `Float32Array` + `BufferAttribute` on **every** hover move while drafting → VIEW-S3-008 reincarnated at pointer rate (not just on place). Budget risk on low-end + long drafts, not correctness.
- `updatePlacedVertex` (Slice C path already present) updates attribute index but **does not** update the tip slot at `placed.length` if tip is active — drag+rubber-band interaction needs a contract test later.
- **`modelScale` mid-draft:** mesh and line both scale; stored points are mesh-local. Changing the sidebar scale slider while drafting can visually skew the rubber-band vs mesh without rewriting points — commit still “valid” in canonical space via current normalization, but **display** of in-progress line may disagree with hits until cancel. Rare, nasty.

### 2.7 Coordinate / pick fidelity

- Hits: `worldToLocal` on pickable mesh (includes `modelScale`). Canonical via `displayToCanonical(normalizationRef)`.
- Normalization is ref-refreshed (good vs VIEW-S3-001 stale closure). Canvas remount on load still isolates drafts.
- Non-manifold / overlapping faces: Three.js returns **first** ray hit — user may place on the wrong shell leaf; materialize then snaps/walks that leaf. Domain-known; still worth a “thin wall / nested” manual case.
- Min-distance and close-radius are **display** metrics (scale-normalized meshes → OK globally; see VIEW-S3-003). They are **not** geodesic on the surface.

### 2.8 Keyboard / a11y collisions

- Esc: draft `cancel` **and** sidebar close (`useSidebarState`) — both fire. Product-acceptable?
- Enter with 1 point: silent.
- Backspace/Delete while drafting: `preventDefault` globally (except input/textarea/select). Focus on non-editable chrome still undoes — good for viewport; surprising if user expects browser Back.
- No focus trap: Done in sidebar vs viewport keys — OK if documented.

### 2.9 Architectural cornering before B–E

| Upcoming | Risk if Slice A assumptions harden wrong |
|----------|------------------------------------------|
| B markers | Need sync on every `setPlaced` / undo / cancel; today only line syncs |
| C drag | Must update **both** display+canonical; orbit disable only while grab; closed stroke first/last twin |
| D re-edit | Overlay must hide editing id (plan risk: double geometry); finalize → `updateCutStroke` |
| Continue-from-node | Not in blueprint; append is always from **last** vertex — matches user ask for “choose node and continue” as a **gap**, not a regression |

---

## 3. Strategic QA proposal

### 3.1 Principles

1. **Separate “draft correctness” from “materialize correctness.”** Draft tests: gesture → canonical polyline shape. Flatten tests: already strong; add **bridge** cases where overlay-looking chords are intentional.
2. **Prefer pure reducers over R3F mounts.** Extract or drive `addPointFromHit` / finalize / close / strip through the helper surface + a thin harness around draft refs (or future pure `CutPolylineDraftSession` class). Full Canvas E2E is last resort.
3. **Characterize races with ordered synthetic events**, not flaky wall-clock dblclick in jsdom.
4. **One integration spine:** place → commit → store deep-copy → Flatten fingerprint bump — already green; re-assert after polyline replace of freehand.
5. **Manual matrix stays mandatory** for orbit + rubber-band + “through model” trust (domain visual).

### 3.2 Must-cover scenarios (proposed P0)

| ID | Scenario | Layer | Why bulletproof |
|----|----------|-------|-----------------|
| P0-01 | Finalize / Done / Enter require ≥2 points; 0–1 are no-ops | helpers + draft | Silent Done confusion |
| P0-02 | Min-distance reject does not set `lastPointerUpAdded` | draft | Dblclick strip correctness |
| P0-03 | Dblclick strip then finalize never keeps the second-click duplicate | helpers + draft | Plan acceptance |
| P0-04 | Close-loop (≥2 pts, hit in radius of first) appends `first` as last and commits once | draft | Closed stroke contract for materialize |
| P0-05 | Close-loop does not run when `placed.length < 2` | draft | Avoid accidental 1→close |
| P0-06 | Commit deep-copies points (mutate after commit ≠ store) | draft→page contract | STATE-S2-001 regression under new path |
| P0-07 | Cancel / Esc / leave cut tool clears line + `cutDraftActive` | draft + session | Stuck sidebar buttons |
| P0-08 | Mesh reload (`meshLoadVersion`) drops draft UI flag | integration / manual | Stuck Done after load |
| P0-09 | Cap at 512: no further append; toast path invoked (once policy TBD) | draft | VIEW-S3-002 successor |
| P0-10 | Display↔canonical twin lengths always match after add/undo/close | draft invariant | Slice C prerequisite |
| P0-11 | Flatten of a polyline drawn as long chord on a closed mesh: warnings/seams match ADR (open loop / skip), **no crash** | logic bridge + manual | Trust gap overlay vs Flatten |
| P0-12 | Orbit drag (>5px) does not place; click after orbit still appends | manual / optional pointer harness | User-verified; keep as regression note |

### 3.3 P1 (high value, after P0 or with Slice B/C)

| ID | Scenario |
|----|----------|
| P1-01 | Close-radius false positive on a **thin box / sheet** fixture (thickness ≪ 0.06 display) |
| P1-02 | Synthetic event order: close-commit on click that was meant as dblclick finalize |
| P1-03 | `modelScale` change mid-draft: document expected behavior; assert no NaN / no store corruption |
| P1-04 | Rubber-band: tip cleared off-mesh; tip never written to Zustand |
| P1-05 | `updatePlacedVertex` + active tip buffer layout (Slice C gate) |
| P1-06 | Toast spam at cap (N rapid clicks → ≤1 toast or debounced) |
| P1-07 | Self-intersecting click polyline: draft accepts; materialize warns/skips — UI expectation |

### 3.4 Explicit non-goals (until you say otherwise)

- Pixel-diff / screenshot CI for cyan overlay
- Full Playwright orbit on WebGL (costly, flaky)
- Rewriting materialize adversarial suite (already owned by Phase 1)
- Surface-geodesic preview implementation (product feature, not QA)

### 3.5 Suggested artifact layout (when approved)

| Artifact | Role |
|----------|------|
| Expand `cutPolylineHelpers.test.ts` | Close / strip / finalize gates / thin-sheet close false-positive |
| New `useCutPolylineDraft` pure harness or `cutPolylineDraftSession.ts` | P0 gesture sequences without Canvas |
| Bridge cases in `flattenWithCutStrokes.test.ts` or viewer→logic fixture | P0-11 |
| Dated section in `qa-audits.md` | Findings POLYCUT-### after adversarial run |
| Manual QA matrix (Slice E) | Orbit, through-volume overlay, Flatten trust |

---

## 4. Extreme edge cases (push the boundaries)

### X1 — “False wedding ring” close on a thin solid

Build a display-normalized **plate** whose thickness in display space is `≪ 0.06`. Place two vertices on the **top** face far apart, then click the **bottom** face under the first vertex (or a side face whose 3D point falls in the close ball). Draft may **auto-close and commit** a ring that jumps through the plate. Materialize then chord-walks a cut the user never meant to seal.

**Why it’s nasty:** Close-loop feels like a gift until thickness < close radius. No current test uses thickness as a first-class parameter.

### X2 — Double-click becomes “seal the loop”

User has an open path whose start is still under the cursor’s close ball after orbit (common on small islands). Intended: dblclick = finalize **open** stroke. Actual: second `pointerup` **close-commits** a loop; dblclick is irrelevant. Flatten treats a closed loop differently (open-loop warnings suppressed; island split behavior changes).

**Why it’s nasty:** Same gesture, opposite topology class (open slit vs closed cycle). Hard to see in unit tests that only call `finalizeFromDoubleClick` without a preceding `addPointFromHit` that triggers close.

### X3 — Scale slider during an active draft

User places 3 points, drags **Model scale** in the sidebar, continues clicking. Hits remain consistent in mesh local space; the imperative line’s `scale` updates; rubber-band can look **detached** from the mesh silhouette. User “corrects” with extra points that are fine in canonical space but densify a stroke that looked wrong. Flatten “works”; trust dies.

**Why it’s nasty:** No crash, no failed assert in store tests — pure **human/system visual desync**. Classic silent quality killer in 3D tools.

### Honorable mentions

- Cap toast storm while clicking the same spot at 512.
- Esc closes sidebar **and** nukes a 200-point draft with no confirm.
- First/last identity for closed strokes when Slice C drags vertex 0 (plan already flags; gate test before C ships).

---

## 5. Dialogue — decisions needed from you

Please react with preferences (even rough):

1. **Close-loop policy:** Keep Euclidean display ball? Switch to screen-space px? Require explicit “close” only via clicking a future first-vertex marker (Slice B)? Disable auto-close until B?
2. **Dblclick vs close:** If both could fire, which wins — prefer open finalize (strip + finalize, never close on the dblclick’s pointerup) or prefer close?
3. **Overlay through-volume:** Accept as known (document in Slice E QA) vs schedule surface-preview later vs warn when segment chord length ≫ surface estimate?
4. **modelScale mid-draft:** Ignore / cancel draft on scale change / freeze scale while `cutDraftActive`?
5. **Esc:** Cancel draft only / cancel + confirm if ≥N points / leave sidebar Esc alone when drafting?
6. **Audit timing:** Run adversarial Vitest **now on Slice A only**, or wait until **B (markers)** so close/marker intent is stable?
7. **Harness style:** Extract pure `CutPolylineDraftSession` for testability, or keep hook + helper tests only?

---

## 6. Findings (static review — Slice A polyline draft)

**Status:** Open — static code + domain review; characterizing Vitest not run yet.  
**Method:** Staff SDET review of `cutPolyline/*`, `PickableMesh`, session wiring vs ADR 0100 + polyline blueprint. No production fixes in this pass.  
**Severity scale:** Same as [qa-audits.md](qa-audits.md) — Critical / High / Medium / Low.

### Executive summary

No **Critical** defect found in the draft path itself (no crash or proven mesh corruption at commit time). Two **High** issues can flip a stroke between **open slit** and **closed loop**, which changes Flatten / island semantics under ADR 0100. Several **Medium** items are UX/trust or silent-input failures. **Low** items are perf, toast hygiene, and preventive Slice C gates.

**Verdict:** Do not treat Slice A as audit-closed until POLYCUT-001/002 product rules are decided and characterized. Overlay-through-volume (POLYCUT-003) is expected chord rendering, not a materialize bug — still Medium for user trust.

### Findings count

| Severity | Open |
|----------|------|
| Critical | 0 |
| High | 2 |
| Medium | 5 |
| Low | 4 |

### Findings table

| ID | Severity | Issue | Evidence |
|----|----------|-------|----------|
| POLYCUT-001 | **High** | Fixed display-space close radius can false-close on thin meshes | `isClosedClick` + `CUT_POLYLINE_CLOSE_RADIUS = 0.06` before min-distance in `addPointFromHit` |
| POLYCUT-002 | **High** | Dblclick finalize can race with close-loop commit on the same click | `pointerup` → close/add then `onDoubleClick` → `finalizeFromDoubleClick` |
| POLYCUT-003 | **Medium** | Overlay draws straight chords that tunnel through the solid | `InProgressPolylineLine` / `CutStrokesOverlay` `THREE.Line` segments; user-reported |
| POLYCUT-004 | **Medium** | `pointerleave` clears pending click → silent missed vertex | `PickableMesh` `onPointerLeave` → `clearPointerDown()` |
| POLYCUT-005 | **Medium** | Done / Enter / dblclick with &lt;2 points fail silently | `canFinalizeDraft` / `finalize` return `null`; no toast |
| POLYCUT-006 | **Medium** | `modelScale` change mid-draft desyncs rubber-band vs mesh visually | Mesh + line both `scale={modelScale}`; points stay in prior local frame |
| POLYCUT-007 | **Medium** | Cap (512) toast can fire per rejected click (spam / hide other toasts) | `onPointCapReached` on every capped `addPointFromHit` |
| POLYCUT-008 | **Low** | Rubber-band `setPreviewTip` reallocates `BufferAttribute` every move | `InProgressPolylineLine.rebuild` |
| POLYCUT-009 | **Low** | Esc cancels draft and closes sidebar with no confirm | Dual `keydown` listeners (draft + `useSidebarState`) |
| POLYCUT-010 | **Low** | Display/canonical twin desync risk when Slice C lands | Two parallel refs; only paired updates today |
| POLYCUT-011 | **Low** | Closed-stroke endpoint 0 / n−1 not kept in sync yet | Blueprint Slice C; no drag path in A |

---

### POLYCUT-001 — Thin-mesh false close (Euclidean close ball)

- **Issue:** With ≥2 placed points, a click within display distance `0.06` of the **first** vertex auto-appends a duplicate of `first` and **commits a closed stroke**. On thin plates / folded sheets (thickness ≪ 0.06 in display space), a hit on the opposite side of the solid can lie inside that ball and seal a loop the user did not intend. Closed vs open changes Flatten open-loop warnings and island-split behavior.
- **Severity:** High
- **Root Cause & Proposed Strategy:** `addPointFromHit` runs `isClosedClick` **before** `shouldAppendCutSample`, using a fixed 3D Euclidean radius in display space (not screen-space, not geodesic, not thickness-aware).

  **Strategy:** Product choose one — (a) disable auto-close until first-vertex marker (Slice B), (b) screen-space px threshold + front-face consistency check, (c) scale close radius by local feature size / forbid close when chord would pierce (ray or winding heuristic). Characterize with a thin-box fixture before remediation.

  **Status:** Open — awaiting §5 close-loop policy.

---

### POLYCUT-002 — Double-click vs close-loop gesture collision

- **Issue:** The second `pointerup` of a double-click can **close-loop commit** if that hit is near the first vertex. `dblclick` then runs on an empty draft. User intent “finalize **open** stroke” becomes “commit **closed** stroke,” flipping topology class silently.
- **Severity:** High
- **Root Cause & Proposed Strategy:** Close handling and dblclick finalize are independent; close wins on `pointerup` before `finalizeFromDoubleClick` can strip/finalize open.

  **Strategy:** Decide winner in §5 — e.g. suppress close when a dblclick is plausible (timer / `detail`), or never close on the click that pairs with dblclick (prefer open finalize). Add ordered synthetic-event characterizing test (P0/P1-02).

  **Status:** Open — awaiting §5 dblclick vs close.

---

### POLYCUT-003 — Overlay chord tunnels through the model

- **Issue:** Consecutive click points lie on the surface, but the viewer connects them with a **straight 3D segment**. On concave or opposite-face paths the cyan line appears to pass through the volume. Flatten still chord-walks the surface (ADR 0100); overlay and derived seams can disagree visually.
- **Severity:** Medium (trust / UX). Not High unless Flatten seams are wrong for the same polyline (that would be a materialize finding, separate).
- **Root Cause & Proposed Strategy:** By design, draft and committed overlays use `Line` / packed segments between samples; no surface-projected preview.

  **Strategy:** Document as known in Slice E QA; optional later surface-preview or warn when segment length ≫ estimated surface path. Bridge Flatten tests for long chords (P0-11) to prove topology, not pixels.

  **Status:** Open — product stance in §5.

---

### POLYCUT-004 — Silent missed place on `pointerleave`

- **Issue:** `onPointerLeave` clears `pointerDown`. A click that briefly leaves the mesh silhouette (or R3F leave/re-enter across the contour) never reaches `addPointFromHit` — no vertex, no feedback.
- **Severity:** Medium
- **Root Cause & Proposed Strategy:** Pending-click state is tied to staying on the mesh hit target; leave is treated as cancel.

  **Strategy:** Clear tip on leave but keep `pointerDown` until `pointerup`/`pointercancel`; or use document-level up with last-hit cache. Manual + optional pointer harness.

  **Status:** Open.

---

### POLYCUT-005 — Silent no-op finalize (&lt;2 points)

- **Issue:** Done, Enter, and dblclick-finalize with fewer than 2 points return `null` with no toast or UI cue. Easy to read as “Done is broken.”
- **Severity:** Medium
- **Root Cause & Proposed Strategy:** `canFinalizeDraft` gate only; no user-visible feedback path.

  **Strategy:** Toast or disable Done until `cutDraftActive && pointCount >= 2` (requires exposing count or a `canFinalize` flag).

  **Status:** Open.

---

### POLYCUT-006 — `modelScale` mid-draft visual desync

- **Issue:** Changing the sidebar model scale while a draft is active scales both mesh and in-progress line; stored display points are not rewritten. Rubber-band / placed line can look detached from the mesh while further clicks still write consistent mesh-local samples. No store corruption observed; trust and density of “correction” clicks suffer.
- **Severity:** Medium
- **Root Cause & Proposed Strategy:** `modelScale` is a live render prop independent of draft refs.

  **Strategy:** Freeze scale while `cutDraftActive`, or cancel draft on scale change, or re-sync line after scale (document choice in §5).

  **Status:** Open — awaiting §5.

---

### POLYCUT-007 — Point-cap toast spam

- **Issue:** Every capped `addPointFromHit` calls `onPointCapReached` → warning toast. Rapid clicks at 512 flood the toast stack (store keeps last 4) and can hide other warnings.
- **Severity:** Medium
- **Root Cause & Proposed Strategy:** No debounce / once-per-draft guard (improves VIEW-S3-002 silence, overshoots into spam).

  **Strategy:** Toast once per draft session when cap first hit; optional line color change.

  **Status:** Open.

---

### POLYCUT-008 — Rubber-band buffer reallocation every move

- **Issue:** `setPreviewTip` rebuilds a new `Float32Array` / `BufferAttribute` on each hover move while drafting. Correctness unaffected; GC churn at pointer rate.
- **Severity:** Low
- **Root Cause & Proposed Strategy:** Same pattern as former VIEW-S3-008; tip path is hotter than place-only.

  **Strategy:** Preallocate max buffer + `setDrawRange` / in-place attribute updates (Slice C hot path should share this).

  **Status:** Open (optional).

---

### POLYCUT-009 — Esc cancels draft and closes sidebar

- **Issue:** Escape runs draft `cancel` and sidebar close with no “discard N points?” confirm. Large drafts can be lost while also collapsing chrome.
- **Severity:** Low
- **Root Cause & Proposed Strategy:** Independent window/document key listeners; both handle Escape.

  **Strategy:** When `cutDraftActive`, consume Esc for draft only; or confirm if `placed.length >= N`.

  **Status:** Open — awaiting §5.

---

### POLYCUT-010 — Display / canonical twin desync (Slice C gate)

- **Issue:** Draft truth lives in two parallel arrays (`placedDisplayRef` / `placedCanonicalRef`). Slice A always updates them together; node drag (Slice C) can desync if one side is updated alone → wrong Flatten coords vs overlay.
- **Severity:** Low **today** (no drag). Treat as **High gate** before merging Slice C if untested.
- **Root Cause & Proposed Strategy:** Dual-array design without a single write API.

  **Strategy:** One `setVertex(i, display, norm)` helper; invariant assert length+pairing in tests (P0-10).

  **Status:** Open (preventive).

---

### POLYCUT-011 — Closed stroke endpoints not paired under drag

- **Issue:** Blueprint requires dragging vertex `0` to update duplicate last (and vice versa) for closed drafts. Slice A has no drag; when C ships without this, close detection / materialize closedness can break after edit.
- **Severity:** Low **today**. **High gate** for Slice C.
- **Root Cause & Proposed Strategy:** Not implemented yet; plan already flags the risk.

  **Strategy:** Characterizing test before C merge; implement paired update in `moveNodeDrag`.

  **Status:** Open (preventive / Slice C).

---

## 7. Recommended next step (after your feedback)

1. Lock answers to §5 (even “defer”) — especially POLYCUT-001/002/003/006/009.
2. Agree P0 set (trim or extend §3.2).
3. **Then** implement characterizing tests only — no production fixes in that pass.
4. Promote this findings block into a dated `## Audit — …` section in [qa-audits.md](qa-audits.md) once tests exist (or mark “static-only”).
5. Remediation slice(s) separately; continue blueprint B→E with POLYCUT-010/011 as merge gates.

---

*End of proposal. Waiting on feedback before writing tests or changing product code.*
