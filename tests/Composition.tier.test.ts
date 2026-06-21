import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { snapshotWorld, restoreWorld } from '../src/worldSnapshot';
import type { CharacterProfile } from '../src/game/CareerProgression';

const MASTER_SEED = 42;

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

describe('#79 composition root — CareerProgression tier-up over a run', () => {
  it('boots at Tier 1 (Gravel Yard)', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: MASTER_SEED, characterProfile: PROFILE });
    expect(world.tierManager.currentTier).toBe(1);
  });

  it('#136: auction board is populated on the cold-start night-before-Day-1 MANAGERIAL', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: MASTER_SEED, characterProfile: PROFILE });
    // Before any clock advance / nextDay, the player is sitting on the first
    // MANAGERIAL screen ("night before Day 1"). The auction board must already
    // be populated so the player can stock the lot before Day 1 opens.
    const listings = world.inventory.getAuctionListings();
    expect(listings.length).toBeGreaterThanOrEqual(12);
    expect(listings.length).toBeLessThanOrEqual(18);

    // And a car bought during this prep window is on the lot for Day 1 (not
    // Day 2): arrivalDay matches the upcoming day.
    const [listing] = listings;
    world.inventory.buyFromAuction(listing.id);
    // The lot opens with the #296 seed (1 SUV / truck / sedan at arrivalDay 0),
    // so fetch the freshly-bought unit by id rather than assuming an empty lot.
    const bought = world.inventory.getLotVehicle(listing.id);
    expect(bought).toBeDefined();
    expect(bought!.arrivalDay).toBe(1);
  });

  it('#250: advances Tier 1 → 2 off the live tier-gate month-verdict streak', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: MASTER_SEED, characterProfile: PROFILE });

    const tierUp = jest.fn();
    bus.subscribe('career:tier_up', tierUp);

    // Real tier-gate.json: T1 streak length is 1 — a single meet-or-better
    // monthly verdict leaves T1. The TierManager is wired to the verdict event
    // in the live composition (no instantaneous threshold path anymore).
    bus.publish('tierGate:month_verdict', {
      day: 30, month: 1, tier: 1, overall: 'meet', faces: [],
    });

    expect(world.tierManager.currentTier).toBe(2);
    expect(tierUp).toHaveBeenCalledWith({ fromTier: 1, toTier: 2, day: 30 });
  });

  it('#250: a below-meet month resets the streak and does not advance', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: MASTER_SEED, characterProfile: PROFILE });

    const tierUp = jest.fn();
    bus.subscribe('career:tier_up', tierUp);

    // Leave T1 (1 month), then a near-miss at T2 (needs 2 consecutive) resets.
    bus.publish('tierGate:month_verdict', { day: 30, month: 1, tier: 1, overall: 'meet', faces: [] });
    bus.publish('tierGate:month_verdict', { day: 60, month: 2, tier: 2, overall: 'meet', faces: [] });
    expect(world.tierManager.monthStreak).toBe(1);
    bus.publish('tierGate:month_verdict', { day: 90, month: 3, tier: 2, overall: 'nearMiss', faces: [] });

    expect(world.tierManager.currentTier).toBe(2);
    expect(world.tierManager.monthStreak).toBe(0);
  });

  it('#250: round-trips an in-progress advancement streak through the world snapshot', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: MASTER_SEED, characterProfile: PROFILE });

    // → T2, then bank 1 of the 2 months needed to leave T2.
    bus.publish('tierGate:month_verdict', { day: 30, month: 1, tier: 1, overall: 'meet', faces: [] });
    bus.publish('tierGate:month_verdict', { day: 60, month: 2, tier: 2, overall: 'meet', faces: [] });
    expect(world.tierManager.currentTier).toBe(2);
    expect(world.tierManager.monthStreak).toBe(1);

    const snap = JSON.parse(JSON.stringify(snapshotWorld(world)));
    expect(snap.modules.tierManager.schemaVersion).toBe(2);
    expect(snap.modules.tierManager.monthStreak).toBe(1);

    const rebuilt = createWorld({
      bus: createEventBus(),
      masterSeed: MASTER_SEED,
      characterProfile: PROFILE,
    });
    expect(rebuilt.tierManager.monthStreak).toBe(0);
    restoreWorld(snap, rebuilt);
    expect(rebuilt.tierManager.currentTier).toBe(2);
    expect(rebuilt.tierManager.monthStreak).toBe(1);
  });
});

describe('#84 composition root — EndCardManager wired into the live world', () => {
  it('converges a terminal failure into a single career:game_over with EndCardData', () => {
    const bus = createEventBus();
    const world = createWorld({
      bus,
      masterSeed: MASTER_SEED,
      characterProfile: PROFILE,
    });

    const gameOver = jest.fn();
    bus.subscribe('career:game_over', gameOver);

    bus.publish('career:bankruptcy_terminal', { day: 100, tier: 1 });

    expect(gameOver).toHaveBeenCalledTimes(1);
    expect(gameOver).toHaveBeenCalledWith(
      expect.objectContaining({
        day: 100,
        data: expect.objectContaining({
          reason: 'bankruptcy',
          playerName: PROFILE.name,
        }),
      }),
    );
    expect(world.endCardManager.data?.reason).toBe('bankruptcy');
  });

  it('routes a success ending (career:retired) through the same converged game-over', () => {
    const bus = createEventBus();
    const world = createWorld({
      bus,
      masterSeed: MASTER_SEED,
      characterProfile: PROFILE,
    });

    const gameOver = jest.fn();
    bus.subscribe('career:game_over', gameOver);

    bus.publish('career:retired', {
      day: 9 * 364,
      tier: 2,
      cashOnHand: 1_000_000,
      careerYear: 9,
    });

    expect(gameOver).toHaveBeenCalledTimes(1);
    expect(world.endCardManager.data?.reason).toBe('retire');
  });
});

describe('#270 composition root — BankruptcyMonitor wired into the live world', () => {
  it('routes sustained Tier 1 cash-insolvency to a terminal bankruptcy game-over', () => {
    const bus = createEventBus();
    const world = createWorld({
      bus,
      masterSeed: MASTER_SEED,
      characterProfile: PROFILE,
    });
    expect(world.tierManager.currentTier).toBe(1);

    const terminal = jest.fn();
    const gameOver = jest.fn();
    bus.subscribe('career:bankruptcy_terminal', terminal);
    bus.subscribe('career:game_over', gameOver);

    // Drive cash below the failure-tunables cashFloor (0): start 50k, debit 60k.
    world.economy.forceDebit(60_000, 'test insolvency');
    expect(world.economy.cash).toBeLessThan(0);

    // Real failure-tunables: 7 consecutive insolvent overnight ticks at Tier 1
    // → terminal. The first six only accrue the streak.
    for (let day = 1; day <= 6; day++) {
      bus.publish('clock:overnight_payroll', { day });
    }
    expect(terminal).not.toHaveBeenCalled();

    bus.publish('clock:overnight_payroll', { day: 7 });

    // BankruptcyMonitor (the sole publisher) fired its terminal, and the
    // live-wired EndCardManager converged it into a single game-over.
    expect(terminal).toHaveBeenCalledWith({ day: 7, tier: 1 });
    expect(gameOver).toHaveBeenCalledTimes(1);
    expect(world.endCardManager.data?.reason).toBe('bankruptcy');
    expect(world.bankruptcyMonitor.isTerminal).toBe(true);
  });

  it('round-trips bankruptcy debt-overhang state through the world snapshot', () => {
    const bus = createEventBus();
    const world = createWorld({
      bus,
      masterSeed: MASTER_SEED,
      characterProfile: PROFILE,
    });

    world.bankruptcyMonitor.restoreState({
      insolventDayCount: 3,
      outstandingDebt: 42_000,
      isTerminal: false,
    });

    const snap = snapshotWorld(world);
    expect(snap.modules.bankruptcyMonitor).toEqual({
      insolventDayCount: 3,
      outstandingDebt: 42_000,
      isTerminal: false,
    });

    const rebuilt = createWorld({
      bus: createEventBus(),
      masterSeed: MASTER_SEED,
      characterProfile: PROFILE,
    });
    expect(rebuilt.bankruptcyMonitor.outstandingDebt).toBe(0);
    restoreWorld(JSON.parse(JSON.stringify(snap)), rebuilt);
    expect(rebuilt.bankruptcyMonitor.outstandingDebt).toBe(42_000);
    expect(rebuilt.bankruptcyMonitor.insolventDayCount).toBe(3);
  });
});

describe('#271 composition root — IndictmentMonitor wired into the live world', () => {
  it('routes accumulated severe-event pressure to a terminal indictment game-over', () => {
    const bus = createEventBus();
    const world = createWorld({
      bus,
      masterSeed: MASTER_SEED,
      characterProfile: PROFILE,
    });
    expect(world.tierManager.currentTier).toBe(1);

    const terminal = jest.fn();
    const gameOver = jest.fn();
    bus.subscribe('career:indictment_terminal', terminal);
    bus.subscribe('career:game_over', gameOver);

    // Real failure-tunables: lemonLawPressure 15, pressureThreshold 50. Three
    // incidents (45) stay under threshold; the fourth (60) trips a Tier 1
    // terminal indictment. These ride the live, wired monitor — the same
    // `regulatory:lemon_law_incident` signal DealEngine now emits when an
    // un-reconditioned hidden lemon is retailed.
    for (let i = 0; i < 3; i++) {
      bus.publish('regulatory:lemon_law_incident', { day: 1, customerId: `c${i}` });
    }
    expect(terminal).not.toHaveBeenCalled();

    bus.publish('regulatory:lemon_law_incident', { day: 1, customerId: 'c3' });

    // IndictmentMonitor (the sole publisher) fired its terminal, and the
    // live-wired EndCardManager converged it into a single game-over.
    expect(terminal).toHaveBeenCalledWith({ day: 1, tier: 1, pressure: 60 });
    expect(gameOver).toHaveBeenCalledTimes(1);
    expect(world.endCardManager.data?.reason).toBe('indictment');
    expect(world.indictmentMonitor.isTerminal).toBe(true);
  });

  it('round-trips indictment pressure through the world snapshot', () => {
    const bus = createEventBus();
    const world = createWorld({
      bus,
      masterSeed: MASTER_SEED,
      characterProfile: PROFILE,
    });

    world.indictmentMonitor.restoreState({ pressure: 30, isTerminal: false });

    const snap = snapshotWorld(world);
    expect(snap.modules.indictmentMonitor).toEqual({
      pressure: 30,
      isTerminal: false,
    });

    const rebuilt = createWorld({
      bus: createEventBus(),
      masterSeed: MASTER_SEED,
      characterProfile: PROFILE,
    });
    expect(rebuilt.indictmentMonitor.pressure).toBe(0);
    restoreWorld(JSON.parse(JSON.stringify(snap)), rebuilt);
    expect(rebuilt.indictmentMonitor.pressure).toBe(30);
  });
});

describe('#272 composition root — CareerEndingsMonitor wired into the live world', () => {
  it('routes a retire success ending to a converged game-over against the live composition', () => {
    const bus = createEventBus();
    const world = createWorld({
      bus,
      masterSeed: MASTER_SEED,
      characterProfile: PROFILE,
    });

    const retired = jest.fn();
    const gameOver = jest.fn();
    bus.subscribe('career:retired', retired);
    bus.subscribe('career:game_over', gameOver);

    // Real career-endings tunables: retire needs cash >= 750k AND careerYear >= 8.
    // careerYearFromDay uses DAYS_PER_YEAR (364): day 8*364 → careerYear 8.
    // Post well clear of the bar (the #296 seed lot trims a few dollars of Day-1
    // floorplan carry off the 50k start, so don't bank on an exact 50k).
    world.economy.postRevenue(750_000, 'test fixture');
    const retireDay = 8 * 364;

    expect(world.careerEndingsMonitor.canRetire(retireDay)).toBe(true);
    expect(world.careerEndingsMonitor.retire(retireDay)).toBe(true);

    // CareerEndingsMonitor (the sole publisher) fired its success ending, and the
    // live-wired EndCardManager converged it into a single game-over.
    expect(retired).toHaveBeenCalledTimes(1);
    expect(gameOver).toHaveBeenCalledTimes(1);
    expect(world.endCardManager.data?.reason).toBe('retire');
    expect(world.careerEndingsMonitor.isEnded).toBe(true);
  });

  it('round-trips a pending PE offer through the world snapshot', () => {
    const bus = createEventBus();
    const world = createWorld({
      bus,
      masterSeed: MASTER_SEED,
      characterProfile: PROFILE,
    });

    world.careerEndingsMonitor.restoreState({
      currentOffer: { day: 100, tier: 3, amount: 1_750_000 },
      lastOfferDay: 100,
      isEnded: false,
    });

    const snap = snapshotWorld(world);
    expect(snap.modules.careerEndingsMonitor).toEqual({
      currentOffer: { day: 100, tier: 3, amount: 1_750_000 },
      lastOfferDay: 100,
      isEnded: false,
    });

    const rebuilt = createWorld({
      bus: createEventBus(),
      masterSeed: MASTER_SEED,
      characterProfile: PROFILE,
    });
    expect(rebuilt.careerEndingsMonitor.currentOffer).toBeNull();
    restoreWorld(JSON.parse(JSON.stringify(snap)), rebuilt);
    expect(rebuilt.careerEndingsMonitor.currentOffer).toEqual({
      day: 100,
      tier: 3,
      amount: 1_750_000,
    });
  });
});

describe('#206 composition root — ServiceDispatch wired into the floor seams', () => {
  it('auto-resolves Tier 2 service intake through a hired service advisor', () => {
    const bus = createEventBus();
    const world = createWorld({
      bus,
      masterSeed: MASTER_SEED,
      characterProfile: PROFILE,
    });
    const closed: unknown[] = [];
    bus.subscribe('service:ticket_closed', e => closed.push(e));

    world.serviceQueue.restore({ schemaVersion: 1, currentTier: 2 });
    // service-advisor has hireTier 2; the hire gate reads the TierManager, so
    // bump the dealership tier too (not just the ServiceQueue's tier).
    const tierState = world.tierManager.getSerializableState();
    world.tierManager.restoreState({ ...tierState, currentTier: 2 });
    const [advisor] = world.staffOrg.getCandidates('service-advisor');
    world.staffOrg.hire(advisor.candidateId);

    // #304 parts gate: a completed job now consumes a matching-category part,
    // and at Tier 2 the rush path is still locked, so an unstocked job misses
    // instead of closing. Stock every category so the advisor can close tickets.
    for (const cat of ['oil_filters', 'tires_brakes', 'drivetrain', 'electronics'] as const) {
      world.partsInventory.addStock(cat, 50, 10);
    }

    // Cold-start Day 1 does not advance the clock, so ServiceQueue's
    // day_started intake starts on the next played day.
    world.dayLoop.nextDay().runDay();

    for (let i = 0; i < 4 && closed.length === 0; i++) {
      world.dayLoop.nextDay().runDay();
    }

    expect(closed.length).toBeGreaterThan(0);
    expect(world.departmentQueue.getBadgeCount('service')).toBeLessThan(4);
  });
});
