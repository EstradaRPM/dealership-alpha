/**
 * InstalledBase types (#298, parent #297).
 *
 * The living per-owner registry that is the foundation of the Service annuity.
 * This slice is the registry + persistence only — no return cadence yet.
 */

/**
 * Vehicle powertrain axis. Joined from the sold-vehicle snapshot
 * (`inventory:vehicle_sold`), never re-derived inside this module. Drives the
 * later service-due cadence (EVs cycle less, throw no oil changes); inert in
 * this slice beyond being captured on the owner record.
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
