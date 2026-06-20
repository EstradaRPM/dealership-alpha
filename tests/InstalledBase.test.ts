import { createEventBus, type EventBus } from '../src/game/EventBus';
import {
  createInstalledBase,
  loadInstalledBaseConfig,
  type InstalledBase,
  type InstalledBaseConfig,
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

const CONFIG: InstalledBaseConfig = { loyaltySeedScale: 1.0 };

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
    const base = createInstalledBase({ bus, config: { loyaltySeedScale: 2.0 } });
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
    const { installedBase, ...legacyModules } = current.modules;
    expect(installedBase).toEqual({ schemaVersion: 1, owners: [] });

    const persisted: PersistedWorldSnapshot = {
      version: WORLD_SNAPSHOT_VERSION - 1,
      modules: legacyModules,
    };
    const migrated = migrateWorldSnapshot(persisted);
    expect(migrated.version).toBe(WORLD_SNAPSHOT_VERSION);
    expect(migrated.modules.installedBase).toEqual({
      schemaVersion: 1,
      owners: [],
    });
  });
});
