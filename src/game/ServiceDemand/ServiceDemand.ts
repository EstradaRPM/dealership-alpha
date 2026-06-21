import type { EventBus } from '../EventBus';
import type { Season } from '../GameClock';
import { composeServiceIntake } from './composeIntake';
import { loadServiceDemandConfig, type ServiceDemandConfig } from './serviceDemandConfig';
import type { BaseOwnerSample, ServiceDemand, ServiceIntakeEntry } from './types';

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export interface ServiceDemandDeps {
  bus: EventBus;
  masterSeed: number;
  config?: ServiceDemandConfig;
  /** Live reputation read, normalized to [0,1]; defaults to neutral 1. */
  reputation?: () => number;
  /** Service-marketing influence input in [0,1]; defaults to 0 (floor-only
   *  conquest until a marketing lever wires in). */
  serviceMarketing?: () => number;
  /** The day's season, read from Weather. */
  season: (day: number) => Season;
  /** A live sample of the installed base (fleet age + powertrain aggregation). */
  baseOwners: () => readonly BaseOwnerSample[];
}

/**
 * ServiceDemand (#302, parent #297) — the pure mix composer that assembles the
 * day's enriched service intake. On each `installedBase:returns_ready` it folds
 * the returning owners in as the primary stream, adds a conquest floor of fresh
 * walk-ins scaled by reputation × service marketing, composes their job/parts
 * category mix (usual split + seasonal lean + base-age drift + powertrain skew +
 * RNG variance), and publishes `serviceDemand:intake_ready`.
 *
 * This is the stream that replaces ServiceQueue's synthetic `seed × day` roll;
 * that consumer rewire is a later #297 slice. Holds no persisted state — the
 * intake regenerates deterministically from `masterSeed + day` + the live
 * installed base (#122 replay-safe), exactly like InstalledBase's return roll.
 */
export function createServiceDemand(deps: ServiceDemandDeps): ServiceDemand {
  const config = deps.config ?? loadServiceDemandConfig();
  const readReputation = deps.reputation ?? (() => 1);
  const readServiceMarketing = deps.serviceMarketing ?? (() => 0);

  let latest: readonly ServiceIntakeEntry[] = [];

  deps.bus.subscribe('installedBase:returns_ready', ({ day, returns }) => {
    const intake = composeServiceIntake(
      {
        day,
        returns,
        owners: deps.baseOwners(),
        reputation: clamp01(readReputation()),
        serviceMarketing: clamp01(readServiceMarketing()),
        season: deps.season(day),
        masterSeed: deps.masterSeed,
      },
      config,
    );
    latest = intake;
    deps.bus.publish('serviceDemand:intake_ready', { day, intake });
  });

  return {
    getLatestIntake() {
      return latest;
    },
  };
}
