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
  backGross: number;
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

export interface KPISnapshot {
  unitsRetailed: number;
  pvr: number;
  fniPpru: number;
  avgFrontGross: number;
  avgBackGross: number;
  avgDii: number;
  cashUnits: number;
  cashGross: number;
  financeUnits: number;
  financeGross: number;
  heavyDownUnits: number;
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
