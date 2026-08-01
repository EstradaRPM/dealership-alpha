/**
 * Gaussian-process surrogate + Expected-Improvement acquisition (#345).
 *
 * Pure math, no game imports, no I/O — the piece of the balance search that can
 * be reasoned about (and tested) without running a single in-game day. The loop
 * that uses it lives in `search.ts`.
 *
 * Why a GP at all: a real evaluation is ~7 ms per in-game day × 360 days × N
 * seeds, so a study affords tens-to-low-hundreds of evaluations over a surface
 * with dozens of dimensions. Grid or random search is hopeless at that budget;
 * a surrogate that models where the objective probably improves is not. Small n
 * also keeps the O(n³) Cholesky solve irrelevant next to the cost of one run.
 *
 * Two choices worth stating:
 *
 *   - **The kernel divides squared distance by the dimension count.** An
 *     isotropic length-scale in a unit box means something different in 3
 *     dimensions than in 55 (distances grow as √d), and a study is run against
 *     whatever subset of the manifest the director selected. Normalizing keeps
 *     one length-scale honest across both.
 *   - **Noise is per-observation, not global.** Adaptive sampling scores some
 *     candidates on a reduced seed subset, and a cheap score is a noisier
 *     estimate of the same quantity. Feeding that in as larger observation noise
 *     is how the surrogate is told not to trust it as much — the alternative,
 *     treating a 5-seed score and a 50-seed score as equally certain, is exactly
 *     the "never compare a cheap score to a full one" failure the issue names.
 */

export interface GpObservation {
  /** Point in the unit box [0,1]^d. */
  readonly x: readonly number[];
  readonly y: number;
  /** Observation-noise variance for THIS point, in y units. */
  readonly noise: number;
}

export interface GpPosterior {
  readonly mean: number;
  /** Posterior standard deviation — 0 only for a noiseless repeat of a known point. */
  readonly sd: number;
}

export interface GpOptions {
  /** Length-scale in unit-box distance, dimension-normalized. */
  readonly lengthScale?: number;
  /** Floor added to every observation's noise, for numerical conditioning. */
  readonly jitter?: number;
}

export const DEFAULT_LENGTH_SCALE = 0.25;
const DEFAULT_JITTER = 1e-8;

export interface Gp {
  readonly count: number;
  predict(x: readonly number[]): GpPosterior;
}

function sqDistNormalized(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return a.length === 0 ? 0 : sum / a.length;
}

function rbf(a: readonly number[], b: readonly number[], lengthScale: number): number {
  return Math.exp(-sqDistNormalized(a, b) / (2 * lengthScale * lengthScale));
}

/** Lower-triangular Cholesky factor of a symmetric positive-definite matrix. */
function cholesky(a: number[][]): number[][] {
  const n = a.length;
  const L: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = a[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      if (i === j) {
        // Clamped rather than thrown: a duplicated observation makes the matrix
        // singular, and a study that re-proposes a point it already evaluated
        // should degrade, not crash.
        L[i][j] = Math.sqrt(Math.max(sum, 1e-12));
      } else {
        L[i][j] = sum / L[j][j];
      }
    }
  }
  return L;
}

function forwardSolve(L: number[][], b: readonly number[]): number[] {
  const n = L.length;
  const x = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = b[i];
    for (let k = 0; k < i; k++) sum -= L[i][k] * x[k];
    x[i] = sum / L[i][i];
  }
  return x;
}

function backSolve(L: number[][], b: readonly number[]): number[] {
  const n = L.length;
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let k = i + 1; k < n; k++) sum -= L[k][i] * x[k];
    x[i] = sum / L[i][i];
  }
  return x;
}

/**
 * Fit a zero-mean GP over standardized observations. The y values are centered
 * and scaled internally and the posterior is returned in the caller's units, so
 * the search never has to think about the surrogate's coordinate system.
 */
export function fitGp(observations: readonly GpObservation[], opts: GpOptions = {}): Gp {
  const lengthScale = opts.lengthScale ?? DEFAULT_LENGTH_SCALE;
  const jitter = opts.jitter ?? DEFAULT_JITTER;
  const n = observations.length;

  if (n === 0) {
    return { count: 0, predict: () => ({ mean: 0, sd: 1 }) };
  }

  const ys = observations.map((o) => o.y);
  const mean = ys.reduce((s, v) => s + v, 0) / n;
  const variance = ys.reduce((s, v) => s + (v - mean) * (v - mean), 0) / n;
  const scale = variance > 0 ? Math.sqrt(variance) : 1;
  const z = ys.map((y) => (y - mean) / scale);

  const K: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      K[i][j] = rbf(observations[i].x, observations[j].x, lengthScale);
    }
    K[i][i] += observations[i].noise / (scale * scale) + jitter;
  }

  const L = cholesky(K);
  const alpha = backSolve(L, forwardSolve(L, z));

  return {
    count: n,
    predict(x: readonly number[]): GpPosterior {
      const ks = observations.map((o) => rbf(o.x, x, lengthScale));
      let mu = 0;
      for (let i = 0; i < n; i++) mu += ks[i] * alpha[i];
      const v = forwardSolve(L, ks);
      let varReduction = 0;
      for (let i = 0; i < n; i++) varReduction += v[i] * v[i];
      const posteriorVar = Math.max(1 - varReduction, 0);
      return { mean: mu * scale + mean, sd: Math.sqrt(posteriorVar) * scale };
    },
  };
}

// ── Expected Improvement ─────────────────────────────────────────────────────

/** Abramowitz & Stegun 7.1.26 — plenty for an acquisition ranking. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function normalPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

/**
 * Expected improvement of a posterior over the best value observed so far
 * (maximization). `xi` is the exploration margin: how much better than the
 * incumbent a point must be expected to be before it counts as improvement.
 */
export function expectedImprovement(post: GpPosterior, best: number, xi = 0.01): number {
  const improvement = post.mean - best - xi;
  if (post.sd <= 1e-12) return Math.max(improvement, 0);
  const z = improvement / post.sd;
  return improvement * normalCdf(z) + post.sd * normalPdf(z);
}
