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
   * Lifted off the page — cards, panels, primary buttons. A true raised bevel:
   * a lighter top hairline (the catch-light along the upper edge) over a deeper,
   * softer outer drop shadow, so a card reads as a physical slab rather than a
   * flat fill. Pairs with the `surfaceRaised` gradient + `gloss` sheen on the
   * `Surface` itself.
   */
  raised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.09)',
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
