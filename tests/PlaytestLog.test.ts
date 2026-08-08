import {
  createPlaytestLog,
  attachPlaytestCapture,
  exportMarkdown,
  computeFinanceMix,
  type PlaytestContext,
  type PlaytestDealEntry,
} from '../src/game/PlaytestLog';
import { createEventBus } from '../src/game/EventBus';
import { createInMemoryDriver } from '../src/game/SaveStore';
import type { StorageDriver } from '../src/game/SaveStore';

const CTX: PlaytestContext = { day: 3, phase: 'FLOOR_OPEN', cash: 42000, tier: 1 };

function fixedClock(): () => Date {
  let t = Date.parse('2026-07-27T14:30:00.000Z');
  return () => new Date((t += 1000));
}

function deal(over: Partial<PlaytestDealEntry> = {}): Omit<
  PlaytestDealEntry,
  'kind' | 'seq' | 'at'
> {
  return {
    day: 1,
    customerId: 'c1',
    vehicleId: 'v1',
    agreedPrice: 20000,
    frontGross: 1500,
    backGross: 800,
    daysInInventory: 14,
    paymentMethod: 'finance',
    downPayment: 2000,
    loanAmount: 18000,
    term: 60,
    apr: 0.09,
    ...over,
  };
}

describe('PlaytestLog — capture + persistence (#332)', () => {
  it('records a flag with the context it was handed', () => {
    const log = createPlaytestLog(createInMemoryDriver(), { now: fixedClock() });
    const entry = log.flag('day 3 dragged', CTX);

    expect(entry.kind).toBe('flag');
    expect(entry.note).toBe('day 3 dragged');
    expect(entry.ctx).toEqual(CTX);
    expect(log.count()).toBe(1);
  });

  it('accepts a bare flag with no note', () => {
    const log = createPlaytestLog(createInMemoryDriver());
    log.flag('   ', CTX);
    expect(log.entries()[0]).toMatchObject({ kind: 'flag', note: '' });
  });

  it('counts entries by kind', () => {
    const log = createPlaytestLog(createInMemoryDriver());
    log.flag('a', CTX);
    log.recordDeal(deal());
    log.recordDeal(deal({ customerId: 'c2' }));
    log.recordWalk({ day: 1, customerId: 'c3', reason: 'no_fit' });

    expect(log.counts()).toEqual({ flag: 1, deal: 2, walk: 1, step: 0, answer: 0 });
    expect(log.count()).toBe(4);
  });

  it('assigns monotonic sequence numbers across kinds', () => {
    const log = createPlaytestLog(createInMemoryDriver());
    log.flag('a', CTX);
    log.recordDeal(deal());
    log.flag('b', CTX);

    expect(log.entries().map((e) => e.seq)).toEqual([0, 1, 2]);
  });

  it('round-trips through the driver into a fresh log', async () => {
    const driver = createInMemoryDriver();
    const a = createPlaytestLog(driver);
    a.flag('note one', CTX);
    a.recordDeal(deal());
    a.recordWalk({ day: 2, customerId: 'c9', reason: 'no_close' });
    await a.flush();

    const b = createPlaytestLog(driver);
    await b.hydrate();

    expect(b.count()).toBe(3);
    expect(b.counts()).toEqual({ flag: 1, deal: 1, walk: 1, step: 0, answer: 0 });
    expect(b.entries()[0]).toMatchObject({ kind: 'flag', note: 'note one' });
  });

  it('continues the sequence after hydrating rather than reusing numbers', async () => {
    const driver = createInMemoryDriver();
    const a = createPlaytestLog(driver);
    a.flag('one', CTX);
    a.flag('two', CTX);
    await a.flush();

    const b = createPlaytestLog(driver);
    await b.hydrate();
    b.flag('three', CTX);

    expect(b.entries().map((e) => e.seq)).toEqual([0, 1, 2]);
  });

  it('hydrates a corrupt blob as an empty log instead of throwing', async () => {
    const driver = createInMemoryDriver();
    await driver.write('}{ not json');
    const log = createPlaytestLog(driver);

    await expect(log.hydrate()).resolves.toBeUndefined();
    expect(log.count()).toBe(0);
  });

  it('hydrates an absent blob as an empty log', async () => {
    const log = createPlaytestLog(createInMemoryDriver());
    await log.hydrate();
    expect(log.count()).toBe(0);
  });

  it('survives a driver write failure and keeps recording', async () => {
    let fail = true;
    const driver: StorageDriver = {
      read: async () => null,
      write: async () => {
        if (fail) throw new Error('disk full');
      },
      clear: async () => {},
    };
    const log = createPlaytestLog(driver);
    log.flag('during failure', CTX);
    await log.flush();

    fail = false;
    log.flag('after failure', CTX);
    await expect(log.flush()).resolves.toBeUndefined();
    expect(log.count()).toBe(2);
  });

  it('drops the oldest entries at the cap', () => {
    const log = createPlaytestLog(createInMemoryDriver(), { maxEntries: 3 });
    for (let i = 0; i < 5; i++) log.flag(`n${i}`, CTX);

    expect(log.count()).toBe(3);
    expect(log.entries().map((e) => (e as { note: string }).note)).toEqual(['n2', 'n3', 'n4']);
  });

  it('clear empties the log and the driver cell', async () => {
    const driver = createInMemoryDriver();
    const log = createPlaytestLog(driver);
    log.flag('gone', CTX);
    await log.flush();
    await log.clear();

    expect(log.count()).toBe(0);
    const fresh = createPlaytestLog(driver);
    await fresh.hydrate();
    expect(fresh.count()).toBe(0);
  });
});

describe('PlaytestLog — bus capture (#332)', () => {
  it('captures deal:closed with the full finance structure and the clock day', () => {
    const bus = createEventBus();
    const log = createPlaytestLog(createInMemoryDriver());
    let day = 4;
    attachPlaytestCapture(bus, log, () => day);

    bus.publish('deal:closed', {
      customerId: 'c1',
      vehicleId: 'v1',
      agreedPrice: 18500,
      frontGross: 1200,
      backGross: 950,
      productGross: 950,
      reserveGross: 0,
      daysInInventory: 21,
      paymentMethod: 'finance',
      downPayment: 1500,
      loanAmount: 17000,
      term: 72,
      apr: 0.114,
    });

    expect(log.entries()[0]).toMatchObject({
      kind: 'deal',
      day: 4,
      paymentMethod: 'finance',
      downPayment: 1500,
      term: 72,
      apr: 0.114,
    });
  });

  it('reads the day cursor at capture time, not at attach time', () => {
    const bus = createEventBus();
    const log = createPlaytestLog(createInMemoryDriver());
    let day = 1;
    attachPlaytestCapture(bus, log, () => day);

    day = 9;
    bus.publish('deal:closed', {
      customerId: 'c1', vehicleId: 'v1', agreedPrice: 1, frontGross: 0, backGross: 0,
      productGross: 0, reserveGross: 0,
      daysInInventory: 0, paymentMethod: 'cash', downPayment: 1, loanAmount: 0, term: 0, apr: 0,
    });

    expect(log.entries()[0]).toMatchObject({ day: 9 });
  });

  it('captures a no_sale walk-off with its named reason', () => {
    const bus = createEventBus();
    const log = createPlaytestLog(createInMemoryDriver());
    attachPlaytestCapture(bus, log, () => 2);

    bus.publish('staff:auto_resolved', {
      customerId: 'c7',
      staffId: 's1',
      day: 2,
      outcome: 'no_sale',
      grossImpact: 0,
      reason: 'no_fit',
      archetypeLabel: 'Young Family',
      wantedCategory: 'suv',
    });

    expect(log.entries()[0]).toMatchObject({
      kind: 'walk',
      day: 2,
      reason: 'no_fit',
      archetypeLabel: 'Young Family',
      wantedCategory: 'suv',
    });
  });

  it('ignores the closed half of staff:auto_resolved (deal:closed carries it)', () => {
    const bus = createEventBus();
    const log = createPlaytestLog(createInMemoryDriver());
    attachPlaytestCapture(bus, log, () => 1);

    bus.publish('staff:auto_resolved', {
      customerId: 'c1', staffId: 's1', day: 1, outcome: 'closed', grossImpact: 2000,
    });

    expect(log.count()).toBe(0);
  });

  it('records an unspecified reason rather than dropping a reasonless walk', () => {
    const bus = createEventBus();
    const log = createPlaytestLog(createInMemoryDriver());
    attachPlaytestCapture(bus, log, () => 1);

    bus.publish('staff:auto_resolved', {
      customerId: 'c1', staffId: 's1', day: 1, outcome: 'no_sale', grossImpact: 0,
    });

    expect(log.entries()[0]).toMatchObject({ kind: 'walk', reason: 'unspecified' });
  });

  it('detaches cleanly', () => {
    const bus = createEventBus();
    const log = createPlaytestLog(createInMemoryDriver());
    const detach = attachPlaytestCapture(bus, log, () => 1);
    detach();

    bus.publish('staff:auto_resolved', {
      customerId: 'c1', staffId: 's1', day: 1, outcome: 'no_sale', grossImpact: 0,
    });

    expect(log.count()).toBe(0);
  });
});

describe('PlaytestLog — finance mix (#332 / script §5)', () => {
  it('splits cash vs finance and averages down only over financed deals', () => {
    const deals = [
      deal({ paymentMethod: 'cash', downPayment: 20000, loanAmount: 0, term: 0, apr: 0 }),
      deal({ paymentMethod: 'finance', agreedPrice: 20000, downPayment: 2000, term: 60, apr: 0.08 }),
      deal({ paymentMethod: 'finance', agreedPrice: 20000, downPayment: 4000, term: 72, apr: 0.12 }),
    ].map((d, i) => ({ ...d, kind: 'deal' as const, seq: i, at: '' }));

    const mix = computeFinanceMix(deals);

    expect(mix.deals).toBe(3);
    expect(mix.cash).toBe(1);
    expect(mix.finance).toBe(2);
    expect(mix.financeShare).toBe(67);
    // The $20k cash "down" must not enter the average.
    expect(mix.avgDownFinanced).toBe(3000);
    expect(mix.avgDownPct).toBe(15);
    expect(mix.avgTerm).toBe(66);
    expect(mix.avgApr).toBe(10);
  });

  it('reports zeroes rather than NaN with no deals', () => {
    expect(computeFinanceMix([])).toMatchObject({
      deals: 0, cash: 0, finance: 0, financeShare: 0, avgDownFinanced: 0, avgDownPct: 0,
    });
  });
});

describe('PlaytestLog — markdown export (#332)', () => {
  const meta = { day: 5, tier: 1, exportedAt: '2026-07-27T18:00:00.000Z' };

  it('renders flags, the deal table and walk-offs', () => {
    const log = createPlaytestLog(createInMemoryDriver(), { now: fixedClock() });
    log.flag('day dragged after lunch', CTX);
    log.recordDeal(deal());
    log.recordWalk({ day: 2, customerId: 'c3', reason: 'no_fit', archetypeLabel: 'Retiree', wantedCategory: 'sedan' });

    const md = exportMarkdown(log.entries(), meta);

    expect(md).toContain('# Playtest log — round 1 (#74)');
    expect(md).toContain('Exported day 5 · Tier 1');
    expect(md).toContain('1 flags · 1 deals · 1 walk-offs');
    expect(md).toContain('day dragged after lunch');
    expect(md).toContain('**Day 3** · FLOOR_OPEN · T1 · $42,000');
    expect(md).toContain('| Day | Method | Price | Structure | Front | Back | Days in inv |');
    expect(md).toContain('$2,000 down · $18,000 @ 9.0% × 60mo');
    expect(md).toContain('| 2 | Retiree | no_fit | sedan |');
  });

  it('states the computed finance split, not just the rows', () => {
    const log = createPlaytestLog(createInMemoryDriver());
    log.recordDeal(deal({ paymentMethod: 'cash', downPayment: 20000, loanAmount: 0, term: 0, apr: 0 }));
    log.recordDeal(deal({ customerId: 'c2' }));

    const md = exportMarkdown(log.entries(), meta);

    expect(md).toContain('**1 financed / 1 cash** across 2 deals (50% financed)');
    expect(md).toContain('Average down on a financed deal: **$2,000** (10% of price)');
  });

  it('marks a note-less flag rather than rendering a blank line', () => {
    const log = createPlaytestLog(createInMemoryDriver());
    log.flag('', CTX);
    expect(exportMarkdown(log.entries(), meta)).toContain('*(flag, no note)*');
  });

  it('renders empty sections explicitly', () => {
    const md = exportMarkdown([], meta);
    expect(md).toContain('0 flags · 0 deals · 0 walk-offs');
    expect(md).toContain('*(no deals closed)*');
    expect((md.match(/\*\(none\)\*/g) ?? []).length).toBe(3);
  });

  it('orders by sequence regardless of the array order handed in', () => {
    const log = createPlaytestLog(createInMemoryDriver());
    log.flag('first', CTX);
    log.flag('second', CTX);

    const md = exportMarkdown([...log.entries()].reverse(), meta);
    expect(md.indexOf('first')).toBeLessThan(md.indexOf('second'));
  });
});
