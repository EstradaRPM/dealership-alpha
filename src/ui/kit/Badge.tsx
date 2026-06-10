import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';

export type BadgeTone = 'neutral' | 'info' | 'positive' | 'reward' | 'danger';

export interface BadgeProps {
  label: string;
  /** Semantic status color. Default `neutral`. */
  tone?: BadgeTone;
}

/**
 * Status chip / pill — the small uppercase tag the mockups scatter everywhere
 * (HIGH DEMAND, AGING, NEW). Tone selects a semantic accent; the chip itself is
 * a tinted pill. Presentation only.
 */
export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const t = useTheme();
  const accent =
    tone === 'info'
      ? t.colors.primary
      : tone === 'positive'
        ? t.colors.positive
        : tone === 'reward'
          ? t.colors.reward
          : tone === 'danger'
            ? t.colors.danger
            : t.colors.textMuted;

  const container: ViewStyle = {
    alignSelf: 'flex-start',
    paddingVertical: t.spacing.xxs,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: accent,
    backgroundColor: t.colors.surfaceRaised,
  };
  const text: TextStyle = { ...t.typography.badge, color: accent };

  return (
    <View style={container}>
      <Text style={text}>{label}</Text>
    </View>
  );
}

/** Semantic alias — a `Pill` is a `Badge`. Same interface. */
export const Pill = Badge;
