/**
 * Structural expense tag (#255). Labels stay the human-readable grouping for
 * the KPI dashboard; the category is for machine consumers (the Home cash-delta
 * ops/stock split). `inventoryAcquisition` = cash converted into stock (auction
 * purchase price) — NOT diligence/process costs around the buy (inspection,
 * recon, carrying), which remain operating spend.
 */
export type ExpenseCategory = 'inventoryAcquisition';

export interface LedgerEntry {
  day: number;
  type: 'revenue' | 'expense';
  amount: number;
  label: string;
  category?: ExpenseCategory;
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
