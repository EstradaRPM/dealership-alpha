/**
 * The base-component kit — the small set of presentation-only primitives every
 * rebranded surface composes from. Each consumes theme tokens (via `useTheme`)
 * only, imports no game logic, and has a narrow variant-prop interface so an
 * alternate implementation can satisfy the same props behind this barrel
 * without touching call sites.
 */
export { Surface, Card } from './Surface';
export type { SurfaceProps, SurfaceVariant } from './Surface';
export { Gradient, GradientSurface } from './Gradient';
export type { GradientSurfaceProps } from './Gradient';
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
export { Badge, Pill } from './Badge';
export type { BadgeProps, BadgeTone, BadgeVariant } from './Badge';
export { Icon } from './Icon';
export type { IconProps, IconName } from './Icon';
export { iconFont } from './icons';
export { IconBadge } from './IconBadge';
export type { IconBadgeProps, IconBadgeTone } from './IconBadge';
export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps, ProgressTone } from './ProgressBar';
export { Meter } from './Meter';
export type { MeterProps } from './Meter';
export { GaugeArc } from './GaugeArc';
export type { GaugeArcProps, GaugeTone } from './GaugeArc';
export { StatCard } from './StatCard';
export type { StatCardProps, TrendDirection } from './StatCard';
export { Sparkline } from './Sparkline';
export type { SparklineProps } from './Sparkline';
export { BarChart } from './BarChart';
export type { BarChartProps, BarDatum } from './BarChart';
export { DonutChart } from './DonutChart';
export type { DonutChartProps, DonutDatum } from './DonutChart';
export { LineChart } from './LineChart';
export type { LineChartProps, LineSeries } from './LineChart';
export { ChartLegend, ChartGrid, ChartEmpty, useChartWidth } from './ChartParts';
export type {
  ChartLegendProps,
  ChartLegendItem,
  ChartGridProps,
  ChartGridLine,
  ChartEmptyProps,
} from './ChartParts';
export {
  clamp01,
  niceTicks,
  signedDomain,
  signedTicks,
  domainFraction,
  sparklinePoints,
  linePoints,
  polylinePath,
  areaPath,
  barBands,
  barPath,
  donutSegments,
  arcPath,
} from './chartScale';
export type { Point, BarBand, DonutSegment, ValueDomain } from './chartScale';
// The app's one number-formatting surface (issue 387): compact when the figure
// is ambient, exact when the player is about to act on it.
export { money, compactMoney, grouped } from './money';
export { SectionHeader } from './SectionHeader';
export type { SectionHeaderProps } from './SectionHeader';
export { Collapsible } from './Collapsible';
export type { CollapsibleProps } from './Collapsible';
export { HintLine } from './HintLine';
export type { HintLineProps } from './HintLine';
// The first-run spine's coachmark (issue 213). Same contract as HintLine: the
// copy and the "is this still owed?" read both arrive as a resolved prop.
export { Coachmark } from './Coachmark';
export type { CoachmarkModel } from './Coachmark';
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';
export { ConfirmDialog, useConfirm } from './ConfirmDialog';
export type { ConfirmDialogProps, ConfirmRequest, Confirm } from './ConfirmDialog';
