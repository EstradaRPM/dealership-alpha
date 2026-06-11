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
 * one-day forecast. Later slices ride season/weather onto demand (the
 * attribute-axis lean) and traffic volume — those wire onto this same pure core.
 */

export type WeatherConfig = Tunables['weather'];

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

export interface Weather {
  /** Deterministic weather for any day — a pure function of (masterSeed, day). */
  weatherForDay(day: number): DayWeather;
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

  return {
    weatherForDay(day: number): DayWeather {
      const season = seasonForDay(day);
      const band = config.seasons[season];
      const rng = createRng(deriveSeed(deps.masterSeed, 'weather', { day }));
      const temperatureF = Math.round(
        band.tempMinF + rng() * (band.tempMaxF - band.tempMinF),
      );
      const conditionId = weightedPick(band.conditionWeights, rng());
      const conditionLabel = config.conditions[conditionId] ?? conditionId;
      return { day, season, conditionId, conditionLabel, temperatureF };
    },
  };
}
