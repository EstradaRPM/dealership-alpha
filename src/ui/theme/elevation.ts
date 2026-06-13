import type { ViewStyle } from 'react-native';

/**
 * Elevation / depth roles — the load-bearing tokens for the neo-skeuomorphic
 * look. A surface picks how it sits in the stack (`raised` off the page,
 * `inset` pressed into it, `floating` above everything) and the shadow/bevel
 * treatment follows. Picked by depth meaning, never by literal shadow values,
 * so depth can be retuned theme-wide in one place.
 *
 * RN has no inset box-shadow, so `inset` simulates a pressed well with a dark
 * top edge + faint light bottom edge (the bevel cue). Raw color/number literals
 * are allowed HERE — this file IS the role→value map. Components must not.
 */
export const elevation = {
  /** Flush with its parent — no shadow. */
  none: {} as ViewStyle,
  /**
   * Lifted off the page — cards, panels, primary buttons. Glass-slab bevel: a
   * faint rim light all the way around (brightest along the top edge, where
   * light catches glass) over a soft outer drop shadow, so a card reads as a
   * cool pane rather than a puffy bubble. Pairs with the near-flat
   * `surfaceRaised` gradient + faint `gloss` sheen on the `Surface` itself.
   */
  raised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 8,
    // The rim is the load-bearing depth cue — it (not a big fill jump) is what
    // separates a low-contrast card from the page, and it carries on Android
    // where shadow* props don't. Tuned to register on an OLED.
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderTopColor: 'rgba(255,255,255,0.20)',
  },
  /**
   * Soft colored halo — a glow cast in the element's OWN accent color (glossy
   * primary button, progress-bar fill). Carries only the soft, offset-less
   * shadow geometry; the caster supplies `shadowColor` from a color role, so a
   * blue button glows blue and a green bar glows green off one geometry.
   */
  glow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  /**
   * Loud accent halo for the hero CTA — same own-color principle as `glow` but
   * fat enough to read as a deliberate glow, not an ambient shadow. The high
   * `elevation` is what makes Android (API 28+) cast a strong COLORED drop
   * shadow once the caster supplies `shadowColor` from a color role; the wide
   * radius/opacity give iOS its bloom. Pairs with the `primaryGlow` under-layer
   * so the glow survives even where the platform colored shadow doesn't.
   */
  glowHero: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 16,
  },
  /** High above everything — modals, menus, floating actions. */
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  /** Pressed into the page — wells, inputs, track grooves. Top edge deepened so
   *  the groove still reads now that raised fills sit closer to the page. */
  inset: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.45)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
} satisfies Record<string, ViewStyle>;

export type ElevationToken = keyof typeof elevation;
