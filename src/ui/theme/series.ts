/**
 * Categorical chart palette — the fixed hue order a chart assigns identity from.
 *
 * Separate from `colors` on purpose. The semantic roles carry *meaning*
 * (`reward` is money, `danger` is loss, `positive` is a healthy KPI); a donut of
 * body-style share needs six hues that mean nothing but "not the one next to
 * me". Reusing `danger` for "sedans" would make a red slice read as a problem.
 *
 * Slots are assigned in this fixed order and NEVER cycled — a seventh category
 * folds into "Other" (rendered in muted ink), it does not wrap back to slot 1.
 * Color follows the entity, never its rank, so a filter that drops a category
 * must not repaint the survivors.
 *
 * The order is the colorblind-safety mechanism, not cosmetics. Candidate
 * orderings were enumerated and validated against the app's card surface; this
 * is the best-scoring passing order:
 *
 *   lightness band  all six inside OKLCH L 0.48-0.67 (the dark-surface band)
 *   chroma floor    all six >= 0.1 (none reads as gray)
 *   CVD separation  worst adjacent pair 22.7 (OKLab dE x100, target >= 8)
 *   normal vision   worst adjacent pair 22.2 (floor 15)
 *   contrast        all six >= 3:1 on both the card and the app base
 *
 * That holds for the *adjacent* pairlist, which is the one bars, stacks and
 * donut rings are read on. All-pairs forms (scatter, bubble) are not in the kit
 * and would carry a three-slot cap; add that check with the form, not before.
 */
export const series = [
  /** Slot 1 — sky. The brand hue, so a single-identity chart looks native. */
  '#0284c7',
  /** Slot 2 — amber. */
  '#d97706',
  /** Slot 3 — magenta. */
  '#c026d3',
  /** Slot 4 — rose. */
  '#e11d48',
  /** Slot 5 — violet. */
  '#8b5cf6',
  /** Slot 6 — emerald. */
  '#059669',
] as const;

export type SeriesPalette = readonly string[];
