export interface LedgerEntry {
  day: number;
  type: 'revenue' | 'expense';
  amount: number;
  label: string;
}

export interface PnLSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  entries: readonly LedgerEntry[];
}
