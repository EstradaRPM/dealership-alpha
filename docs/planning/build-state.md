# Build state — read/written by the /next skill

**Source of build order:** `docs/planning/path-to-finished-product.md` §12 (one commit
sequence, nothing optional). This file is only the pointer + bookkeeping; scope always
comes from that doc and the filed issues.

## Current phase

**Phase 1 — A1 advisor hiring + promotion wiring (+ A3 issue hygiene)**

## Blockers

(none)

## Phase table

Status: `pending` → `active` → `done`. "Decision first" = a DECIDE unit must run before
slicing/building that phase (the doc's `[NEW]` items, ungrilled designs, and forks —
resolved just-in-time at the phase boundary, never earlier).

| # | Work (doc section) | Decision first? | Status |
|---|---|---|---|
| 1 | A1 advisor hiring + promotion wiring (#323, #324), + A3 hygiene (close #269, #266, #297) | — | active |
| 2 | A4 silent-system surfacing: #267, #187, #179, manager status card, recovery states, indictment producers | — | pending |
| 3 | B1 Reveal ranking + records | — | pending |
| 4 | B3 news/adverse-events engine (#176–#179) | — | pending |
| 5 | C3 playtest gate (#74), round 1 — HITL | — | pending |
| 6 | C1 staff-teeth | **GRILL (ungrilled core mechanic)** | pending |
| 7 | A2 staff slots / facility scale | **ADJUDICATE [NEW]** | pending |
| 8 | C2 calibration campaign (#286 + #180/#181) | — | pending |
| 9 | B2 F&I plug-in #2 (+#151–#153) | **RESUME parked grill** (fni-mechanics-grill-state.md) | pending |
| 10 | D1 People + Finance + Growth dashboards (chart kit first) | — | pending |
| 11 | B4 drive-the-clock (absorbs #124) | decide bite-unlock schedule while building (spine STILL-OPEN) | pending |
| 12 | F1 onboarding (#213) + F2 + F3 + D3 plain-language pass | **ADJUDICATE [NEW]: F2, F3, D3** | pending |
| 13 | H1 fictional brands (#246) | — | pending |
| 14 | E1 Tier 4 — OEM engine, courtship, NCM, brand archetypes | — | pending |
| 15 | E2 Tier 5 — BDC | **ADJUDICATE fixed-ops-manager fork** | pending |
| 16 | E3 Tier 6 — GM automation + multi-store | — | pending |
| 17 | E4 Tier 7 — prestige + synergy endgame | — | pending |
| 18 | E5 ladder-wide gate/pacing verification | — | pending |
| 19 | G1 audio/haptics + G2 motion pass | **DECIDE G1 direction; ADJUDICATE [NEW]: G1, G2** | pending |
| 20 | G3 visual completion (#252, icon/splash/store) + D4 a11y (#268) | — | pending |
| 21 | G4 performance/device pass | **ADJUDICATE [NEW]** | pending |
| 22 | H2–H5 ship gates: docs, QA capstones, store readiness, final calibration + playtest | — | pending |

## Log

- 2026-07-16 — file created; /next skill installed. Phase 1 active. A1 has no dedicated
  open issue yet (it was residue of #297, which A3 closes) — first /next will SLICE phase 1.
- 2026-07-16 — SLICED phase 1 (A1) via /to-issues into #323 (advisor hiring tracer — the
  unblock; bays defaults confirmed sane so hiring one advisor flips capacity positive) and
  #324 (promotion path, blocked-by #323). Next /next BUILDs #323. A3 hygiene (close #269/#266/
  #297, refresh #209 + spec-condensed) trails A1 landing — bookkeeping, not sliced.
- 2026-07-16 — BUILT + closed #323 (21e9743). buildHiringRoleOptions now data-driven:
  excludes only worker-tier roles, so service-advisor (T2) + body-shop-advisor (T3) are
  hireable → Service/Body Shop capacity min(bays,advisors) flips positive. Functional
  reachability test drives the hire through the PersonnelScreen container. typecheck + 2080
  tests green. Next /next BUILDs #324 (promotion path — deps met now #323 is in). A3 hygiene
  (close #269/#266/#297, refresh #209 + spec-condensed) still trails, after #324.
