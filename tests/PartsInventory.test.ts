import {
  createPartsInventory,
  PART_CATEGORIES,
  type PartsInventory,
  type PartsInventoryConfig,
} from '../src/game/PartsInventory';
import type { ExpenseTag, PostTag } from '../src/game/Economy';

/**
 * PartsInventory isolation tests (#299, parent #297). Exercise the public
 * surface only: stock-in (cash debit), consumption depletion, the empty-category
 * miss signal, the dead-capital discipline, the coverage read-model, and the
 * persistence round-trip.
 */

/**
 * A spy Economy capturing the ledger calls the module makes: the cash debits
 * (`postExpense`) and, since #375, the non-cash relief a consumed part posts
 * (`postCostOfSale`). `total` stays the CASH total — the relief moves no money,
 * so folding it in would double-count every part.
 */
function createEconomySpy() {
  const expenses: { amount: number; label: string; tag?: ExpenseTag }[] = [];
  const relief: { amount: number; label: string; tag?: PostTag }[] = [];
  return {
    expenses,
    relief,
    postExpense(amount: number, label: string, tag?: ExpenseTag) {
      expenses.push({ amount, label, tag });
    },
    postCostOfSale(amount: number, label: string, tag?: PostTag) {
      relief.push({ amount, label, tag });
    },
    get total() {
      return expenses.reduce((sum, e) => sum + e.amount, 0);
    },
  };
}

function build(): { parts: PartsInventory; economy: ReturnType<typeof createEconomySpy> } {
  const economy = createEconomySpy();
  const parts = createPartsInventory({ economy });
  return { parts, economy };
}

describe('PartsInventory (#299)', () => {
  it('keys the four Service plus four Body-Shop parts categories', () => {
    expect(PART_CATEGORIES).toEqual([
      'oil_filters',
      'tires_brakes',
      'drivetrain',
      'electronics',
      'windows_glass',
      'doors_panels',
      'interior_trim',
      'paint',
    ]);
  });

  describe('stock-in', () => {
    it('adds a lot and debits qty × unitCost via Economy as inventoryAcquisition', () => {
      const { parts, economy } = build();
      parts.addStock('tires_brakes', 4, 250);

      expect(parts.getStock('tires_brakes')).toBe(4);
      expect(parts.getLots()).toEqual([
        { category: 'tires_brakes', qty: 4, unitCost: 250 },
      ]);
      expect(economy.expenses).toHaveLength(1);
      expect(economy.expenses[0]).toMatchObject({
        amount: 1000,
        tag: { category: 'inventoryAcquisition', profitCenter: 'service' },
      });
    });

    it('accumulates separate lots across multiple stock-ins of a category', () => {
      const { parts, economy } = build();
      parts.addStock('oil_filters', 3, 20);
      parts.addStock('oil_filters', 2, 25);

      expect(parts.getStock('oil_filters')).toBe(5);
      expect(parts.getLots()).toHaveLength(2);
      expect(economy.total).toBe(3 * 20 + 2 * 25);
    });

    it('is a no-op (no lot, no debit) when qty <= 0', () => {
      const { parts, economy } = build();
      parts.addStock('drivetrain', 0, 500);
      parts.addStock('drivetrain', -3, 500);

      expect(parts.getStock('drivetrain')).toBe(0);
      expect(parts.getLots()).toHaveLength(0);
      expect(economy.expenses).toHaveLength(0);
    });

    it('clamps a negative unitCost to 0', () => {
      const { parts, economy } = build();
      parts.addStock('electronics', 2, -100);

      expect(parts.getLots()).toEqual([
        { category: 'electronics', qty: 2, unitCost: 0 },
      ]);
      expect(economy.total).toBe(0);
    });

    it('rounds a fractional total when debiting', () => {
      const { parts, economy } = build();
      parts.addStock('oil_filters', 3, 19.99);
      expect(economy.expenses[0].amount).toBe(Math.round(3 * 19.99));
    });
  });

  describe('consumption', () => {
    it('depletes exactly one unit per call and returns true on a hit', () => {
      const { parts } = build();
      parts.addStock('tires_brakes', 2, 250);

      expect(parts.consume('tires_brakes')).toBe(true);
      expect(parts.getStock('tires_brakes')).toBe(1);
      expect(parts.consume('tires_brakes')).toBe(true);
      expect(parts.getStock('tires_brakes')).toBe(0);
    });

    // #375 — the accrual half. The cash left at the order (dropped from the
    // P&L as `inventoryAcquisition`); the cost arrives on the statement here,
    // on the day a job used the part, against that department's revenue.
    it("relieves the consumed unit's cost to the part's own department", () => {
      const { parts, economy } = build();
      parts.addStock('tires_brakes', 2, 250); // Service
      parts.addStock('paint', 1, 400); // Body Shop

      parts.consume('tires_brakes');
      parts.consume('paint');

      expect(economy.relief).toEqual([
        { amount: 250, label: 'Parts used: tires_brakes', tag: { profitCenter: 'service' } },
        { amount: 400, label: 'Parts used: paint', tag: { profitCenter: 'bodyshop' } },
      ]);
      // The relief moves no money — the cash total is still the two orders.
      expect(economy.total).toBe(2 * 250 + 400);
    });

    it('a miss relieves nothing — no part left the shelf', () => {
      const { parts, economy } = build();
      expect(parts.consume('drivetrain')).toBe(false);
      expect(economy.relief).toHaveLength(0);
    });

    it('returns false (miss signal) on an empty category, without throwing', () => {
      const { parts } = build();
      expect(() => parts.consume('drivetrain')).not.toThrow();
      expect(parts.consume('drivetrain')).toBe(false);
    });

    it('returns false once a previously-stocked category is depleted', () => {
      const { parts } = build();
      parts.addStock('electronics', 1, 800);
      expect(parts.consume('electronics')).toBe(true);
      expect(parts.consume('electronics')).toBe(false);
      expect(parts.getStock('electronics')).toBe(0);
    });

    it('depletes oldest lot first and prunes an emptied lot', () => {
      const { parts } = build();
      parts.addStock('oil_filters', 1, 20); // lot A (oldest)
      parts.addStock('oil_filters', 2, 25); // lot B

      expect(parts.consume('oil_filters')).toBe(true); // empties lot A
      expect(parts.getLots()).toEqual([
        { category: 'oil_filters', qty: 2, unitCost: 25 },
      ]);
    });

    it('consuming one category never touches another', () => {
      const { parts } = build();
      parts.addStock('oil_filters', 2, 20);
      parts.addStock('drivetrain', 1, 500);

      expect(parts.consume('drivetrain')).toBe(true);
      expect(parts.getStock('oil_filters')).toBe(2);
    });
  });

  describe('dead-capital discipline', () => {
    it('over-stock carries no spoilage — units persist until consumed', () => {
      const { parts } = build();
      parts.addStock('drivetrain', 10, 500); // over-bought

      // No timer/decay: every consume returns a unit until exhausted.
      for (let i = 0; i < 10; i++) {
        expect(parts.consume('drivetrain')).toBe(true);
      }
      expect(parts.consume('drivetrain')).toBe(false);
    });

    it('cash is spent once at stock-in and is not refunded on consumption', () => {
      const { parts, economy } = build();
      parts.addStock('drivetrain', 4, 500);
      const spentAtStockIn = economy.total;

      parts.consume('drivetrain');
      parts.consume('drivetrain');

      // Consumption posts nothing — capital is recouped only as service revenue
      // (a later slice), never refunded here.
      expect(economy.total).toBe(spentAtStockIn);
      expect(economy.expenses).toHaveLength(1);
    });
  });

  describe('coverage read-model', () => {
    it('keys every category, 0 when empty', () => {
      const { parts } = build();
      parts.addStock('tires_brakes', 3, 250);

      expect(parts.getCoverage()).toEqual({
        oil_filters: 0,
        tires_brakes: 3,
        drivetrain: 0,
        electronics: 0,
        windows_glass: 0,
        doors_panels: 0,
        interior_trim: 0,
        paint: 0,
      });
    });

    it('reflects consumption', () => {
      const { parts } = build();
      parts.addStock('oil_filters', 2, 20);
      parts.consume('oil_filters');
      expect(parts.getCoverage().oil_filters).toBe(1);
    });
  });

  describe('procurement (#301)', () => {
    // A fully on-time config (reliability 1.0) so arrival days are deterministic
    // for the par-level / lead-time / trade-off assertions. The determinism test
    // below uses a sub-1.0 reliability to exercise the seeded on-time roll.
    const CONFIG: PartsInventoryConfig = {
      defaultTier: 'standard',
      categories: {
        oil_filters: { baseUnitCost: 20, reorderPoint: 2, target: 10 },
        tires_brakes: { baseUnitCost: 200, reorderPoint: 1, target: 4 },
        drivetrain: { baseUnitCost: 1000, reorderPoint: 0, target: 2 },
        electronics: { baseUnitCost: 500, reorderPoint: 0, target: 2 },
        // Body-Shop four — keyed but inactive (0 par ⇒ no auto-order), #312.
        windows_glass: { baseUnitCost: 300, reorderPoint: 0, target: 0 },
        doors_panels: { baseUnitCost: 700, reorderPoint: 0, target: 0 },
        interior_trim: { baseUnitCost: 200, reorderPoint: 0, target: 0 },
        paint: { baseUnitCost: 150, reorderPoint: 0, target: 0 },
      },
      supplierTiers: {
        economy: { costMultiplier: 0.8, leadTimeDays: 8, reliability: 1, delayPenaltyDays: 5 },
        standard: { costMultiplier: 1.0, leadTimeDays: 4, reliability: 1, delayPenaltyDays: 2 },
        oem_direct: { costMultiplier: 1.5, leadTimeDays: 2, reliability: 1, delayPenaltyDays: 1 },
        rush: { costMultiplier: 2.0, leadTimeDays: 1, reliability: 1, delayPenaltyDays: 1 },
      },
    };

    function buildProc() {
      const economy = createEconomySpy();
      const parts = createPartsInventory({ economy, config: CONFIG, masterSeed: 7 });
      return { parts, economy };
    }

    it('seeds each category policy from the data defaults', () => {
      const { parts } = buildProc();
      expect(parts.getPolicy('oil_filters')).toEqual({
        reorderPoint: 2,
        target: 10,
        tier: 'standard',
      });
    });

    const ordersFor = (parts: PartsInventory, category: string) =>
      parts.getPendingOrders().filter((o) => o.category === category);

    it('places a reorder to target when on-hand falls to the reorder point', () => {
      const { parts } = buildProc();
      parts.addStock('oil_filters', 3, 20); // on-hand 3, above reorderPoint 2

      parts.advanceDay(1); // 3 > 2 → no oil_filters reorder
      expect(ordersFor(parts, 'oil_filters')).toHaveLength(0);

      parts.consume('oil_filters'); // on-hand → 2, == reorderPoint
      parts.advanceDay(2);

      const orders = ordersFor(parts, 'oil_filters');
      expect(orders).toHaveLength(1);
      // Fills to target: target 10 − (onHand 2 + onOrder 0) = 8 units.
      expect(orders[0]).toMatchObject({
        category: 'oil_filters',
        qty: 8,
        tier: 'standard',
        placedDay: 2,
        arrivalDay: 6, // placedDay 2 + standard leadTime 4, on time
      });
    });

    it('debits cash at order placement, not at arrival', () => {
      const { parts, economy } = buildProc();
      parts.setPolicy('oil_filters', { reorderPoint: 2, target: 5 });
      // Park the other categories so only oil_filters orders.
      for (const c of ['tires_brakes', 'drivetrain', 'electronics'] as const) {
        parts.setPolicy(c, { reorderPoint: 0, target: 0 });
      }
      parts.advanceDay(1); // oil_filters 0 <= 2 → orders 5 @ (20 × 1.0)
      expect(economy.total).toBe(100); // cash out now
      expect(parts.getStock('oil_filters')).toBe(0); // nothing arrived yet

      parts.advanceDay(5); // arrival day — stock lands, no further debit
      expect(parts.getStock('oil_filters')).toBe(5);
      expect(economy.total).toBe(100);
    });

    it('does not re-order while an inbound order already covers the gap to target', () => {
      const { parts } = buildProc();
      parts.advanceDay(1); // drivetrain reorderPoint 0, on-hand 0 → orders 2
      expect(ordersFor(parts, 'drivetrain')).toHaveLength(1);
      expect(parts.getOnOrder('drivetrain')).toBe(2);

      parts.advanceDay(2); // still 0 on hand, but 2 on order == target → no new order
      expect(ordersFor(parts, 'drivetrain')).toHaveLength(1);
    });

    it('an order arrives as stock only after the supplier-tier lead time', () => {
      const { parts } = buildProc();
      parts.advanceDay(0); // tires_brakes: on-hand 0 == reorderPoint 1? 0 <= 1 → orders 4
      const order = parts
        .getPendingOrders()
        .find((o) => o.category === 'tires_brakes');
      expect(order?.arrivalDay).toBe(4); // standard leadTime 4

      parts.advanceDay(3); // before arrival
      expect(parts.getStock('tires_brakes')).toBe(0);

      parts.advanceDay(4); // arrival day
      expect(parts.getStock('tires_brakes')).toBe(4);
      expect(parts.getOnOrder('tires_brakes')).toBe(0);
    });

    it('supplier tiers trade unit cost against lead time', () => {
      const economy = createEconomySpy();
      const parts = createPartsInventory({ economy, config: CONFIG, masterSeed: 7 });
      parts.setPolicy('tires_brakes', { tier: 'economy' });
      parts.advanceDay(0);
      const economyOrder = parts
        .getPendingOrders()
        .find((o) => o.category === 'tires_brakes')!;

      const e2 = createEconomySpy();
      const p2 = createPartsInventory({ economy: e2, config: CONFIG, masterSeed: 7 });
      p2.setPolicy('tires_brakes', { tier: 'oem_direct' });
      p2.advanceDay(0);
      const oemOrder = p2
        .getPendingOrders()
        .find((o) => o.category === 'tires_brakes')!;

      // Economy: cheaper unit cost (200 × 0.8 = 160) but slower (lead 8 → day 8).
      expect(economyOrder.unitCost).toBe(160);
      expect(economyOrder.arrivalDay).toBe(8);
      // OEM-direct: pricier (200 × 1.5 = 300) but faster (lead 2 → day 2).
      expect(oemOrder.unitCost).toBe(300);
      expect(oemOrder.arrivalDay).toBe(2);
      expect(economyOrder.unitCost).toBeLessThan(oemOrder.unitCost);
      expect(economyOrder.arrivalDay).toBeGreaterThan(oemOrder.arrivalDay);
    });

    it('rushOrder places an on-demand premium order at the rush tier', () => {
      const { parts, economy } = buildProc();
      parts.advanceDay(0); // settle any auto-orders for unrelated categories
      const before = economy.total;

      parts.rushOrder('electronics'); // default qty 1
      const rush = parts
        .getPendingOrders()
        .filter((o) => o.category === 'electronics' && o.tier === 'rush');
      expect(rush).toHaveLength(1);
      // Premium unit cost: 500 × 2.0 = 1000, fast arrival (rush leadTime 1).
      expect(rush[0]).toMatchObject({ qty: 1, unitCost: 1000, arrivalDay: 1 });
      expect(economy.total).toBe(before + 1000);
    });

    it('rushOrder is a no-op when qty <= 0', () => {
      const { parts, economy } = buildProc();
      parts.advanceDay(0);
      const before = parts.getPendingOrders().length;
      parts.rushOrder('electronics', 0);
      expect(parts.getPendingOrders()).toHaveLength(before);
      void economy;
    });

    it('coverage-gap read-model reports demand vs on-hand + in-flight per category', () => {
      const { parts } = buildProc();
      parts.addStock('oil_filters', 4, 20);
      parts.rushOrder('oil_filters', 3); // 3 in flight

      const gap = parts.getCoverageGap({ oil_filters: 12 });
      expect(gap.oil_filters).toEqual({
        demand: 12,
        onHand: 4,
        onOrder: 3,
        gap: 5, // 12 − 4 − 3
      });
      // Unmentioned categories key to a 0-demand row.
      expect(gap.drivetrain).toEqual({
        demand: 0,
        onHand: 0,
        onOrder: 0,
        gap: 0,
      });
    });

    it('setPolicy floors par levels at 0 and ignores an unknown tier', () => {
      const { parts } = buildProc();
      parts.setPolicy('oil_filters', {
        reorderPoint: -5,
        target: -1,
        // @ts-expect-error exercising the runtime guard against a bad tier
        tier: 'nonsense',
      });
      expect(parts.getPolicy('oil_filters')).toEqual({
        reorderPoint: 0,
        target: 0,
        tier: 'standard', // unchanged
      });
    });

    it('lead-time / reliability draws are deterministic under a fixed seed', () => {
      const flaky: PartsInventoryConfig = {
        ...CONFIG,
        supplierTiers: {
          ...CONFIG.supplierTiers,
          standard: { ...CONFIG.supplierTiers.standard, reliability: 0.5 },
        },
      };
      const run = () => {
        const economy = createEconomySpy();
        const parts = createPartsInventory({ economy, config: flaky, masterSeed: 42 });
        for (let day = 0; day < 30; day++) {
          if (day % 3 === 0) parts.consume('oil_filters');
          parts.advanceDay(day);
        }
        return parts.getPendingOrders();
      };
      expect(run()).toEqual(run());
    });
  });

  describe('persistence', () => {
    it('round-trips part lots through snapshot/restore', () => {
      const { parts } = build();
      parts.addStock('oil_filters', 3, 20);
      parts.addStock('tires_brakes', 4, 250);
      parts.consume('oil_filters');

      const snap = parts.snapshot();
      expect(snap.schemaVersion).toBe(2);

      const { parts: rebuilt } = build();
      rebuilt.restore(snap);

      expect(rebuilt.getCoverage()).toEqual(parts.getCoverage());
      expect(rebuilt.getLots()).toEqual(parts.getLots());
      // Behavior continues identically post-restore.
      expect(rebuilt.consume('tires_brakes')).toBe(true);
      expect(rebuilt.getStock('tires_brakes')).toBe(3);
    });

    it('a snapshot is an independent copy (mutating the source does not leak)', () => {
      const { parts } = build();
      parts.addStock('drivetrain', 2, 500);
      const snap = parts.snapshot();
      parts.consume('drivetrain');
      // The captured snapshot still reflects the pre-consume state.
      expect(snap.lots).toEqual([
        { category: 'drivetrain', qty: 2, unitCost: 500 },
      ]);
    });

    it('restore drops any zero-qty lot defensively', () => {
      const { parts } = build();
      parts.restore({
        schemaVersion: 1,
        lots: [
          { category: 'oil_filters', qty: 0, unitCost: 20 },
          { category: 'drivetrain', qty: 2, unitCost: 500 },
        ],
      });
      expect(parts.getLots()).toEqual([
        { category: 'drivetrain', qty: 2, unitCost: 500 },
      ]);
    });

    it('round-trips procurement policies and in-flight orders (#301)', () => {
      const economy = createEconomySpy();
      const parts = createPartsInventory({ economy, masterSeed: 9 });
      parts.setPolicy('drivetrain', { reorderPoint: 2, target: 6, tier: 'oem_direct' });
      parts.advanceDay(0); // places auto-orders
      parts.rushOrder('electronics', 1);

      const snap = parts.snapshot();
      expect(snap.schemaVersion).toBe(2);

      const rebuilt = createPartsInventory({
        economy: createEconomySpy(),
        masterSeed: 9,
      });
      rebuilt.restore(snap);

      expect(rebuilt.getPolicy('drivetrain')).toEqual({
        reorderPoint: 2,
        target: 6,
        tier: 'oem_direct',
      });
      expect(rebuilt.getPendingOrders()).toEqual(parts.getPendingOrders());

      // Behavior continues identically post-restore: advancing both to the same
      // day arrives the same orders and re-orders identically.
      parts.advanceDay(20);
      rebuilt.advanceDay(20);
      expect(rebuilt.getLots()).toEqual(parts.getLots());
      expect(rebuilt.getPendingOrders()).toEqual(parts.getPendingOrders());
    });

    it('restores a legacy #299 v1 snapshot with default policies + empty orders', () => {
      const economy = createEconomySpy();
      const parts = createPartsInventory({ economy });
      parts.restore({
        schemaVersion: 1,
        lots: [{ category: 'tires_brakes', qty: 2, unitCost: 250 }],
      });

      expect(parts.getStock('tires_brakes')).toBe(2);
      expect(parts.getPendingOrders()).toHaveLength(0);
      // Policies fall back to the data defaults rather than throwing.
      expect(parts.getPolicy('oil_filters').tier).toBeDefined();
    });
  });

  // ── Body-Shop categories (#312) ──────────────────────────────────────────────

  describe('Body-Shop parts categories (#312)', () => {
    it('stocks, consumes, and reports coverage for a Body-Shop category', () => {
      const { parts } = build();
      parts.addStock('windows_glass', 3, 300);
      expect(parts.getStock('windows_glass')).toBe(3);

      expect(parts.consume('windows_glass')).toBe(true);
      expect(parts.getStock('windows_glass')).toBe(2);
      expect(parts.getCoverage().windows_glass).toBe(2);
    });

    it('reports a miss (false) for an empty Body-Shop category', () => {
      const { parts } = build();
      expect(parts.consume('paint')).toBe(false);
    });

    it('keys every Body-Shop category in the coverage read-model', () => {
      const { parts } = build();
      const coverage = parts.getCoverage();
      expect(coverage.windows_glass).toBe(0);
      expect(coverage.doors_panels).toBe(0);
      expect(coverage.interior_trim).toBe(0);
      expect(coverage.paint).toBe(0);
    });

    it('ships the Body-Shop four inactive (0 par ⇒ no auto-order)', () => {
      const economy = createEconomySpy();
      const parts = createPartsInventory({ economy });
      // A reorder sweep with no body-shop stock must place no body-shop order —
      // the categories are keyed but dormant until the body-shop package sets par.
      parts.advanceDay(1);
      const bodyShopOrders = parts
        .getPendingOrders()
        .filter((o) =>
          ['windows_glass', 'doors_panels', 'interior_trim', 'paint'].includes(
            o.category,
          ),
        );
      expect(bodyShopOrders).toHaveLength(0);
    });
  });
});
