/**
 * Structural ledger tag (#255, widened by #392). Labels stay the human-readable
 * grouping for the KPI dashboard; the category is for machine consumers.
 *
 * **A category names a BALANCE-SHEET movement — cash that changed form rather
 * than money the store earned or spent.** That is the whole rule, and it is
 * what `getPnL` reads: a categorized entry moves cash and has no P&L effect, an
 * uncategorized one is the P&L. Both members are that same fact:
 *
 * - `inventoryAcquisition` — cash converted into stock (auction purchase price,
 *   a trade allowance). **NOT** the diligence/process costs around the buy
 *   (inspection, recon, carrying), which are real operating spend.
 * - `financing` — cash borrowed against, or repaid to, the credit facility
 *   (#392). A draw is not income and a repayment is not an expense; the
 *   *interest* is, and carries no category at all.
 *
 * Only `inventoryAcquisition` feeds the lifetime `inventoryAcquisitionSpend`
 * accumulator behind the Home cash-delta ops/stock split.
 */
export type LedgerCategory = 'inventoryAcquisition' | 'financing';

/**
 * Which profit center a post belongs to (#375) — the departmental axis of the
 * P&L, and the machine-readable sibling of the human `label`, exactly as
 * `ExpenseCategory` is.
 *
 * `store` is overhead: rent, payroll, hiring, marketing, wire subscriptions,
 * construction, legal — everything the four departments are run *out of*
 * rather than earned *by*. It is also what an untagged post means, which is
 * what keeps every pre-#375 entry (and every harness that posts without a tag)
 * below the gross line instead of being silently credited to a department it
 * did not come from.
 */
export type ProfitCenter = 'sales' | 'fni' | 'service' | 'bodyshop' | 'store';

/**
 * The four earning centers, in reporting order, excluding `store`. Fixed order
 * so the Finance panel's bars never reshuffle between windows.
 */
export const DEPARTMENT_CENTERS: readonly ProfitCenter[] = [
  'sales',
  'fni',
  'service',
  'bodyshop',
] as const;

/** How each center reads on a player-facing surface. */
export const PROFIT_CENTER_LABELS: Readonly<Record<ProfitCenter, string>> = {
  sales: 'Sales',
  fni: 'F&I',
  service: 'Service',
  // "Body Shop" is 9 characters — inside the horizontal BarChart's ~13-char
  // name column, which is where "Finance Reserve" got clipped in #365.
  bodyshop: 'Body Shop',
  store: 'Store',
};

/**
 * The optional tag every ledger post may carry. A named object rather than
 * trailing positional arguments: a post site that wants only a profit center
 * should not have to write `undefined` in the category slot, and the next axis
 * added here changes no existing call site.
 *
 * ONE tag type for both directions (#392). It was split into a `PostTag` for
 * revenue and an `ExpenseTag` for expenses while `category` could only mean
 * "cash converted into stock" — and stock is only ever bought. Now that the
 * category names a balance-sheet movement, a *receipt* can be one too (a credit
 * draw is cash in against a debt), and two near-identical tag types would be
 * two places to state one axis.
 */
export interface PostTag {
  profitCenter?: ProfitCenter;
  category?: LedgerCategory;
}

export interface LedgerEntry {
  day: number;
  type: 'revenue' | 'expense';
  amount: number;
  label: string;
  category?: LedgerCategory;
  /**
   * Departmental attribution (#375). Optional and omitted for `store`, so a
   * pre-#375 ledger restores byte-identical and reads as overhead — which is
   * what an untagged post has always meant.
   */
  profitCenter?: ProfitCenter;
  /**
   * Accrual marker (#374). Cash movement and P&L effect are orthogonal, and
   * this is the half that hits the statement without touching the balance: the
   * cost of a vehicle sold is relieved out of stock on the day it leaves the
   * lot, weeks after the cash for it left. Only `postCostOfSale` writes it.
   *
   * Optional and only ever `true`, so a pre-#374 ledger restores unchanged and
   * reads as what it was — all cash.
   */
  nonCash?: true;
}

export interface PnLSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  entries: readonly LedgerEntry[];
}

/** One department's line on the departmental P&L (#375). */
export interface DepartmentPnL {
  readonly center: ProfitCenter;
  readonly revenue: number;
  /**
   * Everything posted *against* this department's revenue in the window — the
   * cost of the cars it sold, its recon and carrying, its parts. Named cost of
   * sale rather than "expenses" because store overhead is deliberately not in
   * it: techs and advisors draw one aggregate daily wage in this sim, and
   * splitting one payroll bill across departments would need a second wage
   * model. So the statement is the classic one — departmental gross, less store
   * overhead, equals net income.
   */
  readonly costOfSale: number;
  readonly gross: number;
  /** False ⇒ the window holds no post for this center at all (not "zero"). */
  readonly active: boolean;
}

/**
 * The P&L cut by department (#375). The identity
 * `sum(departments.gross) − overhead === netIncome` holds for every window,
 * which is the whole reason the panel can be trusted; it is only available
 * because #374 made the statement accrual.
 */
export interface DepartmentPnLSummary {
  /** Always all four centers, in `DEPARTMENT_CENTERS` order. */
  readonly departments: readonly DepartmentPnL[];
  /**
   * Net store-level cost: `store` expenses less any `store` revenue. Stated net
   * so the reconciliation is one subtraction — a store-center receipt (a PE
   * sellout, an admin injection) is not a department's gross and has nowhere
   * else honest to go.
   */
  readonly overhead: number;
  /** Identical to `getPnL(fromDay, toDay).netIncome` over the same window. */
  readonly netIncome: number;
}
