/**
 * InstalledBase types (#298/#300/#306, parent #297).
 *
 * The living per-owner registry that is the foundation of the Service annuity.
 * #298 built the registry + persistence; #300 adds the return cadence + the
 * job-category drift that emits the day's returning-owner stream; #306 closes
 * the feedback loop — service outcomes move per-owner loyalty + CSI, sustained
 * neglect defects an owner out of the base, and aged-out loyal owners emit warm
 * repeat-buyer leads back into Sales.
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
  /** [0,1] loyalty, seeded from the deal's `retentionSeed`; moved by service
   *  outcomes (#306) and read by the return roll. */
  readonly loyalty: number;
  /** [0,1] customer-satisfaction index, seeded alongside loyalty and moved by
   *  service outcomes (#306). Distinct from loyalty: the satisfaction signal the
   *  base-health readout / Reputation feedback reflect. */
  readonly csi: number;
  /** Consecutive bad service experiences (miss / unserved / gouge). Reset by a
   *  good visit; defects the owner once it reaches the configured threshold. */
  readonly consecutiveBadVisits: number;
  /** Consecutive service-due cycles the owner did not return for. Reset on a
   *  return; defects the owner once it reaches the configured threshold. */
  readonly consecutiveNoReturns: number;
  /** Whether this owner's aged-out car has already emitted a repeat-buyer lead
   *  (one per ownership — dedupes the daily age-out sweep). */
  readonly repeatLeadEmitted: boolean;
}

/**
 * One aged-out loyal owner re-entering Sales as a warm repeat buyer (#306). The
 * composition root maps `category` onto a matching sales archetype so the lead
 * walks in wanting the kind of car the player is likely stocked for.
 */
export interface RepeatBuyerLead {
  readonly ownerId: string;
  readonly customerId: string;
  readonly vehicleId: string;
  /** VehicleCategory of the car that aged out (used to bias the warm spawn). */
  readonly category: string;
  /** [0,1] loyalty at age-out (the lead's warmth). */
  readonly loyalty: number;
}

/** Pre-#306 owner record (no loyalty/CSI feedback fields). Restored records of
 *  this shape are migrated forward with neutral defaults. */
interface OwnerRecordV1 {
  readonly ownerId: string;
  readonly customerId: string;
  readonly vehicleId: string;
  readonly category: string;
  readonly powertrain: OwnerPowertrain;
  readonly saleDay: number;
  readonly loyalty: number;
}

interface InstalledBaseSnapshotV1 {
  readonly schemaVersion: 1;
  readonly owners: readonly OwnerRecordV1[];
}

interface InstalledBaseSnapshotV2 {
  readonly schemaVersion: 2;
  readonly owners: readonly OwnerRecord[];
}

/** Versioned persistence blob. `restore` migrates a v1 blob forward (#306). */
export type InstalledBaseSnapshot =
  | InstalledBaseSnapshotV1
  | InstalledBaseSnapshotV2;

export interface InstalledBase {
  /** All owner records, in accrual order. */
  getOwners(): readonly OwnerRecord[];
  getOwner(ownerId: string): OwnerRecord | undefined;
  /** Number of owner records currently in the base. */
  readonly size: number;
  snapshot(): InstalledBaseSnapshot;
  restore(snap: InstalledBaseSnapshot): void;
}
