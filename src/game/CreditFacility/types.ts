/**
 * Why a draw was refused (#392). A refusal changes nothing at all — the same
 * rule construction follows (`Facility.build`): cash and the balance are read
 * before anything moves, so a "no" is inert.
 */
export type CreditDrawRefusal =
  /** Zero or negative, or not a finite number. A non-move is not a draw. */
  | 'invalid-amount'
  /**
   * The draw would take the standing balance past the limit. Refused WHOLE
   * rather than clamped down to the headroom: a button that quietly hands you
   * less than you asked for is a second rule, and the player already reads
   * `available` off `getFacility()`.
   */
  | 'over-limit';

/** Why a repayment was refused (#392). Same inert-refusal rule as a draw. */
export type CreditRepayRefusal =
  | 'invalid-amount'
  /** More than is standing. There is nothing there to pay down. */
  | 'over-balance'
  /** More than the store has in the bank. */
  | 'cannot-afford';

/**
 * The outcome of a draw or a repayment. `amount` is what actually moved, and
 * on a refusal nothing did.
 */
export type CreditFacilityResult<R> =
  | { readonly ok: true; readonly amount: number }
  | { readonly ok: false; readonly reason: R };

/**
 * Everything a surface needs to draw the facility, in one read (#392). The UI
 * re-derives none of these rules — the same doctrine `Facility.getBuildOptions`
 * holds, and the reason `maxRepayment` is stated here rather than left as a
 * `Math.min` on a screen.
 */
export interface CreditFacilityState {
  /** Set once at career start and never moved by anything in the engine. */
  readonly limit: number;
  /** What is standing and costing interest right now. */
  readonly drawn: number;
  /** `limit - drawn`. The largest draw that would not be refused. */
  readonly available: number;
  /** `min(cash, drawn)`. The largest repayment that would not be refused. */
  readonly maxRepayment: number;
  /** Lifetime interest this facility has cost. Cumulative, never reset. */
  readonly interestPaidToDate: number;
  /**
   * What the standing balance will cost at the next morning's charge, in whole
   * dollars — the same number the engine posts, computed by the same rule.
   * Zero when nothing is drawn.
   */
  readonly dailyInterest: number;
  /** The annual rate the facility is priced at, as a decimal. */
  readonly apr: number;
}

/**
 * Persistence surface (#392). Module-owned `schemaVersion`, the house shape.
 */
export interface CreditFacilitySnapshot {
  readonly schemaVersion: 1;
  /**
   * ABSENT in the blob a pre-#392 save migrates to, and that absence is the
   * whole point: a career saved before the facility existed never borrowed, and
   * its limit is whatever its founder's credit is worth — which the freshly
   * built world has already resolved from the persisted character profile.
   * Restoring a synthetic 0 over it would silently strip the facility from
   * every banker's career that predates this module. `snapshot()` always
   * writes it; only the migration's default leaves it off.
   */
  readonly limit?: number;
  readonly drawn: number;
  readonly interestPaidToDate: number;
}

export interface CreditFacility {
  /** The one read. Everything a surface needs, nothing it has to derive. */
  getFacility(): CreditFacilityState;
  draw(amount: number): CreditFacilityResult<CreditDrawRefusal>;
  repay(amount: number): CreditFacilityResult<CreditRepayRefusal>;
  snapshot(): CreditFacilitySnapshot;
  restore(snap: CreditFacilitySnapshot): void;
}
