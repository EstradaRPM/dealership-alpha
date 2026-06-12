import type { EventBus } from '../EventBus';
import { DAYS_PER_WEEK } from '../GameClock';
import { loadEconomyConfig } from './economyData';
import type { EconomyConfig } from './economyData';
import type { ExpenseCategory, LedgerEntry, PnLSummary } from './types';

/**
 * Persistence surface for Economy (#188). Module-owned `schemaVersion`, same as
 * GameClock. The tracer slice persists only the cash balance — the running
 * ledger (used for P&L windows) is a later world-snapshot slice; on restore the
 * ledger starts empty, so a P&L query over pre-restore days reads zero until
 * the ledger itself is round-tripped.
 */
export interface EconomySnapshot {
  readonly schemaVersion: 1;
  readonly cash: number;
  /**
   * Lifetime cash spent acquiring stock (#255). Optional because pre-#255
   * snapshots lack it; restore defaults it to 0.
   */
  readonly inventoryAcquisitionSpend?: number;
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
  config?: EconomyConfig;
}

export function createEconomy(deps: EconomyDeps): Economy {
  const { bus } = deps;
  const config = deps.config ?? loadEconomyConfig();

  let cash = deps.startingCash;
  let currentDay = 1;
  let inventoryAcquisitionSpend = 0;
  const ledger: LedgerEntry[] = [];

  // Track which day is active via day_ended so expenses/revenues posted after
  // advanceDay() are stamped with the day that just concluded.
  bus.subscribe('clock:day_ended', ({ day }) => {
    currentDay = day;
  });

  bus.subscribe('clock:overnight_payroll', ({ day }) => {
    if (day % DAYS_PER_WEEK === 0) {
      postExpenseInternal(day, config.weeklyRent, 'Rent');
      postExpenseInternal(day, config.weeklyPayrollStub, 'Payroll');
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
      ledger.push({ day: currentDay, type: 'revenue', amount, label });
      bus.publish('economy:revenue_posted', { day: currentDay, amount, label });
    },

    postExpense(amount, label, category) {
      if (cash < amount) {
        throw new Error(`Insufficient cash (have ${cash}, need ${amount})`);
      }
      postExpenseInternal(currentDay, amount, label, category);
    },

    forceDebit(amount, label, category) {
      postExpenseInternal(currentDay, amount, label, category);
    },

    getPnL(fromDay, toDay) {
      const entries = ledger.filter((e) => e.day >= fromDay && e.day <= toDay);
      const totalRevenue = entries
        .filter((e) => e.type === 'revenue')
        .reduce((sum, e) => sum + e.amount, 0);
      const totalExpenses = entries
        .filter((e) => e.type === 'expense')
        .reduce((sum, e) => sum + e.amount, 0);
      return { totalRevenue, totalExpenses, netIncome: totalRevenue - totalExpenses, entries };
    },

    snapshot() {
      return { schemaVersion: 1, cash, inventoryAcquisitionSpend };
    },

    restore(snap) {
      cash = snap.cash;
      // Pre-#255 snapshots lack the field → start the lifetime counter at 0.
      // The Home delta diffs it across day closes, so only growth matters.
      inventoryAcquisitionSpend = snap.inventoryAcquisitionSpend ?? 0;
    },
  };
}
