import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';

export type BadgeTone = 'neutral' | 'info' | 'positive' | 'reward' | 'danger';

/** `outline` = accent border on a raised chip; `soft` = filled translucent tint. */
export type BadgeVariant = 'outline' | 'soft';

export interface BadgeProps {
  label: string;
  /** Semantic status color. Default `neutral`. */
  tone?: BadgeTone;
  /** Fill treatment. Default `outline`. */
  variant?: BadgeVariant;
  /**
   * Casing of the chip text. `caps` (default) is the tracked-uppercase status-tag
   * idiom (NEW · AGING · TIER 2). `sentence` keeps the label as written — for
   * descriptive chips (a weather readout, "91% on track") that aren't tags and
   * read as wireframe filler in all-caps (the typography pass).
   */
  textCase?: 'caps' | 'sentence';
}

/**
 * Status chip / pill — the small uppercase tag the mockups scatter everywhere
 * (HIGH DEMAND, AGING, NEW). Tone selects a semantic accent; `outline` rims a
 * raised chip while `soft` fills it with a translucent tint of the same accent
 * (the mockup's soft-glow badges). Presentation only.
 */
export function Badge({
  label,
  tone = 'neutral',
  variant = 'outline',
  textCase = 'caps',
}: BadgeProps) {
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
  const tint =
    tone === 'info'
      ? t.colors.primaryTint
      : tone === 'positive'
        ? t.colors.positiveTint
        : tone === 'reward'
          ? t.colors.rewardTint
          : tone === 'danger'
            ? t.colors.dangerTint
            : t.colors.neutralTint;

  const soft = variant === 'soft';
  const container: ViewStyle = {
    alignSelf: 'flex-start',
    paddingVertical: t.spacing.xxs,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.radius.pill,
    borderWidth: soft ? 0 : 1,
    borderColor: accent,
    backgroundColor: soft ? tint : t.colors.surfaceRaised,
  };
  const text: TextStyle = {
    ...t.typography.badge,
    color: accent,
    // Descriptive chips opt out of the tracked-uppercase tag idiom.
    ...(textCase === 'sentence' ? { textTransform: 'none', letterSpacing: 0.2 } : null),
  };

  return (
    <View style={container}>
      <Text style={text}>{label}</Text>
    </View>
  );
}

/** Semantic alias — a `Pill` is a `Badge`. Same interface. */
export const Pill = Badge;
