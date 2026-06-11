import React from 'react';
import { View, StyleSheet, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { GradientSurface } from './Gradient';

export type SurfaceVariant = 'raised' | 'inset' | 'flat';

export interface SurfaceProps extends ViewProps {
  /** How the surface sits in the depth stack. Default `raised`. */
  variant?: SurfaceVariant;
  /** Apply default card padding. Set false for full-bleed contents. */
  padded?: boolean;
}

/**
 * The base panel every screen builds on. A `raised` card is a real slab: a
 * vertical gradient fill (`surfaceRaised`) under a translucent top sheen
 * (`gloss`), wrapped by the `raised` bevel (top catch-light + outer shadow) —
 * not a flat `backgroundColor`. `inset` presses into the page (wells), `flat`
 * is flush. Presentation only; no game-logic imports.
 */
export function Surface({
  variant = 'raised',
  padded = true,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const t = useTheme();

  if (variant === 'raised') {
    // Outer carries the bevel (shadow + top catch-light) and a solid fallback
    // fill so the shadow has a shape to cast; the inner gradient clips to the
    // rounded corners and holds the padding + sheen.
    const frame: ViewStyle = {
      borderRadius: t.radius.md,
      backgroundColor: t.colors.surfaceRaised,
      ...t.elevation.raised,
    };
    const fill: ViewStyle = {
      borderRadius: t.radius.md,
      overflow: 'hidden',
      padding: padded ? t.spacing.xl : t.spacing.none,
    };
    return (
      <View style={[frame, style]} {...rest}>
        <GradientSurface gradient="surfaceRaised" style={fill}>
          <GradientSurface
            gradient="gloss"
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            pointerEvents="none"
            style={styles.gloss}
          />
          {children}
        </GradientSurface>
      </View>
    );
  }

  const depth = variant === 'inset' ? t.elevation.inset : t.elevation.none;
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

const styles = StyleSheet.create({
  // Glossy top-highlight edge — covers the upper band, fading out downward.
  // Clipped to the card's rounded corners by the parent's overflow:hidden.
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%' },
});

/** Semantic alias — a `Card` is a raised `Surface`. Same interface. */
export const Card = Surface;
