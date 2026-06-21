import {
  createPartsInventory,
  PART_CATEGORIES,
  type PartsInventory,
} from '../src/game/PartsInventory';

/**
 * PartsInventory isolation tests (#299, parent #297). Exercise the public
 * surface only: stock-in (cash debit), consumption depletion, the empty-category
 * miss signal, the dead-capital discipline, the coverage read-model, and the
 * persistence round-trip.
 */

/** A spy Economy capturing the `postExpense` calls the module makes. */
function createEconomySpy() {
  const expenses: { amount: number; label: string; category?: string }[] = [];
  return {
    expenses,
    postExpense(amount: number, label: string, category?: string) {
      expenses.push({ amount, label, category });
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
  it('models the four Service parts categories as lots', () => {
    expect(PART_CATEGORIES).toEqual([
      'oil_filters',
      'tires_brakes',
      'drivetrain',
      'electronics',
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
        category: 'inventoryAcquisition',
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
      });
    });

    it('reflects consumption', () => {
      const { parts } = build();
      parts.addStock('oil_filters', 2, 20);
      parts.consume('oil_filters');
      expect(parts.getCoverage().oil_filters).toBe(1);
    });
  });

  describe('persistence', () => {
    it('round-trips part lots through snapshot/restore', () => {
      const { parts } = build();
      parts.addStock('oil_filters', 3, 20);
      parts.addStock('tires_brakes', 4, 250);
      parts.consume('oil_filters');

      const snap = parts.snapshot();
      expect(snap.schemaVersion).toBe(1);

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
  });
});
