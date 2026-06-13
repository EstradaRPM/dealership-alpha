import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import type { ProgressTone } from './ProgressBar';

export type GaugeTone = ProgressTone;

export interface GaugeArcProps {
  /** Fill fraction, clamped to [0,1]. */
  value: number;
  /** Fill color role for the lit segments. Default `primary`. */
  tone?: GaugeTone;
  /** Big value rendered in the center of the arc — e.g. "87". */
  readout?: string;
  /** Small suffix beside the readout — e.g. "/ 100". */
  readoutSuffix?: string;
  /** Qualitative label rendered beneath the arc — e.g. "Very Good". */
  caption?: string;
  /** Color role for the caption. Default muted. */
  captionTone?: GaugeTone;
  /** Outer diameter in px. Default 92. */
  size?: number;
  testID?: string;
}

// A 270° sweep (gap at the bottom), the speedometer idiom: the arc starts at the
// lower-left, climbs over the top, and ends at the lower-right. Dense enough that
// the discrete ticks read as one continuous arc, while staying a pure-View build
// (no `react-native-svg` dependency) that degrades cleanly at 0 and 100 and can
// animate per-tick later.
const SWEEP_DEG = 270;
const START_DEG = -135;
const SEGMENTS = 36;
const SEG_WIDTH = 3;
const SEG_LENGTH = 9;

/**
 * Radial gauge arc — a tone-driven dial for a 0–1 score (the home hub reputation
 * card). Lit segments fill clockwise around the arc in the chosen tone; the
 * remainder sits as a muted track. The center holds an optional big readout, and
 * a qualitative caption sits beneath. Presentation only — the caller formats the
 * value, readout, and label.
 */
export function GaugeArc({
  value,
  tone = 'primary',
  readout,
  readoutSuffix,
  caption,
  captionTone,
  size = 92,
  testID,
}: GaugeArcProps) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(1, value));
  const litCount = Math.round(clamped * SEGMENTS);
  // Place each tick on a circle just inside the outer edge, pointing outward.
  const trackRadius = size / 2 - SEG_LENGTH / 2 - 1;

  const seg = (i: number): ViewStyle => {
    const lit = i < litCount;
    const angle = START_DEG + (i / (SEGMENTS - 1)) * SWEEP_DEG;
    return {
      position: 'absolute',
      width: SEG_WIDTH,
      height: SEG_LENGTH,
      top: size / 2 - SEG_LENGTH / 2,
      left: size / 2 - SEG_WIDTH / 2,
      borderRadius: t.radius.pill,
      backgroundColor: lit ? t.colors[tone] : t.colors.borderMuted,
      transform: [{ rotate: `${angle}deg` }, { translateY: -trackRadius }],
    };
  };

  const readoutStyle: TextStyle = {
    ...t.typography.statValue,
    color: t.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  };
  const suffixStyle: TextStyle = { ...t.typography.caption, color: t.colors.textMuted };
  const captionStyle: TextStyle = {
    ...t.typography.statLabel,
    color: captionTone ? t.colors[captionTone] : t.colors.textMuted,
    marginTop: t.spacing.xs,
    textAlign: 'center',
  };

  const a11y =
    readout || caption ? [readout, readoutSuffix, caption].filter(Boolean).join(' ') : undefined;

  return (
    <View style={{ alignItems: 'center' }} testID={testID}>
      <View
        style={{ width: size, height: size }}
        accessible={a11y != null}
        accessibilityLabel={a11y}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <View key={i} style={seg(i)} />
        ))}
        {/* Center readout, floated over the dial. */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          pointerEvents="none"
        >
          {readout != null && (
            <Text style={readoutStyle} numberOfLines={1}>
              {readout}
              {readoutSuffix != null && <Text style={suffixStyle}> {readoutSuffix}</Text>}
            </Text>
          )}
        </View>
      </View>
      {caption != null && <Text style={captionStyle}>{caption}</Text>}
    </View>
  );
}
