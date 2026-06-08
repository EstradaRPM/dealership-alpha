import { createEventBus } from '../src/game/EventBus';
import { createKPIDashboard } from '../src/game/KPIDashboard';

function publishDeal(
  bus: ReturnType<typeof createEventBus>,
  frontGross: number,
  backGross: number,
  daysInInventory: number,
) {
  bus.publish('deal:closed', {
    customerId: 'c1',
    vehicleId: 'v1',
    agreedPrice: 20_000,
    frontGross,
    backGross,
    daysInInventory,
    paymentMethod: 'cash',
    downPayment: 20_000,
    loanAmount: 0,
    term: 0,
    apr: 0,
  });
}

function publishCash(
  bus: ReturnType<typeof createEventBus>,
  opts: { agreedPrice: number; frontGross?: number; backGross?: number },
) {
  const { agreedPrice, frontGross = 1_000, backGross = 0 } = opts;
  bus.publish('deal:closed', {
    customerId: 'c1',
    vehicleId: 'v1',
    agreedPrice,
    frontGross,
    backGross,
    daysInInventory: 10,
    paymentMethod: 'cash',
    downPayment: agreedPrice,
    loanAmount: 0,
    term: 0,
    apr: 0,
  });
}

function publishFinance(
  bus: ReturnType<typeof createEventBus>,
  opts: {
    agreedPrice: number;
    downPayment: number;
    term: number;
    apr: number;
    frontGross?: number;
    backGross?: number;
  },
) {
  const { agreedPrice, downPayment, term, apr, frontGross = 1_000, backGross = 500 } = opts;
  bus.publish('deal:closed', {
    customerId: 'c1',
    vehicleId: 'v1',
    agreedPrice,
    frontGross,
    backGross,
    daysInInventory: 10,
    paymentMethod: 'finance',
    downPayment,
    loanAmount: agreedPrice - downPayment,
    term,
    apr,
  });
}

// ── getSnapshot — zero deals ──────────────────────────────────────────────────

describe('KPIDashboard.getSnapshot — no deals', () => {
  it('returns zero snapshot when no deals have been closed', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus });
    const snap = dashboard.getSnapshot();

    expect(snap.unitsRetailed).toBe(0);
    expect(snap.pvr).toBe(0);
    expect(snap.fniPpru).toBe(0);
    expect(snap.avgFrontGross).toBe(0);
    expect(snap.avgBackGross).toBe(0);
    expect(snap.avgDii).toBe(0);
  });
});

// ── getSnapshot — single deal ─────────────────────────────────────────────────

describe('KPIDashboard.getSnapshot — single deal', () => {
  it('PVR equals frontGross + backGross for one deal', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus });

    publishDeal(bus, 2_000, 500, 14);
    const snap = dashboard.getSnapshot();

    expect(snap.unitsRetailed).toBe(1);
    expect(snap.pvr).toBe(2_500);
    expect(snap.avgFrontGross).toBe(2_000);
    expect(snap.avgBackGross).toBe(500);
    expect(snap.fniPpru).toBe(500);
    expect(snap.avgDii).toBe(14);
  });

  it('handles zero back gross (no F&I)', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus });

    publishDeal(bus, 3_000, 0, 7);
    const snap = dashboard.getSnapshot();

    expect(snap.pvr).toBe(3_000);
    expect(snap.fniPpru).toBe(0);
    expect(snap.avgBackGross).toBe(0);
  });

  it('handles negative front gross (sold below cost)', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus });

    publishDeal(bus, -800, 1_200, 45);
    const snap = dashboard.getSnapshot();

    expect(snap.avgFrontGross).toBe(-800);
    expect(snap.pvr).toBe(400);
  });
});

// ── getSnapshot — multiple deals ──────────────────────────────────────────────

describe('KPIDashboard.getSnapshot — multiple deals', () => {
  it('averages front gross correctly across three deals', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus });

    publishDeal(bus, 1_000, 0, 10);
    publishDeal(bus, 3_000, 0, 20);
    publishDeal(bus, 2_000, 0, 30);
    const snap = dashboard.getSnapshot();

    expect(snap.unitsRetailed).toBe(3);
    expect(snap.avgFrontGross).toBe(2_000);
    expect(snap.avgDii).toBe(20);
  });

  it('F&I PPRU is total back gross divided by units', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus });

    // Deal 1: $1500 back, Deal 2: $500 back, Deal 3: $0 back
    publishDeal(bus, 2_000, 1_500, 10);
    publishDeal(bus, 2_000,   500, 10);
    publishDeal(bus, 2_000,     0, 10);
    const snap = dashboard.getSnapshot();

    expect(snap.fniPpru).toBeCloseTo(2_000 / 3, 5);
  });

  it('PVR equals (total front + total back) / units', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus });

    publishDeal(bus, 1_000, 400, 5);
    publishDeal(bus, 3_000, 600, 15);
    const snap = dashboard.getSnapshot();

    // PVR = (1000+400 + 3000+600) / 2 = 5000 / 2 = 2500
    expect(snap.pvr).toBe(2_500);
    expect(snap.unitsRetailed).toBe(2);
  });

  it('avg DII is mean across all sold vehicles', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus });

    publishDeal(bus, 1_000, 0, 5);
    publishDeal(bus, 1_000, 0, 15);
    publishDeal(bus, 1_000, 0, 25);
    publishDeal(bus, 1_000, 0, 35);
    const snap = dashboard.getSnapshot();

    expect(snap.avgDii).toBe(20);
  });

  it('snapshot updates as new deals are closed', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus });

    publishDeal(bus, 2_000, 0, 10);
    expect(dashboard.getSnapshot().unitsRetailed).toBe(1);

    publishDeal(bus, 4_000, 0, 20);
    expect(dashboard.getSnapshot().unitsRetailed).toBe(2);
    expect(dashboard.getSnapshot().avgFrontGross).toBe(3_000);
  });
});

// ── getSnapshot — payment-method splits ───────────────────────────────────────

describe('KPIDashboard.getSnapshot — payment splits', () => {
  it('zero snapshot exposes all split fields as zero', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus });
    const snap = dashboard.getSnapshot();

    expect(snap.cashUnits).toBe(0);
    expect(snap.cashGross).toBe(0);
    expect(snap.financeUnits).toBe(0);
    expect(snap.financeGross).toBe(0);
    expect(snap.heavyDownUnits).toBe(0);
    expect(snap.avgApr).toBe(0);
    expect(snap.avgTerm).toBe(0);
    expect(snap.avgDownPct).toBe(0);
  });

  it('cash deal increments cashUnits + cashGross only', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus });

    publishCash(bus, { agreedPrice: 20_000, frontGross: 2_000, backGross: 300 });
    const snap = dashboard.getSnapshot();

    expect(snap.cashUnits).toBe(1);
    expect(snap.cashGross).toBe(2_300);
    expect(snap.financeUnits).toBe(0);
    expect(snap.financeGross).toBe(0);
    expect(snap.heavyDownUnits).toBe(0);
    // No finance deals → APR/term/downPct averages stay zero.
    expect(snap.avgApr).toBe(0);
    expect(snap.avgTerm).toBe(0);
    expect(snap.avgDownPct).toBe(0);
  });

  it('finance deal with downPct ≥ 0.25 increments heavyDownUnits', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus });

    publishFinance(bus, {
      agreedPrice: 20_000,
      downPayment: 5_000, // 25% exactly
      term: 60,
      apr: 0.07,
      frontGross: 1_500,
      backGross: 800,
    });
    const snap = dashboard.getSnapshot();

    expect(snap.financeUnits).toBe(1);
    expect(snap.financeGross).toBe(2_300);
    expect(snap.heavyDownUnits).toBe(1);
    expect(snap.cashUnits).toBe(0);
    expect(snap.avgApr).toBeCloseTo(0.07, 5);
    expect(snap.avgTerm).toBe(60);
    expect(snap.avgDownPct).toBeCloseTo(0.25, 5);
  });

  it('finance deal below threshold does not count as heavy-down', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus });

    publishFinance(bus, {
      agreedPrice: 20_000,
      downPayment: 2_000, // 10%
      term: 72,
      apr: 0.09,
    });

    expect(dashboard.getSnapshot().heavyDownUnits).toBe(0);
    expect(dashboard.getSnapshot().financeUnits).toBe(1);
  });

  it('APR / term / downPct are weighted by finance count only', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus });

    // Mix: 1 cash, 2 finance. Cash should not influence finance averages.
    publishCash(bus, { agreedPrice: 30_000 });
    publishFinance(bus, { agreedPrice: 20_000, downPayment: 2_000, term: 60, apr: 0.06 });
    publishFinance(bus, { agreedPrice: 40_000, downPayment: 8_000, term: 72, apr: 0.10 });

    const snap = dashboard.getSnapshot();
    expect(snap.cashUnits).toBe(1);
    expect(snap.financeUnits).toBe(2);
    expect(snap.avgApr).toBeCloseTo(0.08, 5);
    expect(snap.avgTerm).toBe(66);
    // Down pcts: 0.10, 0.20 → avg 0.15
    expect(snap.avgDownPct).toBeCloseTo(0.15, 5);
    // Only the second finance deal hits ≥0.25? No — 0.20 < 0.25, so 0 heavy-down.
    expect(snap.heavyDownUnits).toBe(0);
  });

  it('mix of cash and heavy-down finance reports both correctly', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus });

    publishCash(bus, { agreedPrice: 20_000, frontGross: 1_000, backGross: 0 });
    publishCash(bus, { agreedPrice: 25_000, frontGross: 1_500, backGross: 200 });
    publishFinance(bus, {
      agreedPrice: 20_000,
      downPayment: 8_000, // 40% — heavy
      term: 48,
      apr: 0.05,
      frontGross: 2_000,
      backGross: 1_000,
    });

    const snap = dashboard.getSnapshot();
    expect(snap.cashUnits).toBe(2);
    expect(snap.cashGross).toBe(2_700);
    expect(snap.financeUnits).toBe(1);
    expect(snap.financeGross).toBe(3_000);
    expect(snap.heavyDownUnits).toBe(1);
    expect(snap.unitsRetailed).toBe(3);
  });
});

