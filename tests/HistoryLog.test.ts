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
    productGross: 800,
    reserveGross: 0,
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

  it('names the car it dumped and what letting it go cost (#362)', () => {
    // The valve is a deliberate, money-losing decision to free a space. It gets
    // its own kind rather than `sale`, because the badge a closed retail deal
    // wears must not sit next to a $3,100 loss.
    const bus = createEventBus();
    const log = createHistoryLog({ bus });

    bus.publish('inventory:vehicle_wholesaled', {
      day: 31,
      vehicleId: 'v9',
      proceeds: 15_300,
      costBasis: 18_400,
      gain: -3_100,
      year: 2016,
      make: 'Ford',
      model: 'F-150',
      category: 'truck',
      reason: 'released',
    } as never);
    bus.publish('inventory:vehicle_wholesaled', {
      day: 32,
      vehicleId: 'v4',
      proceeds: 6_000,
      costBasis: 6_000,
      gain: 0,
      year: 2014,
      make: 'Honda',
      model: 'Civic',
      category: 'sedan',
      reason: 'recon_abandoned',
    } as never);

    const entries = log.getEntries();
    expect(entries[1]).toEqual(
      expect.objectContaining({
        day: 31,
        kind: 'inventory',
        text: 'Wholesaled the 2016 Ford F-150 — $15,300, a $3,100 loss.',
      }),
    );
    // The abandon path lands in the same feed and says why it went.
    expect(entries[0]).toEqual(
      expect.objectContaining({
        day: 32,
        kind: 'inventory',
        text: 'Wholesaled the 2014 Honda Civic after abandoning the recon — $6,000, breaking even.',
      }),
    );
  });

  it('names the rival when someone is poached, and does not when they quit', () => {
    // #357 — the log is the only place a departure can be read back days later;
    // the floor buffer is wiped every morning. A loss to a named store is a
    // different fact from a loss to low morale, and the entry says which.
    const bus = createEventBus();
    const log = createHistoryLog({ bus });

    bus.publish('staff:quit', {
      staffId: 's1',
      name: 'Marcus Delgado',
      roleId: 'salesperson',
      day: 13,
      toRival: 'Northside Kaivo',
    } as never);
    bus.publish('staff:quit', {
      staffId: 's2',
      name: 'Dana Whitfield',
      roleId: 'salesperson',
      day: 14,
      morale: 8,
    } as never);

    const entries = log.getEntries();
    expect(entries[1]).toEqual(
      expect.objectContaining({
        day: 13,
        kind: 'staff',
        text: 'Marcus Delgado left for Northside Kaivo.',
      }),
    );
    expect(entries[0]).toEqual(
      expect.objectContaining({ day: 14, kind: 'staff', text: 'Dana Whitfield quit.' }),
    );
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

  it('captures market shocks', () => {
    const bus = createEventBus();
    const log = createHistoryLog({ bus });

    bus.publish('market:shock_started', {
      day: 3,
      shockId: 'fuel-spike',
      instanceId: 'fuel-spike@3',
      label: 'Fuel price spike',
      segmentMagnitudes: {},
      expectedEndDay: 10,
    } as never);

    const kinds = log.getEntries().map((e) => e.kind);
    expect(kinds).toContain('market');
  });

  it('captures competitor price moves (#267), directionally', () => {
    const bus = createEventBus();
    const log = createHistoryLog({ bus });

    // `pricing` reads as "how high prices are": up = rival got more expensive.
    bus.publish('competitor:price_changed', {
      day: 5,
      competitorId: 'comp-1',
      brand: 'Velore',
      oldPricing: 0.4,
      newPricing: 0.7,
      segmentAffinity: {},
    } as never);
    bus.publish('competitor:price_changed', {
      day: 6,
      competitorId: 'comp-2',
      brand: 'Corvane',
      oldPricing: 0.6,
      newPricing: 0.3,
      segmentAffinity: {},
    } as never);

    const entries = log.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].kind).toBe('market');
    expect(entries[0].text).toBe('Rival Corvane cut prices.');
    expect(entries[1].text).toBe('Rival Velore raised prices.');
  });

  it('does not log the daily market:competitive_pressure heartbeat (#267)', () => {
    const bus = createEventBus();
    const log = createHistoryLog({ bus });

    for (let day = 1; day <= 10; day++) {
      bus.publish('market:competitive_pressure', {
        day,
        competitors: [],
      } as never);
    }

    expect(log.getEntryCount()).toBe(0);
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
