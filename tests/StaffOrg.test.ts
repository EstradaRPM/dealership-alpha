import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createStaffOrg, StaffOrgError, loadStaffOrgConfig } from '../src/game/StaffOrg';
import { loadStaffTaxonomy, loadStaffArchetypes } from '../src/game/NPC';
import type { StaffOrgConfig, StaffSlotTable, StaffPayTable } from '../src/game/StaffOrg';
import { loadStaffPay, gradeFor, dailyWageFor } from '../src/game/StaffOrg';
import { compositeRatio } from '../src/game/NPC';
import { slotsEverywhere } from './helpers/staffSlots';
import { flatPay, noPay } from './helpers/staffPay';

const STARTING_CASH = 50_000;
const MASTER_SEED = 99;

const taxonomy = loadStaffTaxonomy();
const archetypes = loadStaffArchetypes();

const NO_OVERHEAD = { weeklyRent: 0 };
const CHEAP_CONFIG: StaffOrgConfig = {
  candidatesPerRole: 3,
  conditionRead: {
    minHalfWidthFraction: 0.10,
    maxHalfWidthFraction: 0.80,
    maxBiasFraction: 0.50,
    widthSkillExponent: 0.7,
  },
};

const ROOMY_SLOTS = slotsEverywhere(9);
// Wages off by default, same reasoning as ROOMY_SLOTS: a hiring or promotion
// test should not go red the next time someone tunes `data/staff-pay.json`.
// The wage suites below pass their own table.
const NO_PAY = noPay();

function makeSetup(
  startingCash = STARTING_CASH,
  config = CHEAP_CONFIG,
  slots = ROOMY_SLOTS,
  pay: StaffPayTable = NO_PAY,
) {
  const bus = createEventBus();
  const clock = createGameClock({ bus });
  const economy = createEconomy({ bus, startingCash, config: NO_OVERHEAD });
  const staffOrg = createStaffOrg({
    bus,
    economy,
    masterSeed: MASTER_SEED,
    taxonomy,
    archetypes,
    config,
    slots,
    pay,
  });
  return { bus, clock, economy, staffOrg };
}

// ── Candidate generation ────────────────────────────────────────────────────

describe('StaffOrg — getCandidates', () => {
  it('returns the configured number of candidates for a valid role', () => {
    const { clock, staffOrg } = makeSetup();
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('salesperson');
    expect(candidates).toHaveLength(CHEAP_CONFIG.candidatesPerRole);
  });

  it('all candidates have the requested role', () => {
    const { clock, staffOrg } = makeSetup();
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('salesperson');
    for (const c of candidates) {
      expect(c.staff.role_id).toBe('salesperson');
    }
  });

  it('candidates carry a hiring cost priced off their own wage', () => {
    // #355: the fee is `hireFeeMultiple × this candidate's daily wage`, not a
    // flat per-tier price. Stated per candidate, because two applicants for the
    // same desk are quoted different numbers.
    const { clock, staffOrg } = wageSetup();
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('salesperson');
    for (const c of candidates) {
      expect(c.hiringCost).toBe(WAGE_TABLE.hireFeeMultiple * c.dailyWage);
    }
  });

  it('candidates have skills defined by their archetype', () => {
    const { clock, staffOrg } = makeSetup();
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('salesperson');
    for (const c of candidates) {
      expect(Object.keys(c.staff.skills)).toContain('communication');
    }
  });

  it('candidate skill values are within [0, cap]', () => {
    const { clock, staffOrg } = makeSetup();
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('salesperson');
    for (const c of candidates) {
      for (const [skillId, val] of Object.entries(c.staff.skills)) {
        const cap = taxonomy.skills[skillId]?.cap ?? 100;
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(cap);
      }
    }
  });

  it('candidate pool is stable within a day (same call returns same results)', () => {
    const { clock, staffOrg } = makeSetup();
    clock.advanceDay();
    const a = staffOrg.getCandidates('salesperson');
    const b = staffOrg.getCandidates('salesperson');
    expect(a.map((c) => c.candidateId)).toEqual(b.map((c) => c.candidateId));
  });

  it('throws for an unknown role id', () => {
    const { clock, staffOrg } = makeSetup();
    clock.advanceDay();
    expect(() => staffOrg.getCandidates('nonexistent-role')).toThrow(StaffOrgError);
  });

  it('refreshes pool on new day', () => {
    const { clock, staffOrg } = makeSetup();
    clock.advanceDay();
    const day1 = staffOrg.getCandidates('salesperson').map((c) => c.candidateId);
    clock.advanceDay();
    const day2 = staffOrg.getCandidates('salesperson').map((c) => c.candidateId);
    expect(day1).not.toEqual(day2);
  });
});

// ── Hire flow ───────────────────────────────────────────────────────────────

describe('StaffOrg — hire', () => {
  it('adds hired staff to currentRoster', () => {
    const { clock, staffOrg } = makeSetup();
    clock.advanceDay();
    const [first] = staffOrg.getCandidates('salesperson');
    staffOrg.hire(first.candidateId);
    expect(staffOrg.currentRoster).toHaveLength(1);
    expect(staffOrg.currentRoster[0].id).toBe(first.staff.id);
  });

  it('deducts hiring cost from Economy cash', () => {
    // Priced off a real wage book (#355), not the default no-pay table: a fee
    // of $0 would make this assertion true without charging anything.
    const { clock, economy, staffOrg } = wageSetup();
    clock.advanceDay();
    const cashBefore = economy.cash;
    const [first] = staffOrg.getCandidates('salesperson');
    expect(first.hiringCost).toBeGreaterThan(0);
    staffOrg.hire(first.candidateId);
    expect(economy.cash).toBe(cashBefore - first.hiringCost);
  });

  it('publishes staff:hired event with correct payload', () => {
    const { bus, clock, staffOrg } = makeSetup();
    clock.advanceDay();
    const events: Array<{ staffId: string; roleId: string; hiringCost: number }> = [];
    bus.subscribe('staff:hired', (e) => events.push(e));
    const [first] = staffOrg.getCandidates('salesperson');
    staffOrg.hire(first.candidateId);
    expect(events).toHaveLength(1);
    expect(events[0].staffId).toBe(first.staff.id);
    expect(events[0].roleId).toBe('salesperson');
    expect(events[0].hiringCost).toBe(first.hiringCost);
  });

  it('removes candidate from pool after hire', () => {
    const { clock, staffOrg } = makeSetup();
    clock.advanceDay();
    const [first] = staffOrg.getCandidates('salesperson');
    staffOrg.hire(first.candidateId);
    const remaining = staffOrg.getCandidates('salesperson');
    expect(remaining.map((c) => c.candidateId)).not.toContain(first.candidateId);
  });

  it('throws on unknown candidateId', () => {
    const { clock, staffOrg } = makeSetup();
    clock.advanceDay();
    expect(() => staffOrg.hire('candidate:fake:99:0')).toThrow(StaffOrgError);
  });

  it('throws when cash is insufficient and does not post event', () => {
    // A real wage book, so the fee is a real number: under the no-pay table the
    // signing fee is $0 and there is nothing a lot with $50 cannot afford.
    const { bus, clock, staffOrg } = wageSetup(50);
    clock.advanceDay();
    const events: unknown[] = [];
    bus.subscribe('staff:hired', (e) => events.push(e));
    const [first] = staffOrg.getCandidates('salesperson');
    expect(() => staffOrg.hire(first.candidateId)).toThrow(/[Ii]nsufficient/);
    expect(events).toHaveLength(0);
  });

  it('roster does not grow when hire throws', () => {
    const { clock, staffOrg } = wageSetup(50);
    clock.advanceDay();
    const [first] = staffOrg.getCandidates('salesperson');
    try { staffOrg.hire(first.candidateId); } catch { /* expected */ }
    expect(staffOrg.currentRoster).toHaveLength(0);
  });
});

// ── Per-role slots (#352, A2 R1 + C1 R3) ────────────────────────────────────
//
// Scarcity is per ROLE, not per body. What stops the player buying five
// A-players is that the store has one desk for them. This replaced the flat
// `headcountCapByTier` ({1:4, 2:8, 3:16}), under which a Tier-1 gravel yard
// could field four salespeople.

describe('StaffOrg — per-role slots', () => {
  // Two salesperson desks at T1, three at T2; one UCM desk from T3. Stated
  // here so the assertions read against a table you can see.
  const SLOTS: StaffSlotTable = {
    ...slotsEverywhere(0),
    salesperson: { '1': 2, '2': 3, '3': 3, '4': 6, '5': 10, '6': 10, '7': 10 },
    'used-car-manager': { '1': 0, '2': 0, '3': 1, '4': 1, '5': 1, '6': 1, '7': 1 },
    'service-advisor': { '1': 0, '2': 1, '3': 1, '4': 2, '5': 2, '6': 2, '7': 2 },
  };

  function makeSlotSetup(tier: number, slots: StaffSlotTable = SLOTS) {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: NO_OVERHEAD });
    const staffOrg = createStaffOrg({
      bus, economy, masterSeed: MASTER_SEED, taxonomy, archetypes,
      config: CHEAP_CONFIG, slots, getTier: () => tier,
    });
    return { bus, clock, economy, staffOrg };
  }

  // Hires `count` people into one role, one fresh candidate per day.
  function hireN(
    clock: ReturnType<typeof createGameClock>,
    staffOrg: ReturnType<typeof createStaffOrg>,
    count: number,
    roleId = 'salesperson',
  ) {
    for (let i = 0; i < count; i++) {
      clock.advanceDay();
      staffOrg.hire(staffOrg.getCandidates(roleId)[0].candidateId);
    }
  }

  it('reports filled and total slots per role', () => {
    const { clock, staffOrg } = makeSlotSetup(2);
    expect(staffOrg.getSlots('salesperson')).toEqual({
      roleId: 'salesperson', filled: 0, total: 3,
    });
    hireN(clock, staffOrg, 2);
    expect(staffOrg.getSlots('salesperson')).toEqual({
      roleId: 'salesperson', filled: 2, total: 3,
    });
    // Filling one role leaves every other role's desks untouched.
    expect(staffOrg.getSlots('service-advisor')).toEqual({
      roleId: 'service-advisor', filled: 0, total: 1,
    });
  });

  it('reports every role on the slot board', () => {
    const { staffOrg } = makeSlotSetup(3);
    const board = staffOrg.getSlotBoard();
    expect(board).toHaveLength(Object.keys(SLOTS).length);
    expect(board.find((r) => r.roleId === 'used-car-manager')).toEqual({
      roleId: 'used-car-manager', filled: 0, total: 1,
    });
  });

  it('the headcount cap is the sum of the tier\'s role slots', () => {
    // T2: 3 salespeople + 1 service advisor + 0 everywhere else.
    expect(makeSlotSetup(2).staffOrg.headcountCap).toBe(4);
    // T3 adds the UCM desk.
    expect(makeSlotSetup(3).staffOrg.headcountCap).toBe(5);
  });

  it('allows hiring up to the role\'s slot count', () => {
    const { clock, staffOrg } = makeSlotSetup(1);
    hireN(clock, staffOrg, 2);
    expect(staffOrg.currentRoster).toHaveLength(2);
  });

  it('refuses a hire into a full role', () => {
    const { clock, staffOrg } = makeSlotSetup(1);
    hireN(clock, staffOrg, 2);
    clock.advanceDay();
    const next = staffOrg.getCandidates('salesperson')[0].candidateId;
    expect(() => staffOrg.hire(next)).toThrow(StaffOrgError);
    expect(() => staffOrg.hire(next)).toThrow(/No open slot for "salesperson"/);
  });

  it('does not grow the roster, spend cash or post an event on a full role', () => {
    const { bus, clock, economy, staffOrg } = makeSlotSetup(1);
    hireN(clock, staffOrg, 2);
    clock.advanceDay();
    const events: unknown[] = [];
    bus.subscribe('staff:hired', (e) => events.push(e));
    const cashBefore = economy.cash;
    const next = staffOrg.getCandidates('salesperson')[0].candidateId;
    try { staffOrg.hire(next); } catch { /* expected */ }
    expect(staffOrg.currentRoster).toHaveLength(2);
    expect(events).toHaveLength(0);
    expect(economy.cash).toBe(cashBefore);
  });

  it('a full role does not block a different role that still has a desk', () => {
    const { clock, staffOrg } = makeSlotSetup(2);
    hireN(clock, staffOrg, 3);
    hireN(clock, staffOrg, 1, 'service-advisor');
    expect(staffOrg.currentRoster).toHaveLength(4);
  });

  it('firing someone reopens their slot', () => {
    const { clock, staffOrg } = makeSlotSetup(1);
    hireN(clock, staffOrg, 2);
    staffOrg.fire(staffOrg.currentRoster[0].id);
    expect(staffOrg.getSlots('salesperson').filled).toBe(1);
    hireN(clock, staffOrg, 1);
    expect(staffOrg.currentRoster).toHaveLength(2);
  });

  it('a higher tier opens more desks', () => {
    const { clock, staffOrg } = makeSlotSetup(2);
    hireN(clock, staffOrg, 3);
    expect(staffOrg.currentRoster).toHaveLength(3);
  });

  it('defaults to the Tier 1 slots when getTier is not provided', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: NO_OVERHEAD });
    const staffOrg = createStaffOrg({
      bus, economy, masterSeed: MASTER_SEED, taxonomy, archetypes,
      config: CHEAP_CONFIG, slots: SLOTS,
    });
    hireN(clock, staffOrg, 2);
    clock.advanceDay();
    const next = staffOrg.getCandidates('salesperson')[0].candidateId;
    expect(() => staffOrg.hire(next)).toThrow(/No open slot/);
  });

  it('throws rather than reading 0 slots for a role the table does not name', () => {
    // A silently unhireable role looks like balance and is a missing data row.
    const { staffOrg } = makeSlotSetup(1, { salesperson: SLOTS.salesperson });
    expect(() => staffOrg.getSlots('used-car-manager')).toThrow(/staff-slots\.json/);
  });
});

// ── Fire flow ───────────────────────────────────────────────────────────────

describe('StaffOrg — fire', () => {
  it('removes the staff member from currentRoster', () => {
    const { clock, staffOrg } = makeSetup();
    clock.advanceDay();
    const [first] = staffOrg.getCandidates('salesperson');
    staffOrg.hire(first.candidateId);
    staffOrg.fire(first.staff.id);
    expect(staffOrg.currentRoster).toHaveLength(0);
  });

  it('publishes staff:fired event with correct payload', () => {
    const { bus, clock, staffOrg } = makeSetup();
    clock.advanceDay();
    const [first] = staffOrg.getCandidates('salesperson');
    staffOrg.hire(first.candidateId);
    const events: Array<{ staffId: string; roleId: string }> = [];
    bus.subscribe('staff:fired', (e) => events.push(e));
    staffOrg.fire(first.staff.id);
    expect(events).toHaveLength(1);
    expect(events[0].staffId).toBe(first.staff.id);
    expect(events[0].roleId).toBe('salesperson');
  });

  it('throws when staffId is not on roster', () => {
    const { clock, staffOrg } = makeSetup();
    clock.advanceDay();
    expect(() => staffOrg.fire('staff:nobody:1:0')).toThrow(StaffOrgError);
  });

  it('fires only the targeted staff when multiple are on roster', () => {
    const config: StaffOrgConfig = { ...CHEAP_CONFIG, candidatesPerRole: 3 };
    const { clock, staffOrg } = makeSetup(STARTING_CASH, config);
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('salesperson');
    staffOrg.hire(candidates[0].candidateId);
    clock.advanceDay();
    const next = staffOrg.getCandidates('salesperson');
    staffOrg.hire(next[0].candidateId);
    expect(staffOrg.currentRoster).toHaveLength(2);
    const first = staffOrg.currentRoster[0];
    staffOrg.fire(first.id);
    expect(staffOrg.currentRoster).toHaveLength(1);
    expect(staffOrg.currentRoster[0].id).not.toBe(first.id);
  });
});

// ── Config loading ──────────────────────────────────────────────────────────

describe('StaffOrg — config', () => {
  it('loadStaffOrgConfig returns the bundled tunables without error', () => {
    const config = loadStaffOrgConfig();
    expect(config.candidatesPerRole).toBeGreaterThan(0);
    expect(config.conditionRead.maxBiasFraction).toBeGreaterThan(0);
  });

  it('the per-tier hiring-cost table is gone from the config schema', () => {
    // #355 retired `hiringCostByTier`. Asserted against the raw JSON as well as
    // the parsed config, because the schema is non-strict: a stale key left in
    // the file would be silently stripped at parse and read as "already gone".
    const raw = (require('../data/tunables.json') as { staffOrg: Record<string, unknown> })
      .staffOrg;
    expect(Object.keys(raw)).not.toContain('hiringCostByTier');
    expect(Object.keys(loadStaffOrgConfig())).not.toContain('hiringCostByTier');
  });
});

// ── Body Shop hire-tier gating (#312) ───────────────────────────────────────

describe('StaffOrg — Body Shop hire-tier gating', () => {
  function makeSetupWithTier(tier: number) {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: { weeklyRent: 0 } });
    const staffOrg = createStaffOrg({
      bus,
      economy,
      masterSeed: MASTER_SEED,
      taxonomy,
      archetypes,
      config: CHEAP_CONFIG,
      getTier: () => tier,
    });
    return { clock, staffOrg };
  }

  it('getCandidates for body-shop-advisor throws below Tier 3', () => {
    const { clock, staffOrg } = makeSetupWithTier(2);
    clock.advanceDay();
    expect(() => staffOrg.getCandidates('body-shop-advisor')).toThrow(/tier 3/i);
  });

  it('getCandidates for body-shop-advisor succeeds at Tier 3', () => {
    const { clock, staffOrg } = makeSetupWithTier(3);
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('body-shop-advisor');
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.staff.role_id).toBe('body-shop-advisor');
    }
  });

  it('getCandidates for body-shop-manager throws below its hire tier', () => {
    const { clock, staffOrg } = makeSetupWithTier(3);
    clock.advanceDay();
    expect(() => staffOrg.getCandidates('body-shop-manager')).toThrow(StaffOrgError);
  });

  it('getCandidates for body-shop-manager succeeds at Tier 5', () => {
    const { clock, staffOrg } = makeSetupWithTier(5);
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('body-shop-manager');
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.staff.role_id).toBe('body-shop-manager');
    }
  });
});

// ── F&I Manager hire-tier gating ────────────────────────────────────────────

describe('StaffOrg — F&I Manager hire-tier gating', () => {
  function makeSetupWithTier(tier: number, startingCash = STARTING_CASH) {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({ bus, startingCash, config: { weeklyRent: 0 } });
    const staffOrg = createStaffOrg({
      bus,
      economy,
      masterSeed: MASTER_SEED,
      taxonomy,
      archetypes,
      config: CHEAP_CONFIG,
      getTier: () => tier,
    });
    return { bus, clock, staffOrg };
  }

  it('getCandidates for f&i-manager throws at Tier 1', () => {
    const { clock, staffOrg } = makeSetupWithTier(1);
    clock.advanceDay();
    expect(() => staffOrg.getCandidates('f&i-manager')).toThrow(StaffOrgError);
  });

  it('getCandidates for f&i-manager throws with message mentioning tier 3', () => {
    const { clock, staffOrg } = makeSetupWithTier(1);
    clock.advanceDay();
    expect(() => staffOrg.getCandidates('f&i-manager')).toThrow(/tier 3/i);
  });

  it('getCandidates for f&i-manager throws at Tier 2', () => {
    const { clock, staffOrg } = makeSetupWithTier(2);
    clock.advanceDay();
    expect(() => staffOrg.getCandidates('f&i-manager')).toThrow(StaffOrgError);
  });

  it('getCandidates for f&i-manager succeeds at Tier 3', () => {
    const { clock, staffOrg } = makeSetupWithTier(3);
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('f&i-manager');
    expect(candidates.length).toBeGreaterThan(0);
  });

  it('getCandidates for salesperson is unaffected by tier gating (no hireTier)', () => {
    const { clock, staffOrg } = makeSetupWithTier(1);
    clock.advanceDay();
    expect(() => staffOrg.getCandidates('salesperson')).not.toThrow();
  });

  it('getCandidates skips tier check when getTier dep is not provided', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: { weeklyRent: 0 } });
    const staffOrg = createStaffOrg({
      bus, economy, masterSeed: MASTER_SEED, taxonomy, archetypes, config: CHEAP_CONFIG,
      // no getTier dep
    });
    clock.advanceDay();
    // Should not throw even though f&i-manager has hireTier: 3
    expect(() => staffOrg.getCandidates('f&i-manager')).not.toThrow();
  });

  it('all f&i-manager candidates have product_presentation and finance_structuring skills', () => {
    const { clock, staffOrg } = makeSetupWithTier(3);
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('f&i-manager');
    for (const c of candidates) {
      expect(c.staff.skills).toHaveProperty('product_presentation');
      expect(c.staff.skills).toHaveProperty('finance_structuring');
    }
  });
});

// ── GM hire-tier gating ──────────────────────────────────────────────────────

describe('StaffOrg — GM hire-tier gating', () => {
  function makeSetupWithTier(tier: number, startingCash = STARTING_CASH) {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({ bus, startingCash, config: { weeklyRent: 0 } });
    const staffOrg = createStaffOrg({
      bus,
      economy,
      masterSeed: MASTER_SEED,
      taxonomy,
      archetypes,
      config: CHEAP_CONFIG,
      getTier: () => tier,
    });
    return { bus, clock, staffOrg };
  }

  it('getCandidates for gm throws at Tier 1', () => {
    const { clock, staffOrg } = makeSetupWithTier(1);
    clock.advanceDay();
    expect(() => staffOrg.getCandidates('gm')).toThrow(StaffOrgError);
  });

  it('getCandidates for gm throws at Tier 2', () => {
    const { clock, staffOrg } = makeSetupWithTier(2);
    clock.advanceDay();
    expect(() => staffOrg.getCandidates('gm')).toThrow(StaffOrgError);
  });

  it('getCandidates for gm throws with message mentioning tier 6', () => {
    const { clock, staffOrg } = makeSetupWithTier(2);
    clock.advanceDay();
    expect(() => staffOrg.getCandidates('gm')).toThrow(/tier 6/i);
  });

  it('getCandidates for gm succeeds at Tier 6', () => {
    const { clock, staffOrg } = makeSetupWithTier(6);
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('gm');
    expect(candidates.length).toBeGreaterThan(0);
  });

  it('all gm candidates have role_id gm', () => {
    const { clock, staffOrg } = makeSetupWithTier(6);
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('gm');
    for (const c of candidates) {
      expect(c.staff.role_id).toBe('gm');
    }
  });
});

// ── Model B skill-growth accrual (#294) ─────────────────────────────────────

describe('StaffOrg — Model B skill growth (#294)', () => {
  function hireUcm() {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: NO_OVERHEAD });
    const staffOrg = createStaffOrg({
      bus, economy, masterSeed: MASTER_SEED, taxonomy, archetypes,
      config: CHEAP_CONFIG, getTier: () => 3,
    });
    clock.advanceDay();
    const cand = staffOrg.getCandidates('used-car-manager')[0];
    staffOrg.hire(cand.candidateId);
    const ucm = staffOrg.currentRoster.find((s) => s.role_id === 'used-car-manager')!;
    return { bus, clock, staffOrg, ucm };
  }

  function publishClose(bus: ReturnType<typeof createEventBus>): void {
    bus.publish('deal:closed', {
      customerId: 'c', vehicleId: 'v', agreedPrice: 20_000, frontGross: 1_500,
      backGross: 500, daysInInventory: 10, paymentMethod: 'cash',
      downPayment: 20_000, loanAmount: 0, term: 0, apr: 0,
    });
  }

  it('starts a freshly-hired UCM at zero counters', () => {
    const { ucm } = hireUcm();
    expect(ucm.counters).toEqual({ experience: 0, deals_closed: 0, days_employed: 0 });
  });

  it('effective skill is constant within the open day; growth applies overnight', () => {
    const { bus, clock, ucm } = hireUcm();
    const basePricing = ucm.effectiveSkills.pricing;

    // Deals close *during* the day — counters and effective skill do NOT move.
    for (let i = 0; i < 5; i++) publishClose(bus);
    expect(ucm.counters.deals_closed).toBe(0);
    expect(ucm.effectiveSkills.pricing).toBeCloseTo(basePricing, 10);

    // Overnight: counters accrue, effective skill steps up.
    clock.advanceDay();
    expect(ucm.counters.deals_closed).toBe(5);
    expect(ucm.counters.days_employed).toBe(1);
    expect(ucm.effectiveSkills.pricing).toBeGreaterThan(basePricing);
  });

  it('resets the day tally each morning (no double-count across days)', () => {
    const { bus, clock, ucm } = hireUcm();
    for (let i = 0; i < 3; i++) publishClose(bus);
    clock.advanceDay();
    expect(ucm.counters.deals_closed).toBe(3);
    // A day with no closes accrues tenure but no deals.
    clock.advanceDay();
    expect(ucm.counters.deals_closed).toBe(3);
    expect(ucm.counters.days_employed).toBe(2);
  });

  it('grows the tenure-driven condition read toward (but capped below) 100', () => {
    const { clock, ucm } = hireUcm();
    const baseReading = ucm.effectiveSkills.condition_reading;
    for (let d = 0; d < 200; d++) clock.advanceDay();
    const grown = ucm.effectiveSkills.condition_reading;
    expect(grown).toBeGreaterThan(baseReading);
    expect(grown).toBeLessThanOrEqual(taxonomy.skills.condition_reading.cap);
  });
});

// ── Reload collision (#347) ─────────────────────────────────────────────────

describe('StaffOrg — a regenerated pool never offers someone already hired', () => {
  // The candidate pool is deliberately NOT persisted (#190): it is rebuilt from
  // the seed each `day_started` and on every reload. A staff id is
  // `staff:<archetype>:<hireDay>:<slot>`, so a rebuild for the same day
  // regenerates the exact ids it produced before — including the one you hired.
  // Driving the People tab after a reload showed the same person on the roster
  // AND in the pool; hiring them again would push a duplicate id and break
  // every id-keyed binding (StaffMorale, StaffDispatch).
  it('excludes hired staff when the pool is rebuilt for the same day', () => {
    const { clock, staffOrg } = makeSetup();
    clock.advanceDay();

    const hired = staffOrg.getCandidates('salesperson')[0];
    staffOrg.hire(hired.candidateId);
    expect(staffOrg.currentRoster).toHaveLength(1);

    // A reload: same seed, same day, a fresh pool built from the restored roster.
    const reloaded = makeSetup().staffOrg;
    reloaded.restore(staffOrg.snapshot());

    const rebuilt = reloaded.getCandidates('salesperson');
    const rosterIds = new Set(reloaded.currentRoster.map((s) => s.id));
    for (const c of rebuilt) {
      expect(rosterIds.has(c.staff.id)).toBe(false);
    }
  });

  it('still fills the pool by walking past the collided slot', () => {
    const { clock, staffOrg } = makeSetup();
    clock.advanceDay();
    staffOrg.hire(staffOrg.getCandidates('salesperson')[0].candidateId);

    const reloaded = makeSetup().staffOrg;
    reloaded.restore(staffOrg.snapshot());

    expect(reloaded.getCandidates('salesperson')).toHaveLength(
      CHEAP_CONFIG.candidatesPerRole,
    );
  });
});

// ── Grade + wage: the salary book (#353, C1 R1) ──────────────────────────────

const WAGE_TABLE: StaffPayTable = {
  gradeBands: [0.32, 0.46, 0.6, 0.76],
  hireFeeMultiple: 5,
  dailyWageByRole: {
    ...flatPay(0).dailyWageByRole,
    salesperson: { '1': 150, '2': 230, '3': 340, '4': 520, '5': 780 },
    'used-car-manager': { '1': 280, '2': 380, '3': 520, '4': 710, '5': 970 },
  },
};

function wageSetup(startingCash = STARTING_CASH) {
  return makeSetup(startingCash, CHEAP_CONFIG, ROOMY_SLOTS, WAGE_TABLE);
}

describe('StaffOrg — derived grade', () => {
  it('derives grade 1 through 5 from the effectiveness bands', () => {
    // Drive the derivation across the whole ladder by handing it hand-built
    // skill sets rather than hoping the archetype pool covers all five: the
    // ratio is what the grade is banded on, so state the ratio.
    const bands = WAGE_TABLE.gradeBands;
    const skillsAt = (value: number) => ({
      product_knowledge: value,
      communication: value,
      rapport_building: value,
    });
    const gradeAt = (value: number) =>
      gradeFor(compositeRatio(skillsAt(value), taxonomy.skills, 'effectiveness'), bands);

    expect(gradeAt(0)).toBe(1);
    expect(gradeAt(20)).toBe(1);
    expect(gradeAt(40)).toBe(2);
    expect(gradeAt(50)).toBe(3);
    expect(gradeAt(70)).toBe(4);
    expect(gradeAt(100)).toBe(5);
  });

  it('exposes grade and daily wage per roster member', () => {
    const { clock, staffOrg } = wageSetup();
    clock.advanceDay();
    const candidate = staffOrg.getCandidates('salesperson')[0];
    staffOrg.hire(candidate.candidateId);

    const board = staffOrg.getPayBoard();
    expect(board).toHaveLength(1);
    expect(board[0].staffId).toBe(candidate.staff.id);
    expect(board[0].roleId).toBe('salesperson');
    expect(board[0].grade).toBeGreaterThanOrEqual(1);
    expect(board[0].grade).toBeLessThanOrEqual(5);
    expect(board[0].dailyWage).toBe(
      dailyWageFor(WAGE_TABLE, 'salesperson', board[0].paidGrade),
    );
  });

  it('lists a grade and a daily wage on every candidate', () => {
    const { clock, staffOrg } = wageSetup();
    clock.advanceDay();
    for (const c of staffOrg.getCandidates('salesperson')) {
      expect(c.grade).toBeGreaterThanOrEqual(1);
      expect(c.dailyWage).toBe(dailyWageFor(WAGE_TABLE, 'salesperson', c.grade));
    }
  });

  it('grades a stronger candidate above a weaker one', () => {
    const { clock, staffOrg } = wageSetup();
    clock.advanceDay();
    const listings = [...staffOrg.getCandidates('salesperson')].sort(
      (a, b) => a.staff.effectivenessRatio - b.staff.effectivenessRatio,
    );
    expect(listings[0].grade).toBeLessThanOrEqual(listings[listings.length - 1].grade);
    expect(listings[0].dailyWage).toBeLessThanOrEqual(
      listings[listings.length - 1].dailyWage,
    );
  });

  it('throws for a role the pay book does not name', () => {
    const { clock, staffOrg } = makeSetup(STARTING_CASH, CHEAP_CONFIG, ROOMY_SLOTS, {
      ...WAGE_TABLE,
      dailyWageByRole: { 'lot-porter': { '1': 1, '2': 1, '3': 1, '4': 1, '5': 1 } },
    });
    clock.advanceDay();
    expect(() => staffOrg.getCandidates('salesperson')).toThrow(StaffOrgError);
  });
});

// ── The talent-scaled hire fee (#355, C1 R5) ────────────────────────────────

describe('StaffOrg — hire fee', () => {
  it('the hire fee scales with the candidate\'s wage', () => {
    const { clock, economy, staffOrg } = wageSetup();
    clock.advanceDay();
    const candidate = staffOrg.getCandidates('salesperson')[0];

    expect(candidate.hiringCost).toBe(WAGE_TABLE.hireFeeMultiple * candidate.dailyWage);

    // ...and that is the number actually charged, not just the one listed.
    const cashBefore = economy.cash;
    staffOrg.hire(candidate.candidateId);
    expect(cashBefore - economy.cash).toBe(
      WAGE_TABLE.hireFeeMultiple * candidate.dailyWage,
    );
  });

  it('a grade-5 candidate costs more to sign than a grade-1', () => {
    // Grade is forced rather than fished out of the archetype pool, so the test
    // states the claim instead of hoping the board is diverse: the SAME seeded
    // person read through bands that put everyone at the top of the ladder
    // versus bands that put everyone at the bottom. Under `hiringCostByTier`
    // these two were quoted the identical price for the same job.
    const asGrade5 = { ...WAGE_TABLE, gradeBands: [0, 0.001, 0.002, 0.003] };
    const asGrade1 = { ...WAGE_TABLE, gradeBands: [0.96, 0.97, 0.98, 0.99] };

    const top = makeSetup(STARTING_CASH, CHEAP_CONFIG, ROOMY_SLOTS, asGrade5);
    top.clock.advanceDay();
    const bottom = makeSetup(STARTING_CASH, CHEAP_CONFIG, ROOMY_SLOTS, asGrade1);
    bottom.clock.advanceDay();

    const strong = top.staffOrg.getCandidates('salesperson')[0];
    const weak = bottom.staffOrg.getCandidates('salesperson')[0];

    expect(strong.staff.id).toBe(weak.staff.id);
    expect(strong.grade).toBe(5);
    expect(weak.grade).toBe(1);
    expect(strong.hiringCost).toBeGreaterThan(weak.hiringCost);
  });

  it('never quotes a fee for a role the pay book does not name', () => {
    // The fee is derived from the wage, so an unnamed role can no longer sign
    // for a per-tier default — it throws, the same as the wage read does.
    const { clock, staffOrg } = makeSetup(STARTING_CASH, CHEAP_CONFIG, ROOMY_SLOTS, {
      ...WAGE_TABLE,
      dailyWageByRole: { 'lot-porter': { '1': 1, '2': 1, '3': 1, '4': 1, '5': 1 } },
    });
    clock.advanceDay();
    expect(() => staffOrg.getCandidates('salesperson')).toThrow(StaffOrgError);
  });
});

describe('StaffOrg — paidGrade', () => {
  it('stamps paidGrade at hire', () => {
    const { clock, staffOrg } = wageSetup();
    clock.advanceDay();
    const candidate = staffOrg.getCandidates('salesperson')[0];
    expect(candidate.staff.paidGrade).toBeUndefined();

    staffOrg.hire(candidate.candidateId);

    const hired = staffOrg.currentRoster[0];
    expect(hired.paidGrade).toBe(candidate.grade);
    expect(staffOrg.getPayBoard()[0].paidGrade).toBe(candidate.grade);
  });

  it('serializes, so a reloaded roster is paid what it was paid', () => {
    const { clock, staffOrg } = wageSetup();
    clock.advanceDay();
    staffOrg.hire(staffOrg.getCandidates('salesperson')[0].candidateId);
    const before = staffOrg.getPayBoard()[0];

    const reloaded = wageSetup().staffOrg;
    reloaded.restore(JSON.parse(JSON.stringify(staffOrg.snapshot())));

    expect(reloaded.getPayBoard()[0]).toEqual(before);
  });

  it('materializes paidGrade for a roster saved before the wage book existed', () => {
    const { clock, staffOrg } = wageSetup();
    clock.advanceDay();
    staffOrg.hire(staffOrg.getCandidates('salesperson')[0].candidateId);

    const snap = JSON.parse(JSON.stringify(staffOrg.snapshot()));
    for (const s of snap.roster) delete s.paidGrade;

    const reloaded = wageSetup().staffOrg;
    reloaded.restore(snap);

    const row = reloaded.getPayBoard()[0];
    expect(row.paidGrade).toBe(row.grade);
    expect(row.dailyWage).toBe(dailyWageFor(WAGE_TABLE, 'salesperson', row.grade));
  });

  it('growth does not silently reprice — the wage tracks paidGrade, not the current grade', () => {
    const { clock, staffOrg } = wageSetup();
    clock.advanceDay();
    staffOrg.hire(staffOrg.getCandidates('salesperson')[0].candidateId);
    const hiredWage = staffOrg.getPayBoard()[0].dailyWage;

    for (let i = 0; i < 200; i++) clock.advanceDay();

    const row = staffOrg.getPayBoard()[0];
    expect(row.dailyWage).toBe(hiredWage);
    expect(row.grade).toBeGreaterThanOrEqual(row.paidGrade);
  });
});

describe('StaffOrg — dailyPayroll', () => {
  it('is zero with nobody on the roster', () => {
    expect(wageSetup().staffOrg.dailyPayroll).toBe(0);
  });

  it('sums the roster and grows with each hire', () => {
    const { clock, staffOrg } = wageSetup();
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('salesperson');

    staffOrg.hire(candidates[0].candidateId);
    const one = staffOrg.dailyPayroll;
    expect(one).toBe(candidates[0].dailyWage);

    staffOrg.hire(candidates[1].candidateId);
    expect(staffOrg.dailyPayroll).toBe(one + candidates[1].dailyWage);
  });

  it('drops when someone leaves', () => {
    const { clock, staffOrg } = wageSetup();
    clock.advanceDay();
    staffOrg.hire(staffOrg.getCandidates('salesperson')[0].candidateId);
    staffOrg.fire(staffOrg.currentRoster[0].id);
    expect(staffOrg.dailyPayroll).toBe(0);
  });

  it('reprices on promotion — a manager costs manager money', () => {
    // The wage is role × paidGrade, so a promotion moves it without touching
    // `paidGrade`: you took the desk, you get the desk's pay.
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: NO_OVERHEAD });
    const staffOrg = createStaffOrg({
      bus,
      economy,
      masterSeed: MASTER_SEED,
      taxonomy,
      archetypes,
      config: CHEAP_CONFIG,
      slots: ROOMY_SLOTS,
      pay: WAGE_TABLE,
      getTier: () => 3,
    });
    clock.advanceDay();

    const best = [...staffOrg.getCandidates('salesperson')].sort(
      (a, b) => b.staff.effectiveness - a.staff.effectiveness,
    )[0];
    staffOrg.hire(best.candidateId);
    const staffId = staffOrg.currentRoster[0].id;
    const salesWage = staffOrg.dailyPayroll;
    const paidGrade = staffOrg.getPayBoard()[0].paidGrade;

    staffOrg.promote(staffId, 'used-car-manager');

    const row = staffOrg.getPayBoard()[0];
    expect(row.paidGrade).toBe(paidGrade);
    expect(row.dailyWage).toBe(dailyWageFor(WAGE_TABLE, 'used-car-manager', paidGrade));
    expect(staffOrg.dailyPayroll).not.toBe(salesWage);
  });
});

describe('StaffOrg — the shipped pay book', () => {
  it('is what an unwired StaffOrg falls back to', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: NO_OVERHEAD });
    const staffOrg = createStaffOrg({
      bus,
      economy,
      masterSeed: MASTER_SEED,
      taxonomy,
      archetypes,
      config: CHEAP_CONFIG,
      slots: ROOMY_SLOTS,
    });
    clock.advanceDay();
    const candidate = staffOrg.getCandidates('salesperson')[0];
    expect(candidate.dailyWage).toBe(
      dailyWageFor(loadStaffPay(), 'salesperson', candidate.grade),
    );
  });
});
