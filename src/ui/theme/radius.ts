/**
 * Corner-radius scale. Semantic by surface kind — a `card`, a `control`, a
 * `pill` — not by literal px, so the neo-skeuo softness can be dialed in one
 * place. Future themes (flatter, rounder) swap these values, not consumers.
 */
export const radius = {
  /** Square — dividers, full-bleed strips. */
  none: 0,
  /** Tight rounding — chips, small controls, inset wells. */
  sm: 6,
  /** Default surface rounding — cards, panels, buttons. */
  md: 10,
  /** Soft rounding — large panels, modals, hero surfaces. */
  lg: 14,
  /** Fully round — status pills, gauges, avatars. */
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;
