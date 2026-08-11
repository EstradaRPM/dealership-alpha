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
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'hero';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  /** Visual weight. Default `primary`. */
  variant?: ButtonVariant;
  /**
   * Visual scale. `hero` is the screen's single headline verb (the pinned day
   * action): a bigger body, a louder colored glow, and room for a leading icon.
   * Default `md`.
   */
  size?: ButtonSize;
  /** Optional leading glyph drawn before the label (the hero day-action CTA). */
  icon?: IconName;
  /**
   * Optional trailing glyph drawn after the label — the "and onward" arrow the
   * mockup's hero CTA carries on its right edge. Kept a separate slot from
   * `icon` so a caller never has to smuggle a directional glyph into the label
   * string (which double-draws it beside a leading `icon`).
   */
  trailingIcon?: IconName;
}

/**
 * Themed pressable. `primary` is a glossy saturated-blue gradient CTA carrying a
 * near-white label + colored glow, `secondary` a dim-blue gradient companion
 * with a raised bevel, `ghost` an outline-only action, `danger` the same glossy
 * body in the destructive red role (the verb that deletes something). `size="hero"`
 * swells the primary CTA into the screen's headline verb. Disabled state dims the
 * whole control. Pure presentation — the caller owns `onPress` semantics.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  trailingIcon,
  disabled,
  ...rest
}: ButtonProps) {
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
  const isDanger = variant === 'danger';
  const isHero = size === 'hero';
  const radius = isHero ? t.radius.lg : t.radius.md;
  // The gradient body and the solid fallback under it are the same role, so a
  // variant is one decision (which fill), not two that can disagree.
  const fillRole = isDanger ? 'danger' : isPrimary ? 'primary' : 'primaryDim';
  const fillColor = isDanger
    ? t.colors.danger
    : isPrimary
      ? t.colors.primary
      : t.colors.primaryDim;

  // Outer frame: solid fallback fill (so the bevel/glow has a shape to cast) +
  // depth. Primary and danger glow in their own accent (a fat `glowHero` halo at
  // hero scale); secondary takes the raised bevel.
  const frame: ViewStyle = {
    borderRadius: radius,
    backgroundColor: fillColor,
    opacity: disabled ? 0.45 : 1,
    ...(isPrimary || isDanger
      ? { ...(isHero ? t.elevation.glowHero : t.elevation.glow), shadowColor: fillColor }
      : t.elevation.raised),
  };
  // Faked under-glow: a translucent cyan bloom bleeding below + beside the frame
  // so a colored glow reads even where the platform's colored shadow doesn't
  // (Android < API 28). Drawn behind the fill; only the bled edges show.
  const glow: ViewStyle = {
    position: 'absolute',
    top: t.spacing.xs,
    left: t.spacing.lg,
    right: t.spacing.lg,
    bottom: -t.spacing.sm,
    borderRadius: t.radius.pill,
  };
  // Inner gradient body clips to the rounded corners and holds the padding.
  const fill: ViewStyle = {
    borderRadius: radius,
    overflow: 'hidden',
    flexDirection: 'row',
    gap: t.spacing.sm,
    paddingVertical: isHero ? t.spacing.lg : t.spacing.md,
    paddingHorizontal: t.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const text: TextStyle = {
    ...(isHero ? t.typography.buttonHero : t.typography.button),
    color: t.colors.textPrimary,
    // With glyphs on BOTH edges the mockup centers the verb in the face and
    // pins the icons to the rims; letting the label claim the middle keeps it
    // optically centered instead of shunted left by the trailing glyph.
    ...(trailingIcon ? { flex: 1, textAlign: 'center' as const } : null),
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [frame, pressed && !disabled ? { opacity: 0.78 } : null]}
      {...rest}
    >
      {isPrimary && isHero ? (
        <GradientSurface gradient="primaryGlow" pointerEvents="none" style={glow} />
      ) : null}
      <GradientSurface gradient={fillRole} style={fill}>
        <GradientSurface
          gradient="gloss"
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
          style={styles.gloss}
        />
        {icon ? <Icon name={icon} size="md" tone="onPrimary" /> : null}
        <Text style={text}>{label}</Text>
        {trailingIcon ? <Icon name={trailingIcon} size="md" tone="onPrimary" /> : null}
      </GradientSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Glossy top-highlight sheen — covers the upper band, fading out downward.
  // Clipped to the button's rounded corners by the parent's overflow:hidden.
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
});
