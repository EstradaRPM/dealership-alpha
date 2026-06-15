/**
 * Policy bots for the #247 balance harness.
 *
 * A Policy makes the four managerial decisions the issue names — stocking,
 * hiring, pricing, and trade/discount adjudication defaults — once per
 * MANAGERIAL phase, before the day's floor opens. It only touches the public
 * `World` surface (auction board, roster, pricing lever, demand readout, ad
 * lever); it never reaches into game internals.
 *
 * Three reference policies span the skill range:
 *   - naive    — ignores the demand readout; one salesperson, a thin fixed lot,
 *                a slim cash cushion. The floor / worst case.
 *   - competent — follows the readouts (the reference "good player"): moderate
 *                tier-scaled lot matched to observed demand, a couple
 *                salespeople + a used-car-manager, a healthy cushion.
 *   - optimal   — exploits everything: tier-scaled lot (capped so carrying cost
 *                doesn't drown it), full manager bench (GM/UCM to
 *                capture escalations + cheaper floorplan), demand-matched
 *                stocking + an advertising push, margin pricing, acquisitive
 *                trade policy.
 *
 * The per-policy NUMBERS below are the bot's STRATEGY, not game-balance
 * tunables — they live here on purpose (a policy *is* its parameters). Game
 * balance numbers stay in data/. Add a policy by appending to POLICIES.
 */
import type { World } from '../../src/createWorld';

export interface PolicyContext {
  readonly world: World;
}

export interface Policy {
  readonly id: string;
  /** Per-slot "always escalate trades above $X" default (#170). */
  readonly tradeEscalationOverride?: number;
  /** Per-slot trade-acquisition policy multiplier (#172); 1.0 = market. */
  readonly tradePolicyMultiplier?: number;
  /** Run every MANAGERIAL phase, before `dayLoop.nextDay()`. */
  manage(ctx: PolicyContext): void;
}

// ── Shared decision helpers ──────────────────────────────────────────────────

function rosterCount(world: World, roleId: string): number {
  return world.staffOrg.currentRoster.filter((s) => s.role_id === roleId).length;
}

/** Hire up to `target` of a role, best-effectiveness first, while solvent.
 *  Swallows the hire-tier gate (getCandidates throws below tier) and the
 *  headcount cap (hire throws) — a policy expresses intent, the game enforces. */
function hireUpTo(
  world: World,
  roleId: string,
  target: number,
  cashBuffer: number,
): void {
  while (rosterCount(world, roleId) < target) {
    let cands;
    try {
      cands = world.staffOrg.getCandidates(roleId);
    } catch {
      return; // role's hireTier exceeds current dealership tier
    }
    if (cands.length === 0) return;
    const best = [...cands].sort(
      (a, b) => b.staff.effectiveness - a.staff.effectiveness,
    )[0];
    if (world.economy.cash < best.hiringCost + cashBuffer) return;
    try {
      world.staffOrg.hire(best.candidateId);
    } catch {
      return; // headcount cap for the current tier
    }
  }
}

/** Observed segment heat → per-category buy priority (higher = buy first).
 *  The heat map is keyed by VehicleCategory, so a segment *is* a buy category. */
function demandCategoryPriority(world: World): Record<string, number> {
  const out: Record<string, number> = {};
  for (const entry of world.demandShaper.getObservedMix()) {
    out[entry.segment] = (out[entry.segment] ?? 0) + entry.share;
  }
  return out;
}

/** Fill the lot toward `targetLot`, never spending below `cashBuffer`. When
 *  `categoryPriority` is given, demand-matched categories are bought first,
 *  then cheapest within a tier. */
function stockLot(
  world: World,
  targetLot: number,
  cashBuffer: number,
  categoryPriority?: Record<string, number>,
): void {
  if (world.inventory.getLotVehicles().length >= targetLot) return;
  const listings = world.inventory
    .getAuctionListings()
    .filter((l) => l.inspectionStatus !== 'pending');
  const ordered = [...listings].sort((a, b) => {
    if (categoryPriority) {
      const pa = categoryPriority[a.category] ?? 0;
      const pb = categoryPriority[b.category] ?? 0;
      if (pb !== pa) return pb - pa;
    }
    return a.askingPrice - b.askingPrice;
  });
  for (const listing of ordered) {
    if (world.inventory.getLotVehicles().length >= targetLot) break;
    if (listing.askingPrice <= world.economy.cash - cashBuffer) {
      try {
        world.inventory.buyFromAuction(listing.id);
      } catch {
        // insufficient cash mid-buy (recon/carrying drained it) — stop buying
        break;
      }
    }
  }
}

/** Per-tier lot target with a sensible default past the configured tiers. */
function lotTargetForTier(byTier: Record<number, number>, tier: number, fallback: number): number {
  return byTier[tier] ?? fallback;
}

// ── naive ────────────────────────────────────────────────────────────────────

const NAIVE = {
  lot: 5,
  salespeople: 1,
  cashBuffer: 5_000,
} as const;

const naivePolicy: Policy = {
  id: 'naive',
  manage({ world }) {
    // One salesperson, forever. No managers, no demand reading.
    hireUpTo(world, 'salesperson', NAIVE.salespeople, NAIVE.cashBuffer);
    // Blind cheapest-first stocking to a thin fixed lot, slim cushion.
    stockLot(world, NAIVE.lot, NAIVE.cashBuffer);
  },
};

// ── competent (reference player) ─────────────────────────────────────────────

const COMPETENT = {
  lotByTier: { 1: 6, 2: 9, 3: 13 } as Record<number, number>,
  lotFallback: 16,
  salespeopleByTier: { 1: 2, 2: 3, 3: 4 } as Record<number, number>,
  salespeopleFallback: 4,
  cashBuffer: 15_000,
  tradePolicyMultiplier: 1.0,
} as const;

const competentPolicy: Policy = {
  id: 'competent',
  tradePolicyMultiplier: COMPETENT.tradePolicyMultiplier,
  manage({ world }) {
    const tier = world.tierManager.currentTier;
    hireUpTo(
      world,
      'salesperson',
      lotTargetForTier(COMPETENT.salespeopleByTier, tier, COMPETENT.salespeopleFallback),
      COMPETENT.cashBuffer,
    );
    // A used-car-manager (once tier permits) owns the used desk and absorbs
    // discount escalations so good deals close instead of stalling on the floor.
    hireUpTo(world, 'used-car-manager', 1, COMPETENT.cashBuffer);
    stockLot(
      world,
      lotTargetForTier(COMPETENT.lotByTier, tier, COMPETENT.lotFallback),
      COMPETENT.cashBuffer,
      demandCategoryPriority(world),
    );
  },
};

// ── optimal ──────────────────────────────────────────────────────────────────

const OPTIMAL = {
  lotByTier: { 1: 7, 2: 11, 3: 16 } as Record<number, number>,
  lotFallback: 22,
  salespeopleByTier: { 1: 2, 2: 4, 3: 6 } as Record<number, number>,
  salespeopleFallback: 6,
  cashBuffer: 20_000,
  marginMarkup: 1.05,
  tradeEscalationOverride: 50_000,
  tradePolicyMultiplier: 1.1,
} as const;

let optimalAdSet = false;

const optimalPolicy: Policy = {
  id: 'optimal',
  tradeEscalationOverride: OPTIMAL.tradeEscalationOverride,
  tradePolicyMultiplier: OPTIMAL.tradePolicyMultiplier,
  manage({ world }) {
    const tier = world.tierManager.currentTier;
    hireUpTo(
      world,
      'salesperson',
      lotTargetForTier(OPTIMAL.salespeopleByTier, tier, OPTIMAL.salespeopleFallback),
      OPTIMAL.cashBuffer,
    );
    // Full manager bench: UCM (used desk — discount escalations + confident
    // trade reads), GM (trade escalations + dramatic-case suppression).
    hireUpTo(world, 'used-car-manager', 1, OPTIMAL.cashBuffer);
    hireUpTo(world, 'gm', 1, OPTIMAL.cashBuffer);

    // Push demand with the first available paid campaign, once.
    if (!optimalAdSet) {
      const campaign = world.demandControls.advertisingOptions.find((o) => o.id !== 'none');
      if (campaign) world.demandControls.setAdvertisingCampaign(campaign.id);
      optimalAdSet = true;
    }

    stockLot(
      world,
      lotTargetForTier(OPTIMAL.lotByTier, tier, OPTIMAL.lotFallback),
      OPTIMAL.cashBuffer,
      demandCategoryPriority(world),
    );

    // Margin pricing: ask above the cost-basis suggestion on every lot unit.
    for (const v of world.inventory.getLotVehicles()) {
      world.inventory.setAskingPrice(v.id, Math.round(v.suggestedRetail * OPTIMAL.marginMarkup));
    }
  },
};

// ── registry ─────────────────────────────────────────────────────────────────

export const POLICIES: readonly Policy[] = [naivePolicy, competentPolicy, optimalPolicy];

export function policyById(id: string): Policy | undefined {
  return POLICIES.find((p) => p.id === id);
}

/** Reset any policy-local run state. Some policies carry one-shot latches (the
 *  optimal ad lever) — call before each run so a fresh run behaves identically. */
export function resetPolicies(): void {
  optimalAdSet = false;
}
