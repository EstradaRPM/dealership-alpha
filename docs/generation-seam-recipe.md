# Generation-Seam Recipe

**Purpose:** This is the repeatable wiring pattern for "generation seam" slices — features that
generate a value per customer/visit from tunable data, inject it through a factory, and compose it
at the root. Slices #165 (customer `currentVehicle`), #166 (trade incidence), and #167 (trade
allowance ask) all follow it byte-for-byte. **Read this instead of re-deriving the pattern from
prior slices' source.** Many remaining MarketEconomy slices (#155–#181) are generation seams.

> **Pointers drift.** The *steps* below are the durable contract; the `file:line` references are
> accurate as of #167 (commit `ba921aa`). If a pointer is stale, the step still tells you what to
> look for — `grep` the symbol name rather than re-reading whole files. Before relying on a pointer,
> confirm the symbol still exists (per the memory hygiene rule).

---

## The 5 steps

### 1. Data file + schema + loader

Tunables live as versioned JSON under `data/`. Each gets a Zod schema and a `load*Config()` wrapper.

- Data: `data/<feature>.json` — `schemaVersion: 1` literal at top, `.strict()` everywhere.
- Schema: in the owning module's `schemas/` dir (NPC) or alongside the pure fn (DealEngine).
  - e.g. `src/game/NPC/schemas/customer-current-vehicle.ts:55`, `src/game/DealEngine/trade.ts:16`
- Loader: `parseData(raw, Schema, 'data/<feature>.json')` where `raw = require('../../../../data/<feature>.json')`.
  - Reference: `src/game/NPC/factories/CurrentVehicleFactory.ts:12`

### 2. Pure generation function (no I/O, seeded)

Lives in the owning game module. **Customer-facing → `src/game/NPC/`. Financial → `src/game/DealEngine/`.**
Signature is `(ctx, deps) => value` (or a flatter arg list for purely numeric formulas). All
randomness is seeded off `masterSeed` + a per-field sub-seed — **never `Math.random()`** (replay
determinism, see [[replay-determinism-constraint]]).

- `rollCurrentVehicle(ctx, deps): CurrentVehicle` — `CurrentVehicleFactory.ts:75`
- `rollHasTrade(ctx, deps): boolean` — `TradeIncidenceFactory.ts:42`
- `generateTradeAsk(cv, loanPayoff, bookValueFn, seed, config?): number` — `DealEngine/trade.ts:91`

`ctx` for customer seams is `{ personArchetypeId, day, slot }`. `deps` carries `masterSeed`, the
loaded `config`, and any upstream classifiers (e.g. `creditTier`).

### 3. Inject as an optional named param on the factory

Add an **optional** field to `CreateCustomerDeps` (`src/game/NPC/factories/CustomerFactory.ts:25`).
Optional is load-bearing: omitting it must leave legacy paths working with the field absent.

- `currentVehicleConfig?` (`:50`), `tradeIncidenceConfig?` (`:57`), `tradeAskFn?` (`:75`)
- Shared upstream classifier: `classifyCreditTier?` (`:66`)

Guard the call site on the dep being present, then **stamp the result with the undefined-spread
pattern** so an omitted dep produces no field rather than `undefined`:

```typescript
...(currentVehicle !== undefined ? { currentVehicle } : {}),   // on Person  (:227)
...(allowanceAsk  !== undefined ? { allowanceAsk }  : {}),      // on SalesVisit (:315)
```

### 4. Compose at the root in `createWorld.ts`

Wire the seam where the world is assembled. **Ordering is the trap:** build a seam only *after* its
upstream providers exist. As of #167: MarketEconomy (`:172`) and DealEngine (`:150`) are created
**before** CustomerPool, so a seam that needs them composes in the CustomerPool deps block (`~:186`).

```typescript
const tradeAllowanceNoise = loadTradeAllowanceNoiseConfig();
const tradeBookValue: TradeBookValueFn = (cv) =>
  marketEconomy.bookValueFn(cv as unknown as PricedVehicleInput);  // adapt at the boundary
// ...in CustomerPool deps:
tradeAskFn: (cv, seed) =>
  generateTradeAsk(cv, cv.loanPayoff, tradeBookValue, seed, tradeAllowanceNoise),
```

Type adaptation between modules (the `cv as unknown as PricedVehicleInput` cast) happens **at the
composition boundary in `createWorld`**, not inside the pure fn — keep the pure fn typed to its own
module's shape.

### 5. Events (only if the seam emits/consumes one)

#165–#167 are data-only / pure and touch no events. If your seam needs one, declare it in
`src/game/EventBus/events.ts` (the canonical catalog) and wire emit/consume there. Most generation
seams do **not** need an event — the value is stamped on Person/Visit and read downstream.

---

## Type shapes you'll keep needing

| Type | Where | Shape |
|------|-------|-------|
| `CurrentVehicle` | `NPC/schemas/customer-current-vehicle.ts:72` | `{ templateId, make, model, year, mileage, condition, category, loanPayoff }` |
| `TradeBookValueFn` | `DealEngine/trade.ts:51` | `(vehicle: CurrentVehicle) => number` |
| `AnchorVehicleInput` | `MarketEconomy/anchor.ts:22` | `{ templateId, make, year, mileage, category, condition }` (what `bookValueFn` reads) |
| `PricedVehicleInput` | `SalesProcess/seams.ts:25` | `{ purchasePrice, reconCost }` |

`CurrentVehicle` carries the anchor fields, so MarketEconomy's `bookValueFn` can value it via the
documented runtime cast — even though `CurrentVehicle` is not nominally a `PricedVehicleInput`.

---

## Checklist for the next generation seam

- [ ] `data/<feature>.json` with `schemaVersion: 1`, `.strict()` schema, `load*Config()` loader
- [ ] Pure seeded fn in NPC (customer) or DealEngine (financial); sub-seed off `masterSeed`
- [ ] Optional param on `CreateCustomerDeps`; guarded call site; undefined-spread stamp
- [ ] Compose in `createWorld.ts` **after** upstream providers; adapt types at the boundary
- [ ] Event in `EventBus/events.ts` only if genuinely needed
- [ ] Isolation test on the pure fn's public behavior (per CLAUDE.md testing rules)
- [ ] `npm run typecheck && npm test`
