import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { Surface, SectionHeader, Pill } from '../kit';
import type {
  GateStripModel,
  FlowFaceView,
  LevelFaceView,
  TrendFaceView,
} from './gateStripModel';

/**
 * The Home **monthly gate-progress strip** (S3b, #233) — the reframed TODAY'S
 * TARGETS bar. Surfaces the multi-dimensional monthly tier gate, each face in
 * its native idiom (goals-targets-design decision 3): flow faces as a pace
 * report with the day's haul visibly ticking up the bar (decision 1's tactile
 * reward beat), the cash level as a gauge vs its threshold, CSI as a trend
 * sparkline. No daily judgment / letter-grade — the 4-band verdict is month-end
 * only. Presentation only; every value arrives pre-formatted from `buildGateStrip`.
 */
export function GateStrip({ model }: { model: GateStripModel }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: t.spacing.md }} testID="home-gate-strip">
      <Surface>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <SectionHeader title="Monthly Gate" />
          {model.percentOnTrack != null ? (
            <Pill
              tone={model.percentOnTrack >= 100 ? 'positive' : 'info'}
              label={`${model.percentOnTrack}% on track`}
            />
          ) : null}
        </View>
        {model.faces.map((face) => (
          <View key={face.id} style={{ marginTop: t.spacing.md }}>
            {face.kind === 'flow' ? (
              <FlowFace face={face} />
            ) : face.kind === 'level' ? (
              <LevelFace face={face} />
            ) : (
              <TrendFace face={face} />
            )}
          </View>
        ))}
      </Surface>
    </View>
  );
}

function faceHeader(t: ReturnType<typeof useTheme>): {
  row: ViewStyle;
  label: TextStyle;
  value: TextStyle;
} {
  return {
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    label: { ...t.typography.statLabel, color: t.colors.textMuted },
    value: {
      ...t.typography.statLabel,
      color: t.colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
  };
}

/** Trend arrow + tone. */
function TrendArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  const t = useTheme();
  const glyph = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→';
  const color =
    trend === 'up'
      ? t.colors.positive
      : trend === 'down'
        ? t.colors.danger
        : t.colors.textMuted;
  return <Text style={{ ...t.typography.statLabel, color }}>{glyph}</Text>;
}

function FlowFace({ face }: { face: FlowFaceView }) {
  const t = useTheme();
  const h = faceHeader(t);
  // Two-segment bar: the settled month-to-date portion plus today's haul tick in
  // the reward tone, so the day's contribution is visibly filling the bar.
  const track: ViewStyle = {
    height: t.spacing.sm,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.base,
    overflow: 'hidden',
    flexDirection: 'row',
    marginTop: t.spacing.xs,
    ...t.elevation.inset,
  };
  const priorPct = Math.max(0, Math.min(1, face.priorFill)) * 100;
  const todayPct = Math.max(0, Math.min(1, face.todayFill)) * 100;
  const priorColor = face.tone === 'positive' ? t.colors.positive : t.colors.primary;
  return (
    <View>
      <View style={h.row}>
        <Text style={h.label}>{face.label}</Text>
        <Text style={h.value}>{face.valueLabel}</Text>
      </View>
      <View style={track}>
        <View
          style={{ width: `${priorPct}%`, height: '100%', backgroundColor: priorColor }}
        />
        {todayPct > 0 ? (
          <View
            style={{ width: `${todayPct}%`, height: '100%', backgroundColor: t.colors.reward }}
            testID={`gate-today-tick-${face.id}`}
          />
        ) : null}
      </View>
      <Text
        style={{
          ...t.typography.caption,
          color: t.colors.textSecondary,
          marginTop: t.spacing.xxs,
        }}
      >
        {face.paceLabel}
      </Text>
    </View>
  );
}

function LevelFace({ face }: { face: LevelFaceView }) {
  const t = useTheme();
  const h = faceHeader(t);
  const track: ViewStyle = {
    height: t.spacing.sm,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.base,
    overflow: 'hidden',
    marginTop: t.spacing.xs,
    ...t.elevation.inset,
  };
  const pct = Math.max(0, Math.min(1, face.fill)) * 100;
  const fillColor = face.meets ? t.colors.positive : t.colors.primary;
  return (
    <View>
      <View style={h.row}>
        <Text style={h.label}>{face.label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.xs }}>
          <Text style={h.value}>
            {face.valueLabel} {face.thresholdLabel}
          </Text>
          <TrendArrow trend={face.trend} />
        </View>
      </View>
      <View style={track}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: fillColor }} />
      </View>
    </View>
  );
}

function TrendFace({ face }: { face: TrendFaceView }) {
  const t = useTheme();
  const h = faceHeader(t);
  return (
    <View>
      <View style={h.row}>
        <Text style={h.label}>{face.label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.xs }}>
          <Text style={h.value}>
            {face.valueLabel} {face.thresholdLabel}
          </Text>
          <TrendArrow trend={face.trend} />
        </View>
      </View>
      <Sparkline values={face.sparkline} />
    </View>
  );
}

/** A tiny bar sparkline — the CSI rolling window's shape (oldest→newest). */
function Sparkline({ values }: { values: number[] }) {
  const t = useTheme();
  if (values.length === 0) {
    return (
      <Text
        style={{
          ...t.typography.caption,
          color: t.colors.textMuted,
          fontStyle: 'italic',
          marginTop: t.spacing.xxs,
        }}
      >
        Trend builds over the month.
      </Text>
    );
  }
  const maxH = t.spacing.lg;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 2,
        height: maxH,
        marginTop: t.spacing.xs,
      }}
      testID="gate-csi-sparkline"
    >
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: Math.max(2, v * maxH),
            borderRadius: t.radius.sm,
            backgroundColor: t.colors.primary,
          }}
        />
      ))}
    </View>
  );
}
