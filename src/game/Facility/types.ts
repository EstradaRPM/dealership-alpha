/**
 * The three kinds of physical capacity a store owns (#358, A2 R1).
 *
 * One shape serves both readings: `getBuilt()` is what you have standing, and
 * `getCeilings()` is the most the current tier lets you build. They are the same
 * three numbers because the facility score (#360) is one divided by the other —
 * a ceiling shape that did not match the built shape would need a mapping.
 */
export interface FacilityCapacity {
  /** Cars the lot holds. Governs buying, never a trade (#361, A2 R2). */
  readonly lotSpaces: number;
  /** Service bays — the Service line's `min(bays, advisors)` concurrency term. */
  readonly serviceBays: number;
  /** Body-shop bays — the same term on the Tier-3 collision line. */
  readonly bodyBays: number;
}

/** The capacity kinds, as a value list — the order every build surface reads in. */
export const FACILITY_CAPACITY_KINDS = ['lotSpaces', 'serviceBays', 'bodyBays'] as const;

export type FacilityCapacityKind = (typeof FACILITY_CAPACITY_KINDS)[number];

/**
 * What one purchase of a capacity kind buys (#359). Flat, not per-tier: a
 * service bay costs what a service bay costs, at every rung of the ladder.
 *
 * `blockSize` is the size of one job, not a divisor — the job is clamped down to
 * whatever room is left under the ceiling, so a block of 5 against a gap of 3
 * builds 3 and is priced for 3. That keeps it to ONE rule the player learns
 * ("each space costs this much and takes this long") instead of two ("...but the
 * last block is special").
 */
export interface FacilityBuildSpec {
  readonly blockSize: number;
  readonly unitCost: number;
  readonly days: number;
}

/**
 * Capacity that is paid for and being built (#359, A2 R1).
 *
 * Stored as an absolute `completesOnDay`, compared against the current day at
 * the morning settle — the #295 frontline-hold idiom. Nothing decrements a
 * counter, so a job cannot drift out of step with the calendar across a
 * save/load.
 */
export interface ConstructionJob {
  readonly id: string;
  readonly kind: FacilityCapacityKind;
  /** Units this job adds when it lands. Never counted as built until then. */
  readonly units: number;
  /** Cash already debited, kept for the record — a job is never refunded. */
  readonly cost: number;
  readonly startedOnDay: number;
  readonly completesOnDay: number;
}

/** Why a purchase would be refused. Both leave cash untouched. */
export type FacilityBuildRefusal = 'at-ceiling' | 'cannot-afford';

/**
 * Everything a build surface needs for one capacity kind, in one read — so the
 * UI never re-derives a rule (what a block costs here, whether the tier allows
 * it, whether you can pay for it) that this module already owns.
 */
export interface FacilityBuildOption {
  readonly kind: FacilityCapacityKind;
  readonly built: number;
  readonly ceiling: number;
  /** Units paid for and under construction — counted against the ceiling. */
  readonly inFlight: number;
  /** What the NEXT purchase would add: the block, clamped to the room left. */
  readonly units: number;
  /** What that purchase would cost. `0` when there is no room to build. */
  readonly cost: number;
  /** Price of one unit — the standing quote, true even at the ceiling. */
  readonly unitCost: number;
  readonly days: number;
  /** Set iff `build(kind)` would refuse right now. */
  readonly refusal?: FacilityBuildRefusal;
  /** This kind's jobs in flight, soonest landing first. */
  readonly jobs: readonly ConstructionJob[];
}

/** Outcome of a purchase attempt. A refusal changes nothing at all. */
export type FacilityBuildResult =
  | { readonly ok: true; readonly job: ConstructionJob }
  | { readonly ok: false; readonly reason: FacilityBuildRefusal };

/** Pre-construction persisted shape (#358): built capacity and nothing else. */
export interface FacilitySnapshotV1 {
  readonly schemaVersion: 1;
  readonly built: FacilityCapacity;
}

/**
 * Persisted facility state: what is built, plus what is being built (#359).
 * Ceilings are derived from the live tier, so there is nothing there to persist.
 */
export interface FacilitySnapshot {
  readonly schemaVersion: 2;
  readonly built: FacilityCapacity;
  readonly jobs: readonly ConstructionJob[];
  /** Monotonic job-id counter, so ids stay unique across a save/load. */
  readonly jobSeq: number;
}

/** Either persisted shape `restore` accepts — the live v2 or a #358 v1. */
export type AnyFacilitySnapshot = FacilitySnapshot | FacilitySnapshotV1;

/**
 * Built physical capacity, the current tier's ceiling over it, and the
 * construction that moves one toward the other.
 *
 * Built capacity is **owned state**, not a per-tier constant: tier-up raises the
 * ceiling and leaves what you have standing exactly where it was (A2 R1 —
 * "desks come with the tier, buildings are bought"). Construction spends the gap
 * with cash and days (#359).
 */
export interface Facility {
  /** What is standing today. In-flight construction is NOT counted here. */
  getBuilt(): FacilityCapacity;
  /** The most the CURRENT tier allows. Re-read per call — the tier moves. */
  getCeilings(): FacilityCapacity;
  /** One row per capacity kind, in `FACILITY_CAPACITY_KINDS` order. */
  getBuildOptions(): readonly FacilityBuildOption[];
  /** Every job in flight, soonest landing first. */
  getJobs(): readonly ConstructionJob[];
  /** Commit the next purchase for `kind`: debit cash, schedule the job. */
  build(kind: FacilityCapacityKind): FacilityBuildResult;
  snapshot(): FacilitySnapshot;
  restore(snap: AnyFacilitySnapshot): void;
}

/**
 * The narrow read every consumer takes — the "one bay truth" seam. Both
 * department packages hold this, never the whole module, so nothing outside
 * `Facility` can change what is built.
 */
export type FacilityCapacityReader = Pick<Facility, 'getBuilt' | 'getCeilings'>;
