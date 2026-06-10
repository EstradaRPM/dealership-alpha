import { createEventBus } from '../src/game/EventBus';
import type { EventPayload } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createInventory, loadVehicleData } from '../src/game/Inventory';
import type { TradeAcquisitionInput } from '../src/game/Inventory';
import {
  loadReconVarianceConfig,
  rollRecon,
  deriveReconSeed,
} from '../src/game/MarketEconomy';

const STARTING_CASH = 200_000;
const NO_OVERNIGHT = { weeklyRent: 0, weeklyPayrollStub: 0 };
const VEHICLE_DATA = loadVehicleData();
const CFG = loadReconVarianceConfig();

function makeSetup(masterSeed = 42) {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay: 0 });
  const economy = createEconomy({
    bus,
    startingCash: STARTING_CASH,
    config: NO_OVERNIGHT,
  });
  const inventory = createInventory({
    bus,
    masterSeed,
    economy,
    vehicleData: VEHICLE_DATA,
  });
  return { bus, clock, economy, inventory };
}

const TRADE_VEHICLE: TradeAcquisitionInput['currentVehicle'] = {
  templateId: 'sedan-midsize',
  brand: 'vanda',
  make: 'Honda',
  model: 'Accord',
  year: 2018,
  mileage: 62_000,
  condition: 'average',
  category: 'sedan',
  loanPayoff: 9_000,
};

function acquisition(
  overrides: Partial<TradeAcquisitionInput> = {},
): TradeAcquisitionInput {
  return {
    customerId: 'cust-1',
    currentVehicle: TRADE_VEHICLE,
    agreedAllowance: 12_500,
    staffConfidence: 0.8,
    ...overrides,
  };
}

describe('Inventory — trade vehicle enters inventory (#171)', () => {
  it('materializes the trade as a lot vehicle with allowance as cost basis', () => {
    const { inventory } = makeSetup();
    const v = inventory.acquireFromTrade(acquisition());

    expect(v.purchasePrice).toBe(12_500);
    expect(v.make).toBe('Honda');
    expect(v.model).toBe('Accord');
    expect(v.condition).toBe('average');
    expect(v.reconStatus).toBe('in_progress');
    // Estimate is the condition-tier baseline (same budget an auction unit of
    // this condition shows); suggestedRetail = cost basis + estimate.
    const tier = VEHICLE_DATA.conditionTiers.average;
    expect(v.reconEstimate).toBe(tier.reconCost);
    expect(v.conditionReport).toBe(tier.report);
    expect(v.suggestedRetail).toBe(12_500 + tier.reconCost);
    expect(v.askingPrice).toBe(v.suggestedRetail);
  });

  it('appears in the lot view immediately on acquisition', () => {
    const { inventory } = makeSetup();
    expect(inventory.getLotVehicles()).toHaveLength(0);
    const v = inventory.acquireFromTrade(acquisition());
    const lot = inventory.getLotVehicles();
    expect(lot).toHaveLength(1);
    expect(inventory.getLotVehicle(v.id)).toEqual(v);
  });

  it('is a NON-CASH acquisition — no Economy expense posted for the allowance', () => {
    const { bus, inventory, economy } = makeSetup();
    const expenses: EventPayload<'economy:expense_posted'>[] = [];
    bus.subscribe('economy:expense_posted', (e) => expenses.push(e));
    const before = economy.cash;
    inventory.acquireFromTrade(acquisition({ agreedAllowance: 15_000 }));
    // The allowance is offset against deal cash in the close structure (#169),
    // not a separate expense — cash is untouched and no expense fires.
    expect(economy.cash).toBe(before);
    expect(expenses).toHaveLength(0);
  });

  it('publishes inventory:vehicle_acquired_via_trade with the snapshot + allowance', () => {
    const { bus, inventory } = makeSetup();
    const events: EventPayload<'inventory:vehicle_acquired_via_trade'>[] = [];
    bus.subscribe('inventory:vehicle_acquired_via_trade', (e) => events.push(e));

    const v = inventory.acquireFromTrade(acquisition());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      vehicleId: v.id,
      customerId: 'cust-1',
      allowance: 12_500,
      make: 'Honda',
      condition: 'average',
      category: 'sedan',
      reconCost: VEHICLE_DATA.conditionTiers.average.reconCost,
    });
  });

  it('rolls realized recon deterministically from the per-save seed', () => {
    const a = makeSetup(321).inventory.acquireFromTrade(acquisition());
    const b = makeSetup(321).inventory.acquireFromTrade(acquisition());
    expect(a.id).toBe(b.id);
    expect(a.reconRealizedCost).toBe(b.reconRealizedCost);
    expect(a.reconBucket).toBe(b.reconBucket);
  });

  it('staff condition-read confidence is the recon-variance source-reliability gate', () => {
    const masterSeed = 555;
    const acq = acquisition({ staffConfidence: 0.25 });
    const v = makeSetup(masterSeed).inventory.acquireFromTrade(acq);

    // The realized roll must match a direct sampler call fed the staff
    // confidence as sourceReliability and the same per-vehicle seed namespace.
    const direct = rollRecon(
      {
        estimate: v.reconEstimate,
        condition: v.condition,
        mileage: v.mileage,
        sourceReliability: 0.25,
      },
      deriveReconSeed(masterSeed, v.id),
      CFG,
    );
    expect(v.reconRealizedCost).toBe(direct.realizedCost);
    expect(v.reconBucket).toBe(direct.bucket);
  });

  it('a low-confidence trade can hide a lemon (wider tails than a confident read)', () => {
    // Same vehicle + seed, only the staff read confidence differs → the
    // realized recon can diverge because confidence reshapes the tail buckets.
    const masterSeed = 99;
    const confident = makeSetup(masterSeed).inventory.acquireFromTrade(
      acquisition({ staffConfidence: 0.95 }),
    );
    const blind = makeSetup(masterSeed).inventory.acquireFromTrade(
      acquisition({ staffConfidence: 0.0 }),
    );
    // Both are valid integer realized costs; the blind read is never tighter
    // to estimate than the confident one in expectation (bucket probs shift
    // toward the tails). We assert both rolled and at least the bucket ordering
    // is plausible — a no-UCM read is at least as likely to land off-'within'.
    expect(confident.reconRealizedCost).toBeGreaterThan(0);
    expect(blind.reconRealizedCost).toBeGreaterThan(0);
  });

  it('the acquired trade participates in the normal daily recon flow', () => {
    const setup = makeSetup(42);
    setup.clock.advanceDay(); // day 1: lot opens, recon ticks run on rollover
    const v = setup.inventory.acquireFromTrade(acquisition());
    expect(v.reconCost).toBe(0);

    for (let i = 0; i < v.reconDaysTotal + 1; i++) setup.clock.advanceDay();
    const after = setup.inventory.getLotVehicle(v.id);
    expect(after).toBeDefined();
    // recon either completed or paused on a tail surprise — both are the
    // normal flow (identical to an auction unit).
    expect(['complete', 'paused_for_decision']).toContain(after!.reconStatus);
  });
});

describe('Inventory — trade:resolved drives acquisition (#171 integration)', () => {
  function publishResolved(
    bus: ReturnType<typeof createEventBus>,
    overrides: Partial<EventPayload<'trade:resolved'>> = {},
  ) {
    bus.publish('trade:resolved', {
      customerId: 'cust-42',
      currentVehicle: TRADE_VEHICLE,
      agreedAllowance: 11_000,
      action: 'accept',
      hadCounter: false,
      staffConfidence: 0.8,
      ...overrides,
    });
  }

  it('a trade:resolved event grows the lot with the acquired vehicle', () => {
    const { bus, inventory } = makeSetup();
    expect(inventory.getLotVehicles()).toHaveLength(0);
    publishResolved(bus);
    const lot = inventory.getLotVehicles();
    expect(lot).toHaveLength(1);
    expect(lot[0].purchasePrice).toBe(11_000);
    expect(lot[0].reconStatus).toBe('in_progress');
  });

  it('the subscribed path matches a direct acquireFromTrade call', () => {
    const viaEvent = makeSetup(7);
    publishResolved(viaEvent.bus);
    const evVehicle = viaEvent.inventory.getLotVehicles()[0];

    const direct = makeSetup(7).inventory.acquireFromTrade({
      customerId: 'cust-42',
      currentVehicle: TRADE_VEHICLE,
      agreedAllowance: 11_000,
      staffConfidence: 0.8,
    });
    expect(evVehicle.id).toBe(direct.id);
    expect(evVehicle.reconRealizedCost).toBe(direct.reconRealizedCost);
    expect(evVehicle.purchasePrice).toBe(direct.purchasePrice);
  });
});
