# QA audit — P2-E2 Slice 2 (isolation state)

**Status:** Filed 2026-09-27 — no Critical/High. Medium findings open. Slice 3 is not blocked by severity. Do not check the Slice 2 Done box until [Decision queue](#decision-queue) D1–D2 are accepted or explicitly waived.  
**Date:** 2026-09-27  
**Scope:** `src/state/meshSessionStore.ts`, `src/state/meshEditTool.ts`, `src/state/meshSessionStore.isolation.adversarial.test.ts`, `src/ui/useFlattenExport.ts` (snapshot key only). No production or test edits in this pass.  
**ADR:** [0101 — Mesh isolation](../../decisions/product/0101-mesh-isolation.md)  
**Plan:** [epic-mesh-isolation.md](epic-mesh-isolation.md) Slice 2  
**Index:** [qa-audits.md](qa-audits.md#audit--2026-09-27--p2-e2-slice-2-isolation-state)  
**Method:** Static review of the Zustand overlay, confirm predicate, flatten fingerprint, and colocated Vitest. Fixtures and assertions are evidence, not proof. Slice 1 flood/fence geometry was not re-audited.

**IDs:** `ISO-S2-*`. Do not confuse with deferred product items **ISO-001…004**.

**Test baseline (this pass):** `vitest run src/state/meshSessionStore.isolation.adversarial.test.ts src/state/meshSessionStore.test.ts` — **2 files, 36 passed** (adversarial file: 11). Green is real for the oracles below; it does not cover the Medium gaps.

---

## Verdict

**Not proven** for the full ADR 0101 session contract. **Proven** for the Slice 2 geometric oracles the plan listed, at fixture scale (max 48 triangles).

The canonical path is not a Slice 1-style tautology. A vertex-ring arm seed asserts the exact face set (bands 1–2 on `openTube(5, 6)`). That assertion fails if fence `EdgeKey`s are dropped, if walked faces are passed as blockers, or if `confirmIsolation` never sets `active`. Incomplete-bracelet and mesh-minus-scar tests fail if confirm treats “every mask bit set” as the only refuse rule. Add/subtract asserts exact unions. Branched-arm bits are an exact complement against torso and the proximal arm band. Load clear / failed-load preserve, and `meshLoadVersion` / `patternRevision` pins, are real.

What this green run does not prove:

- The stored `coversAllNonOrphanFaces` flag matches whether confirm will accept the **combined** mask.
- An already-active isolate survives a later flood whose combined mask is not a legal isolate.
- Seams and stroke fences are both applied on the same flood.
- Ghost-side seams survive `clearAllSeams` / `toggleSeamAt` while `isolation.active`.
- Fence warning strings are kept (only a flood non-manifold warning is pinned).
- `isolationContentKey` is bit-identity rather than a popcount (the shipped function is bit-identity; the ablation test would still pass a popcount key).
- `useFlattenExport` actually receives that key (static wiring does; there is no hook test).
- Seed-click or confirm latency on an ~84k-tri mesh.

---

## Findings count

| Severity | Open | Notes |
|----------|------|-------|
| Critical | 0 | No `EdgeKey` remap, no cloned sub-mesh, no topology throw on this slice |
| High | 0 | Plan oracles for band / scar / versions / load are pinned |
| Medium | 4 | ISO-S2-001…004 |
| Low | 3 | ISO-S2-005…007 |

---

## Findings table

| ID | Severity | Issue | Why tests miss it | Proposed characterizing test |
|----|----------|-------|-------------------|------------------------------|
| ISO-S2-001 | **Medium** | `coversAllNonOrphanFaces` is the **last flood**, not the combined mask. Shift-add of every fenced region leaves the flag false while `confirmIsolation()` returns false. If that union happens while `active`, the flood path also forces `active` false. | Every refuse test uses one flood that already sets the flag true (incomplete ring, or a 1-point scar). No test unions three bracelet regions. | Two ring bracelets on `openTube(5, 6)`. `replace` band 0, `add` the arm (bands 1–2), `add` band 3. Oracle: mask bits all 1, `coversAllNonOrphanFaces === false`, `confirmIsolation() === false`, `active === false`, versions unchanged. |
| ISO-S2-002 | **Medium** | A blocked `applyIsolationFlood` **replaces** the mask and clears `active`. `confirmIsolation` on a blocked mask keeps the previous bits and only clears `active`. A confirmed arm is destroyed by a later whole-mesh flood. A later approximate stroke whose fallback blockers cover the ghost can also make confirm deactivate that arm. | Tests start from `active: false`. None confirm, then flood again. None add strokes between confirm and a second confirm. | Confirm the arm band (`active === true`, bits = bands 1–2). Clear strokes, `replace`-seed any face. Pin the chosen policy (D2): either the arm bits and `active` stay, or the mask becomes every face and `active` is false. Second case: arm still active, inject a zero-exit stroke whose `blockerFaces` equal the unmasked faces, call `confirmIsolation`. Today this returns false and clears `active` without editing bits. |
| ISO-S2-003 | **Medium** | Seams and stroke fences are never applied together. The suite stays green if seams are omitted whenever `cutStrokes.length > 0`, and if fences are omitted whenever any seam is set. | Bracelet tests use strokes and an empty registry. The seam-loop test uses a registry and no strokes. | `openTube(5, 6)`: seam cycle `tubeCircumferentialLoop(1)` **and** `tubeRingBraceletStroke` at ring 3. Seed band 0. Oracle: mask === band 0 only. Ablation note in the test name: seams-only would also include band 1; fences-only would include bands 0–2. |
| ISO-S2-004 | **Medium** | `toggleSeamAt` and `clearAllSeams` ignore `isolation.active`. ADR 0101: while isolated, toggle and clear touch only edges incident to a masked face; ghost-side seams stay in the registry. | Store seam tests never set a mask. The isolation file never calls seam actions. No UI sets `active` yet, so this is latent until Slice 4/5. | Confirm an arm mask. Registry holds one edge on the arm and one edge on band 0 only. `clearAllSeams`. Oracle under ADR: the band-0 key remains, the arm key is gone. `toggleSeamAt` on the ghost key does not add it. This test is **red** on current code. |
| ISO-S2-005 | **Low** | Fence diagnostics are not pinned. Dropping `...fence.warnings` stays green. An invalid or orphan seed returns before `set`, so a previous warning list is left in place and the new fence warning is discarded. | The only warning assertion is `/non-manifold/i` from `floodFromFace`. The scar test checks blockers and confirm, not the approximate-fence string. | 1-point (or other zero-exit) stroke, seed a non-blocker. Oracle: `warnings` contains `fence is approximate`. Then `applyIsolationFlood(-1, "replace")`: document whether the overlay is unchanged (current) or records an invalid-seed warning. |
| ISO-S2-006 | **Low** | Snapshot ablation does not lock bit identity. `isolationContentKey` writes every bit (reviewed). A popcount key (`active` + `countMaskedFaces`) still passes the existing test. `expect(flattenSnapshotKey(...)).toBe(withMasked)` compares a call to itself. The hook is unwired from Vitest. | Samples are `0000`, `1000`, and `1000` with `active`. Same weight never appears twice. | `isolationContentKey(false, [1,0,0,0])` !== `isolationContentKey(false, [0,1,0,0])`, same `active`, equal popcount. Hook: static check only — `useHomeSession` passes `isolationContentKey(active, mask)` into `useFlattenExport`, and both snapshot sites pass that argument through `flattenSnapshotKey`. |
| ISO-S2-007 | **Low** | `confirmIsolation` always calls `fenceEdgesFromStrokes` again. `isolationContentKey` rebuilds an O(faceCount) string on every `useHomeSession` render (`bits +=` per face). | Fixtures are ≤48 faces. Plan already marks 84k seed latency unproven. | No dense Vitest. Manual: two bracelets on the gitignored avatar, seed then Isolate, note hitch. Optional cache: reuse the last fence result until `cutStrokes` or mesh identity changes. |

---

## Fixture table

| Fixture | Faces | Topology | Claim it actually supports |
|---------|------:|----------|----------------------------|
| `openTube(5, 6)` + two `tubeRingBraceletStroke` (rings 1 and 3) | 48 | Single open prism, 4 bands × 12 tris. Vertex-ring fences, not a torso. | Exact mask === bands 1–2; confirm sets `active`; exit keeps bits; versions stay 7 / 4; snapshot key changes when `active` flips; same `session.mesh` reference. |
| Same tube + `tubeIncompleteRingStroke` (ring 2, one side omitted) | 48 | Gapped circumferential cycle; flood wraps. | `coversAllNonOrphanFaces`; `confirmIsolation() === false`; `active` stays false. Does not assert the mask face set (the refuse helper still requires mask ∪ blockers to cover every non-orphan, or the confirm expectation fails). |
| Same tube + 1-point scar at a vertex | 48 | Zero-exit stroke; `blockerFaces` is a proper subset. | Confirm refuses mesh-minus-scar. Mask omits blocker faces and is shorter than `faceCount`. **Not** inserted through `addCutStroke` (that API rejects `points.length < 2`). |
| Same tube, add then subtract across the two bracelets | 48 | One cylinder, three dual regions. | `replace` / `add` / `subtract` exact bit sets; versions unchanged. Not two bodies. |
| Same tube + `tubeCircumferentialLoop(2)` as real seams, no strokes | 48 | One seam cycle. | Bands 0–1 masked, bands 2–3 clear. |
| `branchedTube(4, 3)` + `branchedArmRingStroke` at arm ring 1, seed distal band | 48 | Torso 32 tris (4 bands) + one arm 16 tris (2 bands), manifold join at the top ring. One limb, not two. | Distal arm band 1 is 1; proximal arm band 0 and every torso band are 0; confirm returns true. That is the full face set on this fixture. |
| `nonManifoldTripleEdge` | 3 | Three triangles, one edge with 3 incidents. | Overlay warning matches `/non-manifold/i`; mask === `[0]`; `faceCount` unchanged. |
| `TRI_OBJ` load / `bad.txt` failed load | 1 / prior 48 | Replaces or keeps the session. | Success: mask length equals the new face count, bits empty, `active` false, warnings empty, strokes cleared, `meshLoadVersion` 8, `patternRevision` 0. Failure: previous mask, `active`, strokes, and versions kept. OBJ only. |
| Synthetic 4-bit masks | — | No mesh. | Key changes when a bit flips and when `active` flips; differs from the no-isolation string `1:0:`. |

Not in this file: a second arm, two disconnected bodies, a capped solid, an empty-fence whole-mesh seed (no strokes), STL load, orphan seed, seam+fence on one flood.

---

## Tautology / ablation notes

Would still pass if the following were ignored or wrong:

| If this were ignored or wrong | Still green? |
|-------------------------------|--------------|
| Fence `EdgeKey`s on the two-bracelet seed | **No** — exact bands 1–2 |
| Walked faces passed as `blockerFaces` on that seed | **No** — ring walks touch the arm; mask would collapse toward the seed |
| Fallback `blockerFaces` on the scar seed | **No** — mask would include scar faces or confirm would return true |
| `combineFloodIntoMask` mode (`add` / `subtract` implemented as `replace`) | **No** — exact unions |
| `confirmIsolation` always false | **No** — arm and branched tests expect true |
| `confirmIsolation` always true | **No** — incomplete and scar expect false |
| Isolation bumps `meshLoadVersion` or `patternRevision` | **No** — pinned at 7 and 4 |
| Successful load leaves the old mask | **No** |
| Failed load clears the mask | **No** |
| `flattenSnapshotKey` drops the isolation argument | **No** — `withIdle` becomes `1:0:`, which the test rejects |
| `isolationContentKey` keeps only `active` + popcount | **Yes** — ISO-S2-006 |
| `fence.warnings` dropped, flood warnings kept | **Yes** — ISO-S2-005 |
| `seams` omitted when any stroke is present | **Yes** — ISO-S2-003 |
| `fenceEdges` omitted when any seam is present | **Yes** — ISO-S2-003 |
| `applyIsolationFlood` while `active` replaces a legal mask | **Yes** — ISO-S2-002; nothing starts active and floods again |
| `clearAllSeams` / `toggleSeamAt` ignore the mask | **Yes** — ISO-S2-004 |
| `useFlattenExport` called with a constant `isolationKey` | **Yes** — hook has no test; `app/page.tsx` does pass `isolationKey` from `useHomeSession` |
| Last-flood flag used as the confirm predicate | **Yes** for current tests — they never split the flag from the combined mask (ISO-S2-001) |

`session.mesh` is not replaced. The store passes `fence.blockerFaces`, not `walkedFaces`. `"isolate"` on `MeshEditTool` is orthogonal to `isolation.active`; switching the tool does not clear the mask (tested).

---

## ADR alignment (this slice)

| Contract | In the store now |
|----------|------------------|
| Overlay `{ active, mask }` keyed by original face index, not a remapped `MeshModel` | Yes. Load uses `createIsolationOverlay(mesh.faceCount)`. |
| Seed / add / subtract via `floodFromFace` + `combineFloodIntoMask` + `fenceEdgesFromStrokes` | Yes. Hybrid blockers only. |
| Do not set `active` on flood; confirm enters | Flood never sets `active` true. It **can set `active` false** when the new mask is blocked (ISO-S2-002). |
| Refuse whole mesh and mesh-minus-scar | Confirm uses `isolationSelectionBlocksConfirm` (empty mask, length mismatch, or every non-orphan is masked or a current fallback blocker). That is stricter than the stored flag (ISO-S2-001). |
| Exit clears `active`, bits may remain | Yes, and re-confirm works (tested). |
| Successful load clears the mask like `cutStrokes`; failed load keeps it | Yes (OBJ). |
| `meshLoadVersion` unchanged on flood / confirm / exit | Yes. |
| Flatten key includes mask bits and `active`, no `patternRevision` bump for mask edits | Function and call sites do. Tests do not lock bit position or the hook (ISO-S2-006). |
| Keep fence and flood warnings on the overlay | Code concatenates both on a non-empty flood. Tests lock flood non-manifold text only (ISO-S2-005). |
| While isolated, seam toggle and clear are mask-scoped | **No** (ISO-S2-004). Viewer pick gating is Slice 4; `clearAllSeams` has no later owner. |
| Flatten walks the subset | **No.** `useFlattenExport` only folds `isolationKey` into the snapshot key. `onFlatten` still calls `flattenWithCutStrokes` on the full session mesh. Slice 3. |

---

## Decision queue

Resolve before Slice 5 toasts and before any test is written to “match today’s behavior” by accident. Slice 3 can start without these; it must keep reading `isolation.active` and the mask, and must not treat the stored flag as the confirm predicate.

| # | Question | Option A | Option B (current code) |
|---|----------|----------|-------------------------|
| D1 | What does “do not auto-isolate” apply to? | The **combined** mask. `coversAllNonOrphanFaces` (or a sibling flag) is true when confirm will refuse, including Shift-add that unions every region. Toast that flag. | The flag stays “last flood.” Confirm refuses the union anyway and does not update the flag. Slice 5 toast on the flag stays silent (ISO-S2-001). |
| D2 | Flood whose combined result is not a legal isolate, while a legal isolate is already active | Leave the previous mask and `active` unchanged (explicit Exit only). | Write the new mask and force `active` false (ISO-S2-002). Confirm-refuse keeps bits and only clears `active` — the two paths already disagree. |
| D3 | Where do ADR seam limits live? | `toggleSeamAt` / `clearAllSeams` filter by mask when `active` (store). Ghost keys remain. | Viewer pick gating only (Slice 4). Sidebar Clear seams still wipes ghost keys unless Slice 5 grows a second filter. |
| D4 | Zero-exit scar in production | Keep the store scar check (tested via `setState`). Approximate fences still come from ≥2-point walks that record faces and no exits. | Also allow a 1-point committed stroke. Today `addCutStroke` / `updateCutStroke` reject `points.length < 2`, so the adversarial scar cannot be committed through CRUD. |

---

## Downstream landmines (not Slice 2 defects)

| Item | Owner |
|------|--------|
| `onFlatten` ignores the mask; after re-Flatten the snapshot key can be current for a **full-mesh** unfold while `active` | Slice 3 |
| `useHomeSession` actions omit `applyIsolationFlood` / `confirmIsolation` / `exitIsolation` | Slice 4–5 wiring |
| Island stats still use the full mesh (`computeSessionStats`) | Slice 5 |
| Dense ~84k-tri fence walk on seed **and** again on confirm | Manual QA; ISO-S2-007 |

---

## Recommended next steps

1. Accept or waive D1–D2 in this file (one row each). That is the Slice 2 Done checkbox, not more geometry.
2. Add the ISO-S2-001 and ISO-S2-003 tests before any confirm-flag change so the union case cannot pass on the flag alone.
3. Schedule ISO-S2-004 with Slice 5 (or fix the store first if D3 is Option A). A characterizing test is red today; do not “fix” it by weakening the ADR sentence.
4. Slice 3 may start: no open Critical/High. It should call `assertSubsetHasFaces` only when `active`, and it should not read `coversAllNonOrphanFaces` as “confirm succeeded.”

---

## Audit hygiene

- This pass did not modify `src/state/`, `src/ui/useFlattenExport.ts`, or tests.
- Characterizing proposals above are not implemented here.
