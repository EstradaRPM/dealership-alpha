# Rng (seeded determinism)

The game's one source of pseudo-randomness. Not an EventBus participant — a library module
the others depend on, in the same class as `data/`.

## Public API (`index.ts`)
- `deriveSeed(masterSeed, namespace, ctx)` — a stable 32-bit seed from the world's master
  seed plus a namespace string and a context object. The context is serialized with its keys
  **sorted**, so `{day, id}` and `{id, day}` derive the same seed: a seed is a function of the
  *values*, never of the order they were written at the call site.
- `createRng(seed)` — a `() => number` in `[0, 1)` (mulberry32). Same seed ⇒ same stream.
- Type: `SeedContext` (`Record<string, string | number>`).

## Why it is its own module (#342)
It lived at `src/game/NPC/Rng.ts` until #342 — NPC was simply the first module that needed
determinism. It was never an NPC concept: sixteen modules plus `createWorld` and the balance
harness draw from it. Re-exporting it from NPC's barrel would have made seeded RNG part of
NPC's *public promise*, which is a claim about NPC that isn't true and would have left
`Inventory → NPC` as a dependency that exists for no domain reason. So it moved out whole.

## Determinism is load-bearing
Three things depend on the same `(masterSeed, namespace, ctx)` producing the same stream
forever: #122 checkpoint/resume replay, the committed tier fixtures in `data/fixtures/`, and
the balance harness's byte-stable reports (`docs/balance-harness-recipe.md`).

That makes two things breaking changes, even though neither looks like one:

- **Changing a namespace string or a ctx key at a call site.** The seed is derived from that
  text. Renaming `'collision_stream.arrival'` re-rolls every arrival in every existing save.
- **Changing the hash or the generator here.** Every seed and every stream in the game moves
  at once.

Neither is forbidden — but it invalidates the fixtures, so it comes with a fixture
regeneration and, if a save can no longer be replayed, a save-envelope bump
(`docs/save-migration-recipe.md`).

Adding a *new* namespace is free: it derives a stream nothing else was drawing from.

## Convention at the call site
Consumers derive one seed per (entity, day, purpose) rather than threading a single live
generator through a call chain. That is what keeps a roll **order-independent** — a mid-day
replay reproduces the same value even if the surrounding day is evaluated in a different
order. Do not hoist a `createRng` into module scope; a shared live generator makes every
draw depend on how many draws happened before it.
