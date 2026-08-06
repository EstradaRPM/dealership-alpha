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

/** Persisted facility state: what is built. Ceilings are derived from the tier. */
export interface FacilitySnapshot {
  readonly schemaVersion: 1;
  readonly built: FacilityCapacity;
}

/**
 * Built physical capacity, and the current tier's ceiling over it.
 *
 * Built capacity is **owned state**, not a per-tier constant: tier-up raises the
 * ceiling and leaves what you have standing exactly where it was (A2 R1 —
 * "desks come with the tier, buildings are bought"). Construction spends the gap
 * (#359).
 */
export interface Facility {
  /** What is standing today. */
  getBuilt(): FacilityCapacity;
  /** The most the CURRENT tier allows. Re-read per call — the tier moves. */
  getCeilings(): FacilityCapacity;
  snapshot(): FacilitySnapshot;
  restore(snap: FacilitySnapshot): void;
}

/**
 * The narrow read every consumer takes — the "one bay truth" seam. Both
 * department packages hold this, never the whole module, so nothing outside
 * `Facility` can change what is built.
 */
export type FacilityCapacityReader = Pick<Facility, 'getBuilt' | 'getCeilings'>;
