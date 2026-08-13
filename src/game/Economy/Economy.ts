import type { EventBus } from '../EventBus';
import { DAYS_PER_WEEK } from '../GameClock';
import { loadEconomyConfig } from './economyData';
import type { EconomyConfig } from './economyData';
import { DEPARTMENT_CENTERS } from './types';
import type {
  DepartmentPnL,
  DepartmentPnLSummary,
  LedgerEntry,
  PnLSummary,
  PostTag,
  ProfitCenter,
} from './types';

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
  postRevenue(amount: number, label: string, tag?: PostTag): void;
  postExpense(amount: number, label: string, tag?: PostTag): void;
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
  postCostOfSale(amount: number, label: string, tag?: PostTag): void;
  // Bypass the solvency check. Used by failure paths (bankruptcy debt service,
  // compliance fees) where cash legitimately goes negative.
  forceDebit(amount: number, label: string, tag?: PostTag): void;
  getPnL(fromDay: number, toDay: number): PnLSummary;
  /**
   * The same window, cut by profit center (#375). Reads the same entries
   * `getPnL` does — so `sum(departments.gross) − overhead === netIncome`
   * always, for any window.
   */
  getDepartmentPnL(fromDay: number, toDay: number): DepartmentPnLSummary;
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
    tag?: PostTag,
  ): void {
    cash -= amount;
    if (tag?.category === 'inventoryAcquisition') inventoryAcquisitionSpend += amount;
    ledger.push({ day, type: 'expense', amount, label, ...tagFields(tag) });
    bus.publish('economy:expense_posted', { day, amount, label });
  }

  /**
   * The optional tag fields, spread onto an entry. Omitted keys rather than
   * `undefined` values, so an untagged entry snapshots byte-identical to a
   * pre-#255/#375 one and a `toEqual` against a plain object still holds.
   */
  function tagFields(tag?: PostTag): Partial<LedgerEntry> {
    return {
      ...(tag?.category ? { category: tag.category } : {}),
      ...(tag?.profitCenter ? { profitCenter: tag.profitCenter } : {}),
    };
  }

  /**
   * The window's entries as the P&L sees them — the ONE filter both reads
   * share (#375). If the department cut ever applied a different filter, its
   * four grosses would stop adding up to the Net Income printed beside them,
   * which is the exact defect the panel exists to close.
   *
   * **A CATEGORIZED entry is dropped whole** (#392). The category axis names a
   * balance-sheet movement — cash that changed form rather than money earned or
   * spent — so "categorized" and "no P&L effect" are the same fact, stated
   * once. That was already true of the single `inventoryAcquisition` member
   * this filter used to name by hand; reading the axis instead of the member is
   * what let `financing` join it without a second exclusion list that could
   * drift. Behavior is unchanged for every entry written before #392.
   */
  function pnlEntries(fromDay: number, toDay: number): readonly LedgerEntry[] {
    return ledger.filter(
      (e) => e.day >= fromDay && e.day <= toDay && e.category === undefined,
    );
  }

  return {
    get cash() { return cash; },
    get inventoryAcquisitionSpend() { return inventoryAcquisitionSpend; },

    postRevenue(amount, label, tag) {
      cash += amount;
      const day = getCurrentDay();
      ledger.push({ day, type: 'revenue', amount, label, ...tagFields(tag) });
      bus.publish('economy:revenue_posted', { day, amount, label });
    },

    postExpense(amount, label, tag) {
      if (cash < amount) {
        throw new Error(`Insufficient cash (have ${cash}, need ${amount})`);
      }
      postExpenseInternal(getCurrentDay(), amount, label, tag);
    },

    forceDebit(amount, label, tag) {
      postExpenseInternal(getCurrentDay(), amount, label, tag);
    },

    postCostOfSale(amount, label, tag) {
      ledger.push({
        day: getCurrentDay(),
        type: 'expense',
        amount,
        label,
        nonCash: true,
        ...tagFields(tag),
      });
    },

    /**
     * The P&L, and since #374 an ACCRUAL one: it reports what the window
     * earned, not what its bank account did.
     *
     * **Categorized entries are dropped whole** — from the totals AND from
     * `entries` — because a category names a balance-sheet movement. Buying a
     * car converts cash into stock, and the cost comes back as the `nonCash`
     * relief on the day that car sells; drawing on the credit line (#392)
     * converts a debt into cash, and it costs what the interest costs.
     * Leaving either in `entries` would put a line on the expense breakdown
     * under a Net Income that does not count it — two numbers on one screen
     * that cannot be added up, which is the exact defect this read exists to
     * close.
     */
    getPnL(fromDay, toDay) {
      const entries = pnlEntries(fromDay, toDay);
      const totalRevenue = entries
        .filter((e) => e.type === 'revenue')
        .reduce((sum, e) => sum + e.amount, 0);
      const totalExpenses = entries
        .filter((e) => e.type === 'expense')
        .reduce((sum, e) => sum + e.amount, 0);
      return { totalRevenue, totalExpenses, netIncome: totalRevenue - totalExpenses, entries };
    },

    /**
     * The same window cut by profit center (#375) — which of the store's four
     * businesses made the money, and what the building cost to run.
     *
     * Every center is reported, active or not, so a consumer never has to
     * guess whether a missing key means "nothing" or "not built yet"; `active`
     * is the flag a surface reads to omit a bar rather than draw a zero.
     */
    getDepartmentPnL(fromDay, toDay) {
      const entries = pnlEntries(fromDay, toDay);
      const revenue = new Map<ProfitCenter, number>();
      const cost = new Map<ProfitCenter, number>();
      const touched = new Set<ProfitCenter>();

      for (const e of entries) {
        // Untagged ⇒ overhead. The default is the rule, not a fallback: it is
        // what keeps every pre-#375 entry and every untagged harness post
        // below the gross line instead of flattering a department.
        const center = e.profitCenter ?? 'store';
        touched.add(center);
        const into = e.type === 'revenue' ? revenue : cost;
        into.set(center, (into.get(center) ?? 0) + e.amount);
      }

      const departments: readonly DepartmentPnL[] = DEPARTMENT_CENTERS.map((center) => {
        const rev = revenue.get(center) ?? 0;
        const cos = cost.get(center) ?? 0;
        return { center, revenue: rev, costOfSale: cos, gross: rev - cos, active: touched.has(center) };
      });

      const overhead = (cost.get('store') ?? 0) - (revenue.get('store') ?? 0);
      const netIncome = departments.reduce((sum, d) => sum + d.gross, 0) - overhead;
      return { departments, overhead, netIncome };
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
