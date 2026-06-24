import type { EventBus } from '../EventBus';
import type { Season } from '../GameClock';
import { composeCollisionIntake } from './composeCollision';
import { loadCollisionStreamConfig, type CollisionStreamConfig } from './collisionStreamConfig';
import type { CollisionIntakeEntry, CollisionStream } from './types';

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** The minimal weather read CollisionStream needs for the day — the drawn
 *  condition id (volume spike + mix lean) and the season. Mirrors the relevant
 *  fields of `Weather.weatherForDay(day)` without importing `DayWeather`, keeping
 *  CollisionStream decoupled from Weather (the root injects the read). */
export interface CollisionWeatherRead {
  readonly conditionId: string;
  readonly season: Season;
}

export interface CollisionStreamDeps {
  bus: EventBus;
  masterSeed: number;
  config?: CollisionStreamConfig;
  /** The day's weather (condition + season), read from Weather. */
  weather: (day: number) => CollisionWeatherRead;
  /** Live reputation, normalized to [0,1]; defaults to neutral 1. Scales the
   *  conquest stream (the conquest-dominant lever). */
  reputation?: () => number;
  /** Channel posture in [0,1]: 0 = full insurance-DRP, 1 = full retail; defaults
   *  to neutral 0.5. The Body-Shop package supplies the live dial. */
  posture?: () => number;
  /** Installed-base size — the small additive collision tie; defaults to 0. */
  baseSize?: () => number;
}

/**
 * CollisionStream (#313, parent #297) — the Body Shop's demand spine, the Tier-3
 * mirror of `ServiceDemand`. On each `clock:day_started` it composes the day's
 * enriched collision intake — a stochastic, weather/season-spiked draw split into
 * a steady rate-capped insurance-DRP stream and a lumpy fatter-margin retail
 * stream, conquest-dominant via reputation with a small installed-base tie — and
 * publishes `bodyshop:demand_ready` in the same enriched shape Service uses (so
 * the shared resolution/capacity/parts machinery #311 applies unchanged).
 *
 * Holds **no persisted state** — the intake regenerates deterministically from
 * `masterSeed + day` + the live weather/reputation/posture reads (#122
 * replay-safe), exactly like Weather and ServiceDemand. No `worldSnapshot` key,
 * no migration. BodyShopQueue (#312) gates this stream by Tier 3 and re-publishes
 * it as `bodyshop:intake_ready`.
 */
export function createCollisionStream(deps: CollisionStreamDeps): CollisionStream {
  const config = deps.config ?? loadCollisionStreamConfig();
  const readReputation = deps.reputation ?? (() => 1);
  const readPosture = deps.posture ?? (() => 0.5);
  const readBaseSize = deps.baseSize ?? (() => 0);

  let latest: readonly CollisionIntakeEntry[] = [];

  deps.bus.subscribe('clock:day_started', ({ day }) => {
    const { conditionId, season } = deps.weather(day);
    const intake = composeCollisionIntake(
      {
        day,
        conditionId,
        season,
        reputation: clamp01(readReputation()),
        posture: clamp01(readPosture()),
        baseSize: Math.max(0, readBaseSize()),
        masterSeed: deps.masterSeed,
      },
      config,
    );
    latest = intake;
    deps.bus.publish('bodyshop:demand_ready', { day, intake });
  });

  return {
    getLatestIntake() {
      return latest;
    },
  };
}
