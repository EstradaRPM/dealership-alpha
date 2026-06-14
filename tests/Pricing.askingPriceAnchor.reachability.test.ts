import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import type { CharacterProfile } from '../src/game/CareerProgression';

// #273 (Pricing/Demand spine S1) — the close's transaction anchor is the
// player-set askingPrice, and intake stamps that ask at the market suggestion
// rather than the cost-basis placeholder. This guards the live createWorld path:
// a freshly-acquired unit's default ask equals the live MarketEconomy provider's
// number (the seam is actually wired) and sits above the cost-basis placeholder.

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

describe('#273 askingPrice anchor — live createWorld intake', () => {
  it('stamps the default asking price from the market provider, not the cost-basis placeholder', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 42, characterProfile: PROFILE });

    const listing = [...world.inventory.getAuctionListings()].sort(
      (a, b) => a.askingPrice - b.askingPrice,
    )[0];
    expect(listing).toBeDefined();

    // Intake stamps the ask BEFORE publishing inventory:vehicle_purchased, so
    // the market read here (same drift state, identical anchor fields) is the
    // exact value the unit will carry.
    const expectedAsk = Math.round(
      world.marketEconomy.marketPriceFn({
        ...listing!,
        purchasePrice: listing!.askingPrice,
        reconCost: 0,
      }),
    );

    world.inventory.buyFromAuction(listing!.id);
    const unit = world.inventory.getLotVehicles()[0];
    expect(unit).toBeDefined();

    expect(unit!.askingPrice).toBe(expectedAsk);
    expect(unit!.suggestedRetail).toBe(expectedAsk);
    // Genuinely market-derived, not the purchasePrice + reconEstimate placeholder.
    expect(unit!.askingPrice).not.toBe(unit!.purchasePrice + unit!.reconEstimate);
  });
});
