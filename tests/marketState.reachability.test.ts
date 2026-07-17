import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { buildMarketState } from '../src/app/config';
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

/** Cheapest ready-to-sell auction unit the player can currently afford. */
function buyCheapest(world: ReturnType<typeof createWorld>): string {
  const listing = world.inventory
    .getAuctionListings()
    .filter((l) => l.inspectionStatus !== 'pending')
    .filter((l) => world.economy.cash - l.askingPrice > 5_000)
    .sort((a, b) => a.askingPrice - b.askingPrice)[0];
  expect(listing).toBeDefined();
  const before = new Set(world.inventory.getLotVehicles().map((v) => v.id));
  world.inventory.buyFromAuction(listing.id);
  const bought = world.inventory.getLotVehicles().find((v) => !before.has(v.id));
  expect(bought).toBeDefined();
  return bought!.id;
}

describe('#179 buildMarketState — composition seam against a live world', () => {
  it('produces one heat cell per demand segment, keyed + labeled + summed', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 179, characterProfile: PROFILE });

    const model = buildMarketState(world);

    expect(model.segmentHeat.length).toBe(world.demandShaper.segments.length);
    for (const cell of model.segmentHeat) {
      expect(world.demandShaper.segments).toContain(cell.segment);
      expect(cell.label.length).toBeGreaterThan(0);
      // heat is exactly the sum of the three exposed factors.
      expect(cell.heat).toBeCloseTo(cell.personality + cell.drift + cell.shock);
    }
    // Sorted hottest (most-above) first.
    for (let i = 1; i < model.segmentHeat.length; i++) {
      expect(model.segmentHeat[i - 1].heat).toBeGreaterThanOrEqual(
        model.segmentHeat[i].heat,
      );
    }
  });

  it('aggregates valuation over a really-owned unit (valuationFor on a LotVehicle)', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 181, characterProfile: PROFILE });

    const emptyModel = buildMarketState(world);
    const startUnits = emptyModel.valuation.unitCount;

    buyCheapest(world);
    const model = buildMarketState(world);

    expect(model.valuation.unitCount).toBe(startUnits + 1);
    expect(model.valuation.totalBook).toBeGreaterThan(0);
    expect(model.valuation.totalMarket).toBeGreaterThan(0);
    // marketPrice ≥ bookValue (retail markup), so unrealized gross is non-negative.
    expect(model.valuation.unrealizedGross).toBeCloseTo(
      model.valuation.totalMarket - model.valuation.totalBook,
    );
    expect(model.valuation.weeklyCarryingBurn).toBeGreaterThanOrEqual(0);
    // A freshly-bought unit is not yet aged.
    expect(model.stale.staleCount).toBe(0);
    expect(model.stale.thresholdDays).toBeGreaterThan(0);
  });

  it('surfaces a live market shock in the active-shocks list', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 179, characterProfile: PROFILE });
    const segment = world.demandShaper.segments[0];

    // Drive the scheduler until it activates a shock (deterministic per seed).
    let day = 1;
    while (world.marketEconomy.shocks.activeInstances().length === 0 && day < 400) {
      day += 1;
      bus.publish('clock:day_started', { day });
    }
    const active = world.marketEconomy.shocks.activeInstances();
    expect(active.length).toBeGreaterThan(0);

    const model = buildMarketState(world);
    expect(model.activeShocks.length).toBe(active.length);
    const first = model.activeShocks[0];
    expect(first.daysRemaining).toBeGreaterThanOrEqual(0);
    // Shock contributions fold into the matching segment's heat cell.
    const shockBySegment = active.reduce(
      (sum, inst) => sum + (inst.segmentMagnitudes[segment] ?? 0),
      0,
    );
    const cell = model.segmentHeat.find((c) => c.segment === segment)!;
    expect(cell.shock).toBeCloseTo(shockBySegment);
  });
});
