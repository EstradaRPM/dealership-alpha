import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { IconBadge, type IconBadgeTone } from './IconBadge';
import type { IconName } from './Icon';

export type TrendDirection = 'up' | 'down' | 'flat';

export interface StatCardProps {
  /** Caption under the value — e.g. "Units", "Gross". */
  label: string;
  /** The headline figure, pre-formatted by the caller. */
  value: string | number;
  /** Optional trend delta (e.g. "+12%"); colored by `trend`. */
  delta?: string;
  /** Direction the delta represents. Drives the delta color. Default `flat`. */
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
  const deltaColor =
    trend === 'up'
      ? t.colors.positive
      : trend === 'down'
        ? t.colors.danger
        : t.colors.textMuted;
  const deltaText: TextStyle = {
    ...t.typography.caption,
    color: deltaColor,
    marginTop: t.spacing.xxs,
    fontVariant: ['tabular-nums'],
  };

  return (
    <View style={items}>
      {icon != null && (
        <View style={{ marginBottom: t.spacing.sm }}>
          <IconBadge name={icon} tone={iconTone} variant="soft" size="sm" />
        </View>
      )}
      <Text style={valueText}>{value}</Text>
      {/* In a narrow tile a single long label ("INVENTORY") would otherwise
          break mid-word ("INVENTOR Y"); cap at two lines and let it shrink to
          fit rather than fracture. No-op for labels that already fit. */}
      <Text style={labelText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
      {delta != null && <Text style={deltaText}>{delta}</Text>}
    </View>
  );
}
