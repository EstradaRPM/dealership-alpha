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

function resolveCustomer(
  bus: ReturnType<typeof createEventBus>,
  i: number,
): void {
  bus.publish('customer:resolved', {
    customerId: `c${i}`,
    outcome: 'closed',
    receptivity: 0.5,
    satisfaction: 1,
    retentionSeed: 0.5,
    heat: 0,
    agreedPrice: 0,
    frontGross: 0,
  });
}

function closeDeal(bus: ReturnType<typeof createEventBus>, i: number): void {
  bus.publish('deal:closed', {
    customerId: `c${i}`,
    vehicleId: `v${i}`,
    agreedPrice: 20_000,
    frontGross: 0,
    backGross: 0,
    daysInInventory: 1,
    paymentMethod: 'cash',
    downPayment: 20_000,
    loanAmount: 0,
    term: 0,
    apr: 0,
  });
}

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
    const lot = world.inventory.getLotVehicles();
    expect(lot).toHaveLength(1);
    expect(lot[0].arrivalDay).toBe(1);
  });

  it('advances Tier 1 → 2 and fires career:tier_up when the real thresholds are met on the payroll-night cadence', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: MASTER_SEED, characterProfile: PROFILE });

    const tierUp = jest.fn();
    bus.subscribe('career:tier_up', tierUp);

    // Real data/tier-progression.json Tier 2 threshold:
    //   cash >= 125_000, customersServed >= 100, reviewScore >= 62.
    // Economy starts at 50_000 → post revenue to clear the cash bar.
    world.economy.postRevenue(80_000, 'test fixture');
    // reviewScore starts at 60; closedDealReviewBonus is +1 each.
    closeDeal(bus, 1);
    closeDeal(bus, 2);
    for (let i = 0; i < 100; i++) resolveCustomer(bus, i);

    // Below the check interval (28) → no tier-up yet.
    bus.publish('clock:overnight_payroll', { day: 14 });
    expect(world.tierManager.currentTier).toBe(1);
    expect(tierUp).not.toHaveBeenCalled();

    // Payroll night on the 28-day cadence → tier-up evaluates and fires.
    bus.publish('clock:overnight_payroll', { day: 28 });

    expect(world.tierManager.currentTier).toBe(2);
    expect(tierUp).toHaveBeenCalledWith({ fromTier: 1, toTier: 2, day: 28 });
  });

  it('does not tier up when thresholds are unmet on the cadence', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: MASTER_SEED, characterProfile: PROFILE });

    const tierUp = jest.fn();
    bus.subscribe('career:tier_up', tierUp);

    // Cash + reputation cleared, but customersServed stays at 0.
    world.economy.postRevenue(80_000, 'test fixture');
    closeDeal(bus, 1);
    closeDeal(bus, 2);

    bus.publish('clock:overnight_payroll', { day: 28 });

    expect(world.tierManager.currentTier).toBe(1);
    expect(tierUp).not.toHaveBeenCalled();
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
    const [advisor] = world.staffOrg.getCandidates('service-advisor');
    world.staffOrg.hire(advisor.candidateId);

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
