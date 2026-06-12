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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderTopColor: 'rgba(255,255,255,0.10)',
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
  /** High above everything — modals, menus, floating actions. */
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  /** Pressed into the page — wells, inputs, track grooves. */
  inset: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.35)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
} satisfies Record<string, ViewStyle>;

export type ElevationToken = keyof typeof elevation;
