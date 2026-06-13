import type { TextStyle } from 'react-native';

/**
 * Typography ramp — named, composed text roles built from a small size/weight/
 * line-height vocabulary. Components reference a role (`title`, `statValue`,
 * `body`) rather than spelling out fontSize/fontWeight, so the type ramp can be
 * retuned (or a new theme's ramp swapped in) without editing surfaces.
 *
 * Each entry is validated against `TextStyle` via `satisfies` while keeping its
 * literal types, so `fontWeight`/`textTransform` stay assignable downstream.
 */
export const typography = {
  /** Screen identity title — the dealership name over the hero header. */
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  /** Card / section eyebrow — uppercase, tracked, muted in use. */
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  /** Large numeric figure — a stat value, a gross. */
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  /** Caption under a stat — uppercase, tracked. */
  statLabel: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  /** Default body copy. */
  body: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  /** Emphasized body — a row label that's been promoted. */
  bodyStrong: {
    fontSize: 15,
    fontWeight: '700',
  },
  /** Standard row / list label. */
  label: {
    fontSize: 15,
    fontWeight: '400',
  },
  /** Secondary caption / hint. */
  caption: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  /** Status-chip text — small, uppercase, tracked. */
  badge: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  /** Button face text. */
  button: {
    fontSize: 15,
    fontWeight: '700',
  },
  /** Hero CTA face — the screen's one headline verb (footer day action). */
  buttonHero: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
} satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;
