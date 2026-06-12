/**
 * Centralized UI design tokens — the single source of truth for color.
 *
 * Direction: "Cool modern sim" (issue #133). Slate-navy base, cyan primary,
 * indigo accent, amber reserved for money/reward moments. The prior warm-brown
 * palette is fully retired; screens consume these roles instead of inline hex
 * so the look can be re-skinned in one place.
 *
 * Roles are semantic, not literal — pick by meaning (surface, danger, reward),
 * never by hex value. v2 theming (light mode, per-tier tints) drops in here
 * without touching consumers.
 */

export const colors = {
  /** App background — the deepest layer. */
  base: '#0e1420',
  /** Cards, panels, modals sitting on `base`. */
  surface: '#18202e',
  /** Raised surface: list rows, inputs, the layer above `surface`. */
  surfaceRaised: '#2b3650',

  /** Default borders / dividers. */
  border: '#33405a',
  /** Quieter borders and disabled outlines. */
  borderMuted: '#3d4a63',

  /** Primary text on dark surfaces. */
  textPrimary: '#f1f5f9',
  /** Secondary text — body copy, descriptions. */
  textSecondary: '#c2cad6',
  /** Muted text — labels, captions, hints. */
  textMuted: '#8a94a6',

  /** Primary brand / interactive accent (cyan). */
  primary: '#38bdf8',
  /** Dim primary — pressed/secondary-button backgrounds. */
  primaryDim: '#1e3a5f',
  /** Secondary accent (indigo) for variety / selection states. */
  accent: '#818cf8',

  /** Money & win moments ONLY — deals closed, profit, tier-up. */
  reward: '#fbbf24',
  /** Positive/success semantic (gains, healthy KPIs). */
  positive: '#34d399',
  /** Danger/negative semantic (losses, errors, destructive actions). */
  danger: '#f4505a',

  /** Text/icon color to sit ON a `primary` or `reward` fill. */
  onAccent: '#0e1420',

  /** Dimming scrim behind a centered modal sheet (dialogs, the day-close
   *  recap). The one place a translucent full-screen backdrop is themed. */
  scrim: 'rgba(8,12,20,0.78)',

  /** Drop-shadow color for text sitting directly on hero art — pairs with the
   *  hero scrim gradients to guarantee legibility over any photo. */
  heroTextShadow: 'rgba(4,8,16,0.85)',

  /**
   * Soft translucent accent tints — the "filled / soft-glow" backgrounds behind
   * a soft `IconBadge` tile or a soft `Pill` (#236). One per accent so the chip
   * fill stays single-sourced; the glyph/text sits on top in the matching tone.
   */
  neutralTint: 'rgba(138,148,166,0.16)',
  primaryTint: 'rgba(56,189,248,0.16)',
  accentTint: 'rgba(129,140,248,0.16)',
  rewardTint: 'rgba(251,191,36,0.16)',
  positiveTint: 'rgba(52,211,153,0.16)',
  dangerTint: 'rgba(244,80,90,0.16)',
} as const;

/**
 * Default business accent when the player hasn't picked one (was the old
 * warm tan `#c8a96e`). Threaded through CharacterCreation → DayLoopShell.
 */
export const DEFAULT_ACCENT = colors.primary;

export type ColorToken = keyof typeof colors;
