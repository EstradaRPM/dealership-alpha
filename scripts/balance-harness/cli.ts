/**
 * CLI for the #247 headless balance harness.
 *
 *   npm run balance -- pacing  [--policy naive|competent|optimal|all] [--seeds N] [--maxDays N] [--baseSeed N] [--out FILE]
 *   npm run balance -- sweep   --tunable FILE:dot.path --range MIN,MAX,STEPS [--policy P] [--seeds N] [--maxDays N] [--baseSeed N] [--out FILE]
 *   npm run balance -- calib   --metric cash|lotCount|lotValue|cumUnits|tier|csi [--policy P] [--seeds N] [--maxDays N] [--baseSeed N] [--out FILE]
 *   npm run balance -- space   [--out FILE]   # the searchable tunable manifest (#344)
 *   npm run balance -- search  --study FILE [--dims a,b,…] [--trials N] [--initial N] [--seeds N] [--cheapSeeds N] [--policy P] [--maxDays N] [--baseSeed N] [--out FILE]
 *   npm run balance -- apply   --study FILE --trial N [--confirm]
 *
 * The acceptance command (a 100-seed competent pacing run against the current
 * tunables) is simply:  npm run balance -- pacing
 *
 * Determinism: every report is a pure function of (mode, policy, baseSeed,
 * seeds, maxDays, tunables) — the seed cohort derives from baseSeed and the sim
 * is fully seeded, so re-running with the same flags yields byte-identical
 * output. Progress goes to stderr; the report goes to stdout (or --out).
 */
import { writeFileSync } from 'node:fs';
import { deriveSeeds } from './seeds';
import { POLICIES, policyById, type Policy } from './policies';
import { runCohort } from './runner';
import {
  formatApplyPlan,
  formatCalibCsv,
  formatPacing,
  formatSearchSpace,
  formatStudyReport,
  formatSweep,
  isMetric,
  metricNames,
  summarizePacing,
  type SweepRow,
} from './reports';
import {
  SEARCH_SPACE,
  describeSpace,
  dimensionById,
  validateSearchSpace,
  type Dimension,
} from './searchSpace';
import { runSearch } from './search';
import { createCohortEvaluator } from './evaluator';
import { readStudy } from './study';
import { ApplyRefused, applyCandidateToDisk, planEdits } from './applyTuning';
import {
  applyOverride,
  knownFiles,
  linspace,
  readTunable,
  restoreOverride,
} from './overrides';

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): { mode: string; args: Args } {
  const mode = argv[0] ?? 'pacing';
  const args: Args = {};
  for (let i = 1; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith('--')) continue;
    const eq = tok.indexOf('=');
    if (eq >= 0) {
      args[tok.slice(2, eq)] = tok.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[tok.slice(2)] = next;
        i++;
      } else {
        args[tok.slice(2)] = true;
      }
    }
  }
  return { mode, args };
}

function num(args: Args, key: string, fallback: number): number {
  const v = args[key];
  return typeof v === 'string' ? Number(v) : fallback;
}

function str(args: Args, key: string, fallback: string): string {
  const v = args[key];
  return typeof v === 'string' ? v : fallback;
}

function log(msg: string): void {
  process.stderr.write(msg + '\n');
}

function emit(report: string, args: Args): void {
  const out = args.out;
  if (typeof out === 'string') {
    writeFileSync(out, report.endsWith('\n') ? report : report + '\n');
    log(`Wrote ${out}`);
  } else {
    process.stdout.write(report.endsWith('\n') ? report : report + '\n');
  }
}

function selectPolicies(args: Args, fallback: string): Policy[] {
  const id = str(args, 'policy', fallback);
  if (id === 'all') return [...POLICIES];
  const p = policyById(id);
  if (!p) {
    throw new Error(`Unknown policy '${id}'. Known: ${POLICIES.map((x) => x.id).join(', ')}, all`);
  }
  return [p];
}

function runPacing(args: Args): void {
  const seeds = deriveSeeds(num(args, 'baseSeed', 1), num(args, 'seeds', 100));
  const maxDays = num(args, 'maxDays', 360);
  const policies = selectPolicies(args, 'competent');
  const pacings = policies.map((policy) => {
    log(`[pacing] ${policy.id}: ${seeds.length} seeds × ${maxDays} days …`);
    const results = runCohort(policy, seeds, { maxDays });
    return summarizePacing(policy.id, results, { maxDays });
  });
  emit(formatPacing(pacings), args);
}

function runSweep(args: Args): void {
  const tunable = str(args, 'tunable', '');
  const colon = tunable.indexOf(':');
  if (colon < 0) {
    throw new Error(
      `--tunable must be FILE:dot.path (known files: ${knownFiles().join(', ')}). e.g. tier-gate:tiers.1.units`,
    );
  }
  const file = tunable.slice(0, colon);
  const path = tunable.slice(colon + 1);
  const range = str(args, 'range', '');
  const [min, max, steps] = range.split(',').map(Number);
  if (![min, max, steps].every(Number.isFinite)) {
    throw new Error('--range must be MIN,MAX,STEPS (e.g. 4,12,5)');
  }
  const values = linspace(min, max, steps);
  const seeds = deriveSeeds(num(args, 'baseSeed', 1), num(args, 'seeds', 30));
  const maxDays = num(args, 'maxDays', 360);
  const [policy] = selectPolicies(args, 'competent');

  log(`[sweep] ${file}:${path} over [${values.join(', ')}] (baseline=${readTunable(file, path)})`);
  const rows: SweepRow[] = [];
  for (const value of values) {
    const previous = applyOverride(file, path, value);
    try {
      log(`  ${file}:${path}=${value} — ${policy.id} × ${seeds.length} seeds …`);
      const results = runCohort(policy, seeds, { maxDays });
      rows.push({ value, pacing: summarizePacing(policy.id, results, { maxDays }) });
    } finally {
      restoreOverride(file, path, previous);
    }
  }
  emit(formatSweep(file, path, rows), args);
}

function runCalib(args: Args): void {
  const metric = str(args, 'metric', 'cash');
  if (!isMetric(metric)) {
    throw new Error(`Unknown metric '${metric}'. Known: ${metricNames().join(', ')}`);
  }
  const seeds = deriveSeeds(num(args, 'baseSeed', 1), num(args, 'seeds', 5));
  const maxDays = num(args, 'maxDays', 360);
  const [policy] = selectPolicies(args, 'competent');
  log(`[calib] ${metric}: ${policy.id} × ${seeds.length} seeds × ${maxDays} days …`);
  const results = runCohort(policy, seeds, { maxDays });
  emit(formatCalibCsv(metric, results, maxDays), args);
}

function runSpace(args: Args): void {
  validateSearchSpace();
  emit(formatSearchSpace(describeSpace()), args);
}

function selectDimensions(args: Args): Dimension[] {
  const requested = str(args, 'dims', '');
  if (!requested || requested === 'all') return [...SEARCH_SPACE];
  return requested
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .map((id) => dimensionById(id));
}

function studyPath(args: Args): string {
  const path = str(args, 'study', '');
  if (!path) throw new Error('--study FILE is required (the resumable study file).');
  return path;
}

function runSearchMode(args: Args): void {
  validateSearchSpace();
  const dims = selectDimensions(args);
  const path = studyPath(args);
  const baseSeed = num(args, 'baseSeed', 1);
  const seedCount = num(args, 'seeds', 20);
  const seeds = deriveSeeds(baseSeed, seedCount);
  const cheapSeedCount = Math.min(num(args, 'cheapSeeds', Math.max(1, Math.round(seedCount / 4))), seedCount);
  const maxDays = num(args, 'maxDays', 360);
  const [policy] = selectPolicies(args, 'competent');
  const trials = num(args, 'trials', 40);
  const initialDesign = num(args, 'initial', Math.max(4, Math.min(12, dims.length * 2)));

  log(
    `[search] ${dims.length} dims × ${trials} trials — ${policy.id} × ${seeds.length} seeds ` +
      `× ${maxDays} days (screen: ${cheapSeedCount} seeds) → ${path}`,
  );
  const result = runSearch({
    studyPath: path,
    dims,
    seeds,
    cheapSeedCount,
    trials,
    initialDesign,
    config: {
      policyId: policy.id,
      maxDays,
      baseSeed,
      seedCount: seeds.length,
      cheapSeedCount,
      dimensionIds: dims.map((d) => d.id),
    },
    evaluate: createCohortEvaluator({ policy, maxDays, dims }),
    onTrial: (trial, budget) =>
      log(
        `  trial ${trial.index + 1}/${budget} (${trial.source}, ${trial.stage}, ` +
          `${trial.seedCount} seeds): score ${trial.score.toFixed(4)}  ${(trial.wallMs / 1000).toFixed(1)}s`,
      ),
  });
  log(`[search] ${result.evaluated} evaluation(s) this run; ${result.study.trials.length} trials total.`);
  emit(formatStudyReport(result.study, dims), args);
}

function runApply(args: Args): void {
  const path = studyPath(args);
  const study = readStudy(path);
  const index = num(args, 'trial', NaN);
  const trial = study.trials.find((t) => t.index === index);
  if (!trial) {
    throw new Error(
      `--trial N must name a trial in the study (0…${study.trials.length - 1}). Got '${args.trial}'.`,
    );
  }
  const dims = study.header.config.dimensionIds.map((id) => dimensionById(id));
  const confirm = args.confirm === true || args.confirm === 'true';

  log(`[apply] study ${path}, trial ${trial.index} (${trial.source}, ${trial.seedCount} seeds)`);
  if (trial.stage === 'cheap') {
    log(
      '  WARNING: this trial was screened on a reduced seed subset — its score is not ' +
        'comparable to a full-spread one.',
    );
  }
  emit(formatApplyPlan(planEdits(trial.candidate, dims)), args);
  try {
    const edits = applyCandidateToDisk(trial.candidate, dims, {
      confirm,
      baseline: study.header.baseline,
    });
    log(`[apply] wrote ${edits.length} value(s) into data/**. Land them in ONE calibration commit.`);
  } catch (err) {
    if (err instanceof ApplyRefused) {
      log(`[apply] ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

function main(): void {
  const { mode, args } = parseArgs(process.argv.slice(2));
  switch (mode) {
    case 'pacing':
      return runPacing(args);
    case 'sweep':
      return runSweep(args);
    case 'calib':
      return runCalib(args);
    case 'space':
      return runSpace(args);
    case 'search':
      return runSearchMode(args);
    case 'apply':
      return runApply(args);
    default:
      log(`Unknown mode '${mode}'. Use: pacing | sweep | calib | space | search | apply`);
      process.exit(1);
  }
}

main();
