import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy, DEPARTMENT_CENTERS } from '../src/game/Economy';
import type { DepartmentPnLSummary, Economy, ProfitCenter } from '../src/game/Economy';

/**
 * #375 — the departmental axis on the ledger.
 *
 * The store runs four profit centers, and until this slice nothing could say
 * which one made the money. These tests pin the two halves that make the answer
 * trustworthy: an untagged post is overhead (never a department's gross), and
 * `sum(departmental gross) − overhead === netIncome` for any window — an
 * identity that is only available because #374 made the statement accrual.
 */

const STARTING_CASH = 1_000_000;
const NO_RENT = { weeklyRent: 0 };

function makeEconomy(): { economy: Economy; toDay(day: number): void } {
  const bus = createEventBus();
  const clock = createGameClock({ bus });
  const economy = createEconomy({
    bus,
    startingCash: STARTING_CASH,
    config: NO_RENT,
    getCurrentDay: () => clock.currentDay,
  });
  return {
    economy,
    toDay(day: number) {
      while (clock.currentDay < day) clock.advanceDay();
    },
  };
}

function grossOf(summary: DepartmentPnLSummary, center: ProfitCenter): number {
  return summary.departments.find((d) => d.center === center)!.gross;
}

function lineOf(summary: DepartmentPnLSummary, center: ProfitCenter) {
  return summary.departments.find((d) => d.center === center)!;
}

describe('Economy — the departmental P&L (#375)', () => {
  it('a post carries its profit center onto the entry', () => {
    const { economy } = makeEconomy();
    economy.postRevenue(20_000, 'Vehicle sale: v1', { profitCenter: 'sales' });
    economy.postExpense(600, 'Recon: v1', { profitCenter: 'sales' });
    economy.postCostOfSale(14_000, 'Cost of Vehicles Sold', { profitCenter: 'sales' });
    economy.postRevenue(900, 'Service — brakes', { profitCenter: 'service' });

    const centers = economy.snapshot().ledger!.map((e) => e.profitCenter);
    expect(centers).toEqual(['sales', 'sales', 'sales', 'service']);
  });

  it('an untagged post is overhead, not a department', () => {
    const { economy } = makeEconomy();
    economy.postExpense(4_000, 'Payroll');
    economy.postExpense(1_200, 'Marketing');

    const [entry] = economy.snapshot().ledger!;
    // Omitted, not `undefined` — a pre-#375 ledger round-trips byte-identical.
    expect('profitCenter' in entry).toBe(false);

    const summary = economy.getDepartmentPnL(1, 1);
    expect(summary.overhead).toBe(5_200);
    for (const center of DEPARTMENT_CENTERS) {
      expect(lineOf(summary, center)).toMatchObject({ gross: 0, active: false });
    }
  });

  it('reports revenue, cost of sale and gross per center', () => {
    const { economy } = makeEconomy();
    // Sales: a car sold for 20k that cost 14k, with 600 of recon against it.
    economy.postRevenue(20_000, 'Vehicle sale: v1', { profitCenter: 'sales' });
    economy.postCostOfSale(14_000, 'Cost of Vehicles Sold', { profitCenter: 'sales' });
    economy.postExpense(600, 'Recon: v1', { profitCenter: 'sales' });
    // F&I: product margin and reserve, both pure gross — no cost of sale.
    economy.postRevenue(1_100, 'F&I: gap', { profitCenter: 'fni' });
    economy.postRevenue(400, 'F&I: finance reserve', { profitCenter: 'fni' });
    // Service: a ticket, and the part it burned.
    economy.postRevenue(900, 'Service — brakes', { profitCenter: 'service' });
    economy.postCostOfSale(250, 'Parts used: tires_brakes', { profitCenter: 'service' });

    const summary = economy.getDepartmentPnL(1, 1);
    expect(lineOf(summary, 'sales')).toEqual({
      center: 'sales',
      revenue: 20_000,
      costOfSale: 14_600,
      gross: 5_400,
      active: true,
    });
    expect(lineOf(summary, 'fni')).toMatchObject({ revenue: 1_500, costOfSale: 0, gross: 1_500 });
    expect(lineOf(summary, 'service')).toMatchObject({ costOfSale: 250, gross: 650 });
    // Every center is reported, so a consumer never has to guess whether a
    // missing key means "nothing" or "not built yet".
    expect(summary.departments.map((d) => d.center)).toEqual([...DEPARTMENT_CENTERS]);
    expect(lineOf(summary, 'bodyshop').active).toBe(false);
  });

  it('the department breakdown reconciles with Net Income', () => {
    const { economy, toDay } = makeEconomy();
    economy.postRevenue(20_000, 'Vehicle sale: v1', { profitCenter: 'sales' });
    economy.postCostOfSale(14_000, 'Cost of Vehicles Sold', { profitCenter: 'sales' });
    economy.postRevenue(1_100, 'F&I: gap', { profitCenter: 'fni' });
    economy.postExpense(4_000, 'Payroll');
    // Buying stock is not a loss (#374) — dropped from BOTH reads, or the four
    // grosses would stop adding up to the Net Income printed beside them.
    economy.postExpense(12_000, 'Auction purchase: v2', {
      category: 'inventoryAcquisition',
      profitCenter: 'sales',
    });

    toDay(2);
    economy.postRevenue(900, 'Body Shop — bumper', { profitCenter: 'bodyshop' });
    economy.postExpense(300, 'Marketing');

    for (const [from, to] of [[1, 1], [2, 2], [1, 2], [1, 30]] as const) {
      const pnl = economy.getPnL(from, to);
      const dept = economy.getDepartmentPnL(from, to);
      const summed = dept.departments.reduce((s, d) => s + d.gross, 0);
      expect(summed - dept.overhead).toBe(pnl.netIncome);
      expect(dept.netIncome).toBe(pnl.netIncome);
    }

    expect(grossOf(economy.getDepartmentPnL(1, 2), 'sales')).toBe(6_000);
  });

  it('a store-center receipt nets against overhead rather than becoming gross', () => {
    const { economy } = makeEconomy();
    economy.postExpense(4_000, 'Payroll');
    economy.postRevenue(1_000, 'PE Sellout');

    const summary = economy.getDepartmentPnL(1, 1);
    expect(summary.overhead).toBe(3_000);
    expect(summary.netIncome).toBe(economy.getPnL(1, 1).netIncome);
  });

  it('a pre-tag ledger restores as overhead', () => {
    const { economy } = makeEconomy();
    // Exactly the shape a pre-#375 snapshot holds: no `profitCenter` anywhere.
    economy.restore({
      schemaVersion: 1,
      cash: 50_000,
      ledger: [
        { day: 1, type: 'revenue', amount: 20_000, label: 'Vehicle sale: v1' },
        { day: 1, type: 'expense', amount: 4_000, label: 'Payroll' },
      ],
    });

    const summary = economy.getDepartmentPnL(1, 1);
    expect(summary.overhead).toBe(-16_000);
    expect(summary.departments.every((d) => !d.active)).toBe(true);
    expect(summary.netIncome).toBe(16_000);
  });
});
