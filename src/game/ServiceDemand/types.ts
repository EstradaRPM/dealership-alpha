/**
 * ServiceDemand types (#302, parent #297).
 *
 * ServiceDemand is the pure mix composer that turns the day's installed-base
 * returns (#300) plus a conquest stream of fresh walk-ins into the enriched
 * daily service intake — each ticket carrying customer + vehicle identity, the
 * due job/parts category, and the base ticket revenue. This is the stream that
 * replaces ServiceQueue's synthetic `seed × day` roll (wired in a later slice).
 */

import type { JobCategory, OwnerPowertrain, ReturningOwner } from '../InstalledBase';
import type { Season } from '../GameClock';

export type { JobCategory, OwnerPowertrain } from '../InstalledBase';

/** Where a ticket entered the day's intake. `return` = an installed-base owner
 *  bringing their car back (the primary stream); `conquest` = a fresh walk-in
 *  (the floor, scaled by reputation × service marketing). */
export type ServiceTicketSource = 'return' | 'conquest';

/**
 * One enriched service-intake ticket. For a `return` the customer/vehicle
 * identity + job category come straight from the InstalledBase `ReturningOwner`;
 * for a `conquest` they are freshly composed from the mix. `baseRevenue` is the
 * per-job-category base ticket value.
 */
export interface ServiceIntakeEntry {
  readonly ticketId: string;
  readonly source: ServiceTicketSource;
  readonly customerId: string;
  readonly vehicleId: string;
  /** VehicleCategory of the serviced car (e.g. 'sedan'). */
  readonly category: string;
  readonly powertrain: OwnerPowertrain;
  readonly jobCategory: JobCategory;
  readonly baseRevenue: number;
}

/**
 * Minimal installed-base owner sample the composer aggregates for the base-age
 * drift + powertrain skew. Decoupled from the full `OwnerRecord` so the pure fn
 * depends only on the two fields it reads.
 */
export interface BaseOwnerSample {
  /** Day the car was sold (→ age = day − saleDay). */
  readonly saleDay: number;
  readonly powertrain: OwnerPowertrain;
}

/**
 * The composer's per-day inputs. Everything is supplied by the caller — the fn
 * is pure over these inputs and seeds all randomness off `masterSeed + day`.
 */
export interface ServiceDemandInput {
  readonly day: number;
  /** The day's installed-base returns (#300) — the primary stream. */
  readonly returns: readonly ReturningOwner[];
  /** The installed base, sampled for fleet-age + powertrain aggregation. */
  readonly owners: readonly BaseOwnerSample[];
  /** Live reputation, normalized to [0,1]. Scales conquest volume. */
  readonly reputation: number;
  /** Service-marketing influence input in [0,1]. Scales conquest volume. */
  readonly serviceMarketing: number;
  /** The day's season (read from Weather) — selects the seasonal lean. */
  readonly season: Season;
  readonly masterSeed: number;
}

/**
 * The ServiceDemand module surface. It is event-driven (composes on each
 * `installedBase:returns_ready` and publishes `serviceDemand:intake_ready`) and
 * holds no persisted state — the stream regenerates deterministically from
 * `masterSeed + day` + the live installed base. `getLatestIntake` exposes the
 * most recently composed stream for reads/tests.
 */
export interface ServiceDemand {
  getLatestIntake(): readonly ServiceIntakeEntry[];
}
