import { createEventBus } from '../src/game/EventBus';
import { createTierManager } from '../src/game/CareerProgression';
import type { TierConfig } from '../src/game/CareerProgression';
import type { GateBand } from '../src/game/TierGate';

const STUB_CONFIG: TierConfig = {
  checkIntervalDays: 28,
  tiers: [
    { tier: 1, label: 'Gravel Yard', illustration: '🏚', caption: 'awaits' },
    { tier: 2, label: 'Paved Lot', illustration: '🏗', caption: 'taking shape' },
    { tier: 3, label: 'Small Showroom', illustration: '🏢', caption: 'worth protecting' },
  ],
  accentOptions: [
    { id: 'gold', label: 'Gold', color: '#c8a96e' },
    { id: 'cobalt', label: 'Cobalt', color: '#4a9eff' },
  ],
  fontOptions: [
    { id: 'classic', label: 'Classic' },
    { id: 'prestige', label: 'Prestige' },
  ],
};

// Locked #250 streak rule: leave tier N after N consecutive meet-or-better months.
const STREAKS = { 1: 1, 2: 2, 3: 3 } as const;

type Bus = ReturnType<typeof createEventBus>;

function postVerdict(bus: Bus, overall: GateBand, day = 30): void {
  bus.publish('tierGate:month_verdict', {
    day,
    month: Math.ceil(day / 30),
    tier: 1,
    overall,
    faces: [],
  });
}

function makeManager(bus: Bus) {
  return createTierManager({ bus, config: STUB_CONFIG, streaksByTier: STREAKS });
}

describe('TierManager — #250 streak-based advancement', () => {
  it('starts at tier 1 with a zero streak and no dossier', () => {
    const bus = createEventBus();
    const tm = makeManager(bus);
    expect(tm.currentTier).toBe(1);
    expect(tm.monthStreak).toBe(0);
    expect(tm.requiredStreak).toBe(1);
    expect(tm.dossierReady).toBe(false);
  });

  it('advances T1→T2 after a single meet-or-better month (streak length 1)', () => {
    const bus = createEventBus();
    const tierUp = jest.fn();
    bus.subscribe('career:tier_up', tierUp);
    const tm = makeManager(bus);

    postVerdict(bus, 'meet', 30);

    expect(tm.currentTier).toBe(2);
    expect(tm.monthStreak).toBe(0); // resets for the new tier
    expect(tierUp).toHaveBeenCalledWith({ fromTier: 1, toTier: 2, day: 30 });
  });

  it('an "exceed" month also counts as meet-or-better', () => {
    const bus = createEventBus();
    const tm = makeManager(bus);
    postVerdict(bus, 'exceed', 30);
    expect(tm.currentTier).toBe(2);
  });

  it('requires TWO consecutive meet-or-better months to leave T2', () => {
    const bus = createEventBus();
    const tierUp = jest.fn();
    bus.subscribe('career:tier_up', tierUp);
    const tm = makeManager(bus);

    postVerdict(bus, 'meet', 30); // T1 → T2
    expect(tm.currentTier).toBe(2);

    postVerdict(bus, 'meet', 60); // first qualifying month at T2
    expect(tm.currentTier).toBe(2);
    expect(tm.monthStreak).toBe(1);

    postVerdict(bus, 'meet', 90); // second → advance to T3
    expect(tm.currentTier).toBe(3);
    expect(tierUp).toHaveBeenLastCalledWith({ fromTier: 2, toTier: 3, day: 90 });
  });

  it('resets the streak to 0 on a below-meet (nearMiss) month', () => {
    const bus = createEventBus();
    const tm = makeManager(bus);
    postVerdict(bus, 'meet', 30); // T1 → T2 (now needs 2 to leave)

    postVerdict(bus, 'meet', 60); // streak 1
    expect(tm.monthStreak).toBe(1);
    postVerdict(bus, 'nearMiss', 90); // strict reset
    expect(tm.monthStreak).toBe(0);
    expect(tm.currentTier).toBe(2);

    // Must rebuild the full two-month streak from scratch.
    postVerdict(bus, 'meet', 120);
    postVerdict(bus, 'meet', 150);
    expect(tm.currentTier).toBe(3);
  });

  it('also resets on a "miss" month', () => {
    const bus = createEventBus();
    const tm = makeManager(bus);
    postVerdict(bus, 'meet', 30); // → T2
    postVerdict(bus, 'meet', 60); // streak 1
    postVerdict(bus, 'miss', 90);
    expect(tm.monthStreak).toBe(0);
    expect(tm.currentTier).toBe(2);
  });

  it('arms the dossier on a completed T3 streak WITHOUT advancing past T3', () => {
    const bus = createEventBus();
    const tierUp = jest.fn();
    bus.subscribe('career:tier_up', tierUp);
    const tm = makeManager(bus);

    // Climb to T3.
    postVerdict(bus, 'meet', 30); // → T2
    postVerdict(bus, 'meet', 60);
    postVerdict(bus, 'meet', 90); // → T3
    expect(tm.currentTier).toBe(3);
    tierUp.mockClear();

    // T3 needs 3 consecutive meet-or-better months.
    postVerdict(bus, 'meet', 120);
    postVerdict(bus, 'meet', 150);
    expect(tm.dossierReady).toBe(false);
    postVerdict(bus, 'meet', 180); // completes the streak

    expect(tm.currentTier).toBe(3); // never auto-advances to a T4
    expect(tm.dossierReady).toBe(true);
    expect(tierUp).not.toHaveBeenCalled();
  });

  it('falls back to the identity rule (N months for tier N) when no streaksByTier is wired', () => {
    const bus = createEventBus();
    const tm = createTierManager({ bus, config: STUB_CONFIG });
    expect(tm.requiredStreak).toBe(1); // tier 1
    postVerdict(bus, 'meet', 30);
    expect(tm.currentTier).toBe(2);
    expect(tm.requiredStreak).toBe(2); // tier 2
  });

  it('still tracks customersServed off customer:resolved', () => {
    const bus = createEventBus();
    const tm = makeManager(bus);
    for (let i = 0; i < 3; i++) {
      bus.publish('customer:resolved', {
        customerId: `c${i}`, outcome: 'closed', receptivity: 0.5,
        satisfaction: 1, retentionSeed: 0.5, heat: 0, agreedPrice: 0, frontGross: 0,
      });
    }
    expect(tm.customersServed).toBe(3);
  });
});

describe('TierManager — applyTierUp, contraction, and state serialization', () => {
  it('applyTierUp persists branding choices', () => {
    const bus = createEventBus();
    const tm = makeManager(bus);
    tm.applyTierUp({ businessName: 'Estrada Motors', accentColor: '#4a9eff', fontId: 'prestige' });
    expect(tm.businessName).toBe('Estrada Motors');
    expect(tm.accentColor).toBe('#4a9eff');
    expect(tm.fontId).toBe('prestige');
  });

  it('applyContraction unwinds an in-progress advancement streak', () => {
    const bus = createEventBus();
    const tm = makeManager(bus);
    postVerdict(bus, 'meet', 30); // → T2
    postVerdict(bus, 'meet', 60); // streak 1 toward T3
    expect(tm.monthStreak).toBe(1);

    tm.applyContraction(1);
    expect(tm.currentTier).toBe(1);
    expect(tm.monthStreak).toBe(0);
  });

  it('snapshot round-trips tier, career progress, streak, and dossier (schemaVersion 2)', () => {
    const bus = createEventBus();
    const tm = makeManager(bus);
    postVerdict(bus, 'meet', 30); // → T2
    postVerdict(bus, 'meet', 60); // streak 1 toward T3
    tm.applyTierUp({ businessName: 'Revived Rides', accentColor: '#c0392b', fontId: 'classic' });

    const snap = tm.snapshot();
    expect(snap.schemaVersion).toBe(2);
    expect(snap.monthStreak).toBe(1);

    const tm2 = makeManager(createEventBus());
    tm2.restore(snap);
    expect(tm2.currentTier).toBe(2);
    expect(tm2.businessName).toBe('Revived Rides');
    expect(tm2.monthStreak).toBe(1);
    expect(tm2.dossierReady).toBe(false);
  });

  it('mid-streak survives save/load and resumes toward the SAME advancement', () => {
    const bus = createEventBus();
    const tm = makeManager(bus);
    postVerdict(bus, 'meet', 30); // → T2 (needs 2 to leave)
    postVerdict(bus, 'meet', 60); // banked 1 of 2

    const snap = JSON.parse(JSON.stringify(tm.snapshot()));

    const bus2 = createEventBus();
    const tm2 = makeManager(bus2);
    tm2.restore(snap);
    expect(tm2.currentTier).toBe(2);
    expect(tm2.monthStreak).toBe(1);

    // One more meet-or-better month finishes the restored streak → T3.
    postVerdict(bus2, 'meet', 90);
    expect(tm2.currentTier).toBe(3);
  });

  it('rehydrates a pre-#250 (schemaVersion 1) blob to a fresh streak', () => {
    const bus = createEventBus();
    const tm = makeManager(bus);
    // A legacy v1 blob has no monthStreak / dossierReady fields.
    tm.restore({
      schemaVersion: 1,
      currentTier: 2,
      businessName: 'Legacy Lot',
      accentColor: '#38bdf8',
      fontId: 'classic',
      customersServed: 40,
    } as never);
    expect(tm.currentTier).toBe(2);
    expect(tm.monthStreak).toBe(0);
    expect(tm.dossierReady).toBe(false);
  });
});
