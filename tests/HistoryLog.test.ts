import { createEventBus } from '../src/game/EventBus';
import {
  createHistoryLog,
  createDefaultHistoryLogSnapshot,
} from '../src/game/HistoryLog';

function dealPayload(over: Partial<Record<string, unknown>> = {}) {
  return {
    customerId: 'c1',
    vehicleId: 'v1',
    agreedPrice: 25_000,
    frontGross: 1_500,
    backGross: 800,
    daysInInventory: 12,
    paymentMethod: 'finance' as const,
    downPayment: 2_000,
    loanAmount: 23_000,
    term: 60,
    apr: 0.07,
    ...over,
  };
}

describe('HistoryLog (#208)', () => {
  it('records notable events as newest-first entries', () => {
    const bus = createEventBus();
    const log = createHistoryLog({ bus });

    bus.publish('clock:day_started', { day: 1 } as never);
    bus.publish('deal:closed', dealPayload() as never);
    bus.publish('career:tier_up', { fromTier: 1, toTier: 2, day: 1 } as never);

    const entries = log.getEntries();
    expect(entries).toHaveLength(2);
    // Newest first: the tier-up was published last.
    expect(entries[0].kind).toBe('tier');
    expect(entries[0].text).toContain('Tier 2');
    expect(entries[1].kind).toBe('sale');
    expect(entries[1].text).toContain('$2,300');
  });

  it('retains entries across days (not reset daily)', () => {
    const bus = createEventBus();
    const log = createHistoryLog({ bus });

    bus.publish('clock:day_started', { day: 1 } as never);
    bus.publish('deal:closed', dealPayload() as never);
    bus.publish('clock:day_started', { day: 2 } as never);
    bus.publish('deal:closed', dealPayload() as never);

    const entries = log.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].day).toBe(2);
    expect(entries[1].day).toBe(1);
  });

  it('captures escalations and market shocks', () => {
    const bus = createEventBus();
    const log = createHistoryLog({ bus });

    bus.publish('floor:exception_raised', {
      day: 3,
      tick: 5,
      customerId: 'c2',
      department: 'sales',
    } as never);
    bus.publish('market:shock_started', {
      day: 3,
      shockId: 'fuel-spike',
      instanceId: 'fuel-spike@3',
      label: 'Fuel price spike',
      segmentMagnitudes: {},
      expectedEndDay: 10,
    } as never);

    const kinds = log.getEntries().map((e) => e.kind);
    expect(kinds).toContain('escalation');
    expect(kinds).toContain('market');
  });

  it('round-trips through snapshot/restore', () => {
    const bus = createEventBus();
    const log = createHistoryLog({ bus });
    bus.publish('clock:day_started', { day: 1 } as never);
    bus.publish('deal:closed', dealPayload() as never);
    bus.publish('career:tier_up', { fromTier: 1, toTier: 2, day: 1 } as never);

    const snap = log.snapshot();

    const log2 = createHistoryLog({ bus });
    log2.restore(snap);
    expect(log2.getEntries()).toEqual(log.getEntries());

    // ids stay monotonic after restore: a new event gets a fresh id, no clash.
    bus.publish('deal:closed', dealPayload() as never);
    const ids = log2.getEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('caps retained entries at maxEntries (keeping newest)', () => {
    const bus = createEventBus();
    const log = createHistoryLog({ bus });
    bus.publish('clock:day_started', { day: 1 } as never);
    for (let i = 0; i < 250; i++) {
      bus.publish('career:tier_up', { fromTier: 1, toTier: i, day: 1 } as never);
    }
    // data/historyLog.json caps at 200.
    expect(log.getEntryCount()).toBe(200);
    // Newest (last published, toTier 249) is retained at the front.
    expect(log.getEntries()[0].text).toContain('Tier 249');
  });

  it('default snapshot is an empty log', () => {
    expect(createDefaultHistoryLogSnapshot().entries).toHaveLength(0);
  });
});
