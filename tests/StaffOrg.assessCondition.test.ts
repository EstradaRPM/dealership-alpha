import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import {
  createStaffOrg,
  computeConditionRead,
  type StaffOrgConfig,
  type ConditionAssessInput,
  type ConditionReadConfig,
} from '../src/game/StaffOrg';
import { loadStaffTaxonomy, loadStaffArchetypes } from '../src/game/NPC';
import { slotsEverywhere } from './helpers/staffSlots';

const MASTER_SEED = 99;
const taxonomy = loadStaffTaxonomy();
const archetypes = loadStaffArchetypes();

const READ_CFG: ConditionReadConfig = {
  minHalfWidthFraction: 0.10,
  maxHalfWidthFraction: 0.80,
  maxBiasFraction: 0.50,
  widthSkillExponent: 0.7,
};

const NO_OVERHEAD = { weeklyRent: 0, weeklyPayrollStub: 0 };
const CHEAP_CONFIG: StaffOrgConfig = {
  hiringCostByTier: { worker: 100, 'customer-facing': 200, manager: 500, gm: 1000 },
  candidatesPerRole: 3,
  conditionRead: READ_CFG,
};

const REALIZED = 1500;
const ESTIMATE = 1000;
const SAMPLE_VEHICLE: ConditionAssessInput = {
  id: 'auction-day1-0-honda_civic',
  reconEstimate: ESTIMATE,
  condition: 'average',
  mileage: 60_000,
  sourceId: 'manheim_digital',
};

function makeSetup(opts: { withTruthSeam?: boolean } = {}) {
  const bus = createEventBus();
  const clock = createGameClock({ bus });
  const economy = createEconomy({ bus, startingCash: 50_000, config: NO_OVERHEAD });
  const staffOrg = createStaffOrg({
    bus,
    economy,
    masterSeed: MASTER_SEED,
    taxonomy,
    archetypes,
    config: CHEAP_CONFIG,
    // Not a scarcity test — two UCMs on the roster is the tie-break case (#352).
    slots: slotsEverywhere(9),
    realizedReconFor: opts.withTruthSeam === false ? undefined : () => REALIZED,
  });
  return { bus, clock, economy, staffOrg };
}

function hireUcm(setup: ReturnType<typeof makeSetup>, archetypeId: string): string {
  setup.clock.advanceDay();
  const candidates = setup.staffOrg.getCandidates('used-car-manager');
  const match = candidates.find((c) => c.archetypeId === archetypeId)!;
  setup.staffOrg.hire(match.candidateId);
  return match.staff.id;
}

describe('StaffOrg.assessCondition (#163)', () => {
  it('returns null when no UCM is on staff', () => {
    const setup = makeSetup();
    expect(setup.staffOrg.assessCondition(SAMPLE_VEHICLE)).toBeNull();
  });

  it('returns null when the truth seam is not wired (even with UCM on roster)', () => {
    const setup = makeSetup({ withTruthSeam: false });
    hireUcm(setup, 'veteran_used_car_manager');
    expect(setup.staffOrg.assessCondition(SAMPLE_VEHICLE)).toBeNull();
  });

  it('returns a read with all required fields when a UCM is hired', () => {
    const setup = makeSetup();
    hireUcm(setup, 'entry_used_car_manager');
    const read = setup.staffOrg.assessCondition(SAMPLE_VEHICLE);
    expect(read).not.toBeNull();
    expect(read!.estimatedReconLow).toBeGreaterThanOrEqual(0);
    expect(read!.estimatedReconHigh).toBeGreaterThanOrEqual(read!.estimatedReconLow);
    expect(read!.confidence).toBeGreaterThanOrEqual(0);
    expect(read!.confidence).toBeLessThanOrEqual(1);
  });

  it('high-skill UCM produces a narrower band than low-skill (statistical, N=64)', () => {
    // Sample width across distinct vehicle ids — the per-vehicle bias roll
    // averages out and the deterministic band-width term dominates.
    function avgWidth(skill: number): number {
      let sum = 0;
      for (let i = 0; i < 64; i++) {
        const read = computeConditionRead(
          { realizedRecon: REALIZED, estimate: ESTIMATE, skill, seed: i + 1 },
          READ_CFG,
        );
        sum += read.estimatedReconHigh - read.estimatedReconLow;
      }
      return sum / 64;
    }
    const low = avgWidth(20);
    const high = avgWidth(90);
    expect(high).toBeLessThan(low);
  });

  it('high-skill UCM produces a smaller center-vs-realized error on average than low-skill', () => {
    function avgBias(skill: number): number {
      let sum = 0;
      for (let i = 0; i < 200; i++) {
        const read = computeConditionRead(
          { realizedRecon: REALIZED, estimate: ESTIMATE, skill, seed: i + 1 },
          READ_CFG,
        );
        const center = (read.estimatedReconLow + read.estimatedReconHigh) / 2;
        sum += Math.abs(center - REALIZED);
      }
      return sum / 200;
    }
    expect(avgBias(90)).toBeLessThan(avgBias(20));
  });

  it('confidence scales monotonically with skill', () => {
    const lowRead = computeConditionRead(
      { realizedRecon: REALIZED, estimate: ESTIMATE, skill: 10, seed: 1 },
      READ_CFG,
    );
    const midRead = computeConditionRead(
      { realizedRecon: REALIZED, estimate: ESTIMATE, skill: 55, seed: 1 },
      READ_CFG,
    );
    const highRead = computeConditionRead(
      { realizedRecon: REALIZED, estimate: ESTIMATE, skill: 95, seed: 1 },
      READ_CFG,
    );
    expect(midRead.confidence).toBeGreaterThan(lowRead.confidence);
    expect(highRead.confidence).toBeGreaterThan(midRead.confidence);
  });

  it('deterministic: same seed + vehicle + staff → identical read', () => {
    const setupA = makeSetup();
    hireUcm(setupA, 'veteran_used_car_manager');
    const setupB = makeSetup();
    hireUcm(setupB, 'veteran_used_car_manager');
    const readA = setupA.staffOrg.assessCondition(SAMPLE_VEHICLE);
    const readB = setupB.staffOrg.assessCondition(SAMPLE_VEHICLE);
    expect(readA).toEqual(readB);
  });

  it('different UCMs reading the same vehicle produce different reads', () => {
    const setup = makeSetup();
    // Hire one UCM, read, fire, hire a different archetype, re-read.
    const s1 = hireUcm(setup, 'entry_used_car_manager');
    const r1 = setup.staffOrg.assessCondition(SAMPLE_VEHICLE)!;
    setup.staffOrg.fire(s1);
    hireUcm(setup, 'veteran_used_car_manager');
    const r2 = setup.staffOrg.assessCondition(SAMPLE_VEHICLE)!;
    // At minimum the seed differs (different staff id), and the veteran's
    // confidence is meaningfully higher.
    expect(r2.confidence).toBeGreaterThan(r1.confidence);
  });

  it('picks the highest-skilled UCM when multiple are on the roster', () => {
    const setup = makeSetup();
    const sEntry = hireUcm(setup, 'entry_used_car_manager');
    const sVet = hireUcm(setup, 'veteran_used_car_manager');
    const read = setup.staffOrg.assessCondition(SAMPLE_VEHICLE)!;
    // The veteran archetype rolls condition_reading ~78±7; entry rolls ~42±10
    // → the veteran should always win the skill comparison at this seed.
    // Confirm by hiring/firing inverse: with only the entry on roster the
    // confidence should be lower.
    setup.staffOrg.fire(sVet);
    const readEntryOnly = setup.staffOrg.assessCondition(SAMPLE_VEHICLE)!;
    expect(read.confidence).toBeGreaterThan(readEntryOnly.confidence);
    // Sanity: also higher than entry alone.
    setup.staffOrg.fire(sEntry);
    expect(setup.staffOrg.assessCondition(SAMPLE_VEHICLE)).toBeNull();
  });

  it('ignores non-UCM staff even if they happen to have a condition_reading skill record', () => {
    // No non-UCM archetype carries condition_reading currently, so simply hiring
    // an unrelated role must yield null (no UCM on roster).
    const setup = makeSetup();
    setup.clock.advanceDay();
    const sales = setup.staffOrg.getCandidates('salesperson');
    setup.staffOrg.hire(sales[0].candidateId);
    expect(setup.staffOrg.assessCondition(SAMPLE_VEHICLE)).toBeNull();
  });
});

describe('computeConditionRead — pure math (#163)', () => {
  it('band centers near realized at high skill', () => {
    const read = computeConditionRead(
      { realizedRecon: 2000, estimate: 1000, skill: 95, seed: 7 },
      READ_CFG,
    );
    const center = (read.estimatedReconLow + read.estimatedReconHigh) / 2;
    // At skill=95: maxBias ≈ 0.05 × 500 = 25 absolute, halfWidth ≈ 138.
    expect(Math.abs(center - 2000)).toBeLessThan(50);
  });

  it('band clamps low end at 0', () => {
    const read = computeConditionRead(
      { realizedRecon: 100, estimate: 1000, skill: 5, seed: 3 },
      READ_CFG,
    );
    expect(read.estimatedReconLow).toBeGreaterThanOrEqual(0);
  });

  it('max-skill read has min-half-width band', () => {
    const read = computeConditionRead(
      { realizedRecon: 1500, estimate: 1000, skill: 100, seed: 11 },
      READ_CFG,
    );
    const width = read.estimatedReconHigh - read.estimatedReconLow;
    // 2 × minHalfWidthFraction × estimate = 200 (give 2 for rounding)
    expect(width).toBeGreaterThanOrEqual(200 - 2);
    expect(width).toBeLessThanOrEqual(200 + 2);
  });

  it('zero-skill read has max-half-width band', () => {
    const read = computeConditionRead(
      { realizedRecon: 1500, estimate: 1000, skill: 0, seed: 11 },
      READ_CFG,
    );
    const width = read.estimatedReconHigh - read.estimatedReconLow;
    expect(width).toBeGreaterThanOrEqual(2 * 800 - 2);
    expect(width).toBeLessThanOrEqual(2 * 800 + 2);
  });
});
