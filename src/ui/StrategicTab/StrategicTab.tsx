import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { Surface, SectionHeader, Badge } from '../kit';

export interface StrategicTabProps {
  /** Surface title, e.g. "People". */
  title: string;
  /** One-line description of what the unlocked surface becomes. */
  tagline: string;
  /** When false, render the locked teaser instead of the live scaffold. */
  unlocked: boolean;
  /** Teaser copy shown while locked, e.g. "Unlocks at Tier 2 — …". */
  unlockHint: string;
}

/**
 * The thin scaffold for the three strategic tabs — People · Finance · Growth
 * (#226). It establishes each tab's presence and its locked ↔ unlocked
 * presentation; the real mechanics for each land in their own per-surface
 * rebrand slices. Presentation only — the composition root resolves `unlocked`
 * from the tier gate (`resolveNavTabs`) and passes the copy down from
 * `data/nav-tabs.json`, so there are no magic strings or game-logic imports here.
 */
export function StrategicTab({
  title,
  tagline,
  unlocked,
  unlockHint,
}: StrategicTabProps) {
  const t = useTheme();
  const region: ViewStyle = { marginTop: t.spacing.xl };
  const body: ViewStyle = { marginTop: t.spacing.md };
  const tag: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textSecondary,
  };
  const placeholder: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    fontStyle: 'italic',
    marginTop: t.spacing.md,
  };
  const lockTitle: TextStyle = {
    ...t.typography.statValue,
    color: t.colors.textMuted,
  };
  const lockHint: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textSecondary,
    marginTop: t.spacing.sm,
  };

  return (
    <View style={region} testID={`strategic-tab-${title.toLowerCase()}`}>
      <SectionHeader title={title} />
      {unlocked ? (
        <View style={body} testID="strategic-tab-unlocked">
          <Text style={tag}>{tagline}</Text>
          <Text style={placeholder}>
            This surface comes online in a later slice.
          </Text>
        </View>
      ) : (
        <Surface variant="inset" style={body} testID="strategic-tab-locked">
          <Badge label="LOCKED" tone="neutral" />
          <Text style={lockTitle}>{title} is on the horizon</Text>
          <Text style={lockHint}>{unlockHint}</Text>
        </Surface>
      )}
    </View>
  );
}
