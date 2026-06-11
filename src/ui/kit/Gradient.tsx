import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import type { ViewProps } from 'react-native';
import { useTheme } from '../theme';
import type { GradientToken } from '../theme';

export interface GradientSurfaceProps extends ViewProps {
  /** Gradient role to fill with. Default `surfaceRaised`. */
  gradient?: GradientToken;
  /**
   * Gradient direction as fractional points. Defaults to a vertical run
   * (top → bottom), the neo-skeuo lighting direction.
   */
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

/**
 * The gradient fill primitive — a themed `LinearGradient` that resolves its
 * stops from a `gradients` role rather than literal colors. Every gradient in
 * the UI goes through here, so the material is retuned in one place (the theme),
 * never hand-painted per surface. Presentation only; no game-logic imports.
 */
export function GradientSurface({
  gradient = 'surfaceRaised',
  start = { x: 0, y: 0 },
  end = { x: 0, y: 1 },
  style,
  children,
  ...rest
}: GradientSurfaceProps) {
  const t = useTheme();
  return (
    <LinearGradient colors={t.gradients[gradient]} start={start} end={end} style={style} {...rest}>
      {children}
    </LinearGradient>
  );
}

/** Semantic alias — `Gradient` and `GradientSurface` are the same primitive. */
export const Gradient = GradientSurface;
