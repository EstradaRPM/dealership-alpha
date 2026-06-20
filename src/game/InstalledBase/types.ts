/**
 * InstalledBase types (#298/#300, parent #297).
 *
 * The living per-owner registry that is the foundation of the Service annuity.
 * #298 built the registry + persistence; #300 adds the return cadence + the
 * job-category drift that emits the day's returning-owner stream.
 */

/**
 * The four service job categories, in early→late drift order. Which one a
 * returning owner is due for is selected by the car's age (#300). Mirrors the
 * Service parts categories the downstream ServiceDemand/PartsInventory work
 * will stock against.
 */
export type JobCategory =
  | 'oil_filters'
  | 'tires_brakes'
  | 'drivetrain'
  | 'electronics';

/**
 * One entry in the day's returning-owner stream (#300). Carries the customer +
 * vehicle identity and the due job category, so ServiceDemand can compose it
 * into the day's NPC-bound service intake without re-joining the registry.
 */
export interface ReturningOwner {
  readonly ownerId: string;
  readonly customerId: string;
  readonly vehicleId: string;
  /** VehicleCategory of the owner's car (e.g. 'sedan'). */
  readonly category: string;
  readonly powertrain: OwnerPowertrain;
  /** The maintenance category the car's age makes it due for. */
  readonly jobCategory: JobCategory;
  /** Car age in game days at the time of this return (`day − saleDay`). */
  readonly ageDays: number;
}

/**
 * Vehicle powertrain axis. Joined from the sold-vehicle snapshot
 * (`inventory:vehicle_sold`), never re-derived inside this module. Drives the
 * service-due cadence (#300 — EVs cycle least often).
 */
export type OwnerPowertrain = 'ice' | 'hybrid' | 'ev';

/**
 * One owner record per sale. `category`/`powertrain`/`saleDay` are joined from
 * the `inventory:vehicle_sold` snapshot of the same `vehicleId`; `loyalty` is
 * seeded from the deal's `retentionSeed` (the satisfaction-at-sale seam on
 * `customer:resolved`). `saleDay` → age feeds the future maintenance cadence.
 */
export interface OwnerRecord {
  /** Stable id for this ownership: `${customerId}::${vehicleId}`. */
  readonly ownerId: string;
  readonly customerId: string;
  readonly vehicleId: string;
  /** VehicleCategory join from the sold-vehicle snapshot (e.g. 'sedan'). */
  readonly category: string;
  readonly powertrain: OwnerPowertrain;
  /** Day the car was sold (→ age). From `inventory:vehicle_sold.day`. */
  readonly saleDay: number;
  /** [0,1] loyalty, seeded from the deal's `retentionSeed`. */
  readonly loyalty: number;
}

export interface InstalledBaseSnapshot {
  readonly schemaVersion: 1;
  readonly owners: readonly OwnerRecord[];
}

export interface InstalledBase {
  /** All owner records, in accrual order. */
  getOwners(): readonly OwnerRecord[];
  getOwner(ownerId: string): OwnerRecord | undefined;
  /** Number of owner records currently in the base. */
  readonly size: number;
  snapshot(): InstalledBaseSnapshot;
  restore(snap: InstalledBaseSnapshot): void;
}
