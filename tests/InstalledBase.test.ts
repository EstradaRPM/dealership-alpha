import { createEventBus, type EventBus } from '../src/game/EventBus';
import {
  createInstalledBase,
  loadInstalledBaseConfig,
  isServiceDue,
  cadenceForPowertrain,
  returnProbability,
  selectJobCategory,
  type InstalledBase,
  type InstalledBaseConfig,
  type ReturningOwner,
} from '../src/game/InstalledBase';
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
    expect(installedBase).toEqual({ schemaVersion: 1, owners: [] });

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
