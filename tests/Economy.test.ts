import { createEventBus } from '../src/game/EventBus';
import { createGameClock, DAYS_PER_WEEK } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createInventory, loadVehicleData } from '../src/game/Inventory';

const STARTING_CASH = 50_000;
const CONFIG = { weeklyRent: 1200, weeklyPayrollStub: 800 };
const NO_OVERHEAD = { weeklyRent: 0, weeklyPayrollStub: 0 };

function makeSetup(startingCash = STARTING_CASH, config = NO_OVERHEAD) {
  const bus = createEventBus();
  const clock = createGameClock({ bus });
  // Wired exactly as `createWorld` does (#351): the clock owns the day and
  // every ledger entry is stamped with it.
  const economy = createEconomy({
    bus,
    startingCash,
    config,
    getCurrentDay: () => clock.currentDay,
  });
  return { bus, clock, economy };
}

// ── Cash mutations ────────────────────────────────────────────────────────────

describe('Economy — cash mutations', () => {
  it('starts at the configured starting cash', () => {
    const { economy } = makeSetup(30_000);
    expect(economy.cash).toBe(30_000);
  });

  it('postRevenue increases cash', () => {
    const { clock, economy } = makeSetup();
    clock.advanceDay();
    economy.postRevenue(5_000, 'Vehicle sale');
    expect(economy.cash).toBe(STARTING_CASH + 5_000);
  });

  it('postExpense decreases cash', () => {
    const { clock, economy } = makeSetup();
    clock.advanceDay();
    economy.postExpense(3_000, 'Supplies');
    expect(economy.cash).toBe(STARTING_CASH - 3_000);
  });

  it('postExpense throws when cash is insufficient', () => {
    const { clock, economy } = makeSetup(500);
    clock.advanceDay();
    expect(() => economy.postExpense(1_000, 'Too expensive')).toThrow(/[Ii]nsufficient/);
  });

  it('cash does not change when postExpense throws', () => {
    const { clock, economy } = makeSetup(500);
    clock.advanceDay();
    try { economy.postExpense(1_000, 'Too expensive'); } catch { /* expected */ }
    expect(economy.cash).toBe(500);
  });
});

// ── Inventory-acquisition spend tracker (#255) ────────────────────────────────

describe('Economy — inventory-acquisition spend (#255)', () => {
  it('only inventoryAcquisition-categorized expenses accrue', () => {
    const { clock, economy } = makeSetup();
    clock.advanceDay();
    expect(economy.inventoryAcquisitionSpend).toBe(0);
    economy.postExpense(12_000, 'Auction purchase: v1', 'inventoryAcquisition');
    economy.postExpense(500, 'Inspection: v2');
    economy.postRevenue(8_000, 'Sale');
    expect(economy.inventoryAcquisitionSpend).toBe(12_000);
  });

  it('accumulates across days and never resets (lifetime counter)', () => {
    const { clock, economy } = makeSetup();
    clock.advanceDay();
    economy.postExpense(10_000, 'Auction purchase: v1', 'inventoryAcquisition');
    clock.advanceDay();
    economy.postExpense(15_000, 'Auction purchase: v2', 'inventoryAcquisition');
    expect(economy.inventoryAcquisitionSpend).toBe(25_000);
  });

  it('forceDebit honors the category too', () => {
    const { clock, economy } = makeSetup(1_000);
    clock.advanceDay();
    economy.forceDebit(5_000, 'Auction purchase: v1', 'inventoryAcquisition');
    expect(economy.inventoryAcquisitionSpend).toBe(5_000);
  });

  it('categorized entries carry the category in the P&L ledger', () => {
    // A fresh clock is already ON day 1 — no advance needed, and since #351 an
    // entry is stamped with the day the clock reports rather than the day that
    // last ended.
    const { economy } = makeSetup();
    economy.postExpense(9_000, 'Auction purchase: v1', 'inventoryAcquisition');
    economy.postExpense(300, 'Supplies');
    const entries = economy.getPnL(1, 1).entries;
    expect(entries.find((e) => e.label.startsWith('Auction'))?.category).toBe(
      'inventoryAcquisition',
    );
    expect(entries.find((e) => e.label === 'Supplies')?.category).toBeUndefined();
  });
});

// ── Event publishing ──────────────────────────────────────────────────────────

describe('Economy — event publishing', () => {
  it('postRevenue publishes economy:revenue_posted', () => {
    const { bus, clock, economy } = makeSetup();
    clock.advanceDay();
    const events: Array<{ amount: number; label: string }> = [];
    bus.subscribe('economy:revenue_posted', (e) => events.push(e));
    economy.postRevenue(1_500, 'Sale');
    expect(events).toHaveLength(1);
    expect(events[0].amount).toBe(1_500);
    expect(events[0].label).toBe('Sale');
  });

  it('postExpense publishes economy:expense_posted', () => {
    const { bus, clock, economy } = makeSetup();
    clock.advanceDay();
    const events: Array<{ amount: number; label: string }> = [];
    bus.subscribe('economy:expense_posted', (e) => events.push(e));
    economy.postExpense(800, 'Parts');
    expect(events).toHaveLength(1);
    expect(events[0].amount).toBe(800);
    expect(events[0].label).toBe('Parts');
  });

  it('failed postExpense does not publish an event', () => {
    const { bus, clock, economy } = makeSetup(100);
    clock.advanceDay();
    const events: unknown[] = [];
    bus.subscribe('economy:expense_posted', (e) => events.push(e));
    try { economy.postExpense(500, 'Too expensive'); } catch { /* expected */ }
    expect(events).toHaveLength(0);
  });
});

// ── P&L correctness ───────────────────────────────────────────────────────────

describe('Economy — P&L correctness', () => {
  it('getPnL returns zeroes over an empty window', () => {
    const { economy } = makeSetup();
    const pnl = economy.getPnL(1, 10);
    expect(pnl.totalRevenue).toBe(0);
    expect(pnl.totalExpenses).toBe(0);
    expect(pnl.netIncome).toBe(0);
    expect(pnl.entries).toHaveLength(0);
  });

  it('P&L correctness: cash delta equals revenue minus expenses over any window', () => {
    const { clock, economy } = makeSetup();
    const cashBefore = economy.cash;

    // Day 1 is where a fresh clock starts.
    economy.postRevenue(10_000, 'Sale 1');
    economy.postExpense(2_000, 'Recon');

    clock.advanceDay(); // → day 2
    economy.postRevenue(8_000, 'Sale 2');
    economy.postExpense(1_500, 'Marketing');

    const cashAfter = economy.cash;
    const pnl = economy.getPnL(1, 2);

    expect(pnl.totalRevenue).toBe(18_000);
    expect(pnl.totalExpenses).toBe(3_500);
    expect(pnl.netIncome).toBe(14_500);
    expect(cashAfter - cashBefore).toBe(pnl.netIncome);
  });

  it('getPnL filters to the requested day range', () => {
    const { clock, economy } = makeSetup();

    economy.postRevenue(5_000, 'Day-1 sale');

    clock.advanceDay(); // → day 2
    economy.postRevenue(3_000, 'Day-2 sale');

    clock.advanceDay(); // → day 3
    economy.postRevenue(2_000, 'Day-3 sale');

    expect(economy.getPnL(2, 2).totalRevenue).toBe(3_000);
    expect(economy.getPnL(1, 2).totalRevenue).toBe(8_000);
    expect(economy.getPnL(1, 3).totalRevenue).toBe(10_000);
  });
});

// ── Overnight recurring expenses ──────────────────────────────────────────────

describe('Economy — overnight recurring expenses', () => {
  it('no recurring expense before end of first week', () => {
    const { clock, economy } = makeSetup(STARTING_CASH, CONFIG);
    for (let i = 0; i < DAYS_PER_WEEK - 1; i++) clock.advanceDay();
    expect(economy.cash).toBe(STARTING_CASH);
  });

  it('rent and payroll post on day 7 (end of week 1)', () => {
    const { clock, economy } = makeSetup(STARTING_CASH, CONFIG);
    for (let i = 0; i < DAYS_PER_WEEK; i++) clock.advanceDay();
    const expected = STARTING_CASH - CONFIG.weeklyRent - CONFIG.weeklyPayrollStub;
    expect(economy.cash).toBe(expected);
  });

  it('recurring expenses post again at week 2 boundary', () => {
    const { clock, economy } = makeSetup(STARTING_CASH, CONFIG);
    for (let i = 0; i < DAYS_PER_WEEK * 2; i++) clock.advanceDay();
    const expected = STARTING_CASH - 2 * (CONFIG.weeklyRent + CONFIG.weeklyPayrollStub);
    expect(economy.cash).toBe(expected);
  });

  it('P&L correctness holds over a multi-week window with recurring overheads', () => {
    const weeks = 3;
    const { clock, economy } = makeSetup(STARTING_CASH, CONFIG);
    const cashBefore = economy.cash;

    for (let i = 0; i < DAYS_PER_WEEK * weeks; i++) clock.advanceDay();

    const cashAfter = economy.cash;
    const pnl = economy.getPnL(1, DAYS_PER_WEEK * weeks);

    expect(cashAfter - cashBefore).toBe(pnl.netIncome);
    expect(pnl.totalExpenses).toBe(weeks * (CONFIG.weeklyRent + CONFIG.weeklyPayrollStub));
    expect(pnl.totalRevenue).toBe(0);
    expect(pnl.netIncome).toBe(-pnl.totalExpenses);
  });

  it('rent entry is labelled "Rent" and payroll entry "Payroll"', () => {
    const { clock, economy } = makeSetup(STARTING_CASH, CONFIG);
    for (let i = 0; i < DAYS_PER_WEEK; i++) clock.advanceDay();
    const pnl = economy.getPnL(1, DAYS_PER_WEEK);
    const labels = pnl.entries.map((e) => e.label);
    expect(labels).toContain('Rent');
    expect(labels).toContain('Payroll');
  });
});

// ── Integration: Inventory purchase flows through Economy ────────────────────

describe('Economy — Inventory integration', () => {
  const vehicleData = loadVehicleData();

  it('vehicle purchase via Inventory reduces Economy cash', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({
      bus,
      startingCash: STARTING_CASH,
      config: NO_OVERHEAD,
      getCurrentDay: () => clock.currentDay,
    });
    const inventory = createInventory({ bus, masterSeed: 42, economy, vehicleData });

    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);

    expect(economy.cash).toBe(STARTING_CASH - listing.askingPrice);
  });

  it('vehicle purchase appears as an expense entry in P&L', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({
      bus,
      startingCash: STARTING_CASH,
      config: NO_OVERHEAD,
      getCurrentDay: () => clock.currentDay,
    });
    const inventory = createInventory({ bus, masterSeed: 42, economy, vehicleData });

    // The auction stocks overnight, so the buy lands on day 2 — and since #351
    // the ledger entry carries the day the buy actually happened on.
    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);

    const pnl = economy.getPnL(2, 2);
    expect(pnl.totalExpenses).toBe(listing.askingPrice);
    expect(pnl.entries[0].type).toBe('expense');
  });

  it('auction buy counts as inventory-acquisition spend (#255)', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({
      bus,
      startingCash: STARTING_CASH,
      config: NO_OVERHEAD,
      getCurrentDay: () => clock.currentDay,
    });
    const inventory = createInventory({ bus, masterSeed: 42, economy, vehicleData });

    clock.advanceDay();
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);

    expect(economy.inventoryAcquisitionSpend).toBe(listing.askingPrice);
  });
});
