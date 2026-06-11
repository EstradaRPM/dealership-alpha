import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import type { Theme } from '../theme';
import { Icon, type IconName } from './Icon';

/** Tones an `IconBadge` tile can fill in — the accents, no `onAccent`. */
export type IconBadgeTone = 'primary' | 'accent' | 'reward' | 'positive' | 'danger' | 'muted';

export interface IconBadgeProps {
  /** Which glyph sits in the tile (Ionicons name). */
  name: IconName;
  /** Tile accent — fills the tile (solid) or tints it (soft). Default `primary`. */
  tone?: IconBadgeTone;
  /** `solid` = full accent fill + dark glyph; `soft` = translucent tint + accent glyph. Default `solid`. */
  variant?: 'solid' | 'soft';
  /** Tile / glyph size role. Default `md`. */
  size?: 'sm' | 'md' | 'lg';
  /** Tile shape. Default `rounded`. */
  shape?: 'rounded' | 'circle';
}

/** Soft-tint color role behind a `soft` tile, keyed by tone (single-sourced in tokens). */
function tint(t: Theme, tone: IconBadgeTone): string {
  switch (tone) {
    case 'primary':
      return t.colors.primaryTint;
    case 'accent':
      return t.colors.accentTint;
    case 'reward':
      return t.colors.rewardTint;
    case 'positive':
      return t.colors.positiveTint;
    case 'danger':
      return t.colors.dangerTint;
    case 'muted':
    default:
      return t.colors.neutralTint;
  }
}

/**
 * A colored rounded-square (or circle) tile holding a single `Icon` — the
 * cash-$, star-rep, and department-row treatment from the mockup. `solid` reads
 * as a painted chip (dark glyph on the accent); `soft` reads as a gentle tint
 * (accent glyph on a translucent wash). Presentation only.
 */
export function IconBadge({
  name,
  tone = 'primary',
  variant = 'solid',
  size = 'md',
  shape = 'rounded',
}: IconBadgeProps) {
  const t = useTheme();
  const tile: ViewStyle = {
    padding: size === 'sm' ? t.spacing.xs : t.spacing.sm,
    borderRadius: shape === 'circle' ? t.radius.pill : t.radius.md,
    backgroundColor: variant === 'soft' ? tint(t, tone) : t.icon.tone[tone],
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  };
  return (
    <View style={tile}>
      <Icon name={name} size={size} tone={variant === 'soft' ? tone : 'onAccent'} />
    </View>
  );
}
