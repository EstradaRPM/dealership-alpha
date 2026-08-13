import fs from 'fs';
import path from 'path';
import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createInventory, loadVehicleData } from '../src/game/Inventory';
import type { LotVehicle } from '../src/game/Inventory';
import {
  applyReconJudgment,
  bucketProbabilities,
  loadReconVarianceConfig,
} from '../src/game/MarketEconomy';
import {
  createReputation,
  loadReputationConfig,
  withOpeningPenalty,
} from '../src/game/Reputation';
import { createWorld } from '../src/createWorld';
import { getDay1Modifier } from '../src/game/CareerProgression';
import type { BackstoryId, CharacterProfile } from '../src/game/CareerProgression';

/**
 * #390 — the two Day 1 levers that plug into machinery the game already has.
 *
 * Before this slice all three backstories were mechanically identical: the
 * catalog declared four levers and `day1Modifier` was read by nothing. These
 * tests are what stops that being true again.
 */

const VEHICLE_DATA = loadVehicleData();
const CFG = loadReconVarianceConfig();
const NO_OVERNIGHT = { weeklyRent: 0 };

function profileFor(id: BackstoryId): CharacterProfile {
  return { name: `${id} founder`, backstoryId: id, day1Modifier: getDay1Modifier(id) };
}

/** A founder with every lever at zero — the pre-#390 world, by construction. */
const NEUTRAL: CharacterProfile = {
  name: 'No Edge',
  backstoryId: 'ex-banker',
  day1Modifier: {
    backstoryId: 'ex-banker',
    reconJudgmentBonus: 0,
    startingCreditLine: 0,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

describe('startingCapitalBonus reaches the store (#390)', () => {
  it('the inheritor opens with $75,000', () => {
    const seed = 4_242;
    const neutral = createWorld({
      bus: createEventBus(),
      masterSeed: seed,
      characterProfile: NEUTRAL,
    });
    const inheritor = createWorld({
      bus: createEventBus(),
      masterSeed: seed,
      characterProfile: profileFor('inheritor'),
    });
    // Read at the ledger rather than off a constant: `createWorld` plays the
    // cold-start prep tick, so a fresh store has already accrued a day of
    // floorplan carry on its #296 seed units. The claim being made is that the
    // inheritor starts $25,000 ahead of an identical store — 50k + 25k — not
    // that the number on screen is a round 75,000 the moment the world exists.
    expect(getDay1Modifier('inheritor').startingCapitalBonus).toBe(25_000);
    expect(inheritor.economy.cash - neutral.economy.cash).toBe(25_000);
    expect(neutral.economy.cash).toBeLessThanOrEqual(50_000);
    expect(inheritor.economy.cash).toBeGreaterThan(50_000);
  });
});

// ── The founder's eye ────────────────────────────────────────────────────────

function lotAfterBuyingTheBoard(
  masterSeed: number,
  reconJudgmentBonus: number | undefined,
): LotVehicle[] {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay: 0 });
  const economy = createEconomy({
    bus,
    startingCash: 5_000_000,
    config: NO_OVERNIGHT,
  });
  const inventory = createInventory({
    bus,
    masterSeed,
    economy,
    vehicleData: VEHICLE_DATA,
    ...(reconJudgmentBonus === undefined ? {} : { reconJudgmentBonus }),
  });
  const bought: LotVehicle[] = [];
  // Ten boards, bought out. One day's board is too small a sample to say
  // anything about a tail; ten is enough that the shift is a fact rather than
  // a coin flip, and the lot is uncapped in this harness (no Facility wired).
  for (let day = 0; day < 10; day += 1) {
    clock.advanceDay();
    for (const listing of inventory.getAuctionListings()) {
      inventory.buyFromAuction(listing.id);
      bought.push(inventory.getLotVehicle(listing.id)!);
    }
  }
  return bought;
}

describe("the ex-mechanic's floor shrinks the recon surprise tail (#390)", () => {
  it('the rule itself is a lift with a ceiling of 1', () => {
    expect(applyReconJudgment(0.5, 0.15)).toBeCloseTo(0.65, 10);
    expect(applyReconJudgment(0.95, 0.15)).toBe(1);
    expect(applyReconJudgment(0.5, 0)).toBe(0.5);
  });

  it('a better-read car throws a smaller tail at the sampler', () => {
    // The mechanism, stated where it is decided: the same car read 0.15 better
    // carries less probability in the three surprise buckets.
    //
    // The effect is BANDED, because #162's model is: `sourceReliabilityFactors`
    // is keyed low / mid / high, so the lift bites when it carries a source over
    // a boundary (0.50 and 0.70) and does nothing inside one. That is a property
    // of the recon model this rides on, not a limit of the lever — and it is why
    // the lever is worth 0.15 rather than 0.02. Both boundaries are asserted.
    const car = { condition: 'average', mileage: 90_000 } as const;
    for (const from of [0.45, 0.6]) {
      const plain = bucketProbabilities({ ...car, sourceReliability: from }, CFG);
      const read = bucketProbabilities(
        { ...car, sourceReliability: applyReconJudgment(from, 0.15) },
        CFG,
      );
      expect(read.within).toBeGreaterThan(plain.within);
      expect(read.major + read.catastrophic).toBeLessThan(
        plain.major + plain.catastrophic,
      );
    }
  });

  it("the ex-mechanic's floor shrinks the recon surprise tail on the same seed", () => {
    const seed = 9_001;
    const plain = lotAfterBuyingTheBoard(seed, 0);
    const mechanic = lotAfterBuyingTheBoard(
      seed,
      getDay1Modifier('ex-mechanic').reconJudgmentBonus,
    );

    // Same seed, same board: the cars are identical, only what they hide moves.
    expect(mechanic.map((v) => v.id)).toEqual(plain.map((v) => v.id));
    expect(plain.length).toBeGreaterThan(20);

    const tail = (lot: LotVehicle[]) =>
      lot.filter((v) => v.reconBucket !== 'within').length;
    const spend = (lot: LotVehicle[]) =>
      lot.reduce((sum, v) => sum + v.reconRealizedCost, 0);

    expect(tail(mechanic)).toBeLessThan(tail(plain));
    expect(spend(mechanic)).toBeLessThan(spend(plain));
  });

  it('the eye is on the ROLL INPUT, not the RNG stream — the same board comes up', () => {
    // Every unit that did not change bucket realized exactly the same cost, so
    // the founder's edge cannot be re-rolling the world. This is what keeps the
    // balance harness comparable across runs.
    const seed = 9_002;
    const plain = lotAfterBuyingTheBoard(seed, 0);
    const mechanic = lotAfterBuyingTheBoard(seed, 0.15);
    const unchanged = plain.filter((v, i) => v.reconBucket === mechanic[i].reconBucket);
    expect(unchanged.length).toBeGreaterThan(0);
    for (const v of unchanged) {
      const other = mechanic.find((m) => m.id === v.id)!;
      expect(other.reconRealizedCost).toBe(v.reconRealizedCost);
    }
  });
});

describe('a zero lever is the pre-#390 world (#390)', () => {
  it('a zero lever is byte-identical on the same seed', () => {
    const seed = 5_150;
    const declared = lotAfterBuyingTheBoard(seed, 0);
    // `undefined` = the dep omitted entirely, which is every test harness and
    // every founder before this slice existed.
    const omitted = lotAfterBuyingTheBoard(seed, undefined);
    expect(declared).toEqual(omitted);
  });

  it('a founder with no capital bonus opens exactly where a founder with no modifier does', () => {
    const seed = 5_151;
    const banker = createWorld({
      bus: createEventBus(),
      masterSeed: seed,
      characterProfile: profileFor('ex-banker'),
    });
    const neutral = createWorld({
      bus: createEventBus(),
      masterSeed: seed,
      characterProfile: NEUTRAL,
    });
    expect(banker.economy.cash).toBe(neutral.economy.cash);
  });
});

// ── The Inheritor's town ─────────────────────────────────────────────────────

const REP_CONFIG = loadReputationConfig();

/**
 * A standing opened straight off a config — no world, no floor, no drift, so
 * what moves it is only what this test publishes.
 */
function openStanding(grudged: boolean) {
  const bus = createEventBus();
  const config = grudged ? withOpeningPenalty(REP_CONFIG) : REP_CONFIG;
  return { bus, reputation: createReputation({ bus, config }) };
}

function closeADeal(bus: ReturnType<typeof createEventBus>): void {
  bus.publish('deal:closed', {
    customerId: 'c1',
    vehicleId: 'v1',
    agreedPrice: 25_000,
    frontGross: 2_000,
    backGross: 800,
    productGross: 800,
    reserveGross: 0,
    daysInInventory: 0,
    paymentMethod: 'cash',
    downPayment: 25_000,
    loanAmount: 0,
    term: 0,
    apr: 0,
  });
}

function walkAnUp(bus: ReturnType<typeof createEventBus>): void {
  bus.publish('customer:resolved', {
    customerId: 'c1',
    outcome: 'walk',
    receptivity: 0,
    satisfaction: 0,
    retentionSeed: 0,
    heat: 0,
    agreedPrice: 0,
    frontGross: 0,
  });
}

describe("the inheritor opens under the town's grudge (#391)", () => {
  it("the inheritor opens with the town's grudge", () => {
    const seed = 7_391;
    const neutral = createWorld({
      bus: createEventBus(),
      masterSeed: seed,
      characterProfile: NEUTRAL,
    });
    const inheritor = createWorld({
      bus: createEventBus(),
      masterSeed: seed,
      characterProfile: profileFor('inheritor'),
    });
    expect(getDay1Modifier('inheritor').grudgesFlag).toBe(true);
    expect(REP_CONFIG.startingStandingPenalty).toBeGreaterThan(0);
    // Read as a delta between two same-seed worlds rather than against the raw
    // tunable: the claim is that this founder opens BEHIND an otherwise
    // identical store, which is what the player feels — fewer people walk in,
    // because `getDailyDemand` scales on the review score.
    expect(neutral.reputation.reviewScore - inheritor.reputation.reviewScore).toBeCloseTo(
      REP_CONFIG.startingStandingPenalty,
      6,
    );
    expect(
      neutral.reputation.customerSatisfaction - inheritor.reputation.customerSatisfaction,
    ).toBeGreaterThan(0);
  });

  it('a clean backstory opens neutral', () => {
    const seed = 7_392;
    for (const id of ['ex-mechanic', 'ex-banker'] as const) {
      expect(getDay1Modifier(id).grudgesFlag).toBe(false);
      const world = createWorld({
        bus: createEventBus(),
        masterSeed: seed,
        characterProfile: profileFor(id),
      });
      expect(world.reputation.reviewScore).toBe(REP_CONFIG.startingReviewScore);
      expect(world.reputation.customerSatisfaction).toBe(REP_CONFIG.startingSatisfaction);
    }
  });

  it('the same good month moves both careers equally', () => {
    // The deficit is an opening POSITION. Nothing above it is scaled, so the
    // same month of trading has to move both stores by the same amount — and
    // the gap between them can only close, never widen.
    const clean = openStanding(false);
    const grudged = openStanding(true);
    const opening = clean.reputation.reviewScore - grudged.reputation.reviewScore;
    expect(opening).toBeCloseTo(REP_CONFIG.startingStandingPenalty, 6);

    // A month a T1 store actually has: eight units out, and the ups that
    // walked — deliberately not thirty straight closes, which would drive the
    // clean store into the 100 ceiling and have the clamp, rather than the
    // mechanic, be what the assertion sees.
    let gap = opening;
    for (let day = 1; day <= 30; day += 1) {
      const before = [clean.reputation.reviewScore, grudged.reputation.reviewScore] as const;
      for (const store of [clean, grudged]) {
        if (day % 4 === 0) closeADeal(store.bus);
        walkAnUp(store.bus);
        walkAnUp(store.bus);
      }
      // The day moved both by the identical amount — no multiplier rides on
      // the grudge.
      expect(clean.reputation.reviewScore - before[0]).toBeCloseTo(
        grudged.reputation.reviewScore - before[1],
        10,
      );
      clean.bus.publish('clock:overnight_reputation_drift', { day });
      grudged.bus.publish('clock:overnight_reputation_drift', { day });
      const next = clean.reputation.reviewScore - grudged.reputation.reviewScore;
      expect(next).toBeLessThanOrEqual(gap + 1e-9);
      gap = next;
    }
    // A month of the same trading has the grudged store climbing out of it,
    // not carrying it.
    expect(gap).toBeLessThan(opening);
    expect(gap).toBeGreaterThan(0);
  });
});

// ── The picks must not leak into the engine ──────────────────────────────────

const GAME_DIR = path.join(__dirname, '..', 'src', 'game');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const gameFiles = sourceFiles(GAME_DIR);

/**
 * `CareerProgression` owns the catalog. Two other modules are DECLARED readers
 * of the id, and both read it for something other than a mechanic:
 *
 * - `EndCard` — `getFlavorText(reason, backstoryId)` picks the sentence a career
 *   ends on. Narrative copy, no rule branches on it.
 * - `SaveStore` — the persisted character profile carries the id, because a
 *   reloaded career is the same person. It is a field in a save shape, not a
 *   read.
 *
 * That is the line this scan is drawn at: the ruling is that the *modifier* is
 * resolved in `createWorld` and every module below it takes plain numbers — not
 * that the founder's name is a secret. A fourth module appearing here is a
 * mechanic being written against the pick, which is what this fails over.
 */
const DECLARED_READERS = [
  path.join('src', 'game', 'CareerProgression'),
  path.join('src', 'game', 'EndCard'),
  path.join('src', 'game', 'SaveStore'),
];

const BACKSTORY_ID = /backstoryId|'ex-mechanic'|'ex-banker'|'inheritor'/;
/**
 * The modifier itself. `reconJudgmentBonus` is deliberately NOT in this pattern:
 * it is the one lever that means something on its own — a number added to an
 * appraisal's reliability — and `Inventory` declares it as exactly that, a dep
 * it could be handed by anything. The other four are meaningless outside a
 * backstory, so a module naming one of them is a module that learned about the
 * pick.
 */
const THE_MODIFIER =
  /day1Modifier|startingCapitalBonus|startingCreditLine|grudgesFlag/;

describe('no game module learns what a backstory is (#390)', () => {
  it('the scan sees the module tree (a scan of nothing passes everything)', () => {
    expect(gameFiles.length).toBeGreaterThan(50);
  });

  it.each(
    gameFiles.filter((f) => !DECLARED_READERS.some((d) => f.includes(d))),
  )('%s reads no backstory id', (file) => {
    const src = fs.readFileSync(file, 'utf8');
    const offenders = src
      .split('\n')
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => BACKSTORY_ID.test(line) && !/^\s*(\*|\/\/)/.test(line));
    expect(offenders).toEqual([]);
  });

  it.each(
    gameFiles.filter((f) => !f.includes(path.join('src', 'game', 'CareerProgression'))),
  )('%s reads no Day 1 modifier', (file) => {
    // Only `CareerProgression` (which owns the shape) and `createWorld` (which
    // resolves it, and is not under `src/game/**`) may touch the modifier.
    const src = fs.readFileSync(file, 'utf8');
    const offenders = src
      .split('\n')
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => THE_MODIFIER.test(line) && !/^\s*(\*|\/\/)/.test(line));
    expect(offenders).toEqual([]);
  });
});
