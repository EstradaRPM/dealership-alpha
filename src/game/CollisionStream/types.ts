/**
 * CollisionStream types (#313, parent #297).
 *
 * CollisionStream is the Body Shop's demand SPINE — the Tier-3 mirror of
 * `ServiceDemand`, but with a fundamentally different shape. Where Service is an
 * installed-base annuity (steady returns + a conquest floor), Body Shop is a
 * **stochastic collision shock**: a weather/season-spiked random draw,
 * conquest-dominant via reputation, with only a small installed-base tie. Each
 * collision job is split across two channels — `insurance` (DRP claim work:
 * steady, high, rate-capped, price-insensitive) and `retail` (customer-pay:
 * lumpy, fatter-margin) — governed by the player's channel posture.
 *
 * The output is the same enriched intake shape Service uses, so the shared
 * resolution/capacity/parts machinery (#311) applies unchanged — each ticket
 * carries customer + vehicle identity, the due collision job/parts category, and
 * the base ticket revenue.
 */

import type { Season } from '../GameClock';

/** The four Body-Shop collision job/parts categories (mirrors the `bodyshop:*`
 *  event union + the PartsInventory Body-Shop four). */
export type BodyShopJobCategory =
  | 'windows_glass'
  | 'doors_panels'
  | 'interior_trim'
  | 'paint';

/** Powertrain of the damaged vehicle. Declared locally (CollisionStream does not
 *  consume InstalledBase's returning-owner stream) but type-compatible with the
 *  `bodyshop:demand_ready` event union. */
export type CollisionPowertrain = 'ice' | 'hybrid' | 'ev';

/** The Body-Shop demand channel a collision job entered through. `insurance` =
 *  DRP claim work (steady, high volume, rate-capped, the player can't move the
 *  price); `retail` = customer-pay (lumpy, fatter-margin). This is the axis the
 *  Body-Shop pricing satellite (insurance-DRP ↔ retail posture) reads. */
export type CollisionChannel = 'insurance' | 'retail';

/**
 * One enriched collision-intake ticket. Same shape `ServiceIntakeEntry` uses so
 * the shared backbone consumes both unchanged; `source` is the collision channel
 * rather than return/conquest, and `jobCategory` is the collision ladder.
 * `baseRevenue` already carries the channel margin profile (insurance jobs are
 * rate-capped below book, retail jobs carry the fatter structural margin).
 */
export interface CollisionIntakeEntry {
  readonly ticketId: string;
  readonly source: CollisionChannel;
  readonly customerId: string;
  readonly vehicleId: string;
  /** VehicleCategory of the damaged car (e.g. 'sedan'). */
  readonly category: string;
  readonly powertrain: CollisionPowertrain;
  readonly jobCategory: BodyShopJobCategory;
  readonly baseRevenue: number;
}

/**
 * The composer's per-day inputs. Everything is supplied by the caller — the fn
 * is pure over these inputs and seeds all randomness off `masterSeed + day`.
 */
export interface CollisionStreamInput {
  readonly day: number;
  /** The day's weather condition id (`clear`/`cloudy`/`rain`/`snow`/`storm`) —
   *  drives the collision-volume spike + the job-mix lean. */
  readonly conditionId: string;
  /** The day's season — selects the seasonal volume spike + mix lean. */
  readonly season: Season;
  /** Live reputation, normalized to [0,1]. Scales the retail/conquest stream
   *  (the conquest-dominant lever); insurance referral volume is rep-independent. */
  readonly reputation: number;
  /** Channel posture in [0,1]: 0 = full insurance-DRP, 1 = full retail. Leaning
   *  insurance adds steady referral volume; leaning retail grows the lumpy,
   *  fatter-margin conquest stream. */
  readonly posture: number;
  /** Installed-base size — the small additive tie (your own owners occasionally
   *  crash and come back to you). Conquest-dominant ⇒ this is a minor term. */
  readonly baseSize: number;
  readonly masterSeed: number;
}

/**
 * The CollisionStream module surface. Event-driven (composes on each
 * `clock:day_started` and publishes `bodyshop:demand_ready`) and holds no
 * persisted state — the stream regenerates deterministically from
 * `masterSeed + day` + the live weather/reputation/posture reads, exactly like
 * Weather and ServiceDemand. `getLatestIntake` exposes the most recently composed
 * stream for reads/tests.
 */
export interface CollisionStream {
  getLatestIntake(): readonly CollisionIntakeEntry[];
}
