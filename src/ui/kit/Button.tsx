import React from 'react';
import {
  Pressable,
  Text,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  /** Visual weight. Default `primary`. */
  variant?: ButtonVariant;
}

/**
 * Themed pressable. `primary` is the filled accent CTA, `secondary` a dim-fill
 * companion, `ghost` an outline-only action. Disabled state dims the whole
 * control. Pure presentation — the caller owns `onPress` semantics.
 */
export function Button({ label, variant = 'primary', disabled, ...rest }: ButtonProps) {
  const t = useTheme();

  const container: ViewStyle = {
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.xl,
    borderRadius: t.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      variant === 'primary'
        ? t.colors.primary
        : variant === 'secondary'
          ? t.colors.primaryDim
          : 'transparent',
    borderWidth: variant === 'ghost' ? 1 : 0,
    borderColor: t.colors.border,
    opacity: disabled ? 0.45 : 1,
    ...(variant === 'primary' ? t.elevation.raised : t.elevation.none),
  };

  const text: TextStyle = {
    ...t.typography.button,
    color: variant === 'primary' ? t.colors.onAccent : t.colors.textPrimary,
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [container, pressed && !disabled ? { opacity: 0.8 } : null]}
      {...rest}
    >
      <Text style={text}>{label}</Text>
    </Pressable>
  );
}
