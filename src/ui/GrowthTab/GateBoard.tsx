import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
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
import type { GateBoardFace, GateBoardModel } from './gateBoardModel';

/**
 * The Growth **tier-gate detail board** (#349) — the locked IA §4's second half.
 *
 * Home's `GateStrip` is the glance (one line per face, a "% on track" pill).
 * This is the room that glance routes into: every face opened up with the full
 * set of numbers the engine already computes, then the climb — what the next
 * rung asks for and how many banked months stand between here and it. This is
 * where foreshadowing the climb lives (IA rule 3 puts it here and nowhere else).
 *
 * Presentation only; every value arrives pre-formatted from `buildGateBoard`.
 */
export function GateBoard({ model }: { model: GateBoardModel }) {
  const t = useTheme();
  return (
    <View testID="growth-gate-board">
      <SectionHeader
        title="This Month"
        accessory={
          <Pill tone="info" variant="soft" textCase="sentence" label={model.remainingLabel} />
        }
      />
      <View style={{ marginTop: t.spacing.md }}>
        <Surface>
          <Text
            testID="gate-board-period"
            style={{ ...t.typography.caption, color: t.colors.textSecondary }}
          >
            {model.periodLabel}
          </Text>
          {model.faces.length === 0 ? (
            <Text
              style={{
                ...t.typography.caption,
                color: t.colors.textMuted,
                marginTop: t.spacing.md,
              }}
            >
              No gate faces are lit at this tier yet.
            </Text>
          ) : (
            model.faces.map((face) => (
              <View key={face.id} style={{ marginTop: t.spacing.lg }}>
                <FaceBlock face={face} />
              </View>
            ))
          )}
        </Surface>
      </View>

      {model.climb ? (
        <View style={{ marginTop: t.spacing.xl }} testID="growth-gate-climb">
          <SectionHeader title={model.climb.title} />
          <View style={{ marginTop: t.spacing.md }}>
            <Surface>
              <Text style={{ ...t.typography.body, color: t.colors.textPrimary }}>
                {model.climb.ruleLabel}
              </Text>
              <View style={{ marginTop: t.spacing.md }}>
                {model.climb.requirements.map((r) => (
                  <DetailRow key={r.label} label={r.label} value={r.value} emphasis />
                ))}
              </View>
              <Text
                testID="gate-board-streak"
                style={{
                  ...t.typography.caption,
                  color: t.colors.textSecondary,
                  marginTop: t.spacing.md,
                }}
              >
                {model.climb.streakLabel}
              </Text>
            </Surface>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Per-face glyph + accent, keyed by TierGate face id — same map the Home strip
 *  uses, so a face keeps its identity across the glance and the detail board. */
const FACE_ICONS: Record<string, { icon: IconName; tone: IconBadgeTone }> = {
  units: { icon: 'car-sport', tone: 'primary' },
  gross: { icon: 'cash', tone: 'reward' },
  cash: { icon: 'wallet', tone: 'positive' },
  csi: { icon: 'star', tone: 'accent' },
  facility: { icon: 'business', tone: 'muted' },
};

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  return trend === 'up' ? (
    <Icon name="trending-up" size="sm" tone="positive" />
  ) : trend === 'down' ? (
    <Icon name="trending-down" size="sm" tone="danger" />
  ) : (
    <Icon name="remove" size="sm" tone="muted" />
  );
}

function FaceBlock({ face }: { face: GateBoardFace }) {
  const t = useTheme();
  const icon = FACE_ICONS[face.id];
  const header: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  };
  const value: TextStyle = {
    ...t.typography.statLabel,
    color: t.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  };
  return (
    <View testID={`gate-board-face-${face.id}`}>
      <View style={header}>
        {icon ? (
          <IconBadge name={icon.icon} tone={icon.tone} variant="solid" size="sm" />
        ) : null}
        <Text style={{ ...t.typography.label, color: t.colors.textPrimary, flex: 1 }}>
          {face.label}
        </Text>
        <Text style={value}>{face.valueLabel}</Text>
        {face.trend ? <TrendArrow trend={face.trend} /> : null}
      </View>

      <View style={{ marginTop: t.spacing.xs }}>
        {face.fill != null ? (
          <ProgressBar
            value={face.fill}
            tone={face.tone}
            fillTestID={`gate-board-fill-${face.id}`}
          />
        ) : (
          <Sparkline
            values={face.sparkline ?? []}
            size="md"
            tone={face.tone}
            emptyLabel="Trend builds over the month."
            testID={`gate-board-spark-${face.id}`}
          />
        )}
      </View>

      <View style={{ marginTop: t.spacing.sm }}>
        <Pill
          tone={face.tone === 'positive' ? 'positive' : face.tone === 'danger' ? 'danger' : 'info'}
          variant="soft"
          textCase="sentence"
          label={face.statusLabel}
        />
      </View>

      {/* The spelled-out facts. This is the whole reason the board exists as a
          separate surface from the strip — the glance compresses these away. */}
      <View style={{ marginTop: t.spacing.sm }}>
        {face.details.map((d) => (
          <DetailRow key={d.label} label={d.label} value={d.value} />
        ))}
      </View>
    </View>
  );
}

function DetailRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: t.spacing.xxs,
      }}
    >
      <Text style={{ ...t.typography.caption, color: t.colors.textMuted }}>{label}</Text>
      <Text
        style={{
          ...(emphasis ? t.typography.label : t.typography.caption),
          color: emphasis ? t.colors.textPrimary : t.colors.textSecondary,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
}
