import { createEventBus } from '../src/game/EventBus';
import { createKPIDashboard } from '../src/game/KPIDashboard';
import type { StaffOrg } from '../src/game/StaffOrg';
import type { StaffWithComposites } from '../src/game/NPC/factories/StaffFactory';

// Minimal StaffOrg stub — no real roster logic needed
function makeStaffOrg(roster: StaffWithComposites[] = []): StaffOrg {
  return {
    get currentRoster() { return roster; },
    getCandidates: () => [],
    hire: () => {},
    fire: () => {},
  };
}

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

// ── isUnlocked ────────────────────────────────────────────────────────────────

describe('KPIDashboard.isUnlocked', () => {
  it('is false when roster has no GM', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus, staffOrg: makeStaffOrg([]) });
    expect(dashboard.isUnlocked).toBe(false);
  });

  it('is true when roster contains a GM', () => {
    const bus = createEventBus();
    const gm = { role_id: 'gm' } as StaffWithComposites;
    const dashboard = createKPIDashboard({ bus, staffOrg: makeStaffOrg([gm]) });
    expect(dashboard.isUnlocked).toBe(true);
  });

  it('is false when roster has staff but no GM', () => {
    const bus = createEventBus();
    const salesperson = { role_id: 'salesperson' } as StaffWithComposites;
    const dashboard = createKPIDashboard({ bus, staffOrg: makeStaffOrg([salesperson]) });
    expect(dashboard.isUnlocked).toBe(false);
  });

  it('reflects roster changes dynamically', () => {
    const bus = createEventBus();
    const roster: StaffWithComposites[] = [];
    const dashboard = createKPIDashboard({ bus, staffOrg: makeStaffOrg(roster) });

    expect(dashboard.isUnlocked).toBe(false);
    roster.push({ role_id: 'gm' } as StaffWithComposites);
    expect(dashboard.isUnlocked).toBe(true);
  });
});

// ── getSnapshot — zero deals ──────────────────────────────────────────────────

describe('KPIDashboard.getSnapshot — no deals', () => {
  it('returns zero snapshot when no deals have been closed', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus, staffOrg: makeStaffOrg() });
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
    const dashboard = createKPIDashboard({ bus, staffOrg: makeStaffOrg() });

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
    const dashboard = createKPIDashboard({ bus, staffOrg: makeStaffOrg() });

    publishDeal(bus, 3_000, 0, 7);
    const snap = dashboard.getSnapshot();

    expect(snap.pvr).toBe(3_000);
    expect(snap.fniPpru).toBe(0);
    expect(snap.avgBackGross).toBe(0);
  });

  it('handles negative front gross (sold below cost)', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus, staffOrg: makeStaffOrg() });

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
    const dashboard = createKPIDashboard({ bus, staffOrg: makeStaffOrg() });

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
    const dashboard = createKPIDashboard({ bus, staffOrg: makeStaffOrg() });

    // Deal 1: $1500 back, Deal 2: $500 back, Deal 3: $0 back
    publishDeal(bus, 2_000, 1_500, 10);
    publishDeal(bus, 2_000,   500, 10);
    publishDeal(bus, 2_000,     0, 10);
    const snap = dashboard.getSnapshot();

    expect(snap.fniPpru).toBeCloseTo(2_000 / 3, 5);
  });

  it('PVR equals (total front + total back) / units', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus, staffOrg: makeStaffOrg() });

    publishDeal(bus, 1_000, 400, 5);
    publishDeal(bus, 3_000, 600, 15);
    const snap = dashboard.getSnapshot();

    // PVR = (1000+400 + 3000+600) / 2 = 5000 / 2 = 2500
    expect(snap.pvr).toBe(2_500);
    expect(snap.unitsRetailed).toBe(2);
  });

  it('avg DII is mean across all sold vehicles', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus, staffOrg: makeStaffOrg() });

    publishDeal(bus, 1_000, 0, 5);
    publishDeal(bus, 1_000, 0, 15);
    publishDeal(bus, 1_000, 0, 25);
    publishDeal(bus, 1_000, 0, 35);
    const snap = dashboard.getSnapshot();

    expect(snap.avgDii).toBe(20);
  });

  it('snapshot updates as new deals are closed', () => {
    const bus = createEventBus();
    const dashboard = createKPIDashboard({ bus, staffOrg: makeStaffOrg() });

    publishDeal(bus, 2_000, 0, 10);
    expect(dashboard.getSnapshot().unitsRetailed).toBe(1);

    publishDeal(bus, 4_000, 0, 20);
    expect(dashboard.getSnapshot().unitsRetailed).toBe(2);
    expect(dashboard.getSnapshot().avgFrontGross).toBe(3_000);
  });
});
