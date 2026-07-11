# Engagement / "Is any of this FUN?" — design reflection brief

**For a fresh Opus session.** This is a game-wide DESIGN REFLECTION pass — not implementation,
not a grill.

## Read first (in order)
- `docs/planning/fni-mechanics-grill-state.md` — a just-parked grill; read the "Why paused" note
  and the engagement-surfacing branch.
- Memory: `fni-grill-parked.md` and the memories it links —
  `sim-depth-not-surface-complexity`, `felt-loop-dope-wars-lemonade`,
  `market-economy-design-lock` (the "A/B/C dopamine layering"),
  `managerial-default-felt-loop`, `macro-loop-redesign-open`, `ui-mapping-pipeline`.
- `docs/spec-condensed.md`
- `docs/audits/game-coverage-matrix.md` (current build state).

## The problem to solve
The whole game — every system, screen, and mechanic, not just F&I — is honestly modeled but may
not be FUN. The fear: it plays like a well-modeled spreadsheet you tune — lots of correct levers
and readouts, no heartbeat, no dopamine. The dev has lost motivation to keep adding depth and
suspects the answer is NOT more depth. Do the heavy lifting on where "fun"/engagement actually
lives, and be brutally honest.

## What this session must produce
1. **Honest audit.** Go system by system across what's actually built (use the coverage matrix +
   the module map in `CLAUDE.md`) and classify each: does it deliver a FELT beat, or is it a dead
   settings screen / silent ledger entry? Name names. Don't flatter the codebase.
2. **Leverage analysis.** Cross-reference logically where the highest-leverage engagement room
   is — which existing depth, if promoted to a felt beat, buys the most fun per unit of work.
   Leverage, not a wish list.
3. **Pressure-test (do NOT just adopt) the shared-engagement-spine hypothesis** from the parked
   F&I session: that engagement should be built ONCE as a shared layer every system plugs into
   (like EventBus / DepartmentLine), not bolted onto each screen; and that the fix is *surfacing
   existing depth, not modeling more*. A rough four-beat sketch was floated — juice layer /
   bet→verdict recap / record-milestone layer / emergence web. Treat it as a starting hypothesis
   to attack, confirm, reshape, or replace. Say if it's wrong.
4. **Identify the single highest-leverage TRACER** — the first system to prove whatever spine you
   land on. The parked grill assumes F&I; challenge that if something else is a better first note.

## Constraints and standards
- HARD RULE: one finished product = the full tier ladder T1–T7; every agreed mechanic built as
  the real thing; build order is only a commit-sequence question. Never sort work into
  now-vs-later scope buckets.
- Managerial-watch felt loop; deals / F&I are auto-resolved BY DESIGN (no per-deal clicking).
- Player-facing labels name their axis in plain language, never temperature words.
- Don't propose depth that is ambient BY DESIGN (holdback, amortization) as a "fun surface" — the
  job is picking WHICH existing depth to promote.
- The dev is solo, time-constrained, deep auto-retail domain expertise, allergic to scope bloat
  and BS. Give leverage and honesty, not hype.

## Work method
Reflect and cross-reference FIRST and show the reasoning, then converge on a recommended
engagement architecture + the tracer. Lead with your own synthesis — do NOT open by interviewing.
Once the analysis is on the table, grill the genuinely load-bearing forks one at a time.
