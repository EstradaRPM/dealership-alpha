import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';

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
      <Text style={valueText}>{value}</Text>
      <Text style={labelText}>{label}</Text>
      {delta != null && <Text style={deltaText}>{delta}</Text>}
    </View>
  );
}
