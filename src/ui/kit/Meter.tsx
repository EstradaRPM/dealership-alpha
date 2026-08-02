import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { ProgressBar, type ProgressTone } from './ProgressBar';

export interface MeterProps {
  /** Gauge caption — e.g. "Morale", "Regulatory pressure". */
  label: string;
  /** Fill fraction, clamped to [0,1]. */
  value: number;
  /** Optional right-aligned readout — e.g. "72%", "3/5". */
  readout?: string;
  /** Fill color role. Default `primary`. */
  tone?: ProgressTone;
  /** Forwarded to the bar's fill, so a caller can assert the fill's width. */
  fillTestID?: string;
}

/**
 * Labeled gauge — a captioned `ProgressBar` for the morale / regulatory meters.
 * Label + optional readout sit above the bar. Presentation only.
 */
export function Meter({
  label,
  value,
  readout,
  tone = 'primary',
  fillTestID,
}: MeterProps) {
  const t = useTheme();

  const header: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: t.spacing.xs,
  };
  const labelText: TextStyle = { ...t.typography.statLabel, color: t.colors.textMuted };
  const readoutText: TextStyle = {
    ...t.typography.statLabel,
    color: t.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  };

  return (
    <View>
      <View style={header}>
        <Text style={labelText}>{label}</Text>
        {readout != null && <Text style={readoutText}>{readout}</Text>}
      </View>
      <ProgressBar value={value} tone={tone} fillTestID={fillTestID} />
    </View>
  );
}
