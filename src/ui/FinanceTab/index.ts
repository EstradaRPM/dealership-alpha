/**
 * The Finance tab (#351) — the analytics dashboard and its two sibling
 * screens. Everything a consumer may import lives on this barrel; the views
 * are presentation-only and the models are pure.
 */
export { FinanceTab } from './FinanceTab';
export type { FinanceTabProps } from './FinanceTab';
export { MonthResultsScreen } from './MonthResultsScreen';
export type { MonthResultsScreenProps } from './MonthResultsScreen';
export {
  buildFinanceDashboard,
  financeRangeWindow,
  financePriorWindow,
  financeRangeDays,
  bucketDaily,
  groupExpenses,
  money,
  FINANCE_RANGES,
} from './financeModel';
export type {
  FinanceDashboardModel,
  FinanceDashboardInputs,
  FinanceRangeId,
  FinanceRangeOption,
  FinanceStat,
  FinanceHeroChart,
  FinanceDonut,
  FinanceBars,
} from './financeModel';
export { buildMonthResults } from './monthResultsModel';
export type {
  MonthResultsModel,
  MonthResultRow,
  MonthResultFace,
  MonthResultInputs,
} from './monthResultsModel';
