import {
  PART_CATEGORIES,
  type PartCategory,
  type PartLot,
  type PartsInventory,
  type PartsInventoryDeps,
  type PartsInventorySnapshot,
} from './types';

/** Internal mutable lot — the public `PartLot` is the readonly projection. */
interface MutableLot {
  category: PartCategory;
  qty: number;
  unitCost: number;
}

/**
 * PartsInventory (#299, parent PRD #297) — parts stock for the four Service
 * categories, the supply-side half of the Service profit center. It mirrors the
 * vehicle `Inventory` "pay at acquisition, recoup on use" discipline: stock-in
 * debits cash now; a unit is only recouped when a matching job consumes it. Over-
 * stock is punished purely as dead capital — there is no spoilage timer and no
 * age field, so an over-bought lot just sits as cash the player cannot get back
 * until the jobs arrive.
 *
 * **Stock-in.** `addStock(category, qty, unitCost)` appends a `{category, qty,
 * unitCost}` lot and debits `qty × unitCost` via Economy (categorized
 * `inventoryAcquisition` — cash converted into stock, the same tag the vehicle
 * lot uses). `qty <= 0` is a no-op (no lot, no debit).
 *
 * **Consumption.** `consume(category)` depletes exactly one unit from the oldest
 * lot of that category and prunes the lot when it empties. It returns a boolean
 * miss signal (`true` consumed / `false` empty) rather than throwing, so the
 * future Service parts-gate can route a miss to the lost-revenue / rush path.
 *
 * **Read-model.** `getStock` / `getCoverage` expose on-hand counts; `getCoverage`
 * keys all four categories (0 when empty) as the coverage read-model seam the
 * Service page will diff against demand.
 *
 * No EventBus participation this slice: stock-in and consumption are direct API
 * calls, and the cash flow is already observable via Economy's
 * `economy:expense_posted`. The procurement seam (par-levels, supplier lead
 * times) and the consume-on-`service:ticket_closed` wiring are later #297 slices.
 */
export function createPartsInventory(deps: PartsInventoryDeps): PartsInventory {
  const { economy } = deps;

  // Lots in accrual order (oldest first) so consumption is deterministic FIFO.
  const lots: MutableLot[] = [];

  return {
    addStock(category, qty, unitCost) {
      if (qty <= 0) return;
      const cost = Math.max(0, unitCost);
      lots.push({ category, qty, unitCost: cost });
      economy.postExpense(
        Math.round(qty * cost),
        `Parts stock-in: ${qty}× ${category}`,
        'inventoryAcquisition',
      );
    },

    consume(category) {
      const lotIndex = lots.findIndex(
        (lot) => lot.category === category && lot.qty > 0,
      );
      if (lotIndex === -1) return false;
      const lot = lots[lotIndex];
      lot.qty -= 1;
      if (lot.qty <= 0) lots.splice(lotIndex, 1);
      return true;
    },

    getStock(category) {
      let total = 0;
      for (const lot of lots) {
        if (lot.category === category) total += lot.qty;
      }
      return total;
    },

    getCoverage() {
      const coverage = Object.fromEntries(
        PART_CATEGORIES.map((c) => [c, 0]),
      ) as Record<PartCategory, number>;
      for (const lot of lots) coverage[lot.category] += lot.qty;
      return coverage;
    },

    getLots(): readonly PartLot[] {
      return lots.map((lot) => ({ ...lot }));
    },

    snapshot(): PartsInventorySnapshot {
      return {
        schemaVersion: 1,
        lots: lots.map((lot) => ({ ...lot })),
      };
    },

    restore(snap) {
      lots.length = 0;
      for (const lot of snap.lots) {
        // Defensive: skip any empty lot a future writer might emit, so a
        // restored module never carries a zero-qty lot consume would have pruned.
        if (lot.qty > 0) lots.push({ ...lot });
      }
    },
  };
}
