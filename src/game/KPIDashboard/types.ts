export interface DealRecord {
  /**
   * In-game day the deal closed on (#351). `deal:closed` carries no day, so the
   * module reads the clock through an injected `getCurrentDay` provider — a
   * range query can then window the log without every publisher growing a
   * field, and there is no private cursor to fall out of step with the clock.
   *
   * Deals restored from a pre-#351 save carry `0`: they are real (they still
   * count toward a lifetime read) but they predate day stamping, so they fall
   * outside every day-1-and-later window rather than being attributed to a day
   * they did not happen on.
   */
  day: number;
  frontGross: number;
  /** `productGross + reserveGross` (#365). */
  backGross: number;
  /**
   * The two halves of the back end (#365). Optional because a save written
   * before the split has neither: `restore` materializes them as zeroes rather
   * than guessing, so a pre-#365 deal reads as "back gross, unattributed"
   * instead of silently claiming reserve the store never earned.
   */
  productGross?: number;
  reserveGross?: number;
  daysInInventory: number;
  agreedPrice: number;
  paymentMethod: 'cash' | 'finance';
  downPayment: number;
  term: number;
  apr: number;
}

/** An inclusive in-game day window. Both bounds are day indices, not offsets. */
export interface DayRange {
  readonly fromDay: number;
  readonly toDay: number;
}

/**
 * One day's retail flow (#351) — the series behind a sparkline or the hero
 * trend chart. Emitted for **every** day in the queried range, including days
 * with no deals, so a gap in trading draws as a zero rather than closing up
 * and misreporting the shape.
 */
export interface KPIDayTotals {
  readonly day: number;
  readonly units: number;
  readonly frontGross: number;
  readonly backGross: number;
  /** `backGross` split into its two halves (#365). */
  readonly productGross: number;
  readonly reserveGross: number;
  /** `frontGross + backGross` — total gross written that day. */
  readonly gross: number;
}

/**
 * Save/load blob (#193). Self-versioned per the #188 contract. Persists the
 * raw `DealRecord` log (KPIs are derived on read, so the log is the source of
 * truth) plus the latest daily carrying-cost reading, keeping the dashboard
 * continuous across sessions. Distinct from `KPISnapshot`, which is the
 * computed read-model returned by `getSnapshot()`.
 */
export interface KPIDashboardSnapshot {
  readonly schemaVersion: 1;
  readonly deals: readonly DealRecord[];
  readonly dailyCarryingCost: number;
}

/**
 * One deal structure's share of the back end (#152). `perUnit` is the
 * comparable number — the whole point of the split is that the same store earns
 * a different back end per car depending on how the car was paid for, and a
 * total only says which structure was commonest.
 */
export interface BackEndBucket {
  readonly units: number;
  readonly backGross: number;
  readonly productGross: number;
  readonly reserveGross: number;
  /** `backGross / units`; 0 with no units, never a divide-by-zero. */
  readonly perUnit: number;
}

/**
 * Back end split by how the deal was structured (#152) — the surface where
 * loan-sensitive attach becomes visible. The three buckets are **disjoint and
 * exhaustive**: every retailed unit lands in exactly one, so their `backGross`
 * sums to the window's total back gross. `heavyDown` is financed too, so it is
 * carved OUT of `standardFinance` rather than sitting inside it (unlike
 * `KPISnapshot.financeUnits`, which counts both).
 */
export interface BackEndByStructure {
  /** Paid in full. No note, so no reserve and no GAP. */
  readonly cash: BackEndBucket;
  /** Financed with less than `HEAVY_DOWN_THRESHOLD` down — the biggest note. */
  readonly standardFinance: BackEndBucket;
  /** Financed with a large down payment, so a small note to protect. */
  readonly heavyDown: BackEndBucket;
}

export interface KPISnapshot {
  unitsRetailed: number;
  pvr: number;
  fniPpru: number;
  avgFrontGross: number;
  avgBackGross: number;
  /**
   * Window TOTALS for the two halves of the back end (#365) — totals, not
   * averages, so the Finance tab's breakdown adds up to the gross it sits
   * beside instead of being an average multiplied back out.
   */
  productGross: number;
  reserveGross: number;
  avgDii: number;
  cashUnits: number;
  cashGross: number;
  financeUnits: number;
  financeGross: number;
  heavyDownUnits: number;
  /** @see BackEndByStructure */
  backEndByStructure: BackEndByStructure;
  avgApr: number;
  avgTerm: number;
  avgDownPct: number;
  /**
   * Total floorplan + carrying cost burned on the most recent day (#173), off
   * the latest `economy:carrying_cost_posted`. The day's lot-wide burn rate;
   * full month-to-date aggregation lands in slice #25.
   */
  dailyCarryingCost: number;
}
