import { createEventBus, type EventPayload } from '../src/game/EventBus';
import {
  createBodyShopQueue,
  type BodyShopQueueConfig,
} from '../src/game/BodyShopQueue';

const FIXED_CONFIG: BodyShopQueueConfig = {
  minTierRequired: 3,
  jobLabels: {
    windows_glass: 'Glass replacement',
    doors_panels: 'Panel & dent repair',
    interior_trim: 'Interior trim repair',
    paint: 'Paint & refinish',
  },
};

type DemandEntry = EventPayload<'bodyshop:demand_ready'>['intake'][number];
type IntakeEvent = EventPayload<'bodyshop:intake_ready'>;

function makeEntry(over: Partial<DemandEntry> = {}): DemandEntry {
  return {
    ticketId: 'bs:retail:1:0',
    source: 'retail',
    customerId: 'cust-1',
    vehicleId: 'veh-1',
    category: 'sedan',
    powertrain: 'ice',
    jobCategory: 'paint',
    baseRevenue: 1200,
    ...over,
  };
}

/** Wire a bare BodyShopQueue and drive it by publishing bodyshop:demand_ready
 *  directly — the cleanest isolation of the gate + enrichment mapping. */
function makeGated(initialTier = 1) {
  const bus = createEventBus();
  createBodyShopQueue({ bus, initialTier, config: FIXED_CONFIG });
  const events: IntakeEvent[] = [];
  bus.subscribe('bodyshop:intake_ready', (e) => events.push(e));
  const feed = (day: number, intake: DemandEntry[]) =>
    bus.publish('bodyshop:demand_ready', { day, intake });
  return { bus, events, feed };
}

// ── Tier gate ────────────────────────────────────────────────────────────────

describe('BodyShopQueue — tier gate (dark below Tier 3)', () => {
  it('emits no intake below Tier 3', () => {
    const { events, feed } = makeGated(1);
    feed(1, [makeEntry()]);
    expect(events).toHaveLength(0);
  });

  it('stays dark at Tier 2 (Service is open, Body Shop is not)', () => {
    const { events, feed } = makeGated(2);
    feed(1, [makeEntry()]);
    expect(events).toHaveLength(0);
  });

  it('emits intake at Tier 3', () => {
    const { events, feed } = makeGated(3);
    feed(1, [makeEntry()]);
    expect(events).toHaveLength(1);
  });

  it('unlocks when career:tier_up reaches Tier 3', () => {
    const { bus, events, feed } = makeGated(2);
    feed(1, [makeEntry()]);
    expect(events).toHaveLength(0); // dark at Tier 2
    bus.publish('career:tier_up', { fromTier: 2, toTier: 3, day: 5 });
    feed(6, [makeEntry()]);
    expect(events).toHaveLength(1); // open at Tier 3
  });
});

// ── Enriched payload ─────────────────────────────────────────────────────────

describe('BodyShopQueue — enriched bodyshop:intake_ready payload', () => {
  it('carries customer, vehicle, channel, job category, and base revenue', () => {
    const { events, feed } = makeGated(3);
    feed(7, [
      makeEntry({
        ticketId: 'bs:insurance:7:0',
        source: 'insurance',
        customerId: 'cust-99',
        vehicleId: 'veh-99',
        category: 'truck',
        powertrain: 'ev',
        jobCategory: 'doors_panels',
        baseRevenue: 3400,
      }),
    ]);
    expect(events[0].day).toBe(7);
    expect(events[0].items[0]).toMatchObject({
      bodyShopItemId: 'bs:insurance:7:0',
      source: 'insurance',
      customerId: 'cust-99',
      vehicleId: 'veh-99',
      category: 'truck',
      powertrain: 'ev',
      jobCategory: 'doors_panels',
      baseRevenue: 3400,
    });
  });

  it('derives the display label from the due collision job category', () => {
    const { events, feed } = makeGated(3);
    feed(1, [
      makeEntry({ jobCategory: 'windows_glass' }),
      makeEntry({ ticketId: 'bs:insurance:1:0', source: 'insurance', jobCategory: 'paint' }),
    ]);
    const [a, b] = events[0].items;
    expect(a.label).toBe('Glass replacement');
    expect(b.label).toBe('Paint & refinish');
    expect(b.source).toBe('insurance');
  });

  it('preserves intake order and count one-for-one', () => {
    const { events, feed } = makeGated(3);
    feed(1, [
      makeEntry({ ticketId: 'a' }),
      makeEntry({ ticketId: 'b' }),
      makeEntry({ ticketId: 'c' }),
    ]);
    expect(events[0].items.map((i) => i.bodyShopItemId)).toEqual(['a', 'b', 'c']);
  });

  it('publishes an empty batch when CollisionStream produces no tickets', () => {
    const { events, feed } = makeGated(3);
    feed(1, []);
    expect(events).toHaveLength(1);
    expect(events[0].items).toHaveLength(0);
  });
});

// ── Persistence ──────────────────────────────────────────────────────────────

describe('BodyShopQueue — persistence', () => {
  it('snapshot carries only the tier gate', () => {
    const bus = createEventBus();
    const bsq = createBodyShopQueue({ bus, initialTier: 3, config: FIXED_CONFIG });
    expect(bsq.snapshot()).toEqual({ schemaVersion: 1, currentTier: 3 });
  });

  it('restore re-seats the Tier 3 unlock without waiting for tier_up', () => {
    const bus = createEventBus();
    const bsq = createBodyShopQueue({ bus, initialTier: 1, config: FIXED_CONFIG });
    const events: IntakeEvent[] = [];
    bus.subscribe('bodyshop:intake_ready', (e) => events.push(e));
    bsq.restore({ schemaVersion: 1, currentTier: 3 });
    bus.publish('bodyshop:demand_ready', { day: 1, intake: [makeEntry()] });
    expect(events).toHaveLength(1);
  });
});

// ── Config loading ───────────────────────────────────────────────────────────

describe('BodyShopQueue — config', () => {
  it('loads a valid schema (Tier-3 gate + collision job labels)', () => {
    const { loadBodyShopQueueConfig } = require('../src/game/BodyShopQueue');
    const cfg = loadBodyShopQueueConfig();
    expect(cfg.minTierRequired).toBe(3);
    expect(cfg.jobLabels.windows_glass.length).toBeGreaterThan(0);
    expect(cfg.jobLabels.paint.length).toBeGreaterThan(0);
  });
});
