import { createEventBus } from '../src/game/EventBus';
import { createGameClock, DAYS_PER_WEEK } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createInventory, loadVehicleData } from '../src/game/Inventory';
import { createStaffOrg, loadStaffOrgConfig } from '../src/game/StaffOrg';
import { loadStaffTaxonomy, loadStaffArchetypes } from '../src/game/NPC';
import { slotsEverywhere } from './helpers/staffSlots';
import { flatPay } from './helpers/staffPay';

const STARTING_CASH = 50_000;
const CONFIG = { weeklyRent: 1200 };
const NO_OVERHEAD = { weeklyRent: 0 };

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

  it('categorized entries carry the category in the ledger', () => {
    // A fresh clock is already ON day 1 — no advance needed, and since #351 an
    // entry is stamped with the day the clock reports rather than the day that
    // last ended.
    const { economy } = makeSetup();
    economy.postExpense(9_000, 'Auction purchase: v1', 'inventoryAcquisition');
    economy.postExpense(300, 'Supplies');
    // Asserted against the LEDGER, not `getPnL` (#374): the ledger is the
    // record of everything posted, and the P&L is a read of it that
    // deliberately drops acquisitions. The category has to survive on the
    // record for the read to be able to act on it.
    const entries = economy.snapshot().ledger ?? [];
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

  it('a pre-accrual ledger restores without migration (#374)', () => {
    const { economy } = makeSetup();

    // Exactly what a pre-#374 save holds: entries with no `nonCash` marker.
    // `schemaVersion` did not move — the field is optional inside the module's
    // own blob — so there is no migration and the old ledger is simply read
    // under the new rule.
    economy.restore({
      schemaVersion: 1,
      cash: 12_345,
      inventoryAcquisitionSpend: 9_000,
      ledger: [
        { day: 1, type: 'expense', amount: 9_000, label: 'Auction purchase: L1', category: 'inventoryAcquisition' },
        { day: 1, type: 'expense', amount: 1_200, label: 'Rent' },
        { day: 2, type: 'revenue', amount: 14_000, label: 'Vehicle sale: L1' },
      ],
    });

    expect(economy.cash).toBe(12_345);
    const pnl = economy.getPnL(1, 2);
    expect(pnl.totalRevenue).toBe(14_000);
    // The old acquisition entry stops being operating spend the moment it is
    // read under the new rule. Its unit sold before the save, so no relief
    // entry exists to pair with it — the known, accepted artifact: history is
    // read, never back-filled.
    expect(pnl.totalExpenses).toBe(1_200);
    expect(pnl.netIncome).toBe(12_800);
  });
});

// ── Overnight recurring expenses ──────────────────────────────────────────────

describe('Economy — overnight recurring expenses', () => {
  it('no recurring expense before end of first week', () => {
    const { clock, economy } = makeSetup(STARTING_CASH, CONFIG);
    for (let i = 0; i < DAYS_PER_WEEK - 1; i++) clock.advanceDay();
    expect(economy.cash).toBe(STARTING_CASH);
  });

  it('rent posts on day 7 (end of week 1)', () => {
    const { clock, economy } = makeSetup(STARTING_CASH, CONFIG);
    for (let i = 0; i < DAYS_PER_WEEK; i++) clock.advanceDay();
    expect(economy.cash).toBe(STARTING_CASH - CONFIG.weeklyRent);
  });

  it('recurring expenses post again at week 2 boundary', () => {
    const { clock, economy } = makeSetup(STARTING_CASH, CONFIG);
    for (let i = 0; i < DAYS_PER_WEEK * 2; i++) clock.advanceDay();
    expect(economy.cash).toBe(STARTING_CASH - 2 * CONFIG.weeklyRent);
  });

  it('P&L correctness holds over a multi-week window with recurring overheads', () => {
    const weeks = 3;
    const { clock, economy } = makeSetup(STARTING_CASH, CONFIG);
    const cashBefore = economy.cash;

    for (let i = 0; i < DAYS_PER_WEEK * weeks; i++) clock.advanceDay();

    const cashAfter = economy.cash;
    const pnl = economy.getPnL(1, DAYS_PER_WEEK * weeks);

    expect(cashAfter - cashBefore).toBe(pnl.netIncome);
    expect(pnl.totalExpenses).toBe(weeks * CONFIG.weeklyRent);
    expect(pnl.totalRevenue).toBe(0);
    expect(pnl.netIncome).toBe(-pnl.totalExpenses);
  });

  it('rent entry is labelled "Rent"', () => {
    const { clock, economy } = makeSetup(STARTING_CASH, CONFIG);
    for (let i = 0; i < DAYS_PER_WEEK; i++) clock.advanceDay();
    const pnl = economy.getPnL(1, DAYS_PER_WEEK);
    expect(pnl.entries.map((e) => e.label)).toContain('Rent');
  });

  it('posts no payroll of its own — the roster owns that number (#353)', () => {
    const { clock, economy } = makeSetup(STARTING_CASH, CONFIG);
    for (let i = 0; i < DAYS_PER_WEEK * 2; i++) clock.advanceDay();
    const pnl = economy.getPnL(1, DAYS_PER_WEEK * 2);
    expect(pnl.entries.map((e) => e.label)).not.toContain('Payroll');
  });
});

// ── The daily payroll drain (#353) ────────────────────────────────────────────
//
// StaffOrg owns the salary book; Economy posts what it is handed. These assert
// the seam from Economy's side: what actually lands in the ledger.

describe('Economy — daily payroll drain', () => {
  const WAGE = 300;

  function makePayrollSetup(startingCash = STARTING_CASH) {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({
      bus,
      startingCash,
      config: NO_OVERHEAD,
      getCurrentDay: () => clock.currentDay,
    });
    const staffOrg = createStaffOrg({
      bus,
      economy,
      masterSeed: 7,
      taxonomy: loadStaffTaxonomy(),
      archetypes: loadStaffArchetypes(),
      slots: slotsEverywhere(9),
      pay: flatPay(WAGE),
      config: {
        candidatesPerRole: 3,
        conditionRead: loadStaffOrgConfig().conditionRead,
      },
    });
    return { bus, clock, economy, staffOrg };
  }

  function hireN(staffOrg: ReturnType<typeof makePayrollSetup>['staffOrg'], n: number): void {
    const candidates = staffOrg.getCandidates('salesperson');
    for (let i = 0; i < n; i++) staffOrg.hire(candidates[i].candidateId);
  }

  it('posts daily payroll as the sum of the roster\'s wages', () => {
    const { clock, economy, staffOrg } = makePayrollSetup();
    hireN(staffOrg, 3);
    const cashBefore = economy.cash;

    clock.advanceDay();

    const payroll = economy
      .getPnL(1, 1)
      .entries.filter((e) => e.label === 'Payroll');
    expect(payroll).toHaveLength(1);
    expect(payroll[0].amount).toBe(3 * WAGE);
    expect(economy.cash).toBe(cashBefore - 3 * WAGE);
  });

  it('posts nothing when nobody is on the roster', () => {
    const { clock, economy } = makePayrollSetup();
    const cashBefore = economy.cash;

    for (let i = 0; i < 3; i++) clock.advanceDay();

    expect(economy.cash).toBe(cashBefore);
    expect(economy.getPnL(1, 3).entries).toHaveLength(0);
  });

  it('charges every night, not once a week — the fifth hire costs five wages', () => {
    const { clock, economy, staffOrg } = makePayrollSetup();
    hireN(staffOrg, 1);
    const cashBefore = economy.cash;

    for (let i = 0; i < 3; i++) clock.advanceDay();

    expect(cashBefore - economy.cash).toBe(3 * WAGE);
  });

  it('pushes cash negative rather than throwing — payroll is an obligation', () => {
    // Signing two people now costs five days of each one's wage (#355), so the
    // store is opened with exactly that plus one day of float: the first
    // night's drain has nowhere to come from.
    const { clock, economy, staffOrg } = makePayrollSetup(WAGE * 11);
    hireN(staffOrg, 2);
    expect(economy.cash).toBe(WAGE);

    expect(() => clock.advanceDay()).not.toThrow();
    expect(economy.cash).toBe(WAGE - 2 * WAGE);
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

  it('an auction purchase is not an operating expense (#374)', () => {
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

    // Cash left (that half is asserted above and by #255's counter), but a
    // month spent stocking is not a month spent losing money: the buy converted
    // cash into stock and the P&L waits for the sale.
    const pnl = economy.getPnL(2, 2);
    expect(pnl.totalExpenses).toBe(0);
    expect(pnl.netIncome).toBe(0);
    // Dropped from `entries` too, not just from the total — an expense
    // breakdown that lists a purchase the net income does not count is two
    // numbers on one screen that cannot be added up.
    expect(pnl.entries).toHaveLength(0);
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
