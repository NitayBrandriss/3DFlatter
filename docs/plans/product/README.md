# Product plans (Phase 2+)

**Active implementation specs** for post-PoC features. Status and phase order: **[PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md)** (repo root).

**ADRs:** [decisions/product/](../../decisions/product/) (0100+). PoC contracts remain in [decisions/poc/](../../decisions/poc/) (0001–0004).

**PoC history:** [../poc/README.md](../poc/README.md) — do not extend for new product rows.

---

## Active

| Plan | Phase | Status | ADR |
|------|-------|--------|-----|
| [phase-1-freeform-cut-strokes.md](phase-1-freeform-cut-strokes.md) | 1 — Freeform cut strokes | **In progress** | [ADR 0100](../../decisions/product/0100-freeform-cut-strokes.md) *(draft next)* |

---

## How to add a product plan

1. Add a row to **Active** in this file and to [PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md).
2. Write `phase-<n>-<short-name>.md` in this folder (archive-style header: Status / ADR / scope / tests — not Cursor YAML).
3. Add or update **ADR 0100+** under [decisions/product/](../../decisions/product/).
4. Promote from `.cursor/plans/` into this folder; delete the Cursor-only copy.

When a phase ships, set Status **Complete** and keep the spec here (or move to `product/archive/` if the folder grows).
