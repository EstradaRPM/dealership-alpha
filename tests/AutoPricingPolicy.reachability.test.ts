import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { isAutoPricingUnlocked } from '../src/game/MarketEconomy';
import { loadTunables } from '../src/game/data';
import type { CharacterProfile } from '../src/game/CareerProgression';

const PRICING_GATE = loadTunables().managerGates.actThresholds.pricing;

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
  const bought = world.inventory
    .getLotVehicles()
    .find((v) => !before.has(v.id));
  expect(bought).toBeDefined();
  return bought!.id;
}

describe('#289 auto-pricing gate — UCM pricing-skill threshold (channel-desk M2)', () => {
  it('is the pure earned-stripes cliff: null/below the gate locked, at/above unlocked', () => {
    expect(isAutoPricingUnlocked(null, PRICING_GATE)).toBe(false);
    expect(isAutoPricingUnlocked(PRICING_GATE - 1, PRICING_GATE)).toBe(false);
    expect(isAutoPricingUnlocked(PRICING_GATE, PRICING_GATE)).toBe(true);
    expect(isAutoPricingUnlocked(PRICING_GATE + 1, PRICING_GATE)).toBe(true);
  });

  it('suggestion-only with no UCM AND with a below-gate UCM; auto-prices only once pricing clears the gate', () => {
    const bus = createEventBus();
    // Aggressive posture: above market when the policy is live.
    const world = createWorld({
      bus,
      masterSeed: 285,
      characterProfile: PROFILE,
      getPricingStrategy: () => 'aggressive',
    });

    // --- No UCM yet: suggestion-only. The default ask sits at the honest
    //     market suggestion regardless of the Aggressive toggle. ---
    const noUcmId = buyCheapest(world);
    const noUcm = world.inventory
      .getLotVehicles()
      .find((v) => v.id === noUcmId)!;
    expect(noUcm.askingPrice).toBe(noUcm.suggestedRetail);

    // --- Hire a UCM (the used-car desk). ---
    // UCM hireTier is 2; force the dealership to tier 2 so the role is hireable.
    const tierState = world.tierManager.getSerializableState();
    world.tierManager.restoreState({ ...tierState, currentTier: 2 });
    const candidate = world.staffOrg.getCandidates('used-car-manager')[0];
    expect(candidate).toBeDefined();
    world.staffOrg.hire(candidate.candidateId);
    const ucmStaff = world.staffOrg.currentRoster.find(
      (s) => s.role_id === 'used-car-manager',
    )!;
    expect(ucmStaff).toBeDefined();

    // --- Below-gate UCM: presence alone is NOT enough (the #289 reframe).
    //     A green manager who can't yet price the book leaves intake at the
    //     suggestion — the player still prices by hand. ---
    ucmStaff.skills['pricing'] = Math.max(0, PRICING_GATE - 10);
    const greenId = buyCheapest(world);
    const green = world.inventory.getLotVehicles().find((v) => v.id === greenId)!;
    expect(green.askingPrice).toBe(green.suggestedRetail);

    // --- At/above the gate: the desk can act, so intake auto-prices to the
    //     Aggressive target, which lists above the market suggestion. ---
    ucmStaff.skills['pricing'] = Math.min(100, PRICING_GATE + 10);
    const ucmId = buyCheapest(world);
    const ucm = world.inventory.getLotVehicles().find((v) => v.id === ucmId)!;
    expect(ucm.askingPrice).toBeGreaterThan(ucm.suggestedRetail);

    // The player retains the per-unit override (Pillar 5: permission, not
    // amputation) — a manual ask sticks over the standing policy.
    world.inventory.setAskingPrice(ucmId, ucm.suggestedRetail);
    expect(
      world.inventory.getLotVehicles().find((v) => v.id === ucmId)!.askingPrice,
    ).toBe(ucm.suggestedRetail);
  });
});
