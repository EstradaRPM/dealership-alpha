/**
 * #345 — the balance search loop: Bayesian optimization over the #344 manifest,
 * a resumable study file, a ranked diff report, and the explicit apply step.
 *
 * The optimizer is driven against a SYNTHETIC objective with a known optimum,
 * because a real evaluation is ~7 ms per in-game day × 360 days × N seeds. That
 * is why `runSearch` takes its evaluator injected — the constraint shaped the
 * interface, not the other way round.
 *
 * The synthetic evaluator still goes through `applyCandidate` and reads its
 * inputs back through the live registry before restoring. A stub that scored the
 * candidate object directly would pass every assertion here while proving
 * nothing about whether the search actually moves the values it claims to, or
 * puts them back.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyOverride,
  dataFilePath,
  knownFiles,
  readTunable,
} from '../scripts/balance-harness/overrides';
import {
  applyCandidate,
  currentValue,
  diffSnapshots,
  dimensionById,
  snapshotRegisteredFiles,
  type Candidate,
  type Dimension,
} from '../scripts/balance-harness/searchSpace';
import {
  baselineCandidate,
  candidateToUnit,
  fromUnit,
  rankTrials,
  runSearch,
  toUnit,
  trialDiff,
  type Evaluator,
  type SearchOptions,
} from '../scripts/balance-harness/search';
import { readStudy, type StudyConfig } from '../scripts/balance-harness/study';
import {
  ApplyRefused,
  applyCandidateToDisk,
  findValueSpan,
  planEdits,
  replaceValueInText,
} from '../scripts/balance-harness/applyTuning';
import { expectedImprovement, fitGp } from '../scripts/balance-harness/gp';
import {
  CHEAP_STAGE_FLAG,
  SEARCH_SCORE_LABEL,
  TERM_LABELS,
  formatApplyPlan,
  formatStudyReport,
} from '../scripts/balance-harness/reports';
import { deriveSeeds } from '../scripts/balance-harness/seeds';

/** Three real manifest dimensions, one per registered file involved. */
const DIM_IDS = ['gate.t1.units', 'sourcing.buyThreshold', 'inventory.carrying.insurancePerDay'];
const DIMS: Dimension[] = DIM_IDS.map((id) => dimensionById(id));

/** The known optimum, in unit-box coordinates. */
const OPTIMUM = [0.75, 0.3, 0.6];

const SEEDS = deriveSeeds(1, 8);

function distanceToOptimum(candidate: Candidate): number {
  const x = candidateToUnit(candidate, DIMS);
  return Math.sqrt(x.reduce((s, v, i) => s + (v - OPTIMUM[i]) ** 2, 0));
}

/** Smooth, single-peaked, max 1.0 exactly at OPTIMUM. */
function objectiveOf(unitPoint: readonly number[]): number {
  const d2 = unitPoint.reduce((s, v, i) => s + (v - OPTIMUM[i]) ** 2, 0);
  return Math.exp(-3 * d2);
}

let evaluatorCalls = 0;

const evaluate: Evaluator = (candidate, seeds) => {
  evaluatorCalls++;
  const applied = applyCandidate(candidate, DIMS);
  try {
    // Read the inputs back through the registry: this scores what the loaders
    // would actually see, exactly as the real cohort evaluator does.
    const live = DIMS.map((d) => toUnit(d, currentValue(d)));
    const score = objectiveOf(live);
    return {
      score,
      failureRate: 1 - score,
      terms: {
        medianSurvivalDay: Math.round(360 * score),
        medianTierReached: 1 + 2 * score,
        meanVerdictPassRate: score,
        meanTimeToTierFit: score * 0.9,
        },
    };
  } finally {
    applied.restore();
  }
};

function configFor(seedCount: number, cheapSeedCount: number): StudyConfig {
  return {
    policyId: 'competent',
    maxDays: 120,
    baseSeed: 1,
    seedCount,
    cheapSeedCount,
    dimensionIds: DIM_IDS,
  };
}

function optionsFor(studyPath: string, overrides: Partial<SearchOptions> = {}): SearchOptions {
  const seeds = overrides.seeds ?? SEEDS;
  const cheapSeedCount = overrides.cheapSeedCount ?? seeds.length;
  return {
    studyPath,
    dims: DIMS,
    seeds,
    cheapSeedCount,
    trials: 5,
    initialDesign: 4,
    config: configFor(seeds.length, cheapSeedCount),
    evaluate,
    ...overrides,
  };
}

let tmp: string;
let studyCounter = 0;

function studyFile(): string {
  studyCounter++;
  return join(tmp, `study-${studyCounter}.jsonl`);
}

function trialCountInFile(path: string): number {
  return readFileSync(path, 'utf8').trim().split('\n').length - 1;
}

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'balance-search-'));
});

beforeEach(() => {
  evaluatorCalls = 0;
});

describe('#345 the search varies only the manifest, and never writes data/**', () => {
  it('leaves every registered file byte-identical after a study', () => {
    const before = snapshotRegisteredFiles();
    const onDisk = knownFiles().map((f) => readFileSync(dataFilePath(f), 'utf8'));

    const result = runSearch(optionsFor(studyFile(), { trials: 6 }));
    expect(result.study.trials).toHaveLength(6);

    const after = snapshotRegisteredFiles();
    for (const file of knownFiles()) expect(after[file]).toBe(before[file]);
    expect(diffSnapshots(before, after)).toEqual([]);
    // The study writes its own file and nothing else: data/** on disk is only
    // ever written by the explicit apply step.
    knownFiles().forEach((f, i) => expect(readFileSync(dataFilePath(f), 'utf8')).toBe(onDisk[i]));
  });

  it('proposes only values inside each dimensions declared bound', () => {
    const result = runSearch(optionsFor(studyFile(), { trials: 12, initialDesign: 5 }));
    for (const trial of result.study.trials) {
      for (const dim of DIMS) {
        const value = trial.candidate[dim.id];
        expect(value).toBeGreaterThanOrEqual(dim.range!.min);
        expect(value).toBeLessThanOrEqual(dim.range!.max);
      }
    }
  });
});

describe('#345 the study file', () => {
  it('persists each completed evaluation before starting the next', () => {
    const path = studyFile();
    const seen: number[] = [];
    runSearch(
      optionsFor(path, {
        trials: 4,
        onTrial: () => seen.push(trialCountInFile(path)),
      }),
    );
    // Trial k is on disk by the time the k-th callback fires — an interrupted
    // study loses at most the evaluation in flight.
    expect(seen).toEqual([1, 2, 3, 4]);
    expect(trialCountInFile(path)).toBe(4);
  });

  it('resumes without re-running any completed evaluation', () => {
    const path = studyFile();
    const first = runSearch(optionsFor(path, { trials: 5 }));
    expect(evaluatorCalls).toBe(5);

    evaluatorCalls = 0;
    const second = runSearch(optionsFor(path, { trials: 8 }));
    expect(evaluatorCalls).toBe(3);
    expect(second.study.trials).toHaveLength(8);
    expect(second.evaluated).toBe(3);
    expect(second.study.trials.slice(0, 5)).toEqual(first.study.trials);
  });

  it('re-runs nothing at all when the budget is already met', () => {
    const path = studyFile();
    runSearch(optionsFor(path, { trials: 4 }));
    evaluatorCalls = 0;
    const again = runSearch(optionsFor(path, { trials: 4 }));
    expect(evaluatorCalls).toBe(0);
    expect(again.evaluated).toBe(0);
    expect(again.best).not.toBeNull();
  });

  it('refuses to resume against a changed manifest, naming the mismatch', () => {
    const path = studyFile();
    runSearch(optionsFor(path, { trials: 3 }));

    const widened: Dimension[] = DIMS.map((d) =>
      d.id === 'gate.t1.units' ? { ...d, range: { min: 4, max: 20, step: 1 } } : d,
    );
    expect(() => runSearch(optionsFor(path, { trials: 4, dims: widened }))).toThrow(
      /gate\.t1\.units.*bound.*\[4, 14\].*\[4, 20\]/s,
    );
    // Nothing was appended: the study is still exactly what it was.
    expect(trialCountInFile(path)).toBe(3);
  });

  it('refuses to resume against a different seed cohort', () => {
    const path = studyFile();
    runSearch(optionsFor(path, { trials: 3 }));
    const shorter = SEEDS.slice(0, 4);
    expect(() =>
      runSearch(optionsFor(path, { trials: 4, seeds: shorter, cheapSeedCount: shorter.length })),
    ).toThrow(/different cohort config[\s\S]*seeds/);
  });

  it('records the same trial sequence for the same manifest, seed and budget', () => {
    const a = runSearch(optionsFor(studyFile(), { trials: 7 }));
    const b = runSearch(optionsFor(studyFile(), { trials: 7 }));
    expect(a.study.trials.map((t) => t.candidate)).toEqual(b.study.trials.map((t) => t.candidate));
    expect(a.study.trials.map((t) => t.score)).toEqual(b.study.trials.map((t) => t.score));
  });
});

describe('#345 the optimizer optimizes', () => {
  it('proposes a best candidate closer to the optimum than its initial designs best', () => {
    const result = runSearch(optionsFor(studyFile(), { trials: 30, initialDesign: 6 }));
    expect(result.best).not.toBeNull();
    expect(result.initialBest).not.toBeNull();

    const bestDistance = distanceToOptimum(result.best!.candidate);
    const initialDistance = distanceToOptimum(result.initialBest!.candidate);
    expect(bestDistance).toBeLessThan(initialDistance);
    // And it beat the incumbent it started from — the point of the exercise.
    const baseline = result.study.trials.find((t) => t.source === 'baseline')!;
    expect(result.best!.score).toBeGreaterThan(baseline.score);
  });

  it('models an observed point back to its own value', () => {
    const gp = fitGp([
      { x: [0.2, 0.2], y: 0.3, noise: 1e-8 },
      { x: [0.8, 0.8], y: 0.9, noise: 1e-8 },
    ]);
    const at = gp.predict([0.8, 0.8]);
    expect(at.mean).toBeCloseTo(0.9, 3);
    expect(at.sd).toBeLessThan(0.01);
    // Far from any observation the surrogate is uncertain, which is what makes
    // Expected Improvement explore instead of hill-climbing the first bump.
    const far = gp.predict([0.5, 0.05]);
    expect(far.sd).toBeGreaterThan(at.sd);
    expect(expectedImprovement(far, 0.9)).toBeGreaterThan(expectedImprovement(at, 0.9));
  });
});

describe('#345 adaptive sampling records the seeds behind every score', () => {
  it('screens on a reduced subset and keeps cheap and full scores distinguishable', () => {
    const path = studyFile();
    const result = runSearch(
      optionsFor(path, { trials: 12, initialDesign: 6, cheapSeedCount: 2 }),
    );
    const trials = result.study.trials;
    const cheap = trials.filter((t) => t.stage === 'cheap');
    const full = trials.filter((t) => t.stage === 'full');
    expect(cheap.length).toBeGreaterThan(0);
    expect(full.length).toBeGreaterThan(0);
    expect(cheap.every((t) => t.seedCount === 2)).toBe(true);
    expect(full.every((t) => t.seedCount === SEEDS.length)).toBe(true);

    // The study file carries the distinction, not just the in-memory objects.
    const persisted = readStudy(path).trials;
    expect(persisted.map((t) => [t.stage, t.seedCount])).toEqual(
      trials.map((t) => [t.stage, t.seedCount]),
    );

    // A promoted candidate keeps the cheap screen that earned it the full run.
    const promoted = trials.filter((t) => t.cheapScore !== null && t.stage === 'full');
    expect(promoted.length).toBeGreaterThan(0);

    // And the report says which is which.
    const report = formatStudyReport({ ...result.study, path }, DIMS);
    expect(report).toContain(`seeds=2 (${CHEAP_STAGE_FLAG})`);
    expect(report).toContain(`seeds=${SEEDS.length} (full)`);
  });

  it('never recommends a candidate scored only on the reduced subset', () => {
    const result = runSearch(
      optionsFor(studyFile(), { trials: 12, initialDesign: 6, cheapSeedCount: 2 }),
    );
    expect(result.best!.stage).toBe('full');
    expect(result.best!.seedCount).toBe(SEEDS.length);
    // Nothing cheap outranks it either: if a screen looked best when the budget
    // ran out, it was promoted before the study named a best.
    const top = rankTrials(result.study.trials)[0];
    expect(top.stage).toBe('full');
  });
});

describe('#345 the ranked report', () => {
  it('lists every trial in score order with its four terms and a readable diff', () => {
    const path = studyFile();
    const result = runSearch(optionsFor(path, { trials: 3, initialDesign: 3 }));
    const report = formatStudyReport({ ...result.study, path }, DIMS);

    expect(result.study.trials).toHaveLength(3);
    const ranked = rankTrials(result.study.trials);
    expect(ranked.map((t) => t.score)).toEqual([...ranked.map((t) => t.score)].sort((a, b) => b - a));
    ranked.forEach((trial, rank) => {
      expect(report).toContain(`## #${rank + 1}  trial ${trial.index}`);
    });
    // Rank order in the text matches score order.
    const positions = ranked.map((t) => report.indexOf(`trial ${t.index} (`));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    for (const label of Object.values(TERM_LABELS)) expect(report).toContain(label);

    // #343's rule, carried into this report: the blend never appears before all
    // four of its terms, on any row.
    for (const block of report.split('## ').slice(1)) {
      const blend = block.indexOf(SEARCH_SCORE_LABEL);
      expect(blend).toBeGreaterThan(0);
      for (const label of Object.values(TERM_LABELS)) {
        expect(block.indexOf(label)).toBeLessThan(blend);
      }
    }

    // One `file:path current → proposed` line per varied key.
    const proposal = result.study.trials.find((t) => t.source !== 'baseline')!;
    const diff = trialDiff(proposal.candidate, DIMS);
    expect(diff.length).toBeGreaterThan(0);
    for (const row of diff) {
      expect(report).toContain(`${row.label}`);
      expect(report).toContain(`${row.current} → ${row.proposed}`);
    }
    // The incumbent's row says so rather than printing an empty diff.
    expect(report).toContain('(none — this is the current configuration)');
  });
});

describe('#345 apply is an explicit human step', () => {
  const CANDIDATE: Candidate = {
    'gate.t1.units': 9,
    'sourcing.buyThreshold': 0.55,
    'inventory.carrying.insurancePerDay': 11,
  };

  function withRestoredDataFiles(body: () => void): void {
    const files = [...new Set(DIMS.map((d) => d.file))];
    const original = files.map((f) => readFileSync(dataFilePath(f), 'utf8'));
    const values = DIMS.map((d) => readTunable(d.file, d.path));
    try {
      body();
    } finally {
      files.forEach((f, i) => writeFileSync(dataFilePath(f), original[i]));
      DIMS.forEach((d, i) => applyOverride(d.file, d.path, values[i]));
    }
  }

  it('writes nothing without the confirming flag', () => {
    withRestoredDataFiles(() => {
      const before = knownFiles().map((f) => readFileSync(dataFilePath(f), 'utf8'));
      expect(() => applyCandidateToDisk(CANDIDATE, DIMS, { confirm: false })).toThrow(ApplyRefused);
      knownFiles().forEach((f, i) => expect(readFileSync(dataFilePath(f), 'utf8')).toBe(before[i]));
    });
  });

  it('changes exactly the candidates keys, leaving every other byte alone', () => {
    withRestoredDataFiles(() => {
      const before = Object.fromEntries(
        knownFiles().map((f) => [f, readFileSync(dataFilePath(f), 'utf8')]),
      );
      const edits = applyCandidateToDisk(CANDIDATE, DIMS, { confirm: true });
      expect(edits.map((e) => e.id).sort()).toEqual([...DIM_IDS].sort());

      for (const file of knownFiles()) {
        const after = readFileSync(dataFilePath(file), 'utf8');
        const touched = DIMS.some((d) => d.file === file);
        if (!touched) {
          expect(after).toBe(before[file]);
          continue;
        }
        // A surgical edit, not a reserialization: only the tuned lines move.
        const beforeLines = before[file].split('\n');
        const afterLines = after.split('\n');
        expect(afterLines).toHaveLength(beforeLines.length);
        const changed = afterLines.filter((line, i) => line !== beforeLines[i]);
        expect(changed).toHaveLength(DIMS.filter((d) => d.file === file).length);
      }
      // And the new values are what the loaders read back.
      for (const dim of DIMS) expect(readTunable(dim.file, dim.path)).toBe(CANDIDATE[dim.id]);
    });
  });

  it('refuses when data/** has drifted from the baseline the study measured', () => {
    withRestoredDataFiles(() => {
      const baseline = baselineCandidate(DIMS);
      const drifted = { ...baseline, 'gate.t1.units': baseline['gate.t1.units'] + 1 };
      expect(() => applyCandidateToDisk(CANDIDATE, DIMS, { confirm: true, baseline: drifted })).toThrow(
        /has changed since this study was opened[\s\S]*tier-gate:tiers\.1\.units/,
      );
      expect(readTunable('tier-gate', 'tiers.1.units')).toBe(baseline['gate.t1.units']);
    });
  });

  it('exits non-zero from the CLI when --confirm is missing', () => {
    // The only assertion in this file that has to go through a real process:
    // "writes nothing" is testable in-process, but "exits non-zero" is the CLI
    // contract a calibration script would branch on. No sim runs here — the
    // study was produced by the synthetic evaluator above.
    const path = studyFile();
    const study = runSearch(optionsFor(path, { trials: 3 })).study;
    const proposal = study.trials.find((t) => t.source !== 'baseline')!;
    const before = knownFiles().map((f) => readFileSync(dataFilePath(f), 'utf8'));

    const cli = join(__dirname, '..', 'scripts', 'balance-harness', 'cli.ts');
    let status = 0;
    let output = '';
    try {
      output = execFileSync(
        'npx',
        ['tsx', cli, 'apply', '--study', path, '--trial', String(proposal.index)],
        { encoding: 'utf8', stdio: 'pipe', shell: true },
      );
    } catch (err) {
      const failure = err as { status?: number; stdout?: string; stderr?: string };
      status = failure.status ?? -1;
      output = `${failure.stdout ?? ''}${failure.stderr ?? ''}`;
    }
    expect(status).not.toBe(0);
    expect(output).toContain('Refusing to apply without --confirm');
    knownFiles().forEach((f, i) => expect(readFileSync(dataFilePath(f), 'utf8')).toBe(before[i]));
  }, 120000);

  it('plans only the keys that actually move', () => {
    const unchanged = baselineCandidate(DIMS);
    expect(planEdits(unchanged, DIMS)).toEqual([]);
    expect(formatApplyPlan([])).toContain('nothing to change');
    const one = { ...unchanged, 'sourcing.buyThreshold': 0.6 };
    const plan = planEdits(one, DIMS);
    expect(plan).toHaveLength(1);
    expect(formatApplyPlan(plan)).toContain('sourcing:buyThreshold');
  });
});

describe('#345 the JSON text surgery', () => {
  const SAMPLE = `{
  "schemaVersion": 1,
  "nested": { "a": 1.0, "b": 2 },
  "list": [
    { "id": "first", "cost": 25 },
    { "id": "second", "cost": 40 }
  ]
}
`;

  it('replaces one number and nothing else', () => {
    const out = replaceValueInText(SAMPLE, 'nested.b', 7);
    expect(out).toBe(SAMPLE.replace('"b": 2', '"b": 7'));
    // The sibling that shares a prefix value is untouched.
    expect(out).toContain('"a": 1.0');
  });

  it('addresses an array element positionally', () => {
    const out = replaceValueInText(SAMPLE, 'list.1.cost', 55);
    expect(out).toContain('"id": "second", "cost": 55');
    expect(out).toContain('"id": "first", "cost": 25');
  });

  it('spans the value, not the key', () => {
    const span = findValueSpan(SAMPLE, 'schemaVersion');
    expect(SAMPLE.slice(span.start, span.end)).toBe('1');
  });

  it('refuses a path that does not address a number', () => {
    expect(() => replaceValueInText(SAMPLE, 'nested', 1)).toThrow(/does not address a number/);
  });
});

describe('#345 unit-box mapping', () => {
  it('round-trips a value through the unit box', () => {
    const dim = dimensionById('gate.t1.units');
    expect(fromUnit(dim, toUnit(dim, 9))).toBe(9);
    expect(fromUnit(dim, 0)).toBe(dim.range!.min);
    expect(fromUnit(dim, 1)).toBe(dim.range!.max);
  });

  it('rounds to the precision its step implies', () => {
    const dim = dimensionById('sourcing.buyThreshold'); // step 0.05 → 2 decimals
    const value = fromUnit(dim, 1 / 3);
    expect(String(value)).toMatch(/^\d+(\.\d{1,2})?$/);
  });

  it('snaps a discrete dimension onto a legal member', () => {
    const dim = dimensionById('inventory.inspection.daysToComplete');
    for (const u of [0, 0.2, 0.49, 0.5, 0.9, 1]) {
      expect(dim.values).toContain(fromUnit(dim, u));
    }
  });
});

/** Guards the assumption the whole suite rests on: these ids exist and are ranges. */
describe('#345 fixture dimensions still exist in the manifest', () => {
  it('resolves all three and they are continuous ranges', () => {
    for (const dim of DIMS) {
      expect(dim.range).toBeDefined();
      expect(Number.isFinite(currentValue(dim))).toBe(true);
    }
  });
});
