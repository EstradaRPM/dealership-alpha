import { readAppCompositionSource } from './helpers/appComposition';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { availableBites } from '../src/game/ClockBite';
import { resolveBiteCoverage } from '../src/app/config';
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

// Anti-orphan (#381): the bite picker must be mounted in the live app and its
// doors must resolve off a REAL roster — a mechanic built but never surfaced is
// the failure this guard exists for.
describe('#381 the bite picker is wired into the live app', () => {
  const src = readAppCompositionSource();

  it('the picker is composed into the pinned day-action footer', () => {
    expect(src).toContain('BitePicker');
    expect(src).toContain('availableBites');
    expect(src).toContain('resolveBiteCoverage');
    // The picker's run handler reaches the runner, not a stub.
    expect(src).toContain('handleRunBite');
    expect(src).toContain('runBite(');
  });

  it('the runner drives the same exhaust-the-day primitive the player does', () => {
    // nextDay() + runDay() — a bite is a "how many times", not a different day.
    expect(src).toContain('floor.runDay()');
    expect(src).toContain('buildBiteReveal');
  });

  it('the three halt signals are latched by the composition root', () => {
    for (const event of [
      'trade:escalated',
      'discount:escalated',
      'career:bankruptcy_terminal',
      'tierGate:month_verdict',
    ]) {
      expect(src).toContain(event);
    }
  });

  it('a fresh Tier-1 store resolves a real, honestly-shut ladder', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 7, characterProfile: PROFILE });
    const options = availableBites(resolveBiteCoverage(world));
    expect(options.map((o) => o.id)).toEqual(['day', 'week', 'month']);
    expect(options[0].unlocked).toBe(true);
    // No used car manager and no GM on day 1 — both bigger bites are shut, and
    // each states why rather than vanishing.
    for (const locked of options.slice(1)) {
      expect(locked.unlocked).toBe(false);
      expect(locked.lockedReason).toBeTruthy();
    }
  });

  it('every bite the player can actually place states its stakes (#383)', () => {
    // A GM'd store can place both bigger bets; each arrives pre-phrased from
    // the catalog, so the picker states the wager without wording anything.
    const options = availableBites([
      'discount_desking',
      'trade_approval',
      'general_manager',
    ]);
    for (const bite of options.filter((o) => o.days > 1)) {
      expect(bite.unlocked).toBe(true);
      expect(bite.stakes).toBeTruthy();
    }
    // The day is watched as it happens — nothing to state in advance.
    expect(options[0].stakes).toBeNull();
  });

  it('nothing about the bite is persisted — the default is the day, every time', () => {
    // A remembered bite is a standing instruction to skip, the opposite of a
    // bet you place each time. No save-layer wire may reference one.
    expect(src).not.toMatch(/selectedBite|lastBite|biteId:\s*['"]/);
  });
});
