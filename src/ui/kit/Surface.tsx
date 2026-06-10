import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export type SurfaceVariant = 'raised' | 'inset' | 'flat';

export interface SurfaceProps extends ViewProps {
  /** How the surface sits in the depth stack. Default `raised`. */
  variant?: SurfaceVariant;
  /** Apply default card padding. Set false for full-bleed contents. */
  padded?: boolean;
}

/**
 * The base panel every screen builds on — a themed `View` with the right
 * background, rounding and elevation for its depth role. `raised` lifts off the
 * page (cards), `inset` presses into it (wells), `flat` is flush. Presentation
 * only; no game-logic imports.
 */
export function Surface({
  variant = 'raised',
  padded = true,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const t = useTheme();
  const depth =
    variant === 'raised'
      ? t.elevation.raised
      : variant === 'inset'
        ? t.elevation.inset
        : t.elevation.none;
  const base: ViewStyle = {
    backgroundColor: variant === 'inset' ? t.colors.base : t.colors.surface,
    borderRadius: t.radius.md,
    padding: padded ? t.spacing.xl : t.spacing.none,
    ...depth,
  };
  return (
    <View style={[base, style]} {...rest}>
      {children}
    </View>
  );
}

/** Semantic alias — a `Card` is a raised `Surface`. Same interface. */
export const Card = Surface;
