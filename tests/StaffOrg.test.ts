import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createStaffOrg, StaffOrgError, loadStaffOrgConfig } from '../src/game/StaffOrg';
import { loadStaffTaxonomy, loadStaffArchetypes } from '../src/game/NPC';
import type { StaffOrgConfig } from '../src/game/StaffOrg';

const STARTING_CASH = 50_000;
const MASTER_SEED = 99;

const taxonomy = loadStaffTaxonomy();
const archetypes = loadStaffArchetypes();

const NO_OVERHEAD = { weeklyRent: 0, weeklyPayrollStub: 0 };
const CHEAP_CONFIG: StaffOrgConfig = {
  hiringCostByTier: { worker: 100, 'customer-facing': 200, manager: 500, gm: 1000 },
  candidatesPerRole: 3,
};

function makeSetup(startingCash = STARTING_CASH, config = CHEAP_CONFIG) {
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

  it('candidates carry hiring cost matching the role tier', () => {
    const { clock, staffOrg } = makeSetup();
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('salesperson');
    // salesperson is customer-facing tier → cost 200 in CHEAP_CONFIG
    for (const c of candidates) {
      expect(c.hiringCost).toBe(200);
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
    const { clock, economy, staffOrg } = makeSetup();
    clock.advanceDay();
    const cashBefore = economy.cash;
    const [first] = staffOrg.getCandidates('salesperson');
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
    const { bus, clock, staffOrg } = makeSetup(50);
    clock.advanceDay();
    const events: unknown[] = [];
    bus.subscribe('staff:hired', (e) => events.push(e));
    const [first] = staffOrg.getCandidates('salesperson');
    expect(() => staffOrg.hire(first.candidateId)).toThrow(/[Ii]nsufficient/);
    expect(events).toHaveLength(0);
  });

  it('roster does not grow when hire throws', () => {
    const { clock, staffOrg } = makeSetup(50);
    clock.advanceDay();
    const [first] = staffOrg.getCandidates('salesperson');
    try { staffOrg.hire(first.candidateId); } catch { /* expected */ }
    expect(staffOrg.currentRoster).toHaveLength(0);
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
    expect(typeof config.hiringCostByTier['customer-facing']).toBe('number');
  });
});

// ── F&I Manager hire-tier gating ────────────────────────────────────────────

describe('StaffOrg — F&I Manager hire-tier gating', () => {
  function makeSetupWithTier(tier: number, startingCash = STARTING_CASH) {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({ bus, startingCash, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
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

  it('getCandidates for f&i-manager throws with message mentioning tier 2', () => {
    const { clock, staffOrg } = makeSetupWithTier(1);
    clock.advanceDay();
    expect(() => staffOrg.getCandidates('f&i-manager')).toThrow(/tier 2/i);
  });

  it('getCandidates for f&i-manager succeeds at Tier 2', () => {
    const { clock, staffOrg } = makeSetupWithTier(2);
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('f&i-manager');
    expect(candidates.length).toBeGreaterThan(0);
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
    const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
    const staffOrg = createStaffOrg({
      bus, economy, masterSeed: MASTER_SEED, taxonomy, archetypes, config: CHEAP_CONFIG,
      // no getTier dep
    });
    clock.advanceDay();
    // Should not throw even though f&i-manager has hireTier: 2
    expect(() => staffOrg.getCandidates('f&i-manager')).not.toThrow();
  });

  it('all f&i-manager candidates have product_presentation and finance_structuring skills', () => {
    const { clock, staffOrg } = makeSetupWithTier(2);
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
    const economy = createEconomy({ bus, startingCash, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
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

  it('getCandidates for gm throws with message mentioning tier 3', () => {
    const { clock, staffOrg } = makeSetupWithTier(2);
    clock.advanceDay();
    expect(() => staffOrg.getCandidates('gm')).toThrow(/tier 3/i);
  });

  it('getCandidates for gm succeeds at Tier 3', () => {
    const { clock, staffOrg } = makeSetupWithTier(3);
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('gm');
    expect(candidates.length).toBeGreaterThan(0);
  });

  it('all gm candidates have role_id gm', () => {
    const { clock, staffOrg } = makeSetupWithTier(3);
    clock.advanceDay();
    const candidates = staffOrg.getCandidates('gm');
    for (const c of candidates) {
      expect(c.staff.role_id).toBe('gm');
    }
  });
});
