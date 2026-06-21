import { createEventBus, type EventPayload } from '../src/game/EventBus';
import { createServiceQueue, type ServiceQueueConfig } from '../src/game/ServiceQueue';
import { createServiceDemand } from '../src/game/ServiceDemand';
import type { ServiceIntakeEntry } from '../src/game/ServiceDemand';
import type { ReturningOwner } from '../src/game/InstalledBase';

const MASTER_SEED = 42;

const FIXED_CONFIG: ServiceQueueConfig = {
  minTierRequired: 2,
  jobLabels: {
    oil_filters: 'Oil & filter service',
    tires_brakes: 'Tires & brakes',
    drivetrain: 'Drivetrain repair',
    electronics: 'Electronics diagnostic',
  },
};

type IntakeEvent = EventPayload<'service:intake_ready'>;

function makeEntry(over: Partial<ServiceIntakeEntry> = {}): ServiceIntakeEntry {
  return {
    ticketId: 'svc:return:1:0',
    source: 'return',
    customerId: 'cust-1',
    vehicleId: 'veh-1',
    category: 'sedan',
    powertrain: 'ice',
    jobCategory: 'oil_filters',
    baseRevenue: 80,
    ...over,
  };
}

/** Wire a bare ServiceQueue and drive it by publishing serviceDemand:intake_ready
 *  directly — the cleanest isolation of the gate + enrichment mapping. */
function makeGated(initialTier = 1) {
  const bus = createEventBus();
  createServiceQueue({ bus, initialTier, config: FIXED_CONFIG });
  const events: IntakeEvent[] = [];
  bus.subscribe('service:intake_ready', (e) => events.push(e));
  const feed = (day: number, intake: ServiceIntakeEntry[]) =>
    bus.publish('serviceDemand:intake_ready', { day, intake });
  return { bus, events, feed };
}

// ── Tier gate ────────────────────────────────────────────────────────────────

describe('ServiceQueue — tier gate', () => {
  it('emits no intake below Tier 2', () => {
    const { events, feed } = makeGated(1);
    feed(1, [makeEntry()]);
    expect(events).toHaveLength(0);
  });

  it('emits intake at Tier 2', () => {
    const { events, feed } = makeGated(2);
    feed(1, [makeEntry()]);
    expect(events).toHaveLength(1);
  });

  it('emits intake at Tier 3', () => {
    const { events, feed } = makeGated(3);
    feed(1, [makeEntry()]);
    expect(events).toHaveLength(1);
  });

  it('activates when career:tier_up fires', () => {
    const { bus, events, feed } = makeGated(1);
    bus.publish('career:tier_up', { fromTier: 1, toTier: 2, day: 1 });
    feed(1, [makeEntry()]);
    expect(events).toHaveLength(1);
  });
});

// ── Enriched payload ─────────────────────────────────────────────────────────

describe('ServiceQueue — enriched service:intake_ready payload', () => {
  it('carries the customer, vehicle, category, job category, and base revenue', () => {
    const { events, feed } = makeGated(2);
    feed(7, [
      makeEntry({
        ticketId: 'svc:return:7:0',
        customerId: 'cust-99',
        vehicleId: 'veh-99',
        category: 'truck',
        powertrain: 'ev',
        jobCategory: 'electronics',
        baseRevenue: 350,
      }),
    ]);
    expect(events[0].day).toBe(7);
    const item = events[0].items[0];
    expect(item).toMatchObject({
      serviceItemId: 'svc:return:7:0',
      source: 'return',
      customerId: 'cust-99',
      vehicleId: 'veh-99',
      category: 'truck',
      powertrain: 'ev',
      jobCategory: 'electronics',
      baseRevenue: 350,
    });
  });

  it('derives the display label from the due job category', () => {
    const { events, feed } = makeGated(2);
    feed(1, [
      makeEntry({ jobCategory: 'oil_filters' }),
      makeEntry({ ticketId: 'svc:conquest:1:0', source: 'conquest', jobCategory: 'tires_brakes' }),
    ]);
    const [a, b] = events[0].items;
    expect(a.label).toBe('Oil & filter service');
    expect(b.label).toBe('Tires & brakes');
    expect(b.source).toBe('conquest');
  });

  it('preserves intake order and count one-for-one', () => {
    const { events, feed } = makeGated(2);
    feed(1, [
      makeEntry({ ticketId: 'a' }),
      makeEntry({ ticketId: 'b' }),
      makeEntry({ ticketId: 'c' }),
    ]);
    expect(events[0].items.map((i) => i.serviceItemId)).toEqual(['a', 'b', 'c']);
  });

  it('publishes an empty batch when ServiceDemand produces no tickets', () => {
    const { events, feed } = makeGated(2);
    feed(1, []);
    expect(events).toHaveLength(1);
    expect(events[0].items).toHaveLength(0);
  });
});

// ── Determinism (full ServiceDemand → ServiceQueue chain) ─────────────────────

function makeOwner(over: Partial<ReturningOwner> = {}): ReturningOwner {
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

/** Wire the real ServiceDemand composer behind ServiceQueue and drive the day
 *  via installedBase:returns_ready — the live composition order. */
function runChain(masterSeed: number, day: number, returns: ReturningOwner[]) {
  const bus = createEventBus();
  createServiceDemand({
    bus,
    masterSeed,
    reputation: () => 1,
    serviceMarketing: () => 0.5,
    season: () => 'winter',
    baseOwners: () => returns.map((r) => ({ saleDay: day - r.ageDays, powertrain: r.powertrain })),
  });
  createServiceQueue({ bus, initialTier: 2, config: FIXED_CONFIG });
  const events: IntakeEvent[] = [];
  bus.subscribe('service:intake_ready', (e) => events.push(e));
  bus.publish('installedBase:returns_ready', { day, returns });
  return events;
}

describe('ServiceQueue — determinism', () => {
  it('produces byte-identical intake for the same masterSeed + day', () => {
    const returns = [makeOwner(), makeOwner({ customerId: 'cust-2', vehicleId: 'veh-2', jobCategory: 'drivetrain', ageDays: 1200 })];
    const a = runChain(MASTER_SEED, 12, returns);
    const b = runChain(MASTER_SEED, 12, returns);
    expect(a).toEqual(b);
    expect(a[0].items.length).toBeGreaterThan(returns.length); // returns + conquest floor
  });

  it('folds the installed-base returns through with identity intact', () => {
    const returns = [makeOwner({ customerId: 'cust-7', vehicleId: 'veh-7', jobCategory: 'tires_brakes' })];
    const [event] = runChain(MASTER_SEED, 5, returns);
    const ret = event.items.find((i) => i.source === 'return');
    expect(ret).toMatchObject({ customerId: 'cust-7', vehicleId: 'veh-7', jobCategory: 'tires_brakes' });
    expect(ret?.label).toBe('Tires & brakes');
  });
});

// ── Persistence ──────────────────────────────────────────────────────────────

describe('ServiceQueue — persistence', () => {
  it('snapshot carries only the tier gate', () => {
    const bus = createEventBus();
    const sq = createServiceQueue({ bus, initialTier: 3, config: FIXED_CONFIG });
    expect(sq.snapshot()).toEqual({ schemaVersion: 1, currentTier: 3 });
  });

  it('restore re-seats the tier gate without waiting for tier_up', () => {
    const bus = createEventBus();
    const sq = createServiceQueue({ bus, initialTier: 1, config: FIXED_CONFIG });
    const events: IntakeEvent[] = [];
    bus.subscribe('service:intake_ready', (e) => events.push(e));
    sq.restore({ schemaVersion: 1, currentTier: 2 });
    bus.publish('serviceDemand:intake_ready', { day: 1, intake: [makeEntry()] });
    expect(events).toHaveLength(1);
  });
});

// ── Config loading ───────────────────────────────────────────────────────────

describe('ServiceQueue — config', () => {
  it('loads a valid schema (tier gate + job labels)', () => {
    const { loadServiceQueueConfig } = require('../src/game/ServiceQueue');
    const cfg = loadServiceQueueConfig();
    expect(cfg.minTierRequired).toBeGreaterThanOrEqual(2);
    expect(cfg.jobLabels.oil_filters.length).toBeGreaterThan(0);
    expect(cfg.jobLabels.electronics.length).toBeGreaterThan(0);
  });
});
