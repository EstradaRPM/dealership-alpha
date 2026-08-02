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
  headcountCapByTier: { '1': 50, '2': 50, '3': 50 },
  conditionRead: {
    minHalfWidthFraction: 0.10,
    maxHalfWidthFraction: 0.80,
    maxBiasFraction: 0.50,
    widthSkillExponent: 0.7,
  },
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

// ── Headcount cap by tier (#131) ────────────────────────────────────────────

describe('StaffOrg — headcount cap by tier', () => {
  const CAP_CONFIG: StaffOrgConfig = {
    hiringCostByTier: { worker: 100, 'customer-facing': 200, manager: 500, gm: 1000 },
    candidatesPerRole: 3,
    headcountCapByTier: { '1': 2, '2': 4, '3': 8 },
    conditionRead: CHEAP_CONFIG.conditionRead,
  };

  function makeCapSetup(tier: number) {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: NO_OVERHEAD });
    const staffOrg = createStaffOrg({
      bus, economy, masterSeed: MASTER_SEED, taxonomy, archetypes,
      config: CAP_CONFIG, getTier: () => tier,
    });
    return { bus, clock, economy, staffOrg };
  }

  // Hires up to `count` salespeople, one fresh candidate per day.
  function hireN(clock: ReturnType<typeof createGameClock>, staffOrg: ReturnType<typeof createStaffOrg>, count: number) {
    for (let i = 0; i < count; i++) {
      clock.advanceDay();
      staffOrg.hire(staffOrg.getCandidates('salesperson')[0].candidateId);
    }
  }

  it('allows hiring up to the Tier 1 cap', () => {
    const { clock, staffOrg } = makeCapSetup(1);
    hireN(clock, staffOrg, 2);
    expect(staffOrg.currentRoster).toHaveLength(2);
  });

  it('throws StaffOrgError when hiring past the Tier 1 cap', () => {
    const { clock, staffOrg } = makeCapSetup(1);
    hireN(clock, staffOrg, 2);
    clock.advanceDay();
    const next = staffOrg.getCandidates('salesperson')[0].candidateId;
    expect(() => staffOrg.hire(next)).toThrow(/[Hh]eadcount cap/);
  });

  it('does not grow roster or post event when the cap is hit', () => {
    const { bus, clock, economy, staffOrg } = makeCapSetup(1);
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

  it('a higher tier permits a larger roster', () => {
    const { clock, staffOrg } = makeCapSetup(2);
    hireN(clock, staffOrg, 4);
    expect(staffOrg.currentRoster).toHaveLength(4);
  });

  it('defaults to the Tier 1 cap when getTier is not provided', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: NO_OVERHEAD });
    const staffOrg = createStaffOrg({
      bus, economy, masterSeed: MASTER_SEED, taxonomy, archetypes, config: CAP_CONFIG,
    });
    hireN(clock, staffOrg, 2);
    clock.advanceDay();
    const next = staffOrg.getCandidates('salesperson')[0].candidateId;
    expect(() => staffOrg.hire(next)).toThrow(/[Hh]eadcount cap/);
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

// ── Body Shop hire-tier gating (#312) ───────────────────────────────────────

describe('StaffOrg — Body Shop hire-tier gating', () => {
  function makeSetupWithTier(tier: number) {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
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
    const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
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
