# PartsInventory

Parts stock for the four Service parts categories — the supply-side half of the
Service profit center (#299, parent PRD #297). Mirrors the vehicle `Inventory`
discipline: **pay cash at acquisition, recoup it only as matching jobs consume
the stock.** Over-stock is punished purely as dead capital — no spoilage timer,
no age field.

**Built so far (#299): stock-in + consumption + the coverage read-model seam +
persistence. (#301): par-level procurement — per-category reorder point +
target, supplier-tier lead time + reliability, the rush emergency order, and the
coverage-gap read-model.** The Body-Shop parts categories and the
consume-on-`service:ticket_closed` / rush-on-miss dispatch wiring are later #297
slices.

## Public API (`index.ts`)
- `createPartsInventory({ economy, config?, masterSeed? })` → `PartsInventory`.
  `economy` is `Pick<Economy, 'postExpense'>` (stock-in + order placement debit
  cash). `config` defaults to `loadPartsInventoryConfig()`; `masterSeed`
  defaults to 0 (seeds the order lead-time/reliability draw).
- `addStock(category, qty, unitCost)` — append a lot and debit `qty × unitCost`
  via Economy (categorized `inventoryAcquisition`). `qty <= 0` is a no-op;
  negative `unitCost` clamps to 0.
- `consume(category)` → `boolean` — deplete one unit (oldest lot first). Returns
  `true` when consumed, `false` on a miss (empty category). **Never throws** —
  the miss is the observable signal the future parts-gate routes to the
  lost-revenue / rush path.
- `getStock(category)` / `getCoverage()` — on-hand reads. `getCoverage()` keys
  all four categories (0 when empty).
- **Procurement (#301):**
  - `getPolicy(category)` / `setPolicy(category, partial)` — the per-category
    `ProcurementPolicy` (`reorderPoint` / `target` / supplier `tier`), seeded
    from data defaults; `setPolicy` floors par levels at 0 and ignores an
    unknown tier.
  - `advanceDay(day)` — receive every order due (`arrivalDay <= day`) as a stock
    lot, **then** run the par-level reorder sweep. The root drives this off
    `clock:day_started`.
  - `rushOrder(category, qty = 1)` — on-demand premium-tier (`rush`) emergency
    order; backs the future under-stock dispatch gate. `qty <= 0` is a no-op.
  - `getPendingOrders()` / `getOnOrder(category)` — in-flight orders.
  - `getCoverageGap(demand)` — coverage read-model: per category `{ demand,
    onHand, onOrder, gap }` where `gap = demand − onHand − onOrder` (>0 = short).
- `getLots()` — all lots, accrual order (oldest first).
- `snapshot()` / `restore()` — barrel-exported `PartsInventorySnapshot` (v2);
  `restore` also accepts a legacy v1 snapshot.
- `loadPartsInventoryConfig()`, `PART_CATEGORIES`, `SUPPLIER_TIERS`, and types
  `PartsInventory`, `PartsInventoryDeps`, `PartsInventoryConfig`,
  `PartsInventorySnapshot(/V1)`, `AnyPartsInventorySnapshot`, `PartCategory`,
  `PartLot`, `SupplierTier`, `ProcurementPolicy`, `PendingOrder`, `CoverageGap`.

## Model
- A `PartLot` is `{ category, qty, unitCost }`. `addStock` appends a lot;
  `consume` decrements the oldest non-empty lot of the category and prunes it
  when it empties, so consumption is deterministic FIFO.
- `unitCost` is retained per-lot (not just at debit time) so the snapshot
  round-trips the exact dead-capital the player is carrying.
- The four categories (`oil_filters`, `tires_brakes`, `drivetrain`,
  `electronics`) mirror the InstalledBase `JobCategory` ladder one-for-one — one
  completed job depletes one matching unit — but the union is declared
  independently so the two modules stay decoupled.

## Procurement (#301)
- **Par-level reorder.** On each `advanceDay` (after arrivals land), any category
  whose `onHand <= reorderPoint` and whose `onHand + onOrder < target` places an
  order for `target − (onHand + onOrder)` units. Counting in-flight orders stops
  a duplicate order stacking while one is en route. The sweep walks
  `PART_CATEGORIES` in fixed order so the seeded draws are order-stable.
- **Supplier tiers** (`economy` / `standard` / `oem_direct` / `rush`, cheapest/
  slowest → priciest/fastest) trade `costMultiplier` (× the category
  `baseUnitCost`) against `leadTimeDays` and `reliability`. Cash debits at
  **placement** (acquisition-debit discipline), not arrival.
- **Lead time / reliability.** An order's `arrivalDay = placedDay + leadTimeDays`,
  plus `delayPenaltyDays` when a seeded on-time roll fails (`rng() >=
  reliability`). The order materializes as a stock lot on the first `advanceDay`
  at/after `arrivalDay`.
- **Rush.** `rushOrder` is the same placement at the `rush` tier — the on-demand
  emergency top-up the dispatch parts-gate will fire on an under-stock miss.

## Events
- **None.** Stock-in, consumption, and order cash flow are direct API calls; the
  cash flow is already observable via Economy's `economy:expense_posted`.
  Parts-ordered/received/consumed events join the catalog when the
  ServiceDispatch parts-gate lands.

## Persistence (#299/#301)
- `snapshot()/restore()` round-trips part lots **plus** (#301) the procurement
  policies, in-flight `pendingOrders`, `currentDay`, and `orderSeq` (the order
  counter that keys each seeded draw, so a reload keeps drawing identically)
  under the `partsInventory` world-snapshot key. Schema is **v2**; a legacy
  #299 **v1** snapshot (lots only) restores by materializing default policies +
  an empty order book. Envelope stays **v10** (additive module fields need no
  envelope bump). `restore` defensively drops any zero-qty lot or order.

## Determinism
- `addStock`/`consume` are pure stock math. The only RNG is the order
  lead-time/reliability roll, seeded off `masterSeed +
  'parts_inventory.order' + {day, category, orderSeq}` (via `NPC/Rng`), so a
  replay — and a save reload — reproduces the same arrival schedule (#122).
