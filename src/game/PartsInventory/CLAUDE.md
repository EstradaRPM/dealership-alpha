# PartsInventory

Parts stock for the four Service parts categories — the supply-side half of the
Service profit center (#299, parent PRD #297). Mirrors the vehicle `Inventory`
discipline: **pay cash at acquisition, recoup it only as matching jobs consume
the stock.** Over-stock is punished purely as dead capital — no spoilage timer,
no age field.

**Built so far (#299): stock-in + consumption + the coverage read-model seam +
persistence.** Procurement (par-levels, reorder points, supplier-tier lead
times, the rush order), the Body-Shop parts categories, and the
consume-on-`service:ticket_closed` wiring are later #297 slices.

## Public API (`index.ts`)
- `createPartsInventory({ economy })` → `PartsInventory`. `economy` is
  `Pick<Economy, 'postExpense'>` — stock-in debits cash here.
- `addStock(category, qty, unitCost)` — append a lot and debit `qty × unitCost`
  via Economy (categorized `inventoryAcquisition`). `qty <= 0` is a no-op;
  negative `unitCost` clamps to 0.
- `consume(category)` → `boolean` — deplete one unit (oldest lot first). Returns
  `true` when consumed, `false` on a miss (empty category). **Never throws** —
  the miss is the observable signal the future parts-gate routes to the
  lost-revenue / rush path.
- `getStock(category)` / `getCoverage()` — on-hand reads. `getCoverage()` keys
  all four categories (0 when empty) as the coverage read-model seam.
- `getLots()` — all lots, accrual order (oldest first).
- `snapshot()` / `restore()` — barrel-exported `PartsInventorySnapshot`.
- `PART_CATEGORIES` + types `PartsInventory`, `PartsInventoryDeps`,
  `PartsInventorySnapshot`, `PartCategory`, `PartLot`.

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

## Events
- **None this slice.** Stock-in and consumption are direct API calls; the cash
  flow is already observable via Economy's `economy:expense_posted`. Parts
  ordered/received/consumed events join the catalog when procurement + the
  ServiceDispatch parts-gate land.

## Persistence (#299)
- `snapshot()/restore()` round-trips the part lots under the `partsInventory`
  world-snapshot key (envelope **v10**; the v9→v10 migration materializes an
  empty `{ schemaVersion: 1, lots: [] }` for pre-existing saves). `restore`
  defensively skips any zero-qty lot so a restored module never carries a lot
  consumption would have pruned.

## Determinism
- Pure stock math — no RNG. `addStock`/`consume` are deterministic, so a replay
  of the same call sequence reproduces the same lots and cash flow (#122).
