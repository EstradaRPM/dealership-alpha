---
paths: ["tests/**", "src/**/*.test.ts", "src/**/*.test.tsx"]
---

# Tests

`npm test` is Jest on the `jest-expo` preset. Tests live in `tests/` or co-located as
`*.test.ts(x)` under `src/`.

- **Every game-logic module gets isolation tests on its public interface** — drive it through
  the barrel and assert external behavior. A test that reaches into internals to assert them
  freezes the implementation and is the thing this repo's module boundary exists to prevent.
- **UI gets smoke tests only** — renders without crashing.
- **No snapshot tests.** They record what the code does, not what it should do.
- **A slice that adds or changes a player-facing surface needs a reachability / anti-orphan
  test**: proof the mechanic is actually mounted in the live app, not merely built. Pattern is
  `tests/<Surface>.reachability.test.tsx` — see `tests/AdvisorHiring.reachability.test.tsx`.
  This is the guard against "mechanics built but never surfaced," which has happened here
  before and is expensive to find later.
- **Seeded randomness is the determinism seam.** Replay and checkpoint tests scope to seeded
  streams, never to a full re-run of `snapshotWorld` — two fresh same-seed worlds legitimately
  diverge on the sales floor.
