import { createEventBus } from '../src/game/EventBus';
import { createWorld, type World } from '../src/createWorld';
import { loadStaffTaxonomy } from '../src/game/NPC';
import { loadMarketCalibrationConfig } from '../src/game/MarketEconomy';
import type { CharacterProfile } from '../src/game/CareerProgression';

/**
 * #181 — the early-game FLOOR, measured on the live engine.
 *
 * #180 asked whether the #94 calibration survives contact with the real game,
 * driving `createWorld` with a **competent** operator (the 0.75/0.75 reference
 * profile). This test asks the complementary question: **is there anywhere to
 * climb from?** It runs the same live engine with the green solo operator the
 * career starts you as (0.35/0.40) and pins that the outcomes are measurably
 * worse.
 *
 * That matters because a progression system whose day-1 state already performs
 * like its end state has no progression in it — every skill gate, promotion and
 * hire in `StaffOrg` would be decoration. This test is the guard.
 *
 * ## What the margin is measured against
 *
 * Deliberately **two** comparisons, because they answer different questions:
 *
 * 1. **Against `live` (the #180 measurement).** This is the load-bearing one:
 *    same engine, same seed, same bot, same lot — *only the operator differs*.
 *    A margin here is caused by skill and nothing else, which is exactly the
 *    progression floor #181 exists to pin.
 * 2. **Against `reference` (the #94 design commitment).** Recorded as the
 *    weaker outer bound. #180 established that the live engine does not reach
 *    `reference` yet with *any* operator, so this comparison alone would pass
 *    for the wrong reason; it is asserted so the commitment stays visible, not
 *    as proof of a floor.
 *
 * Both margins live in `data/market-calibration.json#earlyGame`, alongside the
 * bands they are measured against. A band failure here is fixed by tuning
 * `data/`, never by changing code.
 *
 * ## What "green" means here, precisely
 *
 * Cold start: day 1 of a fresh save, no comp history, tier 1, the #296 seed lot
 * and whatever the founder walked in with. The bot hires **one salesperson and
 * pins them green**, never hires a UCM (so no appraisal help, no desking help),
 * never pays for a pre-buy inspection (so every acquisition carries its full
 * recon variance), and leaves the trade policy at its `data/` default. Those
 * are the four things a green player has not bought yet.
 *
 * The operator's *capital* is held at #180's level rather than starved, for
 * #180's reason: this measures the outcome distribution of worked customers,
 * and letting the store go insolvent would shrink N until the bands moved
 * whenever calibration changed. Solvency and pacing are the balance harness's
 * job. Holding capital constant is also what makes comparison (1) clean — skill
 * is then the only axis that differs from the #180 run.
 */

/** The same world stream #180 measured, so only the operator differs. */
const MASTER_SEED = 20260806;

/** Enough worked ups for the distribution to have power (the issue's N). */
const TARGET_RESOLUTIONS = 200;

/**
 * The floor on units the run must put through the lot, so the recon bands
 * cannot silently end up measured over nothing.
 *
 * It is small on purpose, and that is itself the finding: **acquisitions are
 * gated by sales.** A six-space lot only reopens when a unit leaves, and a
 * green operator closes ~3% of worked ups, so the store turns roughly one unit
 * a fortnight — 9 acquisitions in the 110 days this run takes, and only 13 if
 * it is allowed to grind to `MAX_DAYS`. Extending the run to chase a bigger
 * denominator costs 4× the runtime for 4 more units, so it does not.
 *
 * The consequence is stated honestly in the band `_doc`: the tail *rate* is a
 * ceiling guard at this denominator, not a tight measurement, and the mean
 * recon overrun (every unit contributes) is the band that actually has power.
 * Both tighten on their own once #286 makes the lot turn.
 */
const MIN_ACQUISITIONS = 6;

/** Hard stop so a starved world fails loudly instead of spinning. */
const MAX_DAYS = 400;

/**
 * The green solo operator, as raw composites.
 *
 * These are the numbers `data/sales-process.json`'s calibration commentary and
 * the #94 harness both name as the green baseline the competent 0.75/0.75
 * profile is defined *against*. They are raw weighted sums (a salesperson's
 * three skills carry mapped weights summing to 1.5 on each axis), not the 0–1
 * ratio a staff card renders.
 */
const GREEN = { effectiveness: 0.35, trustworthiness: 0.4 } as const;

/** Balance-neutral founder — the same one #180 and the #247 harness run. */
const PROFILE: CharacterProfile = {
  name: 'Early Game Bot',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0.15,
    startingCreditLine: 0,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

/** The test bot's stocking strategy — its parameters, not game balance. */
const BOT = {
  targetLot: 6,
  cashBuffer: 4_000,
  /** See the header: fixed N, so the bands measure one thing. Matches #180. */
  floatFloor: 25_000,
  floatTopUp: 75_000,
} as const;

/**
 * Solve for the per-skill fill fractions that realize a target composite pair.
 *
 * A skill contributes `value/cap × weight` to each composite it maps onto, so a
 * fill fraction `f` per skill gives `E = Σ eᵢfᵢ`, `T = Σ tᵢfᵢ` — two equations,
 * many unknowns. #180 could sidestep this by filling every skill to the same
 * fraction (which lands on the diagonal, `E === T`); a green operator is
 * deliberately *off* the diagonal, better at being trusted than at closing.
 *
 * So parameterize the fill by how the skill leans: `fᵢ = α + β·dᵢ` where
 * `dᵢ = (tᵢ − eᵢ)/(tᵢ + eᵢ)` is that skill's lean toward trustworthiness. Both
 * composites are then linear in `(α, β)` — a 2×2 solve — and the answer is
 * derived from the live catalog rather than hardcoded, so a retuned
 * `data/staff-skills.json` cannot silently move the green profile out from
 * under this test. If it ever becomes unsolvable the realized profile stops
 * matching and `pins the operator to the green profile` fails loudly.
 */
type SkillCatalog = ReturnType<typeof loadStaffTaxonomy>['skills'];

function greenFillFractions(
  skillIds: readonly string[],
  skills: SkillCatalog,
): Record<string, number> {
  const mapped = skillIds
    .map((id) => ({ id, def: skills[id] }))
    .filter((s) => s.def?.composite_mapping !== undefined)
    .map((s) => {
      const e = s.def!.composite_mapping!.effectiveness ?? 0;
      const t = s.def!.composite_mapping!.trustworthiness ?? 0;
      return { id: s.id, e, t, lean: e + t === 0 ? 0 : (t - e) / (t + e) };
    });

  // E = α·Σe + β·Σ(e·lean);  T = α·Σt + β·Σ(t·lean)
  const sum = (f: (s: (typeof mapped)[number]) => number): number =>
    mapped.reduce((acc, s) => acc + f(s), 0);
  const a11 = sum((s) => s.e);
  const a12 = sum((s) => s.e * s.lean);
  const a21 = sum((s) => s.t);
  const a22 = sum((s) => s.t * s.lean);

  const det = a11 * a22 - a12 * a21;
  const alpha =
    (GREEN.effectiveness * a22 - a12 * GREEN.trustworthiness) / det;
  const beta = (a11 * GREEN.trustworthiness - GREEN.effectiveness * a21) / det;

  const fractions: Record<string, number> = {};
  for (const s of mapped) fractions[s.id] = alpha + beta * s.lean;
  return fractions;
}

/** Fill every salesperson's skills to the green operator's profile. */
function pinToGreenProfile(world: World): void {
  const { skills } = loadStaffTaxonomy();
  for (const member of world.staffOrg.currentRoster) {
    if (member.role_id !== 'salesperson') continue;
    const fractions = greenFillFractions(Object.keys(member.skills), skills);
    for (const [skillId, fraction] of Object.entries(fractions)) {
      const def = skills[skillId];
      if (!def) continue;
      member.skills[skillId] = def.cap * fraction;
    }
  }
}

/** Top the float up before the day's decisions — see `BOT.floatFloor`. */
function capitalize(world: World): void {
  if (world.economy.cash >= BOT.floatFloor) return;
  world.economy.postRevenue(BOT.floatTopUp, 'early-game harness float');
}

/**
 * One salesperson, green. Deliberately no UCM: a green store has not unlocked
 * (or afforded) a desk, so appraisals, desking and auto-pricing all run without
 * manager help. That absence is part of what the floor measures.
 */
function hireOneGreenSalesperson(world: World): void {
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
  pinToGreenProfile(world);
}

/**
 * Keep the lot stocked toward what the demand readout says is moving — the same
 * strategy #180 runs, so stocking is not a confounding variable between the two
 * measurements. **`requestInspection` is never called**: a green operator buys
 * blind, which is what puts the full recon tail on the board.
 */
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
  positive: number;
  negativeDeal: number;
  apathetic: number;
  warmWalks: number;
  inventoryFitWalks: number;
  preProcess: number;
  closes: number;
  /** Units that entered the lot by any route — the recon-tail denominator. */
  acquisitions: number;
  /** Recon overruns that crossed into the `major`/`catastrophic` buckets. */
  reconTailHits: number;
  /** Every recon overrun, including `minor` — the tail's context. */
  reconSurprises: number;
  /** Recons that finished, and the realized ÷ estimated cost of each. */
  reconsCompleted: number;
  reconOverrunTotal: number;
  /** Aggregate floorplan + insurance + overhead burn posted over the run. */
  carryingCostTotal: number;
  /** Unit-days that burn covered, so the burn can be read per unit per day. */
  carryingUnitDays: number;
  /** Escalations whose vehicle another customer bought first — see #364. */
  escalationsLostToSoldUnit: number;
}

interface RunOutcome extends Tally {
  days: number;
  signature: string[];
  reasons: Record<string, number>;
  /** The realized green profile, so a failed pin is visible not silent. */
  profile: { effectiveness: number; trustworthiness: number } | null;
  /** Who the store ended up employing — the "no desk" condition, asserted. */
  roles: string[];
}

function runEarlyGameFloor(): RunOutcome {
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
    acquisitions: 0,
    reconTailHits: 0,
    reconSurprises: 0,
    reconsCompleted: 0,
    reconOverrunTotal: 0,
    carryingCostTotal: 0,
    carryingUnitDays: 0,
    escalationsLostToSoldUnit: 0,
  };
  const signature: string[] = [];
  const reasons: Record<string, number> = {};
  const warmWalkFloor = 0.4;

  // An escalation HOLDS the deal: no close, no walk, that customer stops
  // existing until someone decides. A headless run that ignores them silently
  // loses customers out of every band, so the bot plays them — it takes the
  // ask, the decision a player makes when they want the car.
  const heldTrades: string[] = [];
  const heldDiscounts: string[] = [];
  bus.subscribe('trade:escalated', ({ customerId }) => {
    heldTrades.push(customerId);
  });
  bus.subscribe('discount:escalated', ({ customerId }) => {
    heldDiscounts.push(customerId);
  });

  // A recon surprise pauses recon until the player rules. The green operator
  // authorizes — abandoning is the move you learn to make, and taking it here
  // would measure a savvier player than this test is about. Held and drained
  // with the rest so nothing resolves mid-tick.
  const heldRecons: string[] = [];
  bus.subscribe('inventory:recon_surprise', ({ vehicleId, bucket }) => {
    heldRecons.push(vehicleId);
    t.reconSurprises += 1;
    if (bucket === 'major' || bucket === 'catastrophic') t.reconTailHits += 1;
  });

  // What buying blind actually costs, as a continuous measure. The tail-bucket
  // *rate* is a rare event over a lot that only turns when something sells; the
  // mean realized-over-estimated overrun uses every unit and so has power at
  // the denominator this world can actually produce.
  bus.subscribe('inventory:recon_completed', ({ realizedCost, estimate }) => {
    if (estimate <= 0) return;
    t.reconsCompleted += 1;
    t.reconOverrunTotal += realizedCost / estimate;
  });

  bus.subscribe('deal:closed', () => {
    t.closes += 1;
  });
  bus.subscribe('inventory:vehicle_purchased', () => {
    t.acquisitions += 1;
  });
  bus.subscribe('inventory:vehicle_acquired_via_trade', () => {
    t.acquisitions += 1;
  });
  bus.subscribe('economy:carrying_cost_posted', ({ totalCost, vehicleCount }) => {
    t.carryingCostTotal += totalCost;
    t.carryingUnitDays += vehicleCount;
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
  // Only customers a salesperson actually worked — the denominator the quadrant
  // bands are measured over. Inventory-fit walks are banded separately.
  const reached = (): number => t.positive + t.negativeDeal + t.apathetic;

  while (reached() < TARGET_RESOLUTIONS && days < MAX_DAYS) {
    capitalize(world);
    hireOneGreenSalesperson(world);
    stockLot(world);

    const floor = world.dayLoop.nextDay();
    floor.runDay();
    days += 1;

    // Two customers can be held on the SAME unit — a six-space lot makes that
    // routine — and whoever is resolved first drives it away. The second then
    // throws `No lot vehicle`, which is a live defect filed as #364, not
    // something this test can assert around. Count those and carry on: they
    // never reached a band either way, so the distribution is unaffected.
    for (const customerId of heldTrades.splice(0)) {
      try {
        world.resolvePlayerTradeDecision(customerId, { kind: 'accept_ask' });
      } catch {
        t.escalationsLostToSoldUnit += 1;
      }
    }
    for (const customerId of heldDiscounts.splice(0)) {
      try {
        world.resolvePlayerDiscountDecision(customerId, { kind: 'accept_ask' });
      } catch {
        t.escalationsLostToSoldUnit += 1;
      }
    }
    for (const vehicleId of heldRecons.splice(0)) {
      try {
        world.inventory.authorizeReconSpend(vehicleId);
      } catch {
        // The unit left the lot before the bot got to it — nothing to authorize.
      }
    }
  }

  const salesperson = world.staffOrg.currentRoster.find(
    (s) => s.role_id === 'salesperson',
  );

  return {
    ...t,
    days,
    signature,
    reasons,
    roles: world.staffOrg.currentRoster.map((s) => s.role_id),
    profile: salesperson
      ? {
          effectiveness: salesperson.effectiveness,
          trustworthiness: salesperson.trustworthiness ?? 0,
        }
      : null,
  };
}

describe('MarketEconomy — early-game floor (#181)', () => {
  const run = runEarlyGameFloor();

  const reached = run.positive + run.negativeDeal + run.apathetic;
  const allResolutions = reached + run.inventoryFitWalks;
  const pPositive = run.positive / reached;
  const pApathetic = run.apathetic / reached;
  const warmWalkShare = run.apathetic === 0 ? 1 : run.warmWalks / run.apathetic;
  const pInventoryFitWalk = run.inventoryFitWalks / allResolutions;
  const reconTailRate =
    run.acquisitions === 0 ? 0 : run.reconTailHits / run.acquisitions;
  const reconOverrun =
    run.reconsCompleted === 0 ? 1 : run.reconOverrunTotal / run.reconsCompleted;
  const carryingPerUnitDay =
    run.carryingUnitDays === 0 ? 0 : run.carryingCostTotal / run.carryingUnitDays;

  // eslint-disable-next-line no-console
  console.log(
    `[#181 early-game floor] days=${run.days} reached=${reached} ` +
      `positive=${(pPositive * 100).toFixed(1)}% ` +
      `apathetic=${(pApathetic * 100).toFixed(1)}% ` +
      `warm-walk-share=${(warmWalkShare * 100).toFixed(1)}% ` +
      `no-fit=${(pInventoryFitWalk * 100).toFixed(1)}% ` +
      `closes=${run.closes} pre-process=${run.preProcess}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `[#181 early-game floor] acquisitions=${run.acquisitions} ` +
      `recon-surprises=${run.reconSurprises} tail-hits=${run.reconTailHits} ` +
      `tail-rate=${(reconTailRate * 100).toFixed(1)}% ` +
      `recons-completed=${run.reconsCompleted} ` +
      `mean-overrun=${reconOverrun.toFixed(3)}× ` +
      `lost-to-sold-unit=${run.escalationsLostToSoldUnit} ` +
      `carrying=$${Math.round(run.carryingCostTotal)} over ` +
      `${run.carryingUnitDays} unit-days = $${carryingPerUnitDay.toFixed(2)}/unit/day ` +
      `profile=${JSON.stringify(run.profile)} reasons=` +
      Object.entries(run.reasons)
        .sort((a, b) => b[1] - a[1])
        .map(([r, n]) => `${r}:${n}`)
        .join(' '),
  );

  const cal = loadMarketCalibrationConfig();
  const early = cal.earlyGame;

  it('collects a full sample from a cold-start green world', () => {
    expect(reached).toBeGreaterThanOrEqual(TARGET_RESOLUTIONS);
    expect(run.days).toBeLessThan(MAX_DAYS);
  });

  it('pins the operator to the green profile', () => {
    expect(run.profile).not.toBeNull();
    expect(run.profile!.effectiveness).toBeCloseTo(GREEN.effectiveness, 6);
    expect(run.profile!.trustworthiness).toBeCloseTo(GREEN.trustworthiness, 6);
  });

  it('runs the whole window without a desk', () => {
    // The floor is measured with no used-car manager: no auto-pricing, no
    // desking help, no sharpened appraisal, and every acquisition bought blind.
    // A UCM appearing would mean the bot grew a capability the green player has
    // not bought, and every number above would be measuring a different store.
    expect(run.roles).toEqual(['salesperson']);
  });

  it('holds the early-game positive band', () => {
    expect(pPositive).toBeGreaterThanOrEqual(early.positiveMin);
    expect(pPositive).toBeLessThanOrEqual(early.positiveMax);
  });

  it('holds the early-game apathetic band', () => {
    expect(pApathetic).toBeGreaterThanOrEqual(early.apatheticMin);
    expect(pApathetic).toBeLessThanOrEqual(early.apatheticMax);
  });

  it('closes below the competent operator by the stated margin', () => {
    // The load-bearing floor assertion: same engine, same seed, same bot, same
    // stocking rule — only the operator's skill differs from #180's run. A
    // green store measurably underperforms a competent one, so the career has
    // somewhere to climb to.
    expect(pPositive).toBeLessThanOrEqual(
      cal.live.positiveMin - early.marginBelowLive,
    );
  });

  it('closes below the design commitment by the stated margin', () => {
    // The weaker outer bound, recorded so the #94 commitment stays visible.
    // #180 established the live engine does not reach it with any operator yet,
    // so this passes for a reason that is not the floor — see the header.
    expect(pPositive).toBeLessThanOrEqual(
      cal.reference.positiveMin - early.marginBelowReference,
    );
  });

  it('takes recon tail hits at the designed early-game rate', () => {
    // Buying blind is what a green operator does; this is the price of it. The
    // denominator is pinned too — a lot that stops turning would otherwise
    // shrink it until the rate meant nothing.
    expect(run.acquisitions).toBeGreaterThanOrEqual(MIN_ACQUISITIONS);
    expect(reconTailRate).toBeGreaterThanOrEqual(early.reconTailRateMin);
    expect(reconTailRate).toBeLessThanOrEqual(early.reconTailRateMax);
  });

  it('overruns its recon estimates at the designed early-game rate', () => {
    // The continuous companion to the tail rate: every unit contributes, so
    // this is the band that actually moves if the variance model is retuned.
    expect(reconOverrun).toBeGreaterThanOrEqual(early.reconOverrunMin);
    expect(reconOverrun).toBeLessThanOrEqual(early.reconOverrunMax);
  });

  it('burns carrying cost at the designed early-game rate', () => {
    // Per unit per day, so the band reads the lot's burn rather than how long
    // the harness happened to run or how many units it happened to hold.
    expect(carryingPerUnitDay).toBeGreaterThanOrEqual(
      early.carryingCostPerUnitDayMin,
    );
    expect(carryingPerUnitDay).toBeLessThanOrEqual(
      early.carryingCostPerUnitDayMax,
    );
  });

  it('does not lose more of the floor to an unstocked lot than designed', () => {
    expect(pInventoryFitWalk).toBeLessThanOrEqual(cal.inventoryFitWalkMax);
  });

  it('is deterministic across runs', () => {
    const again = runEarlyGameFloor();
    expect(again.signature).toEqual(run.signature);
  });
});
