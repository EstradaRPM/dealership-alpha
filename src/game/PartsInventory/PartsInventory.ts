import { createRng, deriveSeed } from '../NPC/Rng';
import { loadPartsInventoryConfig } from './partsInventoryConfig';
import {
  PART_CATEGORIES,
  type AnyPartsInventorySnapshot,
  type CoverageGap,
  type PartCategory,
  type PartLot,
  type PartsInventory,
  type PartsInventoryDeps,
  type PartsInventorySnapshot,
  type PendingOrder,
  type ProcurementPolicy,
  type SupplierTier,
} from './types';

/** Internal mutable lot — the public `PartLot` is the readonly projection. */
interface MutableLot {
  category: PartCategory;
  qty: number;
  unitCost: number;
}

const ORDER_SEED_NAMESPACE = 'parts_inventory.order';

/**
 * PartsInventory (#299/#301, parent PRD #297) — parts stock for the four Service
 * categories, the supply-side half of the Service profit center. It mirrors the
 * vehicle `Inventory` "pay at acquisition, recoup on use" discipline: stock-in
 * (and order placement) debits cash now; a unit is only recouped when a matching
 * job consumes it. Over-stock is punished purely as dead capital — no spoilage
 * timer, no age field.
 *
 * **Stock-in (#299).** `addStock(category, qty, unitCost)` appends a `{category,
 * qty, unitCost}` lot and debits `qty × unitCost` via Economy (categorized
 * `inventoryAcquisition`). `qty <= 0` is a no-op.
 *
 * **Consumption (#299).** `consume(category)` depletes one unit from the oldest
 * lot and returns a boolean miss signal (`true` consumed / `false` empty) rather
 * than throwing, so the future parts-gate routes a miss to the lost-revenue /
 * rush path.
 *
 * **Par-level procurement (#301).** Each category carries a `ProcurementPolicy`
 * (`reorderPoint` / `target` / supplier `tier`), seeded from data defaults and
 * overridable via `setPolicy`. `advanceDay(day)` first receives every order due
 * that day as a stock lot, then runs the reorder sweep: any category whose
 * on-hand has fallen to its reorder point — and isn't already covered to target
 * by stock + inbound orders — places an order to fill to target. Orders debit
 * cash at placement (matching the acquisition-debit discipline) and arrive after
 * the supplier-tier lead time, extended by a reliability-delay penalty when the
 * seeded on-time roll fails. `rushOrder` is the on-demand premium-tier emergency
 * order the parts-gate fires on an under-stock miss.
 *
 * **Read-model (#301).** `getCoverageGap(demand)` diffs demand against on-hand +
 * in-flight stock per category — the coverage signal the Service page renders.
 *
 * **Determinism.** Each order's lead-time/reliability draw is seeded off
 * `masterSeed + 'parts_inventory.order' + {day, category, orderSeq}`, so a replay
 * — and a save reload — reproduces the same arrival schedule (#122). `orderSeq`
 * is persisted so the keying survives a round-trip.
 */
export function createPartsInventory(deps: PartsInventoryDeps): PartsInventory {
  const { economy } = deps;
  const config = deps.config ?? loadPartsInventoryConfig();
  const masterSeed = deps.masterSeed ?? 0;

  // Lots in accrual order (oldest first) so consumption is deterministic FIFO.
  const lots: MutableLot[] = [];
  // Orders in flight, in placement order (oldest first).
  const pendingOrders: PendingOrder[] = [];
  // Per-category procurement policy, seeded from the data defaults.
  const policies = new Map<PartCategory, ProcurementPolicy>();
  for (const category of PART_CATEGORIES) {
    const d = config.categories[category];
    policies.set(category, {
      reorderPoint: d.reorderPoint,
      target: d.target,
      tier: config.defaultTier,
    });
  }

  let currentDay = 0;
  // Monotonic order counter — keys each order's seeded draw so two orders of the
  // same category on the same day still draw independently.
  let orderSeq = 0;

  function onHand(category: PartCategory): number {
    let total = 0;
    for (const lot of lots) {
      if (lot.category === category) total += lot.qty;
    }
    return total;
  }

  function onOrder(category: PartCategory): number {
    let total = 0;
    for (const order of pendingOrders) {
      if (order.category === category) total += order.qty;
    }
    return total;
  }

  /**
   * Place an order: debit cash now and schedule arrival after the tier lead time
   * (+ a reliability-delay penalty on a failed seeded on-time roll). `qty <= 0`
   * is a no-op. The lot's `unitCost` is `baseUnitCost × tier.costMultiplier`.
   */
  function placeOrder(
    category: PartCategory,
    qty: number,
    tier: SupplierTier,
  ): void {
    if (qty <= 0) return;
    const spec = config.supplierTiers[tier];
    const unitCost = Math.round(config.categories[category].baseUnitCost * spec.costMultiplier);

    economy.postExpense(
      qty * unitCost,
      `Parts order (${tier}): ${qty}× ${category}`,
      'inventoryAcquisition',
    );

    // Seeded on-time roll — a failure pushes arrival out by the tier's penalty.
    const rng = createRng(
      deriveSeed(masterSeed, ORDER_SEED_NAMESPACE, {
        day: currentDay,
        category,
        seq: orderSeq,
      }),
    );
    const late = rng() >= spec.reliability;
    const arrivalDay =
      currentDay + spec.leadTimeDays + (late ? spec.delayPenaltyDays : 0);

    pendingOrders.push({
      category,
      qty,
      unitCost,
      tier,
      placedDay: currentDay,
      arrivalDay,
    });
    orderSeq += 1;
  }

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
      return onHand(category);
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

    getPolicy(category) {
      // Map is seeded with every category, so this is always defined.
      return { ...(policies.get(category) as ProcurementPolicy) };
    },

    setPolicy(category, policy) {
      const current = policies.get(category) as ProcurementPolicy;
      const tier =
        policy.tier !== undefined && policy.tier in config.supplierTiers
          ? policy.tier
          : current.tier;
      policies.set(category, {
        reorderPoint:
          policy.reorderPoint !== undefined
            ? Math.max(0, policy.reorderPoint)
            : current.reorderPoint,
        target:
          policy.target !== undefined
            ? Math.max(0, policy.target)
            : current.target,
        tier,
      });
    },

    advanceDay(day) {
      currentDay = day;

      // 1. Receive every order due (arrivalDay <= day). Defensive `<=` so an
      //    order whose day was skipped still lands rather than stranding.
      for (let i = pendingOrders.length - 1; i >= 0; i--) {
        const order = pendingOrders[i];
        if (order.arrivalDay <= day) {
          lots.push({
            category: order.category,
            qty: order.qty,
            unitCost: order.unitCost,
          });
          pendingOrders.splice(i, 1);
        }
      }

      // 2. Par-level reorder sweep — order in fixed category order so the seeded
      //    draws are deterministic regardless of Map iteration nuances.
      for (const category of PART_CATEGORIES) {
        const policy = policies.get(category) as ProcurementPolicy;
        const have = onHand(category);
        if (have > policy.reorderPoint) continue;
        const fill = policy.target - (have + onOrder(category));
        if (fill <= 0) continue;
        placeOrder(category, fill, policy.tier);
      }
    },

    rushOrder(category, qty = 1) {
      placeOrder(category, qty, 'rush');
    },

    getPendingOrders(): readonly PendingOrder[] {
      return pendingOrders.map((order) => ({ ...order }));
    },

    getOnOrder(category) {
      return onOrder(category);
    },

    getCoverageGap(demand) {
      const gap = {} as Record<PartCategory, CoverageGap>;
      for (const category of PART_CATEGORIES) {
        const d = demand[category] ?? 0;
        const have = onHand(category);
        const inbound = onOrder(category);
        gap[category] = {
          demand: d,
          onHand: have,
          onOrder: inbound,
          gap: d - have - inbound,
        };
      }
      return gap;
    },

    snapshot(): PartsInventorySnapshot {
      return {
        schemaVersion: 2,
        lots: lots.map((lot) => ({ ...lot })),
        policies: Object.fromEntries(
          PART_CATEGORIES.map((c) => [c, { ...(policies.get(c) as ProcurementPolicy) }]),
        ) as Record<PartCategory, ProcurementPolicy>,
        pendingOrders: pendingOrders.map((order) => ({ ...order })),
        currentDay,
        orderSeq,
      };
    },

    restore(snap: AnyPartsInventorySnapshot) {
      lots.length = 0;
      for (const lot of snap.lots) {
        // Defensive: skip any empty lot a future writer might emit, so a
        // restored module never carries a zero-qty lot consume would have pruned.
        if (lot.qty > 0) lots.push({ ...lot });
      }

      pendingOrders.length = 0;
      // Policies stay at their data defaults unless the snapshot carries overrides
      // (a #299 v1 snapshot has none), so a legacy save restores cleanly.
      for (const category of PART_CATEGORIES) {
        const d = config.categories[category];
        policies.set(category, {
          reorderPoint: d.reorderPoint,
          target: d.target,
          tier: config.defaultTier,
        });
      }

      if (snap.schemaVersion === 2) {
        for (const order of snap.pendingOrders) {
          if (order.qty > 0) pendingOrders.push({ ...order });
        }
        for (const category of PART_CATEGORIES) {
          const p = snap.policies[category];
          if (p) policies.set(category, { ...p });
        }
        currentDay = snap.currentDay;
        orderSeq = snap.orderSeq;
      } else {
        currentDay = 0;
        orderSeq = 0;
      }
    },
  };
}
