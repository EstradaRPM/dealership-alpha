import { createEventBus } from '../src/game/EventBus';
import { createWorld, type World } from '../src/createWorld';
import { loadStaffTaxonomy } from '../src/game/NPC';
import { loadSalesProcessConfig } from '../src/game/SalesProcess';
import { loadMarketCalibrationConfig } from '../src/game/MarketEconomy';
import type { CharacterProfile } from '../src/game/CareerProgression';

/**
 * #180 — calibration verification against the LIVE engine.
 *
 * `tests/SalesProcess.calibration.test.ts` (#94) proves the sales-process
 * balance in a vacuum: a perfect inventory match every time, static price
 * stubs, no market, no trades, no morale. This test asks the question that one
 * cannot — **does that calibration survive contact with the actual game?**
 *
 * So this drives the real `createWorld`: live MarketEconomy providers (anchor +
 * per-save personality + comp drift + shocks), the real lot bought off the real
 * auction board, seeded weather, demand shaping, competitor price drift, trades
 * with negative equity, morale drifting under the salesperson's feet, and
 * carrying cost eating the cash that buys the next unit. Every one of those is
 * variance the #94 harness holds still.
 *
 * ## What is measured, and against what denominator
 *
 * The live engine produces a walk the #94 harness structurally cannot: `no_fit`
 * — nobody on the lot had what the customer wanted. That is a *stocking*
 * outcome, not a sales-process outcome, and folding it into the apathetic band
 * would measure the test's shopping habits rather than the game's balance. So
 * the quadrant bands are asserted over **process-reached** customers (the ones a
 * salesperson actually worked), and the inventory-fit walk is asserted
 * separately, on its own band, as the thing it actually is.
 *
 * ## What is deliberately NOT held still
 *
 * The salesperson's *base* skills are pinned to the #94 reference profile
 * (0.75/0.75) — that is the "competent operation" the bands are defined
 * against. Morale is **not** pinned: it drifts nightly and multiplies
 * effectiveness at every gate, and that drift is precisely the emergent
 * variance this test exists to catch. Same for shocks, heat and comp drift —
 * pinning them would be measuring the #94 harness again with extra steps.
 *
 * A band failure here is fixed by tuning `data/`, never by changing code.
 */

const MASTER_SEED = 20260806;

/** Enough resolutions for the bands to have distribution power (#94 uses 600). */
const TARGET_RESOLUTIONS = 600;

/**
 * Hard stop so a starved world fails loudly instead of spinning.
 *
 * Raised from 400 in #286. The live tier-1 floor works about 1.2 customers a
 * day — six spaces cannot show most arrivals anything they want — so 600 worked
 * ups is a ~500-day career. The pre-#286 engine reached the sample in 369 days
 * only because nothing ever sold: a lot that never turns keeps offering the
 * same six cars, and its `no_fit` share was correspondingly lower.
 */
const MAX_DAYS = 600;

/** Balance-neutral founder — the same one the #247 harness runs. Every lever is
 *  zero on purpose (#390): the bands below measure the engine, and a founder's
 *  edge would be measured as the engine's. */
const PROFILE: CharacterProfile = {
  name: 'Calibration Bot',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0,
    startingCreditLine: 0,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

/** The test bot's stocking strategy — its parameters, not game balance. */
const BOT = {
  targetLot: 6,
  cashBuffer: 4_000,
  /**
   * Keep the operator capitalized. This harness measures the *outcome
   * distribution* of worked customers, not whether the bot can run a solvent
   * business — and at a low close rate the store goes insolvent long before the
   * sample completes, which would silently shrink N and make the bands move
   * whenever calibration changes. Topping the float up keeps the sample size
   * fixed at `TARGET_RESOLUTIONS` regardless of how the economy is tuned, so the
   * bands measure one thing. Solvency and pacing are the balance harness's job
   * (`scripts/balance-harness/`), not this test's.
   */
  floatFloor: 25_000,
  floatTopUp: 75_000,
} as const;

/**
 * Pin a salesperson's base skills to the #94 reference composite.
 *
 * `effectiveness`/`trustworthiness` are weighted sums of `value/cap × weight`
 * over the role's mapped skills, so setting every skill to exactly half its cap
 * yields half the ceiling on both axes — 0.75/0.75 for a salesperson, the
 * competent-but-not-perfect operator #94 calibrates against. Derived from the
 * catalog rather than hardcoded so a retuned `data/staff-skills.json` cannot
 * silently move the reference profile out from under this test.
 */
function pinToReferenceProfile(world: World): void {
  const { skills } = loadStaffTaxonomy();
  for (const member of world.staffOrg.currentRoster) {
    if (member.role_id !== 'salesperson') continue;
    for (const skillId of Object.keys(member.skills)) {
      const def = skills[skillId];
      if (!def) continue;
      member.skills[skillId] = def.cap / 2;
    }
  }
}

/** Top the float up before the day's decisions — see `BOT.floatFloor`. */
function capitalize(world: World): void {
  if (world.economy.cash >= BOT.floatFloor) return;
  world.economy.postRevenue(BOT.floatTopUp, 'calibration harness float');
}

function hireOneSalesperson(world: World): void {
  if (world.staffOrg.currentRoster.some((s) => s.role_id === 'salesperson')) {
    return;
  }
  const candidates = world.staffOrg.getCandidates('salesperson');
  if (candidates.length === 0) return;
  try {
    world.staffOrg.hire(candidates[0].candidateId);
  } catch {
    return; // cash or cap — the bot expresses intent, the game enforces
  }
  pinToReferenceProfile(world);
}

/**
 * Run the #362 release valve on anything that has aged out.
 *
 * Not an optimization — without it this harness measures a store that cannot
 * restock. A tier-1 lot is six spaces; a unit nobody will buy occupies one of
 * them forever, and within ~200 days all six are duds (mean age climbed to 123
 * days and the close rate halved twice over). That is the harness failing to
 * make a standing decision every operator makes, not the economy degrading —
 * exactly like `capitalize` below. The valve is the mechanic #362 built for it.
 */
function releaseAgedUnits(world: World): void {
  for (const v of world.inventory.getLotVehicles()) {
    if (v.aged) world.inventory.wholesaleVehicle(v.id);
  }
}

/** Keep the lot stocked toward what the demand readout says is moving. */
function stockLot(world: World): void {
  const priority: Record<string, number> = {};
  for (const entry of world.demandShaper.getObservedMix()) {
    priority[entry.segment] = (priority[entry.segment] ?? 0) + entry.share;
  }
  const ordered = [...world.inventory.getAuctionListings()]
    .filter((l) => l.inspectionStatus !== 'pending')
    .sort((a, b) => {
      const pa = priority[a.category] ?? 0;
      const pb = priority[b.category] ?? 0;
      if (pb !== pa) return pb - pa;
      return a.askingPrice - b.askingPrice;
    });
  for (const listing of ordered) {
    if (world.inventory.getLotVehicles().length >= BOT.targetLot) break;
    if (world.inventory.getLotOccupancy().atCapacity) break;
    if (listing.askingPrice > world.economy.cash - BOT.cashBuffer) continue;
    try {
      world.inventory.buyFromAuction(listing.id);
    } catch {
      break;
    }
  }
}

interface Tally {
  /** Closed, customer is happy — the "positive transaction" band. */
  positive: number;
  /** Closed on a strong deal despite low trust — "negative-but-deal". */
  negativeDeal: number;
  /** Worked by a salesperson and did not buy — the "apathetic" band. */
  apathetic: number;
  /** Of those, the ones who left warm enough to be worth a callback. */
  warmWalks: number;
  /** Nobody on the lot had what they wanted — a stocking outcome. */
  inventoryFitWalks: number;
  /** Never reached a salesperson at all (no session / not a sales visit). */
  preProcess: number;
  closes: number;
  tradesAcquired: number;
  /**
   * Below-floor ups that surfaced as the interactive discount event. Only
   * `escalationRate` of them do, so this is the visible tip of a much larger
   * count — the arithmetic that tells `no_close`-the-quadrant-fail apart from
   * `no_close`-the-price-was-under-our-cost, which the bus cannot distinguish.
   */
  discountEscalations: number;
}

interface RunOutcome extends Tally {
  days: number;
  /** Per-resolution signature, for the determinism assertion. */
  signature: string[];
  /**
   * Walk reasons, most common first. A calibration miss is only actionable if
   * it says *which* way the customers are leaving.
   */
  reasons: Record<string, number>;
  /** The realized reference profile, so a failed pin is visible not silent. */
  profile: { effectiveness: number; trustworthiness: number } | null;
  /** Mean customer target ÷ our ask, over the below-floor population. */
  meanTargetOverAsk: number;
  /** Mean vehicle cost ÷ our ask, over the same population. */
  meanCostOverAsk: number;
  /**
   * The four consumers #363 reconnected to the live floor, read at the end of
   * the run. Before that bridge existed a walk never published
   * `customer:resolved`, so every one of these sat at its starting value no
   * matter how the floor went — which is exactly why their magnitudes were
   * calibrated against a producer that never fired. They are read here so a
   * future retune can see what the walk volume actually does to them.
   */
  consumers: {
    satisfaction: number;
    reviewScore: number;
    regulatoryPressure: number;
    followUpsActive: number;
    followUpsArchived: number;
    customersServed: number;
  };
}

function runCalibration(): RunOutcome {
  const bus = createEventBus();
  const world = createWorld({
    bus,
    masterSeed: MASTER_SEED,
    characterProfile: PROFILE,
  });

  const t: Tally = {
    positive: 0,
    negativeDeal: 0,
    apathetic: 0,
    warmWalks: 0,
    inventoryFitWalks: 0,
    preProcess: 0,
    closes: 0,
    tradesAcquired: 0,
    discountEscalations: 0,
  };
  const signature: string[] = [];
  const reasons: Record<string, number> = {};
  const targetOverAsk: number[] = [];
  const costOverAsk: number[] = [];
  const warmWalkFloor = 0.4;

  // A trade or discount the game escalated to the player HOLDS the deal: no
  // close, no walk, that customer simply stops existing until someone decides.
  // A headless run that ignores them silently loses customers out of every
  // band, so the bot plays them — it takes the ask, which is the decision a
  // player makes when they want the car.
  const heldTrades: string[] = [];
  const heldDiscounts: string[] = [];
  bus.subscribe('trade:escalated', ({ customerId }) => {
    heldTrades.push(customerId);
  });
  bus.subscribe('discount:escalated', (p) => {
    heldDiscounts.push(p.customerId);
    t.discountEscalations += 1;
    // The below-floor population, characterized: how far under our ask the
    // customer actually lands, and how much of the ask our cost eats.
    targetOverAsk.push(p.customerTargetPrice / p.askingPrice);
    costOverAsk.push(p.minimumAcceptablePrice / p.askingPrice);
  });

  bus.subscribe('deal:closed', () => {
    t.closes += 1;
  });
  bus.subscribe('inventory:vehicle_acquired_via_trade', () => {
    t.tradesAcquired += 1;
  });

  bus.subscribe('staff:auto_resolved', (p) => {
    if (p.outcome === 'no_sale' && p.reason) {
      reasons[p.reason] = (reasons[p.reason] ?? 0) + 1;
    }
    if (p.outcome === 'closed') {
      if (p.badReview) t.negativeDeal += 1;
      else t.positive += 1;
      signature.push(`closed:${p.badReview ? 'bad' : 'ok'}`);
      return;
    }
    if (p.reason === 'no_fit') {
      t.inventoryFitWalks += 1;
      signature.push('no_fit');
      return;
    }
    if (p.heat === undefined) {
      t.preProcess += 1;
      signature.push(`pre:${p.reason}`);
      return;
    }
    t.apathetic += 1;
    if (p.heat >= warmWalkFloor) t.warmWalks += 1;
    signature.push(`walk:${p.reason}:${p.heat.toFixed(3)}`);
  });

  let days = 0;
  // Count only the customers a salesperson actually worked — that is the
  // denominator the quadrant bands are measured over, so it is the one the
  // sample size has to be big enough in. Inventory-fit walks are tallied and
  // banded separately and must not stand in for a worked up here.
  const reached = (): number => t.positive + t.negativeDeal + t.apathetic;

  while (reached() < TARGET_RESOLUTIONS && days < MAX_DAYS) {
    capitalize(world);
    hireOneSalesperson(world);
    releaseAgedUnits(world);
    stockLot(world);

    const floor = world.dayLoop.nextDay();
    floor.runDay();
    days += 1;

    // Drain the day's held reviews. Deliberately after the floor rather than
    // inside the event handler — resolving mid-tick would re-enter the bus.
    //
    // Two customers can be held on the SAME unit — a six-space lot makes that
    // routine — and whoever is resolved first drives it away. Since #364 the
    // second one resolves as a no-sale (`vehicle_sold_to_other`) instead of
    // throwing, so every held review is simply played straight.
    for (const customerId of heldTrades.splice(0)) {
      world.resolvePlayerTradeDecision(customerId, { kind: 'accept_ask' });
    }
    for (const customerId of heldDiscounts.splice(0)) {
      world.resolvePlayerDiscountDecision(customerId, { kind: 'accept_ask' });
    }
  }

  const salesperson = world.staffOrg.currentRoster.find(
    (s) => s.role_id === 'salesperson',
  );

  const mean = (xs: number[]): number =>
    xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

  return {
    ...t,
    days,
    signature,
    reasons,
    meanTargetOverAsk: mean(targetOverAsk),
    meanCostOverAsk: mean(costOverAsk),
    consumers: {
      satisfaction: world.reputation.customerSatisfaction,
      reviewScore: world.reputation.reviewScore,
      regulatoryPressure: world.regulatoryMeter.pressure,
      followUpsActive: world.followUpPool.getFollowUps().length,
      followUpsArchived: world.followUpPool.getArchived().length,
      customersServed: world.tierManager.customersServed,
    },
    profile: salesperson
      ? {
          effectiveness: salesperson.effectiveness,
          trustworthiness: salesperson.trustworthiness ?? 0,
        }
      : null,
  };
}

describe('MarketEconomy — live-engine calibration (#180)', () => {
  const run = runCalibration();

  const reached = run.positive + run.negativeDeal + run.apathetic;
  const allResolutions = reached + run.inventoryFitWalks;
  const pPositive = run.positive / reached;
  const pNegativeDeal = run.negativeDeal / reached;
  const pApathetic = run.apathetic / reached;
  const warmWalkShare = run.apathetic === 0 ? 1 : run.warmWalks / run.apathetic;
  const pInventoryFitWalk = run.inventoryFitWalks / allResolutions;
  const tradeRate = run.closes === 0 ? 0 : run.tradesAcquired / run.closes;

  // eslint-disable-next-line no-console
  console.log(
    `[#180 live calibration] days=${run.days} reached=${reached} ` +
      `positive=${(pPositive * 100).toFixed(1)}% ` +
      `apathetic=${(pApathetic * 100).toFixed(1)}% ` +
      `negative-deal=${(pNegativeDeal * 100).toFixed(1)}% ` +
      `warm-walk-share=${(warmWalkShare * 100).toFixed(1)}% ` +
      `no-fit=${(pInventoryFitWalk * 100).toFixed(1)}% ` +
      `closes=${run.closes} trades=${run.tradesAcquired} ` +
      `trade-rate=${(tradeRate * 100).toFixed(1)}% ` +
      `pre-process=${run.preProcess}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `[#180 live calibration] escalations=${run.discountEscalations} ` +
      `targetOverAsk=${run.meanTargetOverAsk.toFixed(3)} ` +
      `costOverAsk=${run.meanCostOverAsk.toFixed(3)} ` +
      `profile=${JSON.stringify(run.profile)} reasons=` +
      Object.entries(run.reasons)
        .sort((a, b) => b[1] - a[1])
        .map(([r, n]) => `${r}:${n}`)
        .join(' '),
  );
  // #363 — the four consumers the live-floor walk bridge reconnected.
  // eslint-disable-next-line no-console
  console.log(
    `[#363 walk consumers] satisfaction=${run.consumers.satisfaction.toFixed(1)} ` +
      `review=${run.consumers.reviewScore.toFixed(1)} ` +
      `regPressure=${run.consumers.regulatoryPressure.toFixed(1)} ` +
      `followUps=${run.consumers.followUpsActive}/${run.consumers.followUpsArchived} ` +
      `customersServed=${run.consumers.customersServed}`,
  );

  const cal = loadMarketCalibrationConfig();

  it('collects a full sample from the live engine', () => {
    expect(reached).toBeGreaterThanOrEqual(TARGET_RESOLUTIONS);
    expect(run.days).toBeLessThan(MAX_DAYS);
  });

  it('every resolution lands in exactly one band', () => {
    expect(pPositive + pNegativeDeal + pApathetic).toBeCloseTo(1, 10);
  });

  it('holds the live positive band', () => {
    expect(pPositive).toBeGreaterThanOrEqual(cal.live.positiveMin);
  });

  it('holds the live apathetic band', () => {
    expect(pApathetic).toBeGreaterThanOrEqual(cal.live.apatheticMin);
    expect(pApathetic).toBeLessThanOrEqual(cal.live.apatheticMax);
  });

  it('holds the live negative-but-deal band', () => {
    expect(pNegativeDeal).toBeGreaterThanOrEqual(cal.live.negativeDealMin);
    expect(pNegativeDeal).toBeLessThanOrEqual(cal.live.negativeDealMax);
  });

  it('non-closes are predominantly warm walks', () => {
    expect(warmWalkShare).toBeGreaterThan(cal.warmWalkMin);
  });

  it('acquires trades at the designed rate', () => {
    expect(tradeRate).toBeGreaterThanOrEqual(cal.tradeAcquisitionMin);
    expect(tradeRate).toBeLessThanOrEqual(cal.tradeAcquisitionMax);
  });

  it('does not lose more of the floor to an unstocked lot than designed', () => {
    expect(pInventoryFitWalk).toBeLessThanOrEqual(cal.inventoryFitWalkMax);
  });

  /**
   * The point of the two band sets. `live` is where the game measurably is;
   * `reference` is the #94 design commitment it should reach. This test does
   * not assert they match — they demonstrably don't yet — it asserts the gap is
   * still *recorded*, so nobody can quietly delete the commitment and call the
   * measured state the target. #286 closes it.
   */
  it('records the gap between the live state and the design commitment', () => {
    expect(cal.reference.positiveMin).toBe(
      loadSalesProcessConfig().calibration.positiveMin,
    );
    expect(cal.live.positiveMin).toBeLessThan(cal.reference.positiveMin);
  });

  it('is deterministic across runs', () => {
    const again = runCalibration();
    expect(again.signature).toEqual(run.signature);
  });
});
