import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';

const MASTER_SEED = 42;

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
  });
}

describe('#79 composition root — CareerProgression tier-up over a run', () => {
  it('boots at Tier 1 (Gravel Yard)', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: MASTER_SEED });
    expect(world.tierManager.currentTier).toBe(1);
  });

  it('advances Tier 1 → 2 and fires career:tier_up when the real thresholds are met on the payroll-night cadence', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: MASTER_SEED });

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
    const world = createWorld({ bus, masterSeed: MASTER_SEED });

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
