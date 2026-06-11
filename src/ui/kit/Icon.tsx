import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import type { IconSizeToken, IconToneToken } from '../theme';

/** A glyph name from the Ionicons set — the only "which picture" knob. */
export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface IconProps {
  /** Which glyph to draw (Ionicons name). */
  name: IconName;
  /** Semantic size role. Default `md`. */
  size?: IconSizeToken;
  /** Semantic color role. Default `primary`. */
  tone?: IconToneToken;
}

/**
 * The icon primitive: one wrapper over the vector-icon set so call sites never
 * touch the raw `Ionicons` (size/color come from theme roles, not literals). A
 * future icon-set swap is a one-file change behind this barrel export.
 */
export function Icon({ name, size = 'md', tone = 'primary' }: IconProps) {
  const t = useTheme();
  return <Ionicons name={name} size={t.icon.size[size]} color={t.icon.tone[tone]} />;
}
