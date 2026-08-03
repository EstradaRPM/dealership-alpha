import type { TextStyle, ViewStyle } from 'react-native';
import { colors, type ColorToken } from './tokens';
import { spacing, type SpacingToken } from './spacing';
import { radius, type RadiusToken } from './radius';
import { typography, type TypographyToken } from './typography';
import { elevation, type ElevationToken } from './elevation';
import { gradients, type GradientToken, type GradientStops } from './gradients';
import { icon, type IconSizeToken, type IconToneToken } from './icons';
import { series, type SeriesPalette } from './series';

/**
 * The full theme: the one role→value map the whole UI renders against. A new
 * visual language (neo-skeuo vs. a future flat/light theme) is a new object of
 * this shape, swapped at the root — no component edits. This is the deep-module
 * / narrow-interface rule applied to presentation.
 *
 * Value types are widened (string/number/style) off the const token shapes so
 * an alternate theme can supply different literals against the same role keys.
 */
export interface Theme {
  colors: Record<ColorToken, string>;
  gradients: Record<GradientToken, GradientStops>;
  spacing: Record<SpacingToken, number>;
  radius: Record<RadiusToken, number>;
  typography: Record<TypographyToken, TextStyle>;
  elevation: Record<ElevationToken, ViewStyle>;
  icon: {
    size: Record<IconSizeToken, number>;
    tone: Record<IconToneToken, string>;
  };
  /**
   * Ordered categorical chart hues (issue 350). A theme supplies as many slots
   * as it wants; charts assign in order and fold the overflow into "Other".
   */
  series: SeriesPalette;
}

/** The current default theme: the "cool modern sim" palette + structural ramps. */
export const defaultTheme: Theme = {
  colors,
  gradients,
  spacing,
  radius,
  typography,
  elevation,
  icon,
  series,
};
