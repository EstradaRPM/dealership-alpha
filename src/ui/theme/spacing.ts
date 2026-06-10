/**
 * Spacing scale — the single rhythm step set every surface lays out against.
 *
 * 4-based: each step is a multiple of the 4px base unit. Components pick a step
 * by meaning (a `md` gap between rows, `xl` card padding), never a literal px,
 * so the whole layout density can be retuned in one place without touching
 * consumers. Same doctrine as the color roles in `tokens.ts`.
 */
export const spacing = {
  /** No gap. */
  none: 0,
  /** Hairline nudge — caption-to-label, tight stacks. */
  xxs: 2,
  /** Tightest real gap — icon-to-text, chip insets. */
  xs: 4,
  /** Compact gap — within a control, list-row vertical padding. */
  sm: 8,
  /** Default gap between related elements. */
  md: 12,
  /** Section gap — between groups inside a card. */
  lg: 16,
  /** Card padding / generous inner gutter. */
  xl: 20,
  /** Large gap — between cards in a column. */
  xxl: 24,
  /** Screen-level separation. */
  xxxl: 32,
} as const;

export type SpacingToken = keyof typeof spacing;
