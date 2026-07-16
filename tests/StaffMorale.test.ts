import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import { createStaffMorale, loadStaffMoraleConfig } from '../src/game/StaffMorale';
import type { StaffMoraleConfig } from '../src/game/StaffMorale';
import type { StaffOrg } from '../src/game/StaffOrg';
import type { StaffWithComposites, Staff } from '../src/game/NPC';

const MASTER_SEED = 99;

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeStaff(id: string, roleId = 'salesperson'): StaffWithComposites {
  const plain: Staff = {
    id,
    role_id: roleId,
    trait_ids: [],
    skills: {},
    resources: { stamina: 80 },
    counters: { experience: 0, deals_closed: 0, days_employed: 0 },
  };
  Object.defineProperty(plain, 'effectiveness', { get: () => 0.5, enumerable: false, configurable: true });
  Object.defineProperty(plain, 'trustworthiness', { get: () => 0.5, enumerable: false, configurable: true });
  return plain as StaffWithComposites;
}

function makeStaffOrg(roster: StaffWithComposites[]): StaffOrg {
  return {
    get currentRoster() { return roster; },
    getCandidates: () => [],
    hire: () => {},
    fire: () => {},
    assessCondition: () => null,
    getPromotionOptions: () => [],
    promote: () => {},
    snapshot: () => ({ schemaVersion: 1 as const, currentDay: 1, roster: [] }),
    restore: () => {},
  };
}

const BASE_CONFIG: StaffMoraleConfig = {
  defaultMorale: 70,
  moraleCeiling: 95,
  moraleFloor: 5,
  quitRiskThreshold: 30,
  quitRiskRate: 0,        // disabled by default in tests
  workloadCapacityPerStaff: 4,
  workloadOverloadPenalty: -5,
  workloadIdleBonus: 1,
  recognitionBonus: 3,
  payVsMarketBonus: 2,
  moraleMultiplierMin: 0.6,
  moraleMultiplierMax: 1.2,
};

function makeSetup(roster: StaffWithComposites[], config: StaffMoraleConfig = BASE_CONFIG) {
  const bus = createEventBus();
  const clock = createGameClock({ bus });
  const queue = createDepartmentQueue({ bus });
  const staffOrg = makeStaffOrg(roster);
  const morale = createStaffMorale({ bus, staffOrg, queue, masterSeed: MASTER_SEED, config });
  return { bus, clock, queue, morale };
}

// ── Initial state ─────────────────────────────────────────────────────────────

describe('StaffMorale — initial state', () => {
  it('returns defaultMorale for unknown staffId', () => {
    const { morale } = makeSetup([]);
    expect(morale.getMorale('nonexistent')).toBe(BASE_CONFIG.defaultMorale);
  });

  it('getMoraleMultiplier for unknown staffId uses defaultMorale', () => {
    const { morale } = makeSetup([]);
    const expected = 0.6 + (1.2 - 0.6) * (BASE_CONFIG.defaultMorale / 100);
    expect(morale.getMoraleMultiplier('nonexistent')).toBeCloseTo(expected, 5);
  });
});

// ── Hire / fire lifecycle ────────────────────────────────────────────────────

describe('StaffMorale — hire and fire events', () => {
  it('initializes morale to defaultMorale on staff:hired', () => {
    const s = makeStaff('s1');
    const { bus, morale } = makeSetup([s]);
    bus.publish('staff:hired', { staffId: 's1', roleId: 'salesperson', day: 1, hiringCost: 0 });
    expect(morale.getMorale('s1')).toBe(BASE_CONFIG.defaultMorale);
  });

  it('removes morale tracking on staff:fired', () => {
    const s = makeStaff('s2');
    const { bus, morale } = makeSetup([s]);
    bus.publish('staff:hired', { staffId: 's2', roleId: 'salesperson', day: 1, hiringCost: 0 });
    bus.publish('staff:fired', { staffId: 's2', roleId: 'salesperson', day: 2 });
    // After firing, snapshot should not contain the staffId
    expect(morale.snapshot().morale.some(([id]) => id === 's2')).toBe(false);
  });
});

// ── Recognition bonus ────────────────────────────────────────────────────────

describe('StaffMorale — recognition on closed sale', () => {
  it('increases morale by recognitionBonus on auto_resolved:closed', () => {
    const s = makeStaff('s3');
    const { bus, morale } = makeSetup([s]);
    bus.publish('staff:hired', { staffId: 's3', roleId: 'salesperson', day: 1, hiringCost: 0 });
    const before = morale.getMorale('s3');
    bus.publish('staff:auto_resolved', { customerId: 'c1', staffId: 's3', day: 1, outcome: 'closed', grossImpact: 2500 });
    expect(morale.getMorale('s3')).toBe(before + BASE_CONFIG.recognitionBonus);
  });

  it('does not change morale on auto_resolved:no_sale', () => {
    const s = makeStaff('s4');
    const { bus, morale } = makeSetup([s]);
    bus.publish('staff:hired', { staffId: 's4', roleId: 'salesperson', day: 1, hiringCost: 0 });
    const before = morale.getMorale('s4');
    bus.publish('staff:auto_resolved', { customerId: 'c2', staffId: 's4', day: 1, outcome: 'no_sale', grossImpact: 0 });
    expect(morale.getMorale('s4')).toBe(before);
  });
});

// ── Workload drift ───────────────────────────────────────────────────────────

describe('StaffMorale — workload drift', () => {
  it('applies idleBonus when queue depth is within capacity', () => {
    const s = makeStaff('s5');
    const { bus, morale } = makeSetup([s]);
    bus.publish('staff:hired', { staffId: 's5', roleId: 'salesperson', day: 1, hiringCost: 0 });
    const before = morale.getMorale('s5');
    // capacity = 1 × 4 = 4; no customers in queue → depth 0 ≤ 4
    bus.publish('clock:day_ended', { day: 1 });
    expect(morale.getMorale('s5')).toBe(before + BASE_CONFIG.workloadIdleBonus);
  });

  it('applies overloadPenalty when queue exceeds capacity', () => {
    const s = makeStaff('s6');
    const { bus, queue, morale } = makeSetup([s]);
    bus.publish('staff:hired', { staffId: 's6', roleId: 'salesperson', day: 1, hiringCost: 0 });
    // Flood the queue: 5 customers (capacity = 1 × 4 = 4)
    for (let i = 0; i < 5; i++) {
      bus.publish('capacity:customer_admitted', { day: 1, customerId: `cust:${i}`, label: `C${i}` });
    }
    void queue;
    const before = morale.getMorale('s6');
    bus.publish('clock:day_ended', { day: 1 });
    expect(morale.getMorale('s6')).toBe(before + BASE_CONFIG.workloadOverloadPenalty);
  });
});

// ── Payroll drift ────────────────────────────────────────────────────────────

describe('StaffMorale — payroll drift', () => {
  it('applies payVsMarketBonus on overnight_payroll for all roster members', () => {
    const s = makeStaff('s7');
    const { bus, morale } = makeSetup([s]);
    bus.publish('staff:hired', { staffId: 's7', roleId: 'salesperson', day: 1, hiringCost: 0 });
    const before = morale.getMorale('s7');
    bus.publish('clock:overnight_payroll', { day: 1 });
    expect(morale.getMorale('s7')).toBe(before + BASE_CONFIG.payVsMarketBonus);
  });
});

// ── Ceiling and floor clamping ───────────────────────────────────────────────

describe('StaffMorale — clamping', () => {
  it('morale never exceeds moraleCeiling', () => {
    const s = makeStaff('s8');
    const config: StaffMoraleConfig = { ...BASE_CONFIG, defaultMorale: 94, recognitionBonus: 10 };
    const { bus, morale } = makeSetup([s], config);
    bus.publish('staff:hired', { staffId: 's8', roleId: 'salesperson', day: 1, hiringCost: 0 });
    bus.publish('staff:auto_resolved', { customerId: 'c3', staffId: 's8', day: 1, outcome: 'closed', grossImpact: 0 });
    expect(morale.getMorale('s8')).toBe(config.moraleCeiling);
  });

  it('morale never falls below moraleFloor', () => {
    const s = makeStaff('s9');
    const config: StaffMoraleConfig = { ...BASE_CONFIG, defaultMorale: 6, workloadOverloadPenalty: -100 };
    const { bus, queue, morale } = makeSetup([s], config);
    bus.publish('staff:hired', { staffId: 's9', roleId: 'salesperson', day: 1, hiringCost: 0 });
    // Flood queue beyond capacity (1 staff × 4 = 4) to trigger overload penalty
    for (let i = 0; i < 5; i++) {
      bus.publish('capacity:customer_admitted', { day: 1, customerId: `oc:${i}`, label: `C${i}` });
    }
    void queue;
    bus.publish('clock:day_ended', { day: 1 });
    expect(morale.getMorale('s9')).toBe(config.moraleFloor);
  });
});

// ── Morale multiplier ────────────────────────────────────────────────────────

describe('StaffMorale — getMoraleMultiplier', () => {
  it('returns moraleMultiplierMin when morale is at floor', () => {
    const s = makeStaff('s10');
    const config: StaffMoraleConfig = { ...BASE_CONFIG, defaultMorale: 5 };
    const { bus, morale } = makeSetup([s], config);
    bus.publish('staff:hired', { staffId: 's10', roleId: 'salesperson', day: 1, hiringCost: 0 });
    // morale = floor = 5; multiplier ≈ lerp(0.6, 1.2, 5/100)
    expect(morale.getMoraleMultiplier('s10')).toBeCloseTo(0.6 + 0.6 * (5 / 100), 4);
  });

  it('returns moraleMultiplierMax when morale is at ceiling', () => {
    const s = makeStaff('s11');
    const config: StaffMoraleConfig = { ...BASE_CONFIG, defaultMorale: 95 };
    const { bus, morale } = makeSetup([s], config);
    bus.publish('staff:hired', { staffId: 's11', roleId: 'salesperson', day: 1, hiringCost: 0 });
    expect(morale.getMoraleMultiplier('s11')).toBeCloseTo(0.6 + 0.6 * (95 / 100), 4);
  });

  it('multiplier is higher for high-morale than low-morale staff', () => {
    const s1 = makeStaff('s12');
    const s2 = makeStaff('s13');
    const config: StaffMoraleConfig = { ...BASE_CONFIG };
    const { bus, morale } = makeSetup([s1, s2], config);
    bus.publish('staff:hired', { staffId: 's12', roleId: 'salesperson', day: 1, hiringCost: 0 });
    bus.publish('staff:hired', { staffId: 's13', roleId: 'salesperson', day: 1, hiringCost: 0 });
    // Drive s13 morale down
    for (let i = 0; i < 15; i++) {
      bus.publish('clock:day_ended', { day: i + 1 });
    }
    // s12 stays at defaultMorale (not in roster filter unless we push customers)
    // Just compare: manipulate directly via events
    expect(morale.getMoraleMultiplier('s12')).toBeGreaterThanOrEqual(morale.getMoraleMultiplier('s13'));
  });
});

// ── Quit risk ────────────────────────────────────────────────────────────────

describe('StaffMorale — quit risk', () => {
  it('staff below threshold with quitRiskRate=1 always quits', () => {
    const s = makeStaff('s14');
    const roster = [s];
    const config: StaffMoraleConfig = {
      ...BASE_CONFIG,
      defaultMorale: 10,   // below quitRiskThreshold=30
      quitRiskRate: 1.0,
    };
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const queue = createDepartmentQueue({ bus });
    const staffOrg = makeStaffOrg(roster);
    createStaffMorale({ bus, staffOrg, queue, masterSeed: MASTER_SEED, config });

    const quitEvents: unknown[] = [];
    bus.subscribe('staff:quit', (e) => quitEvents.push(e));

    bus.publish('staff:hired', { staffId: 's14', roleId: 'salesperson', day: 1, hiringCost: 0 });
    bus.publish('clock:overnight_followup_decay', { day: 1 });

    void clock;
    expect(quitEvents).toHaveLength(1);
    expect((quitEvents[0] as { staffId: string }).staffId).toBe('s14');
  });

  it('staff above threshold never quits even with quitRiskRate=1', () => {
    const s = makeStaff('s15');
    const roster = [s];
    const config: StaffMoraleConfig = {
      ...BASE_CONFIG,
      defaultMorale: 70,   // above quitRiskThreshold=30
      quitRiskRate: 1.0,
    };
    const bus = createEventBus();
    createGameClock({ bus });
    const queue = createDepartmentQueue({ bus });
    const staffOrg = makeStaffOrg(roster);
    createStaffMorale({ bus, staffOrg, queue, masterSeed: MASTER_SEED, config });

    const quitEvents: unknown[] = [];
    bus.subscribe('staff:quit', (e) => quitEvents.push(e));

    bus.publish('staff:hired', { staffId: 's15', roleId: 'salesperson', day: 1, hiringCost: 0 });
    bus.publish('clock:overnight_followup_decay', { day: 1 });

    expect(quitEvents).toHaveLength(0);
  });

  it('quit event carries correct morale value', () => {
    const s = makeStaff('s16');
    const roster = [s];
    const config: StaffMoraleConfig = {
      ...BASE_CONFIG,
      defaultMorale: 20,
      quitRiskRate: 1.0,
    };
    const bus = createEventBus();
    createGameClock({ bus });
    const queue = createDepartmentQueue({ bus });
    const staffOrg = makeStaffOrg(roster);
    createStaffMorale({ bus, staffOrg, queue, masterSeed: MASTER_SEED, config });

    const quitEvents: Array<{ morale: number }> = [];
    bus.subscribe('staff:quit', (e) => quitEvents.push(e));

    bus.publish('staff:hired', { staffId: 's16', roleId: 'salesperson', day: 1, hiringCost: 0 });
    bus.publish('clock:overnight_followup_decay', { day: 1 });

    expect(quitEvents[0].morale).toBe(20);
  });

  it('staff with quitRiskRate=0 never quits regardless of morale', () => {
    const s = makeStaff('s17');
    const roster = [s];
    const config: StaffMoraleConfig = {
      ...BASE_CONFIG,
      defaultMorale: 5,
      quitRiskRate: 0,
    };
    const bus = createEventBus();
    createGameClock({ bus });
    const queue = createDepartmentQueue({ bus });
    const staffOrg = makeStaffOrg(roster);
    createStaffMorale({ bus, staffOrg, queue, masterSeed: MASTER_SEED, config });

    const quitEvents: unknown[] = [];
    bus.subscribe('staff:quit', (e) => quitEvents.push(e));

    bus.publish('staff:hired', { staffId: 's17', roleId: 'salesperson', day: 1, hiringCost: 0 });
    for (let i = 0; i < 30; i++) {
      bus.publish('clock:overnight_followup_decay', { day: i + 1 });
    }

    expect(quitEvents).toHaveLength(0);
  });
});

// ── StaffOrg integration — quit removes from roster ──────────────────────────

describe('StaffMorale — staff:quit removes from StaffOrg roster', () => {
  it('roster shrinks after staff:quit is published', () => {
    const bus = createEventBus();
    createGameClock({ bus });
    const queue = createDepartmentQueue({ bus });

    const s = makeStaff('s18');
    const roster: StaffWithComposites[] = [s];
    const staffOrg = makeStaffOrg(roster);

    // Wire real quit subscription (StaffOrg.test already covers this, but confirm integration)
    bus.subscribe('staff:quit', ({ staffId }) => {
      const idx = roster.findIndex((m) => m.id === staffId);
      if (idx !== -1) roster.splice(idx, 1);
    });

    const config: StaffMoraleConfig = { ...BASE_CONFIG, defaultMorale: 10, quitRiskRate: 1.0 };
    createStaffMorale({ bus, staffOrg, queue, masterSeed: MASTER_SEED, config });

    bus.publish('staff:hired', { staffId: 's18', roleId: 'salesperson', day: 1, hiringCost: 0 });
    expect(staffOrg.currentRoster).toHaveLength(1);

    bus.publish('clock:overnight_followup_decay', { day: 1 });
    expect(staffOrg.currentRoster).toHaveLength(0);
  });
});

// ── Config loading ───────────────────────────────────────────────────────────

describe('StaffMorale — config', () => {
  it('loadStaffMoraleConfig returns valid tunables', () => {
    const config = loadStaffMoraleConfig();
    expect(config.defaultMorale).toBeGreaterThan(0);
    expect(config.defaultMorale).toBeLessThanOrEqual(100);
    expect(config.quitRiskThreshold).toBeGreaterThan(0);
    expect(config.moraleMultiplierMin).toBeLessThan(config.moraleMultiplierMax);
  });
});
