/**
 * Icon roles — the size/color half of the icon system (#236). A glyph name is a
 * call-site prop (which picture), but how big it draws and what it paints in are
 * semantic roles resolved through the theme, never literal px / hex at the call
 * site. Recoloring or resizing the icon language is a one-file edit here.
 *
 * Tones map to the flat color roles in `tokens.ts` so an icon never carries its
 * own hex — colors stay single-sourced. `tint` is the soft translucent fill
 * behind a soft IconBadge / soft Pill (also single-sourced in `tokens.ts`).
 */
import { colors } from './tokens';

/** Icon pixel sizes — semantic by role, not literal px at the call site. */
export const iconSize = {
  /** Inline / dense rows, chip leading glyphs. */
  sm: 16,
  /** Default — stat tiles, list rows. */
  md: 22,
  /** Hero glyphs — large badges, empty states. */
  lg: 28,
} as const;

export type IconSizeToken = keyof typeof iconSize;

/** The small palette an icon glyph paints in, each aliased to a flat color role. */
export const iconTone = {
  primary: colors.primary,
  accent: colors.accent,
  reward: colors.reward,
  positive: colors.positive,
  danger: colors.danger,
  muted: colors.textMuted,
  /** Glyph color to sit ON a solid-filled tone tile (cash / star badge). */
  onAccent: colors.onAccent,
} as const;

export type IconToneToken = keyof typeof iconTone;

/** The icon token group hung off the theme as `theme.icon`. */
export const icon = {
  size: iconSize,
  tone: iconTone,
} as const;
