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
  /** Forwarded to the bar — a [0,1] hairline marking where the value started. */
  mark?: number;
  markTestID?: string;
  /** Forwarded to the bar — the [0,1] point past which the track is unreachable. */
  reach?: number;
  reachTestID?: string;
  /**
   * One line under the bar saying what the gauge means for the thing it
   * measures. A bar states a level; a caption states the consequence, which is
   * the difference between a readout and a decision (issue 377).
   */
  caption?: string;
  captionTestID?: string;
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
  mark,
  markTestID,
  reach,
  reachTestID,
  caption,
  captionTestID,
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
  const captionText: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    marginTop: t.spacing.xs,
    fontVariant: ['tabular-nums'],
  };

  return (
    <View>
      <View style={header}>
        <Text style={labelText}>{label}</Text>
        {readout != null && <Text style={readoutText}>{readout}</Text>}
      </View>
      <ProgressBar
        value={value}
        tone={tone}
        fillTestID={fillTestID}
        mark={mark}
        markTestID={markTestID}
        reach={reach}
        reachTestID={reachTestID}
      />
      {caption != null && (
        <Text style={captionText} testID={captionTestID}>
          {caption}
        </Text>
      )}
    </View>
  );
}
