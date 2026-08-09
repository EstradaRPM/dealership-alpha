import type { EventBus } from '../EventBus';
import { DAYS_PER_WEEK } from '../GameClock';
import { loadEconomyConfig } from './economyData';
import type { EconomyConfig } from './economyData';
import type { ExpenseCategory, LedgerEntry, PnLSummary } from './types';

/**
 * Persistence surface for Economy (#188). Module-owned `schemaVersion`, same as
 * GameClock.
 */
export interface EconomySnapshot {
  readonly schemaVersion: 1;
  readonly cash: number;
  /**
   * Lifetime cash spent acquiring stock (#255). Optional because pre-#255
   * snapshots lack it; restore defaults it to 0.
   */
  readonly inventoryAcquisitionSpend?: number;
  /**
   * The running ledger (#351). Persisted whole and never pruned: it IS the P&L,
   * and a window that silently loses its early days reports a profit the
   * business did not make. Every entry is day-stamped, so the cost of keeping
   * it is linear in career length and the Finance dashboard's range queries
   * survive a save/load.
   *
   * Optional because pre-#351 snapshots lack it; those restore to an empty
   * ledger, so a P&L over days that predate the upgrade reads zero — the state
   * every save was already in before this field existed.
   */
  readonly ledger?: readonly LedgerEntry[];
}

export interface Economy {
  readonly cash: number;
  /**
   * Lifetime cash spent on `inventoryAcquisition`-categorized expenses (#255).
   * Cumulative, never reset — the Home cash-delta split diffs it across day
   * closes the same way it diffs `cash`, so no per-day windowing lives here.
   */
  readonly inventoryAcquisitionSpend: number;
  postRevenue(amount: number, label: string): void;
  postExpense(amount: number, label: string, category?: ExpenseCategory): void;
  /**
   * Relieve the cost of a unit that just left the lot (#374). Writes a
   * `nonCash` expense entry and **does not touch cash** — the money for that
   * car left when it was bought, and posting the relief through `postExpense`
   * would debit the store twice for one vehicle.
   *
   * Publishes nothing, deliberately: `economy:expense_posted` means cash moved
   * (Telemetry's `cashCurve` is its only consumer and is a cash curve). A P&L
   * reader wants `getPnL`, which is where this entry shows up.
   */
  postCostOfSale(amount: number, label: string): void;
  // Bypass the solvency check. Used by failure paths (bankruptcy debt service,
  // compliance fees) where cash legitimately goes negative.
  forceDebit(amount: number, label: string, category?: ExpenseCategory): void;
  getPnL(fromDay: number, toDay: number): PnLSummary;
  /** #188 SaveStore seam: capture/rehydrate the cash balance. */
  snapshot(): EconomySnapshot;
  restore(snap: EconomySnapshot): void;
}

export interface EconomyDeps {
  bus: EventBus;
  startingCash: number;
  /**
   * Live current-day read — the clock's `currentDay` (#351), the same provider
   * shape `TierGate` takes. Every ledger entry is stamped with it.
   *
   * The clock's own ordering makes this exactly right at both edges: during
   * `advanceDay` the overnight phases run BEFORE the day index increments, so
   * payroll/rent/carrying land on the day that just concluded, and everything
   * posted during trading lands on the open day. A private cursor latched off
   * the bus got the second case wrong by one day, and read 1 for the rest of a
   * session resumed from a save (a restore fires no clock event).
   *
   * Optional only as a test seam; defaults to day 1.
   */
  getCurrentDay?: () => number;
  config?: EconomyConfig;
}

export function createEconomy(deps: EconomyDeps): Economy {
  const { bus } = deps;
  const config = deps.config ?? loadEconomyConfig();

  let cash = deps.startingCash;
  const getCurrentDay = deps.getCurrentDay ?? (() => 1);
  let inventoryAcquisitionSpend = 0;
  const ledger: LedgerEntry[] = [];

  // Rent only. The "Payroll" line on this same overnight phase is posted by
  // StaffOrg now (#353) — it owns the roster, so it owns the salary book, and
  // Economy posts what it is handed.
  bus.subscribe('clock:overnight_payroll', ({ day }) => {
    if (day % DAYS_PER_WEEK === 0) {
      postExpenseInternal(day, config.weeklyRent, 'Rent');
    }
  });

  function postExpenseInternal(
    day: number,
    amount: number,
    label: string,
    category?: ExpenseCategory,
  ): void {
    cash -= amount;
    if (category === 'inventoryAcquisition') inventoryAcquisitionSpend += amount;
    ledger.push({ day, type: 'expense', amount, label, ...(category ? { category } : {}) });
    bus.publish('economy:expense_posted', { day, amount, label });
  }

  return {
    get cash() { return cash; },
    get inventoryAcquisitionSpend() { return inventoryAcquisitionSpend; },

    postRevenue(amount, label) {
      cash += amount;
      const day = getCurrentDay();
      ledger.push({ day, type: 'revenue', amount, label });
      bus.publish('economy:revenue_posted', { day, amount, label });
    },

    postExpense(amount, label, category) {
      if (cash < amount) {
        throw new Error(`Insufficient cash (have ${cash}, need ${amount})`);
      }
      postExpenseInternal(getCurrentDay(), amount, label, category);
    },

    forceDebit(amount, label, category) {
      postExpenseInternal(getCurrentDay(), amount, label, category);
    },

    postCostOfSale(amount, label) {
      ledger.push({ day: getCurrentDay(), type: 'expense', amount, label, nonCash: true });
    },

    /**
     * The P&L, and since #374 an ACCRUAL one: it reports what the window
     * earned, not what its bank account did.
     *
     * `inventoryAcquisition` entries are dropped whole — from the totals AND
     * from `entries`. Buying a car converts cash into stock; it is a cash
     * movement with no P&L effect, and the cost comes back as the `nonCash`
     * relief on the day that car sells. Leaving them in `entries` would put
     * "Auction purchase" on the expense breakdown under a Net Income that does
     * not count it — two numbers on one screen that cannot be added up, which
     * is the exact defect this read exists to close.
     */
    getPnL(fromDay, toDay) {
      const entries = ledger.filter(
        (e) => e.day >= fromDay && e.day <= toDay && e.category !== 'inventoryAcquisition',
      );
      const totalRevenue = entries
        .filter((e) => e.type === 'revenue')
        .reduce((sum, e) => sum + e.amount, 0);
      const totalExpenses = entries
        .filter((e) => e.type === 'expense')
        .reduce((sum, e) => sum + e.amount, 0);
      return { totalRevenue, totalExpenses, netIncome: totalRevenue - totalExpenses, entries };
    },

    snapshot() {
      return {
        schemaVersion: 1 as const,
        cash,
        inventoryAcquisitionSpend,
        ledger: ledger.map((e) => ({ ...e })),
      };
    },

    restore(snap) {
      cash = snap.cash;
      // Pre-#255 snapshots lack the field → start the lifetime counter at 0.
      // The Home delta diffs it across day closes, so only growth matters.
      inventoryAcquisitionSpend = snap.inventoryAcquisitionSpend ?? 0;
      // #351: the ledger round-trips, so a P&L window spanning a save/load is
      // continuous. Pre-#351 snapshots restore empty (the prior behaviour).
      ledger.length = 0;
      ledger.push(...(snap.ledger ?? []).map((e) => ({ ...e })));
    },
  };
}
