/**
 * PartsInventory types (#299/#301, parent PRD #297).
 *
 * Parts stock for the four Service parts categories, mirroring the vehicle
 * `Inventory` discipline — pay cash at acquisition, recoup it only as matching
 * jobs consume the stock. #299 delivered stock-in + consumption + the coverage
 * read-model seam + persistence; #301 adds par-level procurement (per-category
 * reorder point + target, supplier-tier lead time + reliability, the rush
 * emergency order). The Body-Shop categories are a later #297 slice.
 */
import type { Economy } from '../Economy';
import type { PartsInventoryConfig } from './partsInventoryConfig';

/**
 * The eight parts categories — the Service four plus the Body-Shop four (#312,
 * parent #297). PartsInventory keys all eight so the same stock/consume/coverage/
 * procurement machinery serves both profit centers (the shared department line,
 * `docs/planning/shared-department-structure.md`); each department only *activates*
 * its own four by carrying non-zero par on them (a department's par defaults to
 * 0, so an inactive category never auto-orders). The Service four mirror the
 * InstalledBase `JobCategory` ladder; the Body-Shop four mirror the collision
 * job ladder (windows/glass, doors/panels, interior trim, paint materials). The
 * union is declared independently here so the consuming modules stay decoupled
 * (no cross-module type import).
 */
export type PartCategory =
  // Service four.
  | 'oil_filters'
  | 'tires_brakes'
  | 'drivetrain'
  | 'electronics'
  // Body-Shop four (#312).
  | 'windows_glass'
  | 'doors_panels'
  | 'interior_trim'
  | 'paint';

/**
 * All part categories — the Service four (early→late job-category drift) followed
 * by the Body-Shop four. Appending the Body-Shop categories keeps the existing
 * seeded reorder draws order-stable: an inactive (0-par) category never places an
 * order, so it consumes no `orderSeq` and the Service categories draw identically
 * (#122 replay-safe).
 */
export const PART_CATEGORIES: readonly PartCategory[] = [
  'oil_filters',
  'tires_brakes',
  'drivetrain',
  'electronics',
  'windows_glass',
  'doors_panels',
  'interior_trim',
  'paint',
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

/**
 * The four supplier tiers, cheapest/slowest → priciest/fastest. A tier trades
 * unit cost (a multiplier on a category's `baseUnitCost`) against lead time and
 * reliability. `rush` is the priciest/fastest tier and backs the on-demand
 * emergency order the future Service parts-gate fires on an under-stock miss.
 */
export type SupplierTier = 'economy' | 'standard' | 'oem_direct' | 'rush';

/** All supplier tiers, cheapest/slowest → priciest/fastest. */
export const SUPPLIER_TIERS: readonly SupplierTier[] = [
  'economy',
  'standard',
  'oem_direct',
  'rush',
] as const;

/**
 * Per-category procurement policy. When on-hand falls to `reorderPoint` an order
 * is placed to fill back up to `target`, sourced from supplier `tier`. Seeded
 * from the category's data defaults; the player overrides it via `setPolicy`.
 */
export interface ProcurementPolicy {
  readonly reorderPoint: number;
  readonly target: number;
  readonly tier: SupplierTier;
}

/**
 * An order in flight: `qty` units of `category` bought at `unitCost` each
 * (`baseUnitCost × tier.costMultiplier`), placed on `placedDay`, arriving on
 * `arrivalDay` (= placedDay + the tier lead time, plus a reliability-delay
 * penalty when the seeded on-time roll fails). Cash is already debited at
 * placement; the order materializes as a stock lot when its arrival day comes.
 */
export interface PendingOrder {
  readonly category: PartCategory;
  readonly qty: number;
  readonly unitCost: number;
  readonly tier: SupplierTier;
  readonly placedDay: number;
  readonly arrivalDay: number;
}

/**
 * Coverage-gap read-model row for one category: the demand the caller supplied,
 * units `onHand`, units `onOrder` (in flight), and the resulting `gap` =
 * demand − onHand − onOrder. A positive gap is a shortage to act on; zero or
 * negative means demand is already covered by stock plus inbound orders.
 */
export interface CoverageGap {
  readonly demand: number;
  readonly onHand: number;
  readonly onOrder: number;
  readonly gap: number;
}

/**
 * #301 procurement snapshot (schemaVersion 2). Adds the player-set `policies`,
 * the in-flight `pendingOrders`, the module's `currentDay`, and the monotonic
 * `orderSeq` (which keys each order's seeded lead-time/reliability draw so a
 * restored game keeps drawing identically). A #299 v1 snapshot (lots only)
 * restores by materializing default policies + an empty order book.
 */
export interface PartsInventorySnapshotV1 {
  readonly schemaVersion: 1;
  readonly lots: readonly PartLot[];
}

export interface PartsInventorySnapshot {
  readonly schemaVersion: 2;
  readonly lots: readonly PartLot[];
  readonly policies: Readonly<Record<PartCategory, ProcurementPolicy>>;
  readonly pendingOrders: readonly PendingOrder[];
  readonly currentDay: number;
  readonly orderSeq: number;
}

/** Either persisted shape `restore` accepts — the live v2 or a legacy #299 v1. */
export type AnyPartsInventorySnapshot =
  | PartsInventorySnapshot
  | PartsInventorySnapshotV1;

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
  /**
   * #301 read the current procurement policy for a category (its par levels +
   * supplier tier). Seeded from data defaults until `setPolicy` overrides it.
   */
  getPolicy(category: PartCategory): ProcurementPolicy;
  /**
   * #301 override a category's procurement policy. Any subset of fields may be
   * given; the rest keep their current values. `reorderPoint`/`target` are
   * floored at 0; an unknown tier is ignored. The next `advanceDay` reorder
   * sweep uses the new policy.
   */
  setPolicy(category: PartCategory, policy: Partial<ProcurementPolicy>): void;
  /**
   * #301 advance the procurement clock to `day`: first receive every order due
   * (`arrivalDay <= day`) as a stock lot, then run the par-level reorder sweep —
   * any category whose on-hand has fallen to its reorder point (and isn't
   * already covered to target by stock + inbound orders) places an order to fill
   * to target. The composition root drives this off `clock:day_started`.
   */
  advanceDay(day: number): void;
  /**
   * #301 on-demand emergency order at the premium `rush` tier — the under-stock
   * path the future Service parts-gate fires when a job misses. Debits cash now;
   * the units arrive after the (short) rush lead time. `qty` defaults to 1 (the
   * single unit a missed job needs); `qty <= 0` is a no-op.
   */
  rushOrder(category: PartCategory, qty?: number): void;
  /** #301 all orders in flight, in placement order (oldest first). */
  getPendingOrders(): readonly PendingOrder[];
  /** #301 in-flight units for one category (summed across pending orders). */
  getOnOrder(category: PartCategory): number;
  /**
   * #301 coverage-gap read-model: per category, the caller's `demand` diffed
   * against on-hand + in-flight stock. Every category is keyed; a missing demand
   * entry counts as 0. The Service page renders this as the "you need brakes,
   * you stock 4" signal.
   */
  getCoverageGap(
    demand: Partial<Record<PartCategory, number>>,
  ): Record<PartCategory, CoverageGap>;
  /** #299/#301 SaveStore seam: capture/rehydrate lots, policies, and orders. */
  snapshot(): PartsInventorySnapshot;
  restore(snap: AnyPartsInventorySnapshot): void;
}

export interface PartsInventoryDeps {
  /** Stock-in and order placement debit cash here. */
  economy: Pick<Economy, 'postExpense'>;
  /**
   * Procurement tunables (category base costs + par defaults, supplier tiers).
   * Optional: defaults to `loadPartsInventoryConfig()` so legacy callers that
   * predate #301 keep working unchanged.
   */
  config?: PartsInventoryConfig;
  /**
   * Seeds each order's lead-time/reliability draw; defaults to 0 for
   * legacy/test callers. Keyed by `(day, category, orderSeq)` so replays — and
   * a save reload — draw identically (#122).
   */
  masterSeed?: number;
}
