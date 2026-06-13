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
export { StatCard } from './StatCard';
export type { StatCardProps, TrendDirection } from './StatCard';
export { SectionHeader } from './SectionHeader';
export type { SectionHeaderProps } from './SectionHeader';
