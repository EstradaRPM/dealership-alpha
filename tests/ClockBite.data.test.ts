import {
  loadClockBites,
  ClockBitesConfigSchema,
  BITE_IDS,
  HALT_REASON_IDS,
} from '../src/game/ClockBite';

// #381 — the shipped catalog. The doors live in data and the predicates in
// code; these assertions are what keep the file honest about the first half.
describe('ClockBite catalog (#381)', () => {
  const config = loadClockBites();

  it('the shipped catalog states a door for every bite above the day', () => {
    const day = config.bites.find((b) => b.id === 'day');
    expect(day?.days).toBe(1);
    expect(day?.requires).toEqual([]);
    for (const bite of config.bites.filter((b) => b.days > 1)) {
      expect(bite.requires.length).toBeGreaterThan(0);
      // Every required cover has a sentence to state — a door with no
      // explanation is a silently greyed control.
      for (const req of bite.requires) {
        const fact = config.coverage.find((f) => f.id === req);
        expect(fact?.missingSentence.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it('carries the ruled day counts and every declared id', () => {
    expect(config.bites.find((b) => b.id === 'week')?.days).toBe(7);
    expect(config.bites.find((b) => b.id === 'month')?.days).toBe(30);
    expect(config.bites.map((b) => b.id).sort()).toEqual([...BITE_IDS].sort());
    expect(config.halts.map((h) => h.id).sort()).toEqual(
      [...HALT_REASON_IDS].sort(),
    );
    for (const halt of config.halts) expect(halt.sentence.length).toBeGreaterThan(0);
  });

  it('the week needs BOTH used-desk covers and the month needs the GM', () => {
    expect(config.bites.find((b) => b.id === 'week')?.requires.sort()).toEqual([
      'discount_desking',
      'trade_approval',
    ]);
    expect(config.bites.find((b) => b.id === 'month')?.requires).toEqual([
      'general_manager',
    ]);
  });

  it('refuses a door naming coverage the file never declares', () => {
    const bad = {
      ...loadClockBites(),
      bites: [
        { id: 'day', label: 'Run the Day', days: 1, requires: [] },
        {
          id: 'week',
          label: 'Run the Week',
          days: 7,
          requires: ['general_manager'],
        },
        { id: 'month', label: 'Run the Month', days: 30, requires: [] },
      ],
      coverage: [{ id: 'discount_desking', missingSentence: 'x' }],
    };
    expect(ClockBitesConfigSchema.safeParse(bad).success).toBe(false);
  });

  // #383 — the bite is a bet, so a bite the player commits to blind has to say
  // what it is wagering. The day is the exception and the only one: it is the
  // live floor, watched as it happens.
  it('every bite above the day states its stakes, and the day states none', () => {
    expect(config.bites.find((b) => b.id === 'day')?.stakes).toBeUndefined();
    for (const bite of config.bites.filter((b) => b.days > 1)) {
      expect(bite.stakes?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('refuses a bite above the day that ships without its stakes', () => {
    const shipped = loadClockBites();
    const bad = {
      ...shipped,
      bites: shipped.bites.map((b) =>
        b.id === 'week' ? { ...b, stakes: undefined } : b,
      ),
    };
    expect(ClockBitesConfigSchema.safeParse(bad).success).toBe(false);
  });

  it('is strict inside a bite, so a stale key is a load error not a silent drop', () => {
    const bad = {
      ...loadClockBites(),
      bites: loadClockBites().bites.map((b) =>
        b.id === 'week' ? { ...b, minTier: 2 } : b,
      ),
    };
    expect(ClockBitesConfigSchema.safeParse(bad).success).toBe(false);
  });
});
