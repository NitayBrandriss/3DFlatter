# Phase 2+ epics (client backlog)

**Status:** P2-E2 **promoted** (2026-09-02) — [ADR 0101](../../decisions/product/0101-mesh-isolation.md) · [epic-mesh-isolation.md](epic-mesh-isolation.md). P2-E1 and P2-E3 remain planning-only.  
**Date captured:** 2026-08-25  
**Source:** Client product feedback after dense-mesh polyline cut QA  
**Indexed from:** [PRODUCT_ROADMAP.md — Deferred backlog](../../../PRODUCT_ROADMAP.md#deferred-backlog-not-scheduled) (SSOT for parked work)  
**Roadmap:** [PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md)  
**Related:** Phase 1 complete — [phase-1-freeform-cut-strokes.md](phase-1-freeform-cut-strokes.md) · [ADR 0100](../../decisions/product/0100-freeform-cut-strokes.md)

This file is **epic detail** (P2-E1…E3). The living deferred checklist — cut-tool v2, geometry debt, Worker flatten, QA debt — lives on the roadmap. Do not implement P2-E1 / P2-E3 from this file until promoted with an ADR (0102+) and a concrete slice plan.

---

## Epic index

| ID | Epic | Theme fit | Priority (client) | Status |
|----|------|-----------|-------------------|--------|
| P2-E1 | 2D PDF A4 export (nested booklet) | Roadmap Phase 4 (pagination) + manufacturing export | High | Planning only |
| P2-E2 | Mesh isolation / sub-mesh selection | Phase 2 first Active epic | High | **Active** — ADR 0101 |
| P2-E3 | Developability heatmap (strain / curvature) | Guidance before cuts; pairs with cut tool + unfold quality | High | Planning only |

---

## P2-E1 — 2D PDF A4 export

### Problem

Flatten today yields an on-screen / SVG preview of islands. Production papercraft needs **print-ready pages**: islands nested onto **standard A4** sheets and exported as a **multi-page PDF booklet**.

### Desired outcome

1. Pack (nest) flattened 2D islands into A4 bounding boxes with configurable margins and optional gap.
2. Paginate overflow across multiple pages when islands do not fit one sheet.
3. Export a multi-page PDF (candidate: **jsPDF** or similar — **dependency requires approval** before adding).
4. Preserve scale semantics once real-world cm scale lands (roadmap Phase 4); until then, document page scale (e.g. 1 unit = N mm) explicitly in the UI.

### Open questions

- Nesting algorithm: shelf / skyline / existing `layoutIslands` extension vs dedicated packer?
- One island per page vs multi-island nesting?
- Include fold/cut line styles and edge IDs (Phases 2–3) in the same PDF pass or SVG-first then PDF?

### Non-goals (for a first slice)

- Laser machine drivers, DXF, or vendor-specific cutters.
- Automatic packing optimization competitions (good-enough nesting is enough for v1).

### Suggested ADR / plan when scheduled

- Product ADR (e.g. 010x — print pagination & PDF export).
- Plan under `docs/plans/product/phase-*-pdf-a4-export.md`.
- Ask before adding `jspdf` (or alternative) to `package.json`.

---

## P2-E2 — Mesh isolation (sub-mesh selection)

**Promoted** — do not implement from this section. Contracts: [ADR 0101](../../decisions/product/0101-mesh-isolation.md). Slices: [epic-mesh-isolation.md](epic-mesh-isolation.md).

### Problem

On dense production assets (e.g. full-body avatars), users need to **select a part**, **isolate** it (“take it aside”), and edit seams/cuts on that subset while the rest of the model is **ghosted**.

### Resolved (ADR 0101)

- **Selection:** seed-flood from a face click, stopping at manual seams and fence `EdgeKey`s from committed cut-stroke surface walks (bracelet loops). Shift-add / Alt-subtract. No screen lasso in v1.
- **Session:** face-index mask overlay on the frozen base mesh — not a stored sub-`MeshModel` clone.
- **Crossing strokes:** skip + toast in v1; auto-split at the isolation boundary is deferred (ISO-001).
- **Display:** full-mesh normalization; camera frames the isolate; remainder is ghosted (not hidden).

### Non-goals (v1)

- Full CAD assembly / multi-body file formats.
- Destructive boolean split of the stored mesh on isolate enter.
- Hide toggle, lasso, brush radius — see roadmap isolation v2.

---

## P2-E3 — Developability heatmap (strain analysis)

### Problem

Users do not know **where** to place relief cuts or darts. Areas with high **Gaussian curvature** (or high unfold strain / distortion) will not flatten well; a **heatmap on the 3D model** would guide manual cutting.

### Desired outcome

1. Compute a per-face (or per-vertex) developability / strain signal in `src/logic/` (unit-testable).
2. Visualize as a color overlay on the 3D mesh (viewer-only materials; math stays in logic).
3. Toggle heatmap on/off; optional legend (low → high distortion).
4. Optionally refresh after seams/cuts change (post-materialize or approximate on base mesh).

### Candidate signals (pick in ADR)

| Signal | Notes |
|--------|--------|
| Discrete Gaussian curvature | Intrinsic; good “will not flatten” prior on the uncut mesh |
| Unfold strain / area or edge stretch | Requires a trial unfold (or island-local); ties to ADR 0002 soup |
| Existing quality metrics | Collisions / tears ([ADR 0003](../../decisions/poc/0003-unfold-quality-detection.md)) projected back to 3D |

### Open questions

- Pre-cut curvature heatmap vs post-Flatten strain bake-back?
- Performance on ~80k-tri client meshes (may need Worker; see deferred UI-004).
- Colorblind-safe ramp; interaction with wireframe / seam overlays.

### Non-goals (for a first slice)

- Fully automatic cut placement from the heatmap.
- Physics-based material simulation beyond geometric strain.

### Suggested ADR / plan when scheduled

- Product ADR (metric definition + overlay contract).
- Plan under `docs/plans/product/phase-*-developability-heatmap.md`.
- Reuse unfold/quality where possible; do not reintroduce vertex-map unfold placement (ADR 0002).

---

## Scheduling notes

1. **P2-E2** is the first Active Phase 2 epic (isolation). Manufacturing SVG stays Planned under Phase 2.
2. **P2-E1** aligns with roadmap Phases 2 + 4 (export + pagination); schedule once manufacturing SVG is underway.
3. **P2-E3** can start as a logic-only spike (curvature fixture tests) before any viewer polish.

When promoting an epic: add a row to [product/README.md](README.md) Active table, promote from [PRODUCT_ROADMAP.md — Deferred backlog](../../../PRODUCT_ROADMAP.md#deferred-backlog-not-scheduled), and open an ADR — do not treat this file as an implementation checklist.
