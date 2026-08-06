import React from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import {
  Surface,
  SectionHeader,
  Pill,
  Icon,
  IconBadge,
  ProgressBar,
  Sparkline,
  type IconName,
  type IconBadgeTone,
} from '../kit';
import type {
  GateStripModel,
  FlowFaceView,
  LevelFaceView,
  SteppedFaceView,
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
export function GateStrip({
  model,
  onOpen,
}: {
  model: GateStripModel;
  /** Deep-link into the Growth gate board (#349) — every Home glance routes
   *  into its owning room, and the board is where the detail lives. */
  onOpen?: () => void;
}) {
  const t = useTheme();
  return (
    // Region idiom matching Today/Market (#258): the SectionHeader titles the
    // region OUTSIDE the card (% pill riding its accessory slot), the faces
    // live on the Surface below. "This Month" is the player-facing name for
    // the monthly tier gate.
    <View style={{ marginTop: t.spacing.xl }} testID="home-gate-strip">
      <SectionHeader
        title="This Month"
        accessory={
          model.percentOnTrack != null ? (
            <Pill
              tone={model.percentOnTrack >= 100 ? 'positive' : 'info'}
              variant="soft"
              textCase="sentence"
              label={`${model.percentOnTrack}% on track`}
            />
          ) : undefined
        }
      />
      <Pressable
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole="button"
        accessibilityLabel="Open the tier-gate board"
        testID="home-gate-strip-open"
        style={{ marginTop: t.spacing.md }}
      >
        <Surface>
          {model.faces.map((face, i) => (
            <View key={face.id} style={{ marginTop: i === 0 ? 0 : t.spacing.md }}>
              {face.kind === 'flow' ? (
                <FlowFace face={face} />
              ) : face.kind === 'level' ? (
                <LevelFace face={face} />
              ) : face.kind === 'stepped' ? (
                <SteppedFace face={face} />
              ) : (
                <TrendFace face={face} />
              )}
            </View>
          ))}
          {/* #250 tier-advancement track-record line: banked meet-or-better
              months toward the next tier, or the dossier-ready cue at the top. */}
          {model.streakLabel != null ? (
            <Text
              testID="gate-streak-line"
              style={{
                ...t.typography.caption,
                color: t.colors.textSecondary,
                marginTop: t.spacing.md,
              }}
            >
              {model.streakLabel}
            </Text>
          ) : null}
        </Surface>
      </Pressable>
    </View>
  );
}

/** Per-face glyph + accent for the leading tile (#240). Keyed by the TierGate
 *  face ids (`units`/`gross`/`cash`/`csi`/`facility`); an unknown id simply
 *  renders no tile, so new faces degrade gracefully. */
const FACE_ICONS: Record<string, { icon: IconName; tone: IconBadgeTone }> = {
  units: { icon: 'car-sport', tone: 'primary' },
  gross: { icon: 'cash', tone: 'reward' },
  cash: { icon: 'wallet', tone: 'positive' },
  csi: { icon: 'star', tone: 'accent' },
  facility: { icon: 'business', tone: 'muted' },
};

function faceHeader(t: ReturnType<typeof useTheme>): {
  row: ViewStyle;
  value: TextStyle;
} {
  return {
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    value: {
      ...t.typography.statLabel,
      color: t.colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
  };
}

/** Leading icon tile + face label — the header's left group. */
function FaceLabel({ id, label }: { id: string; label: string }) {
  const t = useTheme();
  const face = FACE_ICONS[id];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
      {face ? (
        <IconBadge name={face.icon} tone={face.tone} variant="solid" size="sm" />
      ) : null}
      <Text style={{ ...t.typography.statLabel, color: t.colors.textMuted }}>{label}</Text>
    </View>
  );
}

/** Trend arrow + tone — a kit `Icon`, not a text glyph (#258). */
function TrendArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  return trend === 'up' ? (
    <Icon name="trending-up" size="sm" tone="positive" />
  ) : trend === 'down' ? (
    <Icon name="trending-down" size="sm" tone="danger" />
  ) : (
    <Icon name="remove" size="sm" tone="muted" />
  );
}

function FlowFace({ face }: { face: FlowFaceView }) {
  const t = useTheme();
  const h = faceHeader(t);
  return (
    <View>
      <View style={h.row}>
        <FaceLabel id={face.id} label={face.label} />
        <Text style={h.value}>{face.valueLabel}</Text>
      </View>
      {/* Two-segment gradient bar (#237/#240): the settled month-to-date portion
          plus today's haul tick in the reward tone, so the day's contribution is
          visibly filling the bar. */}
      <View style={{ marginTop: t.spacing.xs }}>
        <ProgressBar
          value={face.priorFill}
          tone={face.tone === 'positive' ? 'positive' : 'primary'}
          tick={face.todayFill}
          tickTestID={`gate-today-tick-${face.id}`}
        />
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
  return (
    <View>
      <View style={h.row}>
        <FaceLabel id={face.id} label={face.label} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
          <Text style={h.value}>
            {face.valueLabel} {face.thresholdLabel}
          </Text>
          <TrendArrow trend={face.trend} />
        </View>
      </View>
      <View style={{ marginTop: t.spacing.xs }}>
        <ProgressBar value={face.fill} tone={face.meets ? 'positive' : 'primary'} />
      </View>
    </View>
  );
}

/**
 * The facility build-out face (#360). The level gauge without the arrow: a
 * stepped score holds still until the player builds, so a trend indicator here
 * would read "flat" every day and mean nothing.
 */
function SteppedFace({ face }: { face: SteppedFaceView }) {
  const t = useTheme();
  const h = faceHeader(t);
  return (
    <View testID={`gate-face-${face.id}`}>
      <View style={h.row}>
        <FaceLabel id={face.id} label={face.label} />
        <Text style={h.value}>
          {face.valueLabel} {face.thresholdLabel}
        </Text>
      </View>
      <View style={{ marginTop: t.spacing.xs }}>
        <ProgressBar value={face.fill} tone={face.meets ? 'positive' : 'primary'} />
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
        <FaceLabel id={face.id} label={face.label} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
          <Text style={h.value}>
            {face.valueLabel} {face.thresholdLabel}
          </Text>
          <TrendArrow trend={face.trend} />
        </View>
      </View>
      {/* The kit's shared sparkline (#349) — the Growth gate board renders the
          same trend face at detail scale, so the shape lives in one place. */}
      <Sparkline
        values={face.sparkline}
        emptyLabel="Trend builds over the month."
        testID="gate-csi-sparkline"
      />
    </View>
  );
}
