---
status: accepted
date: 2026-07-19
depends_on: 0001, 0002, 0003
---

## ADR 0004: Tech-debt remediation strategy

### Context

The project has a large, prioritized QA audit ([docs/qa-audit.md](../../qa-audit.md)) covering architecture, DRY geometry helpers, quality-detection performance, session/state scaling, layout/a11y, and UI structure. Remediating every finding in one push would stall feature velocity. We need an explicit strategy for **what to fix now**, **what to defer**, and **how to verify** algorithmic refactors without relying solely on unit tests.

The remediation plan lives at [docs/plans/poc/archive/qa-audit-remediation.md](../../plans/poc/archive/qa-audit-remediation.md). This ADR records the architectural policy that plan must follow.

### Decision 1 — Prefer granular Zustand selectors over Web Workers

**Problem:** Seam toggles can feel slow because the page selects the whole `session` and re-runs `partitionIslands` for sidebar stats (`STATE-003`, `ARCH-001`). Separately, Flatten runs `unfoldMesh` synchronously on the UI thread (`UI-004`).

**Decision:** Address interactive jank first with **granular Zustand selectors** and **island/stats memoization** keyed on seams (and related identity), not with a Web Worker.

**Rationale:**

- Selector/memoization fixes are low-risk, localized to `app/page.tsx` and `meshSessionStore`, and remove redundant work on every seam pick — the path users hit continuously.
- Moving unfold/quality detection into a Web Worker is a **large architectural shift**: structured cloning or custom serialization of `MeshModel` / `Topology` / `SeamRegistry`, async request/response messaging, cancellation/`loadSeq`-style races, and progress UX. That complexity is not justified for the current PoC while meshes remain modest.
- Synchronous Flatten on large files remains a known limit; it is **deferred** (audit `UI-004`), not denied forever. Revisit when real meshes make main-thread unfold unacceptable.

**Consequence:** Remediation Slice 5 covers Zustand scale items only. `UI-004` stays in the plan’s Deferred section until a future ADR or plan explicitly adopts workers.

### Decision 2 — Mandate visual QA for algorithmic geometry changes

**Problem:** Slices that DRY face/edge helpers or change SAT / clipping / tear iteration (`LOGIC-007`–`011`, etc.) can keep unit fixtures green while still regressing 2D canvas output (winding, seam overlays, collision centroids, tear segments).

**Decision:** For remediation **Slices 2 and 3**, “Done when” **must** include **Manual visual QA with a complex seamed model**: load a non-trivial mesh, apply multiple seams, Flatten, and inspect the 2D canvas for face fill, seam overlay, and quality markers against a pre-change mental baseline. Unit tests remain necessary but are not sufficient.

**Consequence:** Agents and humans must not mark those slices complete on `npm test` alone. Record a short pass/fail note in the plan or PR.

### Decision 3 — Defer UI / layout structural refactors

**Problem:** Layout hydration, peek capture, keyboard a11y, prop-drilling, and `page.tsx` orchestration (`LAYOUT-*`, `A11Y-*`, `UI-002`, `APP-001`, …) are real maintainability costs but do not threaten core mesh → unfold → quality correctness.

**Decision:** Mark remediation **Slices 6 and 7** as **Optional / Backlog**. Execute **Slices 0–5** to stabilize docs, quality correctness, logic DRY, quality performance, I/O robustness, and Zustand scaling. Do **not** halt product momentum to refactor UI chrome in this phase.

**Consequence:** Shell and orchestrator cleanups may be pulled forward only when they block users or a large UI feature; they are not part of the default engine-stabilization path.

### Explicit non-goals (this ADR)

- Choosing a specific Web Worker library or message protocol.
- Changing triangle-soup unfold, `EdgeKey`, or quality orthogonality (ADRs 0001–0003).
- Auto-fix for collisions/tears.

### Implementation files

| File | Role |
|------|------|
| [docs/plans/poc/archive/qa-audit-remediation.md](../../plans/poc/archive/qa-audit-remediation.md) | Sliced execution plan bound by this ADR |
| [docs/qa-audit.md](../../qa-audit.md) | Finding source of truth; update statuses as slices ship |

### References

- [ADR 0001](0001-mesh-model-and-topology.md) — mesh / topology
- [ADR 0002](0002-unfold-step-1-hinge-island.md) — hinge unfold
- [ADR 0003](0003-unfold-quality-detection.md) — quality detection
- [AGENTS.md](../../../AGENTS.md) — planning workflow; ask before architectural changes
