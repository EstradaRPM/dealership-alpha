import { createEventBus, type EventBus } from '../src/game/EventBus';
import {
  createInstalledBase,
  loadInstalledBaseConfig,
  isServiceDue,
  cadenceForPowertrain,
  returnProbability,
  selectJobCategory,
  isGouging,
  resolveServiceOutcome,
  shouldDefect,
  isRepeatBuyerDue,
  type InstalledBase,
  type InstalledBaseConfig,
  type ReturningOwner,
  type RepeatBuyerLead,
} from '../src/game/InstalledBase';
import type { EventPayload } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import {
  snapshotWorld,
  restoreWorld,
  migrateWorldSnapshot,
  WORLD_SNAPSHOT_VERSION,
  type WorldSnapshot,
  type PersistedWorldSnapshot,
} from '../src/worldSnapshot';
import type { CharacterProfile } from '../src/game/CareerProgression';

const PROFILE: CharacterProfile = {
  name: 'Ray Estrada',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0.15,
    startingCreditLine: 0,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

const CONFIG: InstalledBaseConfig = {
  loyaltySeedScale: 1.0,
  returnCadence: { ice: 120, hybrid: 150, ev: 240 },
  jobCategoryDrift: [
    { category: 'oil_filters', untilAgeDays: 365 },
    { category: 'tires_brakes', untilAgeDays: 1095 },
    { category: 'drivetrain', untilAgeDays: 2190 },
    { category: 'electronics' },
  ],
  returnRoll: { convenience: 0.9, priceSensitivity: 0.05 },
  feedback: {
    goodLoyaltyBonus: 0.04,
    goodCsiBonus: 0.04,
    missLoyaltyPenalty: 0.15,
    missCsiPenalty: 0.15,
    unservedLoyaltyPenalty: 0.1,
    unservedCsiPenalty: 0.1,
    gougeLoyaltyPenalty: 0.06,
    gougeCsiPenalty: 0.06,
    fairPostureThreshold: 0.66,
    reputationMissHit: -3,
    reputationUnservedHit: -2,
    reputationGougeHit: -1,
  },
  defection: { badVisitsToDefect: 3, noReturnsToDefect: 4 },
  repeatBuyer: { ageOutDays: 1460, minLoyalty: 0.6 },
};

/**
 * Emit the three signals a real sale fans out (all synchronous within one
 * `DealEngine.closeDeal`). `seedFiresLast` mirrors the live ordering
 * (`customer:resolved` published from inside CustomerPool's `deal:closed`
 * handler); flipping it proves the join is order-independent.
 */
function emitSale(
  bus: EventBus,
  opts: {
    customerId: string;
    vehicleId: string;
    category?: string;
    powertrain?: 'ice' | 'hybrid' | 'ev';
    saleDay?: number;
    retentionSeed: number;
    seedFiresLast?: boolean;
  },
): void {
  const {
    customerId,
    vehicleId,
    category = 'sedan',
    powertrain = 'ice',
    saleDay = 1,
    retentionSeed,
    seedFiresLast = true,
  } = opts;

  bus.publish('inventory:vehicle_sold', {
    day: saleDay,
    vehicleId,
    salePrice: 20_000,
    templateId: 'tmpl',
    brand: 'vanda',
    make: 'Honda',
    year: 2020,
    mileage: 40_000,
    condition: 'clean',
    category,
    purchasePrice: 15_000,
    reconCost: 800,
    powertrain,
  });

  const emitSeed = () =>
    bus.publish('customer:resolved', {
      customerId,
      outcome: 'closed',
      receptivity: 0.5,
      satisfaction: 1,
      retentionSeed,
      heat: 0,
      agreedPrice: 20_000,
      frontGross: 1_200,
    });

  if (!seedFiresLast) emitSeed();
  bus.publish('deal:closed', {
    customerId,
    vehicleId,
    agreedPrice: 20_000,
    frontGross: 1_200,
    backGross: 600,
    productGross: 600,
    reserveGross: 0,
    daysInInventory: 10,
    paymentMethod: 'cash',
    downPayment: 20_000,
    loanAmount: 0,
    term: 0,
    apr: 0,
  });
  if (seedFiresLast) emitSeed();
}

function build(): { bus: EventBus; base: InstalledBase } {
  const bus = createEventBus();
  const base = createInstalledBase({ bus, config: CONFIG });
  return { bus, base };
}

describe('InstalledBase accrual (#298)', () => {
  it('accrues exactly one owner record per closed deal, joining the sold-vehicle snapshot', () => {
    const { bus, base } = build();
    emitSale(bus, {
      customerId: 'c1',
      vehicleId: 'v1',
      category: 'suv',
      powertrain: 'ev',
      saleDay: 7,
      retentionSeed: 0.6,
    });

    expect(base.size).toBe(1);
    const [owner] = base.getOwners();
    expect(owner).toEqual({
      ownerId: 'c1::v1',
      customerId: 'c1',
      vehicleId: 'v1',
      category: 'suv', // joined from inventory:vehicle_sold, not re-derived
      powertrain: 'ev', // joined from inventory:vehicle_sold
      saleDay: 7, // from inventory:vehicle_sold.day
      loyalty: 0.6, // seeded from retentionSeed × scale(1.0)
      csi: 0.6, // CSI starts at the same satisfaction-at-sale seed (#306)
      consecutiveBadVisits: 0,
      consecutiveNoReturns: 0,
      repeatLeadEmitted: false,
    });
    expect(base.getOwner('c1::v1')).toEqual(owner);
  });

  it('seeds loyalty from retentionSeed via the config scale (clamped to [0,1])', () => {
    const bus = createEventBus();
    const base = createInstalledBase({
      bus,
      config: { ...CONFIG, loyaltySeedScale: 2.0 },
    });
    emitSale(bus, { customerId: 'c1', vehicleId: 'v1', retentionSeed: 0.4 });
    emitSale(bus, { customerId: 'c2', vehicleId: 'v2', retentionSeed: 0.9 });

    expect(base.getOwner('c1::v1')!.loyalty).toBeCloseTo(0.8, 10); // 0.4 × 2
    expect(base.getOwner('c2::v2')!.loyalty).toBe(1); // 0.9 × 2 → clamped
  });

  it('does NOT register a walked customer (no deal to join)', () => {
    const { bus, base } = build();
    bus.publish('customer:resolved', {
      customerId: 'walker',
      outcome: 'walk',
      receptivity: 0.3,
      satisfaction: 0,
      retentionSeed: 0.5,
      heat: 0.8,
      agreedPrice: 0,
      frontGross: 0,
    });
    expect(base.size).toBe(0);
  });

  it('joins order-independently — retentionSeed before the deal still accrues', () => {
    const { bus, base } = build();
    emitSale(bus, {
      customerId: 'c1',
      vehicleId: 'v1',
      retentionSeed: 0.55,
      seedFiresLast: false,
    });
    expect(base.size).toBe(1);
    expect(base.getOwner('c1::v1')!.loyalty).toBeCloseTo(0.55, 10);
  });

  it('registers one record per vehicle for a repeat buyer', () => {
    const { bus, base } = build();
    emitSale(bus, { customerId: 'c1', vehicleId: 'v1', retentionSeed: 0.5, saleDay: 1 });
    emitSale(bus, { customerId: 'c1', vehicleId: 'v2', retentionSeed: 0.7, saleDay: 400 });
    expect(base.size).toBe(2);
    expect(base.getOwners().map((o) => o.ownerId).sort()).toEqual([
      'c1::v1',
      'c1::v2',
    ]);
  });

  it('is deterministic — identical event streams produce identical bases', () => {
    const a = build();
    const b = build();
    const sales = [
      { customerId: 'c1', vehicleId: 'v1', retentionSeed: 0.31, saleDay: 2 },
      { customerId: 'c2', vehicleId: 'v2', retentionSeed: 0.88, saleDay: 5 },
      { customerId: 'c3', vehicleId: 'v3', retentionSeed: 0.5, saleDay: 9 },
    ];
    for (const s of sales) emitSale(a.bus, s);
    for (const s of sales) emitSale(b.bus, s);
    expect(a.base.snapshot()).toEqual(b.base.snapshot());
  });
});

describe('InstalledBase persistence (#298)', () => {
  it('round-trips owner records + loyalty onto a fresh base', () => {
    const { bus, base } = build();
    emitSale(bus, { customerId: 'c1', vehicleId: 'v1', retentionSeed: 0.6, saleDay: 3 });
    emitSale(bus, { customerId: 'c2', vehicleId: 'v2', retentionSeed: 0.2, saleDay: 8 });

    const snap = base.snapshot();
    // SaveStore persists plain data — the blob must survive JSON.
    const reparsed = JSON.parse(JSON.stringify(snap)) as typeof snap;
    expect(reparsed).toEqual(snap);

    const { base: fresh } = build();
    expect(fresh.size).toBe(0);
    fresh.restore(reparsed);
    expect(fresh.getOwners()).toEqual(base.getOwners());
  });

  it('the loaded config matches the shipped tunable', () => {
    expect(loadInstalledBaseConfig().loyaltySeedScale).toBeGreaterThanOrEqual(0);
  });
});

describe('InstalledBase through the world seam (#298)', () => {
  function buildWorld(masterSeed: number) {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
    return { bus, world };
  }

  it('accrues from a real close and round-trips through snapshotWorld/restoreWorld', () => {
    const seed = 298;
    const { bus, world: original } = buildWorld(seed);

    // Open Day 1, buy a unit, then drive a real close through DealEngine.
    bus.publish('clock:day_started', { day: 1 });
    const listing = original.inventory.getAuctionListings()[0];
    expect(listing).toBeDefined();
    original.inventory.buyFromAuction(listing.id);
    const unit = original.inventory.getLotVehicles()[0];

    const customerId = original.customerPool.spawnCustomer(
      'young_family',
      'family_vehicle_search',
      'Young Family',
    );
    original.dealEngine.closeDeal({
      customerId,
      vehicleId: unit.id,
      agreedPrice: unit.askingPrice,
      paymentMethod: 'cash',
    });

    expect(original.installedBase.size).toBe(1);
    const owner = original.installedBase.getOwners()[0];
    expect(owner.vehicleId).toBe(unit.id);
    expect(owner.category).toBe(unit.category);
    expect(owner.powertrain).toBe('ice');

    const snap = snapshotWorld(original);
    const reparsed = JSON.parse(JSON.stringify(snap)) as WorldSnapshot;
    expect(reparsed).toEqual(snap);

    // A fresh same-seed World boots with an empty base...
    const { world: rebuilt } = buildWorld(seed);
    expect(rebuilt.installedBase.size).toBe(0);

    // ...until restore rehydrates the owner record.
    restoreWorld(reparsed, rebuilt);
    expect(rebuilt.installedBase.getOwners()).toEqual(
      original.installedBase.getOwners(),
    );
  });

  it('migrates a pre-#298 save by materializing an empty installed base', () => {
    const { world } = buildWorld(4242);
    const current = snapshotWorld(world);
    // installedBase was introduced at the v8→v9 step; a genuine pre-#298 save is
    // version 8 and carries neither installedBase nor any later-added key
    // (partsInventory, v9→v10). Strip both to reconstruct that vintage.
    const { installedBase, partsInventory, ...legacyModules } = current.modules;
    // A fresh world snapshots at the current module schema (v2, #306).
    expect(installedBase).toEqual({ schemaVersion: 2, owners: [] });

    const persisted: PersistedWorldSnapshot = {
      version: 8,
      modules: legacyModules,
    };
    const migrated = migrateWorldSnapshot(persisted);
    expect(migrated.version).toBe(WORLD_SNAPSHOT_VERSION);
    expect(migrated.modules.installedBase).toEqual({
      schemaVersion: 1,
      owners: [],
    });
    // The same upgrade run also materializes empty parts stock (v9→v10).
    expect(migrated.modules.partsInventory).toEqual({
      schemaVersion: 1,
      lots: [],
    });
  });
});

// ── #300: return cadence + job-category drift ────────────────────────────────

describe('InstalledBase return roll (#300, pure)', () => {
  it('is monotone increasing in loyalty', () => {
    const p = (loyalty: number) =>
      returnProbability({ loyalty, reputation: 0.8, convenience: 1, priceSensitivity: 0 });
    expect(p(0.8)).toBeGreaterThan(p(0.4));
    expect(p(0.4)).toBeGreaterThan(p(0.1));
  });

  it('is monotone increasing in reputation', () => {
    const p = (reputation: number) =>
      returnProbability({ loyalty: 0.7, reputation, convenience: 1, priceSensitivity: 0 });
    expect(p(0.9)).toBeGreaterThan(p(0.5));
    expect(p(0.5)).toBeGreaterThan(p(0.2));
  });

  it('is monotone decreasing in price-sensitivity', () => {
    const p = (priceSensitivity: number) =>
      returnProbability({ loyalty: 0.7, reputation: 0.8, convenience: 1, priceSensitivity });
    expect(p(0.1)).toBeGreaterThan(p(0.3));
    expect(p(0.3)).toBeGreaterThan(p(0.5));
  });

  it('clamps to [0,1]', () => {
    expect(
      returnProbability({ loyalty: 1, reputation: 1, convenience: 5, priceSensitivity: 0 }),
    ).toBe(1);
    expect(
      returnProbability({ loyalty: 1, reputation: 1, convenience: 1, priceSensitivity: 2 }),
    ).toBe(0);
  });
});

describe('InstalledBase cadence (#300, pure)', () => {
  it('comes due at whole multiples of the interval, never at age 0', () => {
    expect(isServiceDue(0, 120)).toBe(false);
    expect(isServiceDue(60, 120)).toBe(false);
    expect(isServiceDue(120, 120)).toBe(true);
    expect(isServiceDue(240, 120)).toBe(true);
    expect(isServiceDue(241, 120)).toBe(false);
  });

  it('cycles EVs less often than ICE (longer interval)', () => {
    const ice = cadenceForPowertrain('ice', CONFIG);
    const hybrid = cadenceForPowertrain('hybrid', CONFIG);
    const ev = cadenceForPowertrain('ev', CONFIG);
    expect(ev).toBeGreaterThan(hybrid);
    expect(hybrid).toBeGreaterThan(ice);
  });
});

describe('InstalledBase job-category drift (#300, pure)', () => {
  it('drifts early→late as the car ages', () => {
    expect(selectJobCategory(30, CONFIG)).toBe('oil_filters');
    expect(selectJobCategory(364, CONFIG)).toBe('oil_filters');
    expect(selectJobCategory(365, CONFIG)).toBe('tires_brakes');
    expect(selectJobCategory(1094, CONFIG)).toBe('tires_brakes');
    expect(selectJobCategory(1095, CONFIG)).toBe('drivetrain');
    expect(selectJobCategory(2189, CONFIG)).toBe('drivetrain');
    expect(selectJobCategory(2190, CONFIG)).toBe('electronics');
    expect(selectJobCategory(9999, CONFIG)).toBe('electronics');
  });
});

describe('InstalledBase returning-owner stream (#300)', () => {
  // P saturates to 1 (loyalty 1 × reputation 1 × convenience 2 = 2 → clamped),
  // so a due owner always returns — making the cadence/drift deterministic to
  // assert without reasoning about the RNG draw.
  const ALWAYS: InstalledBaseConfig = {
    ...CONFIG,
    returnRoll: { convenience: 2, priceSensitivity: 0 },
  };

  function buildCadence(opts?: {
    config?: InstalledBaseConfig;
    masterSeed?: number;
    reputation?: () => number;
  }) {
    const bus = createEventBus();
    const base = createInstalledBase({
      bus,
      config: opts?.config ?? CONFIG,
      masterSeed: opts?.masterSeed ?? 7,
      reputation: opts?.reputation ?? (() => 1),
    });
    const streams: Array<{ day: number; returns: readonly ReturningOwner[] }> = [];
    bus.subscribe('installedBase:returns_ready', (p) => streams.push(p));
    return { bus, base, streams };
  }

  it('emits a returns stream every day, empty before any owner is due', () => {
    const { bus, streams } = buildCadence();
    bus.publish('clock:day_started', { day: 1 });
    expect(streams).toHaveLength(1);
    expect(streams[0]).toEqual({ day: 1, returns: [] });
  });

  it('returns a due owner carrying customer + vehicle + due job category', () => {
    const { bus, streams } = buildCadence({ config: ALWAYS });
    emitSale(bus, {
      customerId: 'c1',
      vehicleId: 'v1',
      category: 'suv',
      powertrain: 'ice',
      saleDay: 1,
      retentionSeed: 1,
    });

    // Not due before the first cadence interval (120 days for ICE).
    bus.publish('clock:day_started', { day: 60 });
    expect(streams[streams.length - 1].returns).toEqual([]);

    // Due at sale day + 120.
    bus.publish('clock:day_started', { day: 121 });
    expect(streams[streams.length - 1].returns).toEqual([
      {
        ownerId: 'c1::v1',
        customerId: 'c1',
        vehicleId: 'v1',
        category: 'suv',
        powertrain: 'ice',
        jobCategory: 'oil_filters', // age 120 < 365
        ageDays: 120,
      },
    ]);
  });

  it('cycles EVs less often than ICE', () => {
    const { bus, streams } = buildCadence({ config: ALWAYS });
    emitSale(bus, {
      customerId: 'c1',
      vehicleId: 'v1',
      powertrain: 'ev',
      saleDay: 1,
      retentionSeed: 1,
    });

    // ICE would be due at age 120; an EV (240) is not.
    bus.publish('clock:day_started', { day: 121 });
    expect(streams[streams.length - 1].returns).toEqual([]);

    // EV comes due at age 240.
    bus.publish('clock:day_started', { day: 241 });
    expect(streams[streams.length - 1].returns.map((r) => r.ownerId)).toEqual([
      'c1::v1',
    ]);
  });

  it('drifts the due job category with car age through the cadence', () => {
    const { bus, streams } = buildCadence({ config: ALWAYS });
    emitSale(bus, {
      customerId: 'c1',
      vehicleId: 'v1',
      powertrain: 'ice',
      saleDay: 1,
      retentionSeed: 1,
    });

    // age 480 (4× ICE cadence) → tires_brakes band.
    bus.publish('clock:day_started', { day: 481 });
    expect(streams[streams.length - 1].returns[0].jobCategory).toBe('tires_brakes');

    // age 1200 (10× cadence) → drivetrain band.
    bus.publish('clock:day_started', { day: 1201 });
    expect(streams[streams.length - 1].returns[0].jobCategory).toBe('drivetrain');

    // age 2280 (19× cadence) → electronics catch-all.
    bus.publish('clock:day_started', { day: 2281 });
    expect(streams[streams.length - 1].returns[0].jobCategory).toBe('electronics');
  });

  it('zero reputation drives P to 0 — a due owner never returns', () => {
    const { bus, streams } = buildCadence({
      config: ALWAYS,
      reputation: () => 0,
    });
    emitSale(bus, {
      customerId: 'c1',
      vehicleId: 'v1',
      powertrain: 'ice',
      saleDay: 1,
      retentionSeed: 1,
    });
    bus.publish('clock:day_started', { day: 121 });
    expect(streams[streams.length - 1].returns).toEqual([]);
  });

  it('is deterministic — same seed + same sales produce an identical stream', () => {
    function run() {
      const { bus, streams } = buildCadence({ masterSeed: 4242 });
      // A mid-loyalty owner whose return hinges on the RNG draw (P ≈ 0.45),
      // so determinism is actually exercised rather than saturated to P=1.
      emitSale(bus, {
        customerId: 'c1',
        vehicleId: 'v1',
        powertrain: 'ice',
        saleDay: 1,
        retentionSeed: 0.5,
      });
      for (let d = 100; d <= 1300; d++) {
        bus.publish('clock:day_started', { day: d });
      }
      return streams;
    }
    expect(run()).toEqual(run());
  });

  it('rolls each owner independently — one return is order-independent of others', () => {
    // Two owners, both due the same day; the per-owner seed is keyed on ownerId
    // so the stream is stable regardless of registry iteration concerns.
    const a = buildCadence({ masterSeed: 99, config: ALWAYS });
    emitSale(a.bus, { customerId: 'c1', vehicleId: 'v1', powertrain: 'ice', saleDay: 1, retentionSeed: 1 });
    emitSale(a.bus, { customerId: 'c2', vehicleId: 'v2', powertrain: 'ice', saleDay: 1, retentionSeed: 1 });
    a.bus.publish('clock:day_started', { day: 121 });
    expect(
      a.streams[a.streams.length - 1].returns.map((r) => r.ownerId).sort(),
    ).toEqual(['c1::v1', 'c2::v2']);
  });
});

describe('InstalledBase return cadence through the world seam (#300)', () => {
  it('emits installedBase:returns_ready off the live clock', () => {
    const bus = createEventBus();
    createWorld({ bus, masterSeed: 300, characterProfile: PROFILE });
    const streams: Array<{ day: number; returns: readonly ReturningOwner[] }> = [];
    bus.subscribe('installedBase:returns_ready', (p) => streams.push(p));

    bus.publish('clock:day_started', { day: 1 });
    expect(streams).toHaveLength(1);
    expect(streams[0]).toEqual({ day: 1, returns: [] });
  });
});

// ── #306: loyalty/CSI feedback, defection, repeat-buyer leads ────────────────

describe('InstalledBase service feedback (#306, pure)', () => {
  it('a fair-price close raises loyalty + CSI; a gouged close drops both', () => {
    const fair = resolveServiceOutcome({ kind: 'closed', posture: 0.5, config: CONFIG });
    expect(fair.loyaltyDelta).toBeGreaterThan(0);
    expect(fair.csiDelta).toBeGreaterThan(0);
    expect(fair.isBadVisit).toBe(false);
    expect(fair.reputationHit).toBe(0);

    const gouged = resolveServiceOutcome({ kind: 'closed', posture: 0.9, config: CONFIG });
    expect(gouged.loyaltyDelta).toBeLessThan(0);
    expect(gouged.csiDelta).toBeLessThan(0);
    expect(gouged.isBadVisit).toBe(true);
    expect(gouged.reputationHit).toBeLessThan(0);
  });

  it('misses and unserved jobs drop loyalty + CSI and ding Reputation', () => {
    for (const kind of ['missed', 'unserved'] as const) {
      const e = resolveServiceOutcome({ kind, posture: 0.5, config: CONFIG });
      expect(e.loyaltyDelta).toBeLessThan(0);
      expect(e.csiDelta).toBeLessThan(0);
      expect(e.isBadVisit).toBe(true);
      expect(e.reputationHit).toBeLessThan(0);
    }
  });

  it('gates gouging on the fair-posture threshold', () => {
    expect(isGouging(0.66, CONFIG)).toBe(false);
    expect(isGouging(0.67, CONFIG)).toBe(true);
  });

  it('shouldDefect fires on either sustained bad visits or sustained non-returns', () => {
    expect(shouldDefect({ consecutiveBadVisits: 2, consecutiveNoReturns: 2 }, CONFIG)).toBe(false);
    expect(shouldDefect({ consecutiveBadVisits: 3, consecutiveNoReturns: 0 }, CONFIG)).toBe(true);
    expect(shouldDefect({ consecutiveBadVisits: 0, consecutiveNoReturns: 4 }, CONFIG)).toBe(true);
  });

  it('isRepeatBuyerDue gates on age-out, loyalty floor, and the once-only flag', () => {
    const loyal = { loyalty: 0.7, repeatLeadEmitted: false };
    expect(isRepeatBuyerDue(loyal, 1459, CONFIG)).toBe(false); // not aged out yet
    expect(isRepeatBuyerDue(loyal, 1460, CONFIG)).toBe(true);
    expect(isRepeatBuyerDue({ loyalty: 0.5, repeatLeadEmitted: false }, 2000, CONFIG)).toBe(false); // below floor
    expect(isRepeatBuyerDue({ loyalty: 0.7, repeatLeadEmitted: true }, 2000, CONFIG)).toBe(false); // already emitted
  });
});

describe('InstalledBase feedback loop (#306)', () => {
  /** Emit a served-job close for an owner via the intake map → ticket_closed. */
  function close(bus: EventBus, customerId: string, vehicleId: string, day: number): void {
    const serviceItemId = `svc-${customerId}-${vehicleId}-${day}`;
    bus.publish('service:intake_ready', {
      day,
      items: [
        {
          serviceItemId,
          source: 'return',
          customerId,
          vehicleId,
          category: 'sedan',
          powertrain: 'ice',
          jobCategory: 'oil_filters',
          baseRevenue: 200,
          label: 'Oil change',
        },
      ],
    });
    bus.publish('service:ticket_closed', { serviceItemId, day, revenue: 200, advisorId: 'a1' });
  }

  function miss(bus: EventBus, customerId: string, vehicleId: string, day: number): void {
    bus.publish('service:job_missed', {
      serviceItemId: `m-${day}`,
      day,
      customerId,
      vehicleId,
      jobCategory: 'tires_brakes',
      lostRevenue: 300,
      csiHit: 4,
      advisorId: 'a1',
    });
  }

  it('a fair-price close raises the owner loyalty + CSI', () => {
    const { bus, base } = build();
    emitSale(bus, { customerId: 'c1', vehicleId: 'v1', retentionSeed: 0.5 });
    const before = base.getOwner('c1::v1')!;
    expect(before.csi).toBeCloseTo(0.5, 10);

    close(bus, 'c1', 'v1', 130);
    const after = base.getOwner('c1::v1')!;
    expect(after.loyalty).toBeGreaterThan(before.loyalty);
    expect(after.csi).toBeGreaterThan(before.csi);
    expect(after.consecutiveBadVisits).toBe(0);
  });

  it('a miss lowers loyalty + CSI and emits a Reputation hit', () => {
    const { bus, base } = build();
    const hits: EventPayload<'reputation:satisfaction_hit'>[] = [];
    bus.subscribe('reputation:satisfaction_hit', (p) => hits.push(p));
    emitSale(bus, { customerId: 'c1', vehicleId: 'v1', retentionSeed: 0.8 });

    miss(bus, 'c1', 'v1', 130);
    const owner = base.getOwner('c1::v1')!;
    expect(owner.loyalty).toBeCloseTo(0.65, 10); // 0.8 − 0.15
    expect(owner.csi).toBeCloseTo(0.65, 10);
    expect(owner.consecutiveBadVisits).toBe(1);
    expect(hits).toHaveLength(1);
    expect(hits[0].amount).toBe(-3);
    expect(hits[0].reason).toBe('service_missed');
  });

  it('a premium (gouging) posture turns a close into a loyalty/CSI drop + Reputation hit', () => {
    const bus = createEventBus();
    const base = createInstalledBase({ bus, config: CONFIG, getPricingPosture: () => 0.9 });
    const hits: EventPayload<'reputation:satisfaction_hit'>[] = [];
    bus.subscribe('reputation:satisfaction_hit', (p) => hits.push(p));
    emitSale(bus, { customerId: 'c1', vehicleId: 'v1', retentionSeed: 0.8 });

    close(bus, 'c1', 'v1', 130);
    const owner = base.getOwner('c1::v1')!;
    expect(owner.loyalty).toBeCloseTo(0.74, 10); // 0.8 − 0.06
    expect(owner.consecutiveBadVisits).toBe(1);
    expect(hits).toHaveLength(1);
    expect(hits[0].reason).toBe('service_gouged');
  });

  it('sustained bad experiences permanently defect an owner', () => {
    const { bus, base } = build();
    const defections: EventPayload<'installedBase:owner_defected'>[] = [];
    bus.subscribe('installedBase:owner_defected', (p) => defections.push(p));
    emitSale(bus, { customerId: 'c1', vehicleId: 'v1', retentionSeed: 0.9 });

    miss(bus, 'c1', 'v1', 130);
    miss(bus, 'c1', 'v1', 260);
    expect(base.size).toBe(1); // 2 bad visits < threshold (3)
    miss(bus, 'c1', 'v1', 390);

    expect(base.size).toBe(0); // 3rd bad visit defects
    expect(base.getOwner('c1::v1')).toBeUndefined();
    expect(defections).toHaveLength(1);
    expect(defections[0].ownerId).toBe('c1::v1');
    expect(defections[0].reason).toBe('missed');
  });

  it('a good visit resets the bad-visit streak (no defection)', () => {
    const { bus, base } = build();
    emitSale(bus, { customerId: 'c1', vehicleId: 'v1', retentionSeed: 0.9 });
    miss(bus, 'c1', 'v1', 130);
    miss(bus, 'c1', 'v1', 260);
    close(bus, 'c1', 'v1', 390); // resets streak
    miss(bus, 'c1', 'v1', 520);
    miss(bus, 'c1', 'v1', 650);
    expect(base.size).toBe(1); // streak never reached 3 consecutively
    expect(base.getOwner('c1::v1')!.consecutiveBadVisits).toBe(2);
  });

  it('a conquest close (no matching owner) touches no owner record', () => {
    const { bus, base } = build();
    emitSale(bus, { customerId: 'c1', vehicleId: 'v1', retentionSeed: 0.5 });
    const before = base.getOwner('c1::v1')!;
    // intake_ready carries only a conquest ticket → ticket_closed maps to nobody.
    bus.publish('service:intake_ready', {
      day: 130,
      items: [
        {
          serviceItemId: 'conq-1',
          source: 'conquest',
          customerId: 'stranger',
          vehicleId: 'x9',
          category: 'sedan',
          powertrain: 'ice',
          jobCategory: 'oil_filters',
          baseRevenue: 200,
          label: 'Oil change',
        },
      ],
    });
    bus.publish('service:ticket_closed', { serviceItemId: 'conq-1', day: 130, revenue: 200, advisorId: 'a1' });
    expect(base.getOwner('c1::v1')).toEqual(before);
  });
});

describe('InstalledBase non-return defection (#306)', () => {
  // P = loyalty(low) × reputation(0) → 0, so a due owner never returns and the
  // non-return counter climbs each cadence cycle until it defects.
  it('sustained non-returns defect an owner out of the base', () => {
    const bus = createEventBus();
    const base = createInstalledBase({
      bus,
      config: CONFIG,
      masterSeed: 1,
      reputation: () => 0, // P(return) = 0 every cycle
    });
    const defections: EventPayload<'installedBase:owner_defected'>[] = [];
    bus.subscribe('installedBase:owner_defected', (p) => defections.push(p));
    emitSale(bus, { customerId: 'c1', vehicleId: 'v1', powertrain: 'ice', saleDay: 1, retentionSeed: 0.9 });

    // ICE cadence 120 → due at 121, 241, 361, 481 (ageDays 120/240/360/480).
    for (const day of [121, 241, 361]) bus.publish('clock:day_started', { day });
    expect(base.size).toBe(1); // 3 non-returns < threshold (4)
    bus.publish('clock:day_started', { day: 481 });

    expect(base.size).toBe(0); // 4th non-return defects
    expect(defections).toHaveLength(1);
    expect(defections[0].reason).toBe('sustained_non_return');
  });

  it('a return resets the non-return streak', () => {
    // Reputation high enough that P(return)=1 every cycle (loyalty 1 × rep 1 ×
    // convenience 2 = 2 → clamped) so the owner always returns and never defects.
    const bus = createEventBus();
    const base = createInstalledBase({
      bus,
      config: { ...CONFIG, returnRoll: { convenience: 2, priceSensitivity: 0 } },
      reputation: () => 1,
    });
    emitSale(bus, { customerId: 'c1', vehicleId: 'v1', powertrain: 'ice', saleDay: 1, retentionSeed: 1 });
    for (const day of [121, 241, 361, 481, 601]) bus.publish('clock:day_started', { day });
    expect(base.size).toBe(1);
    expect(base.getOwner('c1::v1')!.consecutiveNoReturns).toBe(0);
  });
});

describe('InstalledBase repeat-buyer leads (#306)', () => {
  function buildLeads() {
    const bus = createEventBus();
    const base = createInstalledBase({ bus, config: CONFIG, reputation: () => 1 });
    const streams: RepeatBuyerLead[][] = [];
    bus.subscribe('installedBase:repeat_buyer_ready', (p) => streams.push([...p.leads]));
    return { bus, base, streams };
  }

  it('emits a repeat_buyer_ready stream every day (empty before age-out)', () => {
    const { bus, streams } = buildLeads();
    bus.publish('clock:day_started', { day: 1 });
    expect(streams).toHaveLength(1);
    expect(streams[0]).toEqual([]);
  });

  it('a loyal owner whose car ages out emits a warm lead exactly once', () => {
    const { bus, base, streams } = buildLeads();
    emitSale(bus, { customerId: 'c1', vehicleId: 'v1', category: 'suv', saleDay: 1, retentionSeed: 0.9 });

    bus.publish('clock:day_started', { day: 1000 }); // age 999 < 1460
    expect(streams[streams.length - 1]).toEqual([]);

    bus.publish('clock:day_started', { day: 1461 }); // age 1460 ≥ ageOutDays
    expect(streams[streams.length - 1]).toEqual([
      { ownerId: 'c1::v1', customerId: 'c1', vehicleId: 'v1', category: 'suv', loyalty: 0.9 },
    ]);
    expect(base.getOwner('c1::v1')!.repeatLeadEmitted).toBe(true);

    // Does not re-emit on a later day.
    bus.publish('clock:day_started', { day: 1600 });
    expect(streams[streams.length - 1]).toEqual([]);
  });

  it('a low-loyalty aged-out owner emits no lead', () => {
    const { bus, streams } = buildLeads();
    emitSale(bus, { customerId: 'c1', vehicleId: 'v1', saleDay: 1, retentionSeed: 0.4 });
    bus.publish('clock:day_started', { day: 1461 });
    expect(streams[streams.length - 1]).toEqual([]);
  });

  it('spawns a warm sales customer through the world seam', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 306, characterProfile: PROFILE });
    const arrivals: EventPayload<'customer:arrived'>[] = [];
    bus.subscribe('customer:arrived', (p) => arrivals.push(p));

    bus.publish('installedBase:repeat_buyer_ready', {
      day: 1,
      leads: [
        { ownerId: 'c1::v1', customerId: 'c1', vehicleId: 'v1', category: 'suv', loyalty: 0.9 },
      ],
    });

    expect(arrivals).toHaveLength(1);
    expect(arrivals[0].label).toContain('Repeat Buyer');
    // The lead is now a live session in the pool.
    expect(world.customerPool.getSession(arrivals[0].customerId)).toBeDefined();
  });
});

describe('InstalledBase feedback persistence (#306)', () => {
  it('round-trips the new feedback fields', () => {
    const { bus, base } = build();
    emitSale(bus, { customerId: 'c1', vehicleId: 'v1', retentionSeed: 0.8 });
    bus.publish('service:job_missed', {
      serviceItemId: 'm1', day: 130, customerId: 'c1', vehicleId: 'v1',
      jobCategory: 'tires_brakes', lostRevenue: 300, csiHit: 4, advisorId: 'a1',
    });

    const snap = base.snapshot();
    expect(snap.schemaVersion).toBe(2);
    const reparsed = JSON.parse(JSON.stringify(snap)) as typeof snap;

    const { base: fresh } = build();
    fresh.restore(reparsed);
    expect(fresh.getOwners()).toEqual(base.getOwners());
    expect(fresh.getOwner('c1::v1')!.consecutiveBadVisits).toBe(1);
  });

  it('migrates a pre-#306 (schemaVersion 1) blob with neutral defaults', () => {
    const { base: fresh } = build();
    fresh.restore({
      schemaVersion: 1,
      owners: [
        {
          ownerId: 'c1::v1',
          customerId: 'c1',
          vehicleId: 'v1',
          category: 'sedan',
          powertrain: 'ice',
          saleDay: 3,
          loyalty: 0.7,
        },
      ],
    });
    const owner = fresh.getOwner('c1::v1')!;
    expect(owner.csi).toBe(0.7); // defaulted to loyalty
    expect(owner.consecutiveBadVisits).toBe(0);
    expect(owner.consecutiveNoReturns).toBe(0);
    expect(owner.repeatLeadEmitted).toBe(false);
  });
});
