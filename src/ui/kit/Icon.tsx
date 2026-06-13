import React from 'react';
import { IconSet, ICON_MAP, type IconName } from './icons';
import { useTheme } from '../theme';
import type { IconSizeToken, IconToneToken } from '../theme';

/** A glyph name the kit supports — the only "which picture" knob. */
export type { IconName };

export interface IconProps {
  /** Which glyph to draw (kit icon name; see ICON_MAP in icons.ts). */
  name: IconName;
  /** Semantic size role. Default `md`. */
  size?: IconSizeToken;
  /** Semantic color role. Default `primary`. */
  tone?: IconToneToken;
}

/**
 * The icon primitive: one wrapper over the vector-icon set so call sites never
 * touch the raw icon component (size/color come from theme roles, not
 * literals). A future icon-set swap is a one-file change behind this barrel.
 */
export function Icon({ name, size = 'md', tone = 'primary' }: IconProps) {
  const t = useTheme();
  return <IconSet name={ICON_MAP[name]} size={t.icon.size[size]} color={t.icon.tone[tone]} />;
}
