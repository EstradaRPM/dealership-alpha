---
paths: ["data/**", "src/game/data/**"]
---

# Tunable data — `data/**`

Everything under `data/` is **versioned tunable content**: OEM tables, customer archetypes,
F&I products, tier definitions, balance numbers, copy tables. Code reads it; code never
hardcodes it.

**Read `src/game/data/CLAUDE.md`** for the loader's public surface and the file-layout
convention (what belongs in the sectioned `data/tunables.json` versus its own catalog file).

Two things bind every change here:

- **Every loader goes through `parseData(schema, raw)`** with a Zod-style schema. No
  `JSON.parse(...) as Type` shortcut — a mismatched file must fail loudly at load, not
  produce `undefined` three systems downstream.
- **A new block needs a schema entry.** Adding keys to `data/tunables.json` without extending
  `TunablesSchema` means the file is no longer validated in the part you just added.

## Fixtures and the save envelope

`data/fixtures/**` and the world-snapshot version are not ordinary tunables — they are save
state. Touching them triggers the `pre-save-envelope` hook, which states the full re-stamp
ritual; follow it rather than working around it. The migration pattern itself is
`docs/save-migration-recipe.md`.
