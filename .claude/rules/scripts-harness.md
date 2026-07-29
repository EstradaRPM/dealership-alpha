---
paths: ["scripts/**"]
---

# Scripts and the balance harness — `scripts/**`

**Read `docs/balance-harness-recipe.md` before touching `scripts/balance-harness/` or
reading its output.** Its opening block is load-bearing and saves a wasted session: the
harness bot going bankrupt before Tier 2 is **expected and pre-existing**, not a regression
to investigate, and the pacing report's "bankruptcy rate: 0%" does **not** mean solvent.

Scripts are development tooling, not shipped game code, but they consume the same modules and
so obey the same module-boundary rule — import through each module's `index.ts` barrel.
