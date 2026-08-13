import type { EventBus } from '../EventBus';
import type { PostTag } from '../Economy';
import {
  dailyInterestOn,
  drawStepsFor,
  loadCreditFacilityData,
  type CreditFacilityDataTable,
} from './creditFacilityData';
import type {
  CreditDrawRefusal,
  CreditFacility,
  CreditFacilityResult,
  CreditFacilitySnapshot,
  CreditFacilityState,
  CreditRepayRefusal,
} from './types';

/** The ledger lines this module writes. One label per movement, stated once. */
export const CREDIT_DRAW_LABEL = 'Credit line draw';
export const CREDIT_REPAYMENT_LABEL = 'Credit line repayment';
export const CREDIT_INTEREST_LABEL = 'Credit line interest';

/**
 * The narrow slice of `Economy` this module banks through (#392). It moves cash
 * three ways and never reads the ledger back.
 */
export interface CreditFacilityBank {
  readonly cash: number;
  postRevenue(amount: number, label: string, tag?: PostTag): void;
  postExpense(amount: number, label: string, tag?: PostTag): void;
  forceDebit(amount: number, label: string, tag?: PostTag): void;
}

export interface CreditFacilityDeps {
  bus: EventBus;
  /** Where drawn cash lands and where interest is paid from. */
  economy: CreditFacilityBank;
  /**
   * The facility's ceiling, in dollars, decided once at career start. A plain
   * number: this module is handed a limit and never learns where it came from,
   * which is the #390 rule that keeps the founder's picks out of the engine.
   * **Zero is a facility that cannot be drawn, not an absent facility** — one
   * code path, so no surface and no test branches on who the player is.
   */
  limit: number;
  /**
   * Live current-day read, not a latched cursor — a restore fires no clock
   * event, and every published payload is day-stamped.
   */
  getCurrentDay: () => number;
  /** Catalog; injectable so a test can state the rate it is exercising. */
  data?: CreditFacilityDataTable;
}

/**
 * What a career that predates this module restores to (#392): nothing borrowed,
 * nothing paid, and **no limit** — see `CreditFacilitySnapshot.limit` for why
 * the absence is deliberate rather than a zero.
 */
export function createDefaultCreditFacilitySnapshot(): CreditFacilitySnapshot {
  return { schemaVersion: 1, drawn: 0, interestPaidToDate: 0 };
}

/**
 * The CreditFacility module (#392, F2-R1): money the store can reach for, at a
 * price.
 *
 * It is the third genuinely different opening the founder's pick can buy — a
 * sharper eye, more money now, or **money you can reach for later at a cost**.
 * The facility never calls the balance and never forces a repayment: what it
 * does is make every borrowed dollar quietly dearer than the one before it,
 * until the store either sells its way out or runs the cash down. A store that
 * cannot pay a day's interest goes negative, which the bankruptcy machinery
 * already reads — the same call #379 made about a trade the store cannot cover.
 *
 * **One rule for the cost.** Every morning, the balance the day opens with is
 * charged a day's interest. Money drawn today first costs tomorrow morning;
 * money repaid today stops costing tomorrow morning. There is no intra-day
 * proration, no compounding schedule and no second rule — the player learns one
 * sentence and can predict every charge from it.
 *
 * **A draw is not income and a repayment is not an expense.** Both are
 * balance-sheet movements — cash changing form against a debt — so both are
 * posted with a `financing` category and dropped whole from the P&L, exactly as
 * an auction purchase is (#374). Only the interest is a real cost, and it lands
 * as plain store overhead. A draw booked as revenue would flatter Net Income by
 * the size of the loan, which is the one thing the Finance statement cannot do.
 */
export function createCreditFacility(deps: CreditFacilityDeps): CreditFacility {
  const { bus, economy } = deps;
  const data = deps.data ?? loadCreditFacilityData();

  let limit = Math.max(0, deps.limit);
  let drawn = 0;
  let interestPaidToDate = 0;

  // The morning charge. `forceDebit` rather than `postExpense` because interest
  // accrues whether or not the store can pay it — a throw here would abort the
  // day over a bill the lender is owed regardless. Untagged by category, so it
  // is what it is: operating spend, on the store's own profit center.
  bus.subscribe('clock:day_started', () => {
    const interest = dailyInterestOn(drawn, data);
    if (interest <= 0) return;
    interestPaidToDate += interest;
    economy.forceDebit(interest, CREDIT_INTEREST_LABEL, { profitCenter: 'store' });
  });

  function usable(amount: number): boolean {
    return Number.isFinite(amount) && amount > 0;
  }

  return {
    getFacility(): CreditFacilityState {
      return {
        limit,
        drawn,
        available: limit - drawn,
        maxRepayment: Math.min(Math.max(0, economy.cash), drawn),
        interestPaidToDate,
        dailyInterest: dailyInterestOn(drawn, data),
        apr: data.apr,
        drawSteps: drawStepsFor(limit, data),
      };
    },

    draw(amount): CreditFacilityResult<CreditDrawRefusal> {
      if (!usable(amount)) return { ok: false, reason: 'invalid-amount' };
      if (drawn + amount > limit) return { ok: false, reason: 'over-limit' };
      drawn += amount;
      economy.postRevenue(amount, CREDIT_DRAW_LABEL, { category: 'financing' });
      bus.publish('credit:drawn', {
        day: deps.getCurrentDay(),
        amount,
        drawn,
        limit,
      });
      return { ok: true, amount };
    },

    repay(amount): CreditFacilityResult<CreditRepayRefusal> {
      if (!usable(amount)) return { ok: false, reason: 'invalid-amount' };
      if (amount > drawn) return { ok: false, reason: 'over-balance' };
      if (amount > economy.cash) return { ok: false, reason: 'cannot-afford' };
      drawn -= amount;
      // `postExpense` (which throws when the cash is not there) rather than
      // `forceDebit`: the affordability check above has already been made, so a
      // throw here would mean the two reads disagreed — an invariant break worth
      // hearing about, not a failure path to absorb.
      economy.postExpense(amount, CREDIT_REPAYMENT_LABEL, { category: 'financing' });
      bus.publish('credit:repaid', {
        day: deps.getCurrentDay(),
        amount,
        drawn,
        limit,
      });
      return { ok: true, amount };
    },

    snapshot() {
      return { schemaVersion: 1 as const, limit, drawn, interestPaidToDate };
    },

    restore(snap) {
      // An absent limit keeps the one the world was constructed with — the
      // pre-#392 migration case. See `CreditFacilitySnapshot.limit`.
      limit = snap.limit ?? limit;
      drawn = snap.drawn;
      interestPaidToDate = snap.interestPaidToDate;
    },
  };
}
