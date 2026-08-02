export { GrowthTab } from './GrowthTab';
export type { GrowthTabProps } from './GrowthTab';
export { GateBoard } from './GateBoard';
export { buildGateBoard } from './gateBoardModel';
export type {
  GateBoardModel,
  GateBoardFace,
  GateBoardDetail,
  GateBoardClimb,
  GateBoardStreak,
} from './gateBoardModel';
// The wire + weekly report moved here from `HomeTab/` in #349: both are market
// reads that belong to the demand console's room, and Home's charter is glances
// only. Same components, same models — a relocation, not a rewrite.
export { IndustryWire } from './IndustryWire';
export type { IndustryWireProps } from './IndustryWire';
export { buildIndustryWire, wireDayLabel } from './industryWireModel';
export type {
  IndustryWireModel,
  IndustryWireInputs,
  WireHeadlineInput,
  WireHeadlineView,
  WireLegendEntry,
  WireReliability,
  WireLockInput,
  WireUnlockView,
  WireGatingCopyInput,
} from './industryWireModel';
export { WeeklyMarketReportCard } from './WeeklyMarketReportCard';
export type { WeeklyMarketReportCardProps } from './WeeklyMarketReportCard';
export { buildWeeklyReportCard, signedPercent } from './weeklyReportModel';
export type {
  WeeklyReportCardModel,
  WeeklyReportInputs,
  WeeklyReportInput,
  WeeklyReportCopyInput,
  WeeklyMoveRow,
  WeeklyCallRow,
  WeeklyBadge,
} from './weeklyReportModel';
