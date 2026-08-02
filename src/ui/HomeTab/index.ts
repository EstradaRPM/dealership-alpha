export { HomeTab } from './HomeTab';
export type { HomeTabProps, HomeMarketGlance } from './HomeTab';
export { GateStrip } from './GateStrip';
// The Industry Wire + Weekly Market Report moved to `src/ui/GrowthTab/` in
// #349 — they are the demand console's market reads, and Home renders glances
// only (locked IA §1). Import them from '../GrowthTab'.
export { buildHomeDashboard, csiLabel } from './homeModel';
export { buildMarketGlance } from './marketGlanceModel';
export { buildGateStrip } from './gateStripModel';
export type {
  CashDeltaSplit,
  HomeDashboardModel,
  HomeDashboardInputs,
  HomeCalendarModel,
  HomeStat,
  MiniCalDay,
  SeasonName,
} from './homeModel';
export type {
  GateStripModel,
  GateFaceView,
  FlowFaceView,
  LevelFaceView,
  TrendFaceView,
  TodayContribution,
  StreakStatus,
} from './gateStripModel';
