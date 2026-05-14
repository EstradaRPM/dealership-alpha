# data (loader)

Generic JSON loader + tunables schema. Not an EventBus participant — a library module the others depend on.

## Public API (`index.ts`)
- `parseData(schema, raw)` — validates raw JSON against a Zod-style schema. Throws `DataValidationError` on mismatch.
- `loadTunables` — typed loader for `data/tunables.json`. `TunablesSchema` is the source-of-truth schema. Type: `Tunables`.

## Convention
- All tunables go into `data/tunables.json` (single file, sectioned by module).
- Module-specific catalogs (archetypes, products, vehicles) get their own JSON file under `data/`.
- Every loader uses `parseData` — no `JSON.parse + as Type` shortcuts allowed.

## No magic numbers in code
Per the root CLAUDE.md engineering principle: every balance number lives in `data/`, loaded via a typed schema. If you're about to type a number into a `.ts` file, stop and put it in JSON first.
