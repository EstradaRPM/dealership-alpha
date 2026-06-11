import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../theme';
import { GradientSurface } from './Gradient';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  /** Visual weight. Default `primary`. */
  variant?: ButtonVariant;
}

/**
 * Themed pressable. `primary` is a glossy gradient CTA with a colored glow,
 * `secondary` a dim-blue gradient companion with a raised bevel, `ghost` an
 * outline-only action. Disabled state dims the whole control. Pure presentation
 * — the caller owns `onPress` semantics.
 */
export function Button({ label, variant = 'primary', disabled, ...rest }: ButtonProps) {
  const t = useTheme();

  // `ghost` stays a flat outline — no gradient body.
  if (variant === 'ghost') {
    const container: ViewStyle = {
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.xl,
      borderRadius: t.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.colors.border,
      opacity: disabled ? 0.45 : 1,
    };
    const ghostText: TextStyle = { ...t.typography.button, color: t.colors.textPrimary };
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        style={({ pressed }) => [container, pressed && !disabled ? { opacity: 0.8 } : null]}
        {...rest}
      >
        <Text style={ghostText}>{label}</Text>
      </Pressable>
    );
  }

  const isPrimary = variant === 'primary';

  // Outer frame: solid fallback fill (so the bevel/glow has a shape to cast) +
  // depth. Primary glows in its own accent; secondary takes the raised bevel.
  const frame: ViewStyle = {
    borderRadius: t.radius.md,
    backgroundColor: isPrimary ? t.colors.primary : t.colors.primaryDim,
    opacity: disabled ? 0.45 : 1,
    ...(isPrimary ? { ...t.elevation.glow, shadowColor: t.colors.primary } : t.elevation.raised),
  };
  // Inner gradient body clips to the rounded corners and holds the padding.
  const fill: ViewStyle = {
    borderRadius: t.radius.md,
    overflow: 'hidden',
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const text: TextStyle = {
    ...t.typography.button,
    color: isPrimary ? t.colors.onAccent : t.colors.textPrimary,
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [frame, pressed && !disabled ? { opacity: 0.8 } : null]}
      {...rest}
    >
      <GradientSurface gradient={isPrimary ? 'primary' : 'primaryDim'} style={fill}>
        <GradientSurface
          gradient="gloss"
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
          style={styles.gloss}
        />
        <Text style={text}>{label}</Text>
      </GradientSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Glossy top-highlight sheen — covers the upper band, fading out downward.
  // Clipped to the button's rounded corners by the parent's overflow:hidden.
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
});
