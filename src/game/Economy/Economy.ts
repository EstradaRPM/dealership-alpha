import type { EventBus } from '../EventBus';
import { DAYS_PER_WEEK } from '../GameClock';
import { loadEconomyConfig } from './economyData';
import type { EconomyConfig } from './economyData';
import type { LedgerEntry, PnLSummary } from './types';

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
}

export interface Economy {
  readonly cash: number;
  postRevenue(amount: number, label: string): void;
  postExpense(amount: number, label: string): void;
  // Bypass the solvency check. Used by failure paths (bankruptcy debt service,
  // compliance fees) where cash legitimately goes negative.
  forceDebit(amount: number, label: string): void;
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

  function postExpenseInternal(day: number, amount: number, label: string): void {
    cash -= amount;
    ledger.push({ day, type: 'expense', amount, label });
    bus.publish('economy:expense_posted', { day, amount, label });
  }

  return {
    get cash() { return cash; },

    postRevenue(amount, label) {
      cash += amount;
      ledger.push({ day: currentDay, type: 'revenue', amount, label });
      bus.publish('economy:revenue_posted', { day: currentDay, amount, label });
    },

    postExpense(amount, label) {
      if (cash < amount) {
        throw new Error(`Insufficient cash (have ${cash}, need ${amount})`);
      }
      postExpenseInternal(currentDay, amount, label);
    },

    forceDebit(amount, label) {
      postExpenseInternal(currentDay, amount, label);
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
      return { schemaVersion: 1, cash };
    },

    restore(snap) {
      cash = snap.cash;
    },
  };
}
