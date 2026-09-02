# Product plans (Phase 2+)

**Active implementation specs** for post-PoC features. Status and phase order: **[PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md)** (repo root).

**ADRs:** [decisions/product/](../../decisions/product/) (0100+). PoC contracts remain in [decisions/poc/](../../decisions/poc/) (0001–0004).

**PoC history:** [../poc/README.md](../poc/README.md) — do not extend for new product rows.

---

## Active

| Plan | Phase | Status | ADR |
|------|-------|--------|-----|
| [phase-1-freeform-cut-strokes.md](phase-1-freeform-cut-strokes.md) | 1 — Freeform cut strokes | **Complete** | [ADR 0100](../../decisions/product/0100-freeform-cut-strokes.md) |
| [epic-mesh-isolation.md](epic-mesh-isolation.md) | 2 — P2-E2 Mesh isolation | **Active** | [ADR 0101](../../decisions/product/0101-mesh-isolation.md) |

---

## Backlog (not scheduled)

**Source of truth:** [PRODUCT_ROADMAP.md — Deferred backlog](../../../PRODUCT_ROADMAP.md#deferred-backlog-not-scheduled) (phases 2–5, client epics, cut-tool v2, geometry debt, performance, UX polish, test debt).

| Plan | Status |
|------|--------|
| [PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md#deferred-backlog-not-scheduled) | Deferred backlog (SSOT) |
| [phase2-epics.md](phase2-epics.md) | Client epic detail — **P2-E2 promoted** (ADR 0101); P2-E1 / P2-E3 still planning-only |

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
