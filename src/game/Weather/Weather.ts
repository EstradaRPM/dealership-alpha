import { seasonForDay, type Season } from '../GameClock';
import { loadTunables, type Tunables } from '../data';
import { createRng, deriveSeed } from '../NPC/Rng';

/**
 * Weather / season substrate (#231, slice 1 of the weather-demand mechanic).
 *
 * The weather for a given day is a **pure deterministic projection** of
 * `(masterSeed, day)` — a temperature drawn uniformly in the day's season band
 * plus a condition drawn from that season's weighted catalog, on a per-day
 * keyed RNG (`deriveSeed(masterSeed, 'weather', { day })`). Because it derives
 * entirely from the already-persisted `masterSeed` + `GameClock.day`, the module
 * holds **no state of its own** — so it needs no snapshot and survives
 * save/load and #122 replay for free (the rebuilt World recomputes identical
 * weather). The per-day key is independent of tick order, so it can never
 * desync mid-day (see replay-determinism-constraint).
 *
 * Slice 1 is read-only: it feeds the Home calendar weather line + an honest
 * one-day forecast. Slice 2 (#231) rides the *season* onto demand: a
 * data-driven additive lean over the customer want-vector's SPACED axes
 * (`wantLeanForDay` / `leanWantVector`), so which models a season favors falls
 * out of the existing match (#197) rather than any per-make/model rule. Slice 3
 * rides *daily* weather onto traffic VOLUME (`volumeMultiplierForDay` /
 * `trafficOutlookForDay`) — a per-condition multiplier the composition root
 * composes onto the demand traffic multiplier, orthogonal to FloorSim's coarse
 * season baseline. The new attribute axes (S4) wire onto this same pure core.
 */

export type WeatherConfig = Tunables['weather'];

/**
 * A want-vector slice: axis id → unit-scaled level. Structurally compatible
 * with SalesProcess's `SpacedVector` without importing it (one-directional
 * decoupling — Weather never depends on SalesProcess). `leanWantVector`
 * preserves the caller's concrete shape via a generic.
 */
export type SpacedLike = Record<string, number>;

const clampUnit = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export interface DayWeather {
  readonly day: number;
  readonly season: Season;
  /** Stable condition id from the catalog (e.g. 'clear', 'snow'). */
  readonly conditionId: string;
  /** Display label for the condition (e.g. 'Clear'). */
  readonly conditionLabel: string;
  /** Whole degrees Fahrenheit. */
  readonly temperatureF: number;
}

/** Qualitative foot-traffic outlook for a day (#231 S3) — the readable form of
 *  the volume multiplier, banded by `volumeOutlook`. */
export type TrafficOutlook = 'busy' | 'steady' | 'slow';

export interface Weather {
  /** Deterministic weather for any day — a pure function of (masterSeed, day). */
  weatherForDay(day: number): DayWeather;
  /**
   * The day's season demand lean (#231 S2): additive per-axis deltas over the
   * customer want-vector's SPACED axes (only non-zero axes present). Pure — a
   * function of the day's season + the bundled `attributeLeans` config.
   */
  wantLeanForDay(day: number): Readonly<Record<string, number>>;
  /**
   * Apply the day's season lean to a customer want-vector, clamping each axis
   * to [0,1]. Returns a new object of the caller's shape; axes absent from the
   * lean pass through unchanged. This is the seam StaffDispatch's auto-resolve
   * path biases the customer want-vector through before the match (#197), so
   * the seasonal effect stays emergent.
   */
  leanWantVector<T extends SpacedLike>(spaced: T, day: number): T;
  /**
   * The day's daily-weather → traffic-VOLUME multiplier (#231 S3): a nice day
   * lifts expected foot traffic, a bad day depresses it. A pure projection of
   * the day's already-drawn condition (no new RNG ⇒ replay-safe). The
   * composition root rides this on the locked #125 `pricing.trafficMultiplier`
   * composite; it is the per-day variance, orthogonal to FloorSim's coarse
   * `seasonArrivalMultiplier` season baseline. Unmapped conditions ⇒ 1.
   */
  volumeMultiplierForDay(day: number): number;
  /**
   * The day's traffic outlook (#231 S3): the volume multiplier banded into a
   * qualitative `busy | steady | slow` for the Home weather card, so reading
   * tomorrow's forecast becomes an honest, learnable planning signal.
   */
  trafficOutlookForDay(day: number): TrafficOutlook;
}

export interface WeatherDeps {
  readonly masterSeed: number;
  /** Test seam; defaults to the bundled `tunables.weather` block. */
  readonly config?: WeatherConfig;
}

/**
 * Weighted draw over the condition catalog. Keys are visited in sorted order so
 * the pick is stable regardless of object-key ordering (replay-safe). `roll` is
 * a unit value in [0, 1).
 */
function weightedPick(weights: Record<string, number>, roll: number): string {
  const entries = Object.keys(weights)
    .sort()
    .map((id) => [id, weights[id]] as const)
    .filter(([, w]) => w > 0);
  if (entries.length === 0) return Object.keys(weights).sort()[0] ?? '';
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let target = roll * total;
  for (const [id, w] of entries) {
    target -= w;
    if (target < 0) return id;
  }
  // Floating-point fall-through: return the last positive-weight entry.
  return entries[entries.length - 1][0];
}

export function createWeather(deps: WeatherDeps): Weather {
  const config = deps.config ?? loadTunables().weather;

  function weatherForDay(day: number): DayWeather {
    const season = seasonForDay(day);
    const band = config.seasons[season];
    const rng = createRng(deriveSeed(deps.masterSeed, 'weather', { day }));
    const temperatureF = Math.round(
      band.tempMinF + rng() * (band.tempMaxF - band.tempMinF),
    );
    const conditionId = weightedPick(band.conditionWeights, rng());
    const conditionLabel = config.conditions[conditionId] ?? conditionId;
    return { day, season, conditionId, conditionLabel, temperatureF };
  }

  function wantLeanForDay(day: number): Readonly<Record<string, number>> {
    return config.attributeLeans.bySeason[seasonForDay(day)];
  }

  function leanWantVector<T extends SpacedLike>(spaced: T, day: number): T {
    const lean = wantLeanForDay(day);
    const out: Record<string, number> = { ...spaced };
    for (const axis of Object.keys(lean)) {
      // Only lean axes the want-vector actually carries; unknown axes are noise.
      if (axis in out) out[axis] = clampUnit(out[axis] + lean[axis]);
    }
    return out as T;
  }

  function volumeMultiplierForDay(day: number): number {
    const { conditionId } = weatherForDay(day);
    // Reuses the day's drawn condition — no new RNG. Unmapped ⇒ neutral 1.
    return config.conditionVolume[conditionId] ?? 1;
  }

  function trafficOutlookForDay(day: number): TrafficOutlook {
    const mult = volumeMultiplierForDay(day);
    if (mult >= config.volumeOutlook.busyMin) return 'busy';
    if (mult <= config.volumeOutlook.slowMax) return 'slow';
    return 'steady';
  }

  return {
    weatherForDay,
    wantLeanForDay,
    leanWantVector,
    volumeMultiplierForDay,
    trafficOutlookForDay,
  };
}
