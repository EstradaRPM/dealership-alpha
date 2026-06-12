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
}

export interface PnLSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  entries: readonly LedgerEntry[];
}
