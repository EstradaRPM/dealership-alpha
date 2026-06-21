/**
 * PartsInventory types (#299, parent PRD #297).
 *
 * Parts stock for the four Service parts categories, mirroring the vehicle
 * `Inventory` discipline — pay cash at acquisition, recoup it only as matching
 * jobs consume the stock. This slice delivers stock-in + consumption + the
 * coverage read-model seam + persistence; procurement (par-levels, supplier
 * tiers, lead times) and the Body-Shop categories are later #297 slices.
 */
import type { Economy } from '../Economy';

/**
 * The four Service parts categories. Mirror one-for-one the InstalledBase
 * `JobCategory` ladder — one completed job of a given category depletes one unit
 * of the matching part — but the union is declared independently here so the two
 * modules stay decoupled (no cross-module type import).
 */
export type PartCategory =
  | 'oil_filters'
  | 'tires_brakes'
  | 'drivetrain'
  | 'electronics';

/** All part categories, in the same early→late order as the job-category drift. */
export const PART_CATEGORIES: readonly PartCategory[] = [
  'oil_filters',
  'tires_brakes',
  'drivetrain',
  'electronics',
] as const;

/**
 * One stock lot: `qty` units of `category` bought at `unitCost` each. A stock-in
 * pushes a lot; consumption depletes one unit at a time (oldest lot first) and
 * prunes a lot once it empties. `unitCost` is the cash basis at purchase — it is
 * retained per-lot so the snapshot round-trips the exact dead-capital the player
 * is carrying.
 */
export interface PartLot {
  readonly category: PartCategory;
  readonly qty: number;
  readonly unitCost: number;
}

export interface PartsInventorySnapshot {
  readonly schemaVersion: 1;
  readonly lots: readonly PartLot[];
}

export interface PartsInventory {
  /**
   * Manual stock-in: buy `qty` units of `category` at `unitCost` each, debiting
   * `qty × unitCost` cash via Economy as an `inventoryAcquisition` expense (cash
   * converted into stock, same category the vehicle lot uses). A new lot is
   * appended. No-op (no lot, no debit) when `qty <= 0`; a negative `unitCost` is
   * clamped to 0.
   */
  addStock(category: PartCategory, qty: number, unitCost: number): void;
  /**
   * Deplete exactly one unit of `category` (oldest lot first). Returns `true`
   * when a unit was on hand and consumed, `false` on a miss (empty category) —
   * the miss is observable to the caller rather than thrown, so the future
   * Service parts-gate can route it to the lost-revenue / rush-order path.
   */
  consume(category: PartCategory): boolean;
  /** Units on hand for one category (summed across its lots). */
  getStock(category: PartCategory): number;
  /**
   * Coverage read-model seam: on-hand units per category (every category keyed,
   * 0 when empty). The future Service page diffs this against demand to render
   * the stock-coverage gap; this slice exposes only the on-hand side.
   */
  getCoverage(): Record<PartCategory, number>;
  /** All current lots, in accrual order (oldest first). */
  getLots(): readonly PartLot[];
  /** #299 SaveStore seam: capture/rehydrate the part lots. */
  snapshot(): PartsInventorySnapshot;
  restore(snap: PartsInventorySnapshot): void;
}

export interface PartsInventoryDeps {
  /** Stock-in debits cash here; only `postExpense` is needed this slice. */
  economy: Pick<Economy, 'postExpense'>;
}
