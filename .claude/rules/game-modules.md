---
paths: ["src/game/**", "src/*.ts"]
---

# Game logic — `src/game/**` and the composition roots in `src/`

**Read `src/game/<Module>/CLAUDE.md` before that module's code.** Every module directory
under `src/game/` carries one, and the path is mechanical — the module you are editing has
its doc one directory up from the file. It names the module's public surface, the events it
emits and consumes, and the `data/` files it reads; it is shorter and more current than
re-deriving the surface from `index.ts`.

## Module boundary

Every module is a directory under `src/game/<ModuleName>/` whose entire public surface is
its `index.ts` barrel. Consumers import from `'@/game/<ModuleName>'` or the relative path to
the directory — **never from a file inside it.** Anything not re-exported from `index.ts` is
private. A module may read its own internals.

A write that reaches past a barrel is **blocked** at write time by
`.claude/hooks/pre-module-boundary.mjs` — this is not a review-time convention. If the symbol
you need is not on the barrel, that is a public-surface decision: re-export it (and say so in
that module's `CLAUDE.md`), or get what you need through the surface that already exists.
Do not alias the path around it.

Legacy reach-ins are enumerated in `.claude/hooks/module-boundary-allow.json`. That list is
meant to shrink, never grow; `npm run hooks:scan` regenerates the sweep. Details:
`.claude/hooks/README.md`.

## Cross-module communication

Modules talk through the `EventBus`. **No module calls another's internals** — not via an
import, not via a passed-in reference to a sibling's guts. The canonical catalog (every event
name, payload, and ordering note) is `src/game/EventBus/events.ts`; add the event there
rather than inventing a name at the call site.

## Shape

- **Deep modules, narrow interfaces.** This is a multi-year project — architectural
  shortcuts are rejected at review.
- A subsystem that is intentionally simple today (static OEMs, static competitors, the
  regulatory meter) is still exposed **behind an interface**, so a richer replacement drops
  in later without touching consumers.
- **No magic numbers in code.** Every tunable — OEM tables, archetypes, F&I products, tier
  definitions, balance numbers — lives in a versioned file under `data/`, loaded through a
  typed schema. Convention and loader surface: `src/game/data/CLAUDE.md`.
- A **generation seam** (a value generated per customer/visit from `data/`, injected through
  a factory, composed in `createWorld`) follows `docs/generation-seam-recipe.md`. Read the
  recipe, not a prior slice's source.
