import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { IconBadge, type IconBadgeTone } from './IconBadge';
import { Icon, type IconName } from './Icon';

export type TrendDirection = 'up' | 'down' | 'flat';

export interface StatCardProps {
  /** Caption under the value — e.g. "Units", "Gross". */
  label: string;
  /** The headline figure, pre-formatted by the caller. */
  value: string | number;
  /** Optional trend delta (e.g. "+12%"); toned by `trend`. */
  delta?: string;
  /** Optional trailing context for the delta chip (e.g. "vs Yesterday"), formatted by the caller. */
  deltaContext?: string;
  /** Direction the delta represents. Drives the chip tone + arrow. Default `flat`. */
  trend?: TrendDirection;
  /** Horizontal alignment of the stack. Default `left`. */
  align?: 'left' | 'center';
  /** Optional leading `IconBadge` glyph above the figure (Ionicons name). */
  icon?: IconName;
  /** Tone for the leading icon badge. Default `primary`. */
  iconTone?: IconBadgeTone;
}

/**
 * Label + value (+ optional trend delta) figure block — the KPI tile the
 * dashboards repeat. The caller formats `value`; this only presents it.
 */
export function StatCard({
  label,
  value,
  delta,
  deltaContext,
  trend = 'flat',
  align = 'left',
  icon,
  iconTone = 'primary',
}: StatCardProps) {
  const t = useTheme();
  const items: ViewStyle = { alignItems: align === 'center' ? 'center' : 'flex-start' };
  const valueText: TextStyle = {
    ...t.typography.statValue,
    color: t.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  };
  const labelText: TextStyle = {
    ...t.typography.statLabel,
    color: t.colors.textMuted,
    marginTop: t.spacing.xxs,
  };
  // Delta is a toned candy chip, not inert text: trend drives the tint fill,
  // the accent applied to the figure, and the trend-arrow glyph.
  const deltaAccent =
    trend === 'up'
      ? t.colors.positive
      : trend === 'down'
        ? t.colors.danger
        : t.colors.textMuted;
  const deltaTint =
    trend === 'up'
      ? t.colors.positiveTint
      : trend === 'down'
        ? t.colors.dangerTint
        : t.colors.neutralTint;
  const arrow: IconName =
    trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove';
  const arrowTone = trend === 'up' ? 'positive' : trend === 'down' ? 'danger' : 'muted';
  const deltaChip: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: align === 'center' ? 'center' : 'flex-start',
    marginTop: t.spacing.xs,
    paddingVertical: t.spacing.xxs,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.radius.pill,
    backgroundColor: deltaTint,
    gap: t.spacing.xxs,
  };
  const deltaText: TextStyle = {
    ...t.typography.caption,
    color: deltaAccent,
    fontVariant: ['tabular-nums'],
  };
  const deltaContextText: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
  };

  return (
    <View style={items}>
      {icon != null && (
        <View style={{ marginBottom: t.spacing.sm }}>
          {/* Solid candy tile per the mockup — the soft 16%-alpha tint reads as
              a muddy smudge on the dark surface at device brightness. */}
          <IconBadge name={icon} tone={iconTone} variant="solid" size="sm" />
        </View>
      )}
      <Text style={valueText}>{value}</Text>
      {/* In a narrow tile a single long label ("INVENTORY") would otherwise
          break mid-word ("INVENTOR Y"); cap at two lines and let it shrink to
          fit rather than fracture. No-op for labels that already fit. */}
      <Text style={labelText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
      {delta != null && (
        <View style={deltaChip}>
          <Icon name={arrow} size="sm" tone={arrowTone} />
          <Text style={deltaText}>{delta}</Text>
          {deltaContext != null && <Text style={deltaContextText}>{deltaContext}</Text>}
        </View>
      )}
    </View>
  );
}
