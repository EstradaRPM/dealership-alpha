import {
  ceilingsAtTier,
  loadFacilityCeilings,
  type FacilityCeilingTable,
} from './facilityData';
import type { Facility, FacilityCapacity, FacilitySnapshot } from './types';

export interface FacilityDeps {
  /** The live dealership tier. Read per call — the ceiling moves with it. */
  getTier: () => number;
  /** Ceiling table; injectable so a test can state the scale it is exercising. */
  ceilings?: FacilityCeilingTable;
}

/**
 * Built capacity for a store standing at `tier` — every kind at its ceiling.
 *
 * This is what a **new** world starts holding (#358 seeds it at construction)
 * and what a pre-facility save migrates to, so neither changes behavior from
 * when bays were a per-tier constant. Growth past this point is construction
 * (#359), and it is only ever bought.
 */
export function createDefaultFacilitySnapshot(
  tier: number,
  ceilings: FacilityCeilingTable = loadFacilityCeilings(),
): FacilitySnapshot {
  return { schemaVersion: 1, built: ceilingsAtTier(ceilings, tier) };
}

/**
 * The Facility module (#358, A2 R1): what the store has physically built.
 *
 * It owns three numbers and hands them out through one read. Everything that
 * used to ask the tier for a bay count now asks here — one bay truth — and the
 * tier's number became the ceiling rather than the answer.
 *
 * There is no `facility:*` event yet, and no bus dep, because nothing in this
 * slice *changes* capacity: a new world is seeded at the tier's constants and a
 * tier-up only lifts the ceiling. Construction (#359) is the first thing that
 * moves a built number, and it publishes when it does.
 */
export function createFacility(deps: FacilityDeps): Facility {
  const ceilings = deps.ceilings ?? loadFacilityCeilings();
  // Seeded to the starting tier's constants, so a fresh world runs exactly the
  // bay counts the retired `baysByTier` gave it.
  let built: FacilityCapacity = ceilingsAtTier(ceilings, deps.getTier());

  return {
    getBuilt: () => built,
    // Derived from the LIVE tier, never stored: tier-up must not be able to
    // leave a stale ceiling behind, and there is nothing to migrate.
    getCeilings: () => ceilingsAtTier(ceilings, deps.getTier()),
    snapshot: () => ({ schemaVersion: 1, built }),
    restore: (snap) => {
      built = snap.built;
    },
  };
}
