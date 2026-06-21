import { createEventBus } from '../src/game/EventBus';
import {
  createServiceDemand,
  composeServiceIntake,
  composeConquestMix,
  conquestVolume,
  loadServiceDemandConfig,
  JOB_CATEGORIES,
  type ServiceDemandConfig,
  type ServiceDemandInput,
  type ServiceIntakeEntry,
} from '../src/game/ServiceDemand';
import type { ReturningOwner } from '../src/game/InstalledBase';

const CONFIG: ServiceDemandConfig = loadServiceDemandConfig();

function makeReturn(over: Partial<ReturningOwner> = {}): ReturningOwner {
  return {
    ownerId: 'cust-1::veh-1',
    customerId: 'cust-1',
    vehicleId: 'veh-1',
    category: 'sedan',
    powertrain: 'ice',
    jobCategory: 'oil_filters',
    ageDays: 200,
    ...over,
  };
}

function makeInput(over: Partial<ServiceDemandInput> = {}): ServiceDemandInput {
  return {
    day: 10,
    returns: [],
    owners: [],
    reputation: 1,
    serviceMarketing: 0,
    season: 'summer',
    masterSeed: 12345,
    ...over,
  };
}

const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);

describe('conquestVolume', () => {
  it('is the floor when either input is zero', () => {
    expect(conquestVolume(0, 1, CONFIG.conquest)).toBe(CONFIG.conquest.floor);
    expect(conquestVolume(1, 0, CONFIG.conquest)).toBe(CONFIG.conquest.floor);
    expect(conquestVolume(0, 0, CONFIG.conquest)).toBe(CONFIG.conquest.floor);
  });

  it('scales above the floor with reputation × marketing', () => {
    const max = conquestVolume(1, 1, CONFIG.conquest);
    expect(max).toBe(CONFIG.conquest.floor + Math.round(CONFIG.conquest.scale));
    expect(max).toBeGreaterThan(CONFIG.conquest.floor);
    // Monotone in the product: half-marketing yields between floor and max.
    const half = conquestVolume(1, 0.5, CONFIG.conquest);
    expect(half).toBeGreaterThanOrEqual(CONFIG.conquest.floor);
    expect(half).toBeLessThanOrEqual(max);
  });

  it('clamps out-of-range inputs', () => {
    expect(conquestVolume(5, 5, CONFIG.conquest)).toBe(
      CONFIG.conquest.floor + Math.round(CONFIG.conquest.scale),
    );
    expect(conquestVolume(-1, 1, CONFIG.conquest)).toBe(CONFIG.conquest.floor);
  });
});

describe('composeConquestMix', () => {
  it('returns a normalized distribution over the four job categories', () => {
    const mix = composeConquestMix(makeInput(), CONFIG);
    expect(Object.keys(mix).sort()).toEqual([...JOB_CATEGORIES].sort());
    expect(sum(JOB_CATEGORIES.map((c) => mix[c]))).toBeCloseTo(1, 6);
    for (const c of JOB_CATEGORIES) expect(mix[c]).toBeGreaterThanOrEqual(0);
  });

  it('is consumable-heavy by default (oil_filters dominates a fresh, neutral base)', () => {
    const mix = composeConquestMix(makeInput({ season: 'spring' }), CONFIG);
    expect(mix.oil_filters).toBeGreaterThan(mix.drivetrain);
    expect(mix.oil_filters).toBeGreaterThan(mix.electronics);
  });

  it('leans seasonally: winter favors tires_brakes more than summer does', () => {
    const winter = composeConquestMix(makeInput({ season: 'winter' }), CONFIG);
    const summer = composeConquestMix(makeInput({ season: 'summer' }), CONFIG);
    expect(winter.tires_brakes).toBeGreaterThan(summer.tires_brakes);
  });

  it('drifts toward late-life work as the installed fleet ages', () => {
    const young = composeConquestMix(
      makeInput({ day: 1000, owners: [{ saleDay: 990, powertrain: 'ice' }] }),
      CONFIG,
    );
    const old = composeConquestMix(
      makeInput({ day: 1000, owners: [{ saleDay: 0, powertrain: 'ice' }] }),
      CONFIG,
    );
    expect(old.drivetrain).toBeGreaterThan(young.drivetrain);
    expect(old.oil_filters).toBeLessThan(young.oil_filters);
  });

  it('skews by powertrain: an EV-heavy base pulls work off oil and onto electronics', () => {
    const ice = composeConquestMix(
      makeInput({ owners: [{ saleDay: 9, powertrain: 'ice' }] }),
      CONFIG,
    );
    const ev = composeConquestMix(
      makeInput({ owners: [{ saleDay: 9, powertrain: 'ev' }] }),
      CONFIG,
    );
    expect(ev.oil_filters).toBeLessThan(ice.oil_filters);
    expect(ev.electronics).toBeGreaterThan(ice.electronics);
  });
});

describe('composeServiceIntake — enrichment', () => {
  it('folds returns in as the primary stream with full identity + revenue', () => {
    const ret = makeReturn({ jobCategory: 'tires_brakes', category: 'truck', powertrain: 'hybrid' });
    const intake = composeServiceIntake(makeInput({ returns: [ret] }), CONFIG);
    const returnEntries = intake.filter((e) => e.source === 'return');
    expect(returnEntries).toHaveLength(1);
    const e = returnEntries[0];
    expect(e.customerId).toBe(ret.customerId);
    expect(e.vehicleId).toBe(ret.vehicleId);
    expect(e.category).toBe('truck');
    expect(e.powertrain).toBe('hybrid');
    expect(e.jobCategory).toBe('tires_brakes');
    expect(e.baseRevenue).toBe(CONFIG.jobRevenue.tires_brakes);
  });

  it('adds a conquest floor even with an empty base + zero marketing', () => {
    const intake = composeServiceIntake(makeInput(), CONFIG);
    const conquest = intake.filter((e) => e.source === 'conquest');
    expect(conquest).toHaveLength(CONFIG.conquest.floor);
  });

  it('scales conquest volume with reputation × marketing', () => {
    const floorIntake = composeServiceIntake(makeInput({ serviceMarketing: 0 }), CONFIG);
    const richIntake = composeServiceIntake(
      makeInput({ reputation: 1, serviceMarketing: 1 }),
      CONFIG,
    );
    const floorN = floorIntake.filter((e) => e.source === 'conquest').length;
    const richN = richIntake.filter((e) => e.source === 'conquest').length;
    expect(richN).toBeGreaterThan(floorN);
    expect(richN).toBe(conquestVolume(1, 1, CONFIG.conquest));
  });

  it('enriches every conquest entry with a valid, well-formed ticket', () => {
    const intake = composeServiceIntake(
      makeInput({ reputation: 1, serviceMarketing: 1 }),
      CONFIG,
    );
    const conquest = intake.filter((e) => e.source === 'conquest');
    const catKeys = Object.keys(CONFIG.conquestVehicleCategories);
    for (const e of conquest) {
      expect(JOB_CATEGORIES).toContain(e.jobCategory);
      expect(['ice', 'hybrid', 'ev']).toContain(e.powertrain);
      expect(catKeys).toContain(e.category);
      expect(e.baseRevenue).toBe(CONFIG.jobRevenue[e.jobCategory]);
      expect(e.customerId).toContain('conquest');
      expect(e.ticketId).toContain('conquest');
    }
  });

  it('keeps returns and conquest distinct + both present', () => {
    const intake = composeServiceIntake(
      makeInput({ returns: [makeReturn(), makeReturn({ ownerId: 'b', customerId: 'c2', vehicleId: 'v2' })] }),
      CONFIG,
    );
    expect(intake.filter((e) => e.source === 'return')).toHaveLength(2);
    expect(intake.filter((e) => e.source === 'conquest').length).toBeGreaterThanOrEqual(
      CONFIG.conquest.floor,
    );
  });
});

describe('composeServiceIntake — determinism (#122)', () => {
  it('is byte-identical under a fixed seed + inputs', () => {
    const input = makeInput({ reputation: 1, serviceMarketing: 1, owners: [{ saleDay: 1, powertrain: 'ev' }] });
    const a = composeServiceIntake(input, CONFIG);
    const b = composeServiceIntake(input, CONFIG);
    expect(a).toEqual(b);
  });

  it('varies the conquest draw with the master seed', () => {
    const base = makeInput({ reputation: 1, serviceMarketing: 1 });
    const a = composeServiceIntake({ ...base, masterSeed: 1 }, CONFIG);
    const b = composeServiceIntake({ ...base, masterSeed: 2 }, CONFIG);
    const jobsA = a.filter((e) => e.source === 'conquest').map((e) => e.jobCategory);
    const jobsB = b.filter((e) => e.source === 'conquest').map((e) => e.jobCategory);
    // Same count, but a different seed should perturb at least the draw stream.
    expect(jobsA.length).toBe(jobsB.length);
    expect(jobsA.join(',')).not.toBe(jobsB.join(','));
  });
});

describe('createServiceDemand — event wiring', () => {
  it('composes + publishes serviceDemand:intake_ready on each returns_ready', () => {
    const bus = createEventBus();
    let received: { day: number; intake: readonly ServiceIntakeEntry[] } | undefined;
    bus.subscribe('serviceDemand:intake_ready', (p) => {
      received = p as typeof received;
    });

    const sd = createServiceDemand({
      bus,
      masterSeed: 7,
      reputation: () => 1,
      serviceMarketing: () => 1,
      season: () => 'winter',
      baseOwners: () => [{ saleDay: 0, powertrain: 'ice' }],
    });

    bus.publish('installedBase:returns_ready', {
      day: 5,
      returns: [makeReturn()],
    });

    expect(received).toBeDefined();
    expect(received?.day).toBe(5);
    expect(received?.intake.some((e) => e.source === 'return')).toBe(true);
    expect(received?.intake.some((e) => e.source === 'conquest')).toBe(true);
    // getLatestIntake mirrors the published stream.
    expect(sd.getLatestIntake()).toEqual(received?.intake);
  });

  it('defaults service marketing to 0 (floor-only conquest) when omitted', () => {
    const bus = createEventBus();
    let received: { intake: readonly ServiceIntakeEntry[] } | undefined;
    bus.subscribe('serviceDemand:intake_ready', (p) => {
      received = p as typeof received;
    });
    createServiceDemand({
      bus,
      masterSeed: 7,
      reputation: () => 1,
      season: () => 'summer',
      baseOwners: () => [],
    });
    bus.publish('installedBase:returns_ready', { day: 1, returns: [] });
    const conquest = received?.intake.filter((e) => e.source === 'conquest') ?? [];
    expect(conquest).toHaveLength(CONFIG.conquest.floor);
  });
});
