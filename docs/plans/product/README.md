# Product plans (Phase 2+)

**Active implementation specs** for post-PoC features. Status and phase order: **[PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md)** (repo root).

**ADRs:** [decisions/product/](../../decisions/product/) (0100+). PoC contracts remain in [decisions/poc/](../../decisions/poc/) (0001–0004).

**PoC history:** [../poc/README.md](../poc/README.md) — do not extend for new product rows.

---

## Active

| Plan | Phase | Status | ADR |
|------|-------|--------|-----|
| [phase-1-freeform-cut-strokes.md](phase-1-freeform-cut-strokes.md) | 1 — Freeform cut strokes | **Complete** | [ADR 0100](../../decisions/product/0100-freeform-cut-strokes.md) |

---

## QA

Findings live in [qa-audits.md](qa-audits.md). Strategies (not yet findings) stay as sibling plans until an execute-audit pass appends a snapshot.

| Plan | Status |
|------|--------|
| [remediation-phase1.md](remediation-phase1.md) | **Complete** (2026-08-23) — UI/UX, load toasts, Vitest hardening |
| [qa-holistic-post-phase1.md](qa-holistic-post-phase1.md) | Approved — **CI gate + manual E2E recorded**; in-scope findings remediations complete ([qa-audits.md](qa-audits.md#audit--2026-08-23--phase-1-holistic-remediation-complete)); logic/viewer regression pass still waiting |
| [qa-audits.md](qa-audits.md) | Living findings index (Slices A–E + holistic baseline + remediation complete) |

---

## How to add a product plan

1. Add a row to **Active** in this file and to [PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md).
2. Write `phase-<n>-<short-name>.md` in this folder (archive-style header: Status / ADR / scope / tests — not Cursor YAML).
3. Add or update **ADR 0100+** under [decisions/product/](../../decisions/product/).
4. Promote from `.cursor/plans/` into this folder; delete the Cursor-only copy.

When a phase ships, set Status **Complete** and keep the spec here (or move to `product/archive/` if the folder grows).

**Backlog (not scheduled):** cut-tool v2 UX — mid-segment insert, undo stack, snap/weld — lives on [PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md#cut-tool-ux-backlog-v2--after-polyline-blueprint) (do not fold into polyline Slice E).
