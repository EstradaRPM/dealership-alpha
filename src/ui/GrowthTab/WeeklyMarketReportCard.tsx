import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { Surface, Badge, Icon, type BadgeTone } from '../kit';
import type { WeeklyReportCardModel } from './weeklyReportModel';

const DIRECTION_TONE = {
  up: 'positive',
  down: 'danger',
  flat: 'textSecondary',
} as const;

const RELIABILITY_TONE: Record<string, BadgeTone> = {
  direct: 'positive',
  leading: 'reward',
  lagging: 'neutral',
};

export interface WeeklyMarketReportCardProps {
  model: WeeklyReportCardModel;
}

/**
 * The weekly market report card (#177) — the trade pub's column, standing on
 * the Home screen until the next one replaces it.
 *
 * The card is deliberately two-halves-with-two-badges: the recap half is
 * "Recap" (it already happened, and the player's own numbers said so first),
 * the forward calls are "Rumor" (somebody's bet). That is the same trust
 * vocabulary the daily wire uses, so the column doesn't have to teach a second
 * one — and so the calls can never be mistaken for the recap.
 */
export function WeeklyMarketReportCard({ model }: WeeklyMarketReportCardProps) {
  const t = useTheme();

  const caption: TextStyle = { ...t.typography.caption, color: t.colors.textMuted };
  const divider: ViewStyle = {
    height: 1,
    backgroundColor: t.colors.border,
    marginVertical: t.spacing.md,
  };
  const headingRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginBottom: t.spacing.sm,
  };
  const heading: TextStyle = {
    ...t.typography.statLabel,
    color: t.colors.textSecondary,
    flex: 1,
  };

  return (
    <Surface testID="weekly-market-report">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <Text
          style={{ ...t.typography.bodyStrong, color: t.colors.textPrimary, flex: 1 }}
        >
          {model.title}
        </Text>
        <Text style={caption}>{model.subtitle}</Text>
      </View>
      <Text style={{ ...caption, marginTop: t.spacing.xs }}>{model.sourceLabel}</Text>

      <Text
        style={{
          ...t.typography.body,
          color: t.colors.textPrimary,
          marginTop: t.spacing.md,
        }}
        testID="weekly-report-summary"
      >
        {model.summary}
      </Text>

      <View style={divider} />

      <View style={headingRow}>
        <Text style={heading}>{model.movesHeading}</Text>
        {model.recapBadge && (
          <Badge
            label={model.recapBadge.label}
            tone={RELIABILITY_TONE[model.recapBadge.reliability] ?? 'neutral'}
            variant="soft"
            textCase="caps"
          />
        )}
      </View>
      {model.moves.map((m) => (
        <View
          key={m.segment}
          testID={`weekly-move-${m.segment}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.sm,
            marginBottom: t.spacing.xs,
          }}
        >
          <Text style={{ ...t.typography.label, color: t.colors.textPrimary, flex: 1 }}>
            {m.label}
          </Text>
          {m.mentionsLabel && <Text style={caption}>{m.mentionsLabel}</Text>}
          <Text
            style={{
              ...t.typography.bodyStrong,
              color: t.colors[DIRECTION_TONE[m.direction]],
            }}
          >
            {m.deltaLabel}
          </Text>
        </View>
      ))}

      <View style={divider} />

      <View style={headingRow}>
        <Text style={heading}>{model.callsHeading}</Text>
        {model.callsBadge && (
          <Badge
            label={model.callsBadge.label}
            tone={RELIABILITY_TONE[model.callsBadge.reliability] ?? 'neutral'}
            variant="soft"
            textCase="caps"
          />
        )}
      </View>
      {model.callsLockedHint != null ? (
        // #178: the column's forward calls ride the same locked lane as the
        // wire's, so the same door — and the same sentence — stands in front of
        // them. Withheld reads differently from "the desk had nothing to say".
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}
        >
          <Icon name="lock-closed" size="sm" tone="muted" />
          <Text style={{ ...caption, flex: 1 }} testID="weekly-calls-locked">
            {model.callsLockedHint}
          </Text>
        </View>
      ) : model.calls.length > 0 ? (
        model.calls.map((c) => (
          <Text
            key={c.id}
            testID={`weekly-call-${c.id}`}
            style={{
              ...t.typography.body,
              color: t.colors.textPrimary,
              marginBottom: t.spacing.xs,
            }}
          >
            {c.text}
          </Text>
        ))
      ) : (
        <Text style={caption} testID="weekly-no-calls">
          {model.noCallsText}
        </Text>
      )}

      <View style={divider} />
      <Text style={caption} testID="weekly-report-tally">
        {model.tallyText}
      </Text>
    </Surface>
  );
}
