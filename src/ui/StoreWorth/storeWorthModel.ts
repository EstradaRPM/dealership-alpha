/**
 * The store's position, formatted (#380): **Cash on Hand** and **What the Store
 * Is Worth**.
 *
 * Pure — numbers in, strings out. It lives in its own UI module rather than
 * inside HomeTab or FinanceTab because both rooms state the same pair, and copy
 * that says what a figure means is exactly the kind of thing that drifts when it
 * is written twice. The arithmetic is not here at all: `World.getStoreWorth()`
 * owns the sum, and this only decides how it reads.
 */

import { compactMoney } from '../kit';

/** The engine's `StoreWorth`, restated with no game-logic import. */
export interface StoreWorthInputs {
  readonly cash: number;
  readonly stockValue: number;
  readonly total: number;
}

export interface StoreWorthModel {
  readonly cashLabel: string;
  readonly cashValue: string;
  readonly worthLabel: string;
  readonly worthValue: string;
  /** The rule, in one sentence, under the worth figure. */
  readonly worthCaption: string;
}

/**
 * Plain-language names, not accounting terms. "Net worth" and "equity" are read
 * as finance jargon by the layperson this game is written for, so the figures
 * say what they are.
 */
const CASH_LABEL = 'Cash on Hand';
const WORTH_LABEL = 'What the Store Is Worth';

/**
 * The caption names **cost**, deliberately. The stock half is what the store
 * paid for its cars plus the recon it sank into them — not an appraisal — and
 * the Finance room renders a market Book Value a few inches further down the
 * page. A caption reading "plus the cars on your lot" would invite the player to
 * check the addition against that other number and find it does not work. #380's
 * own rule is that the figure is labeled for exactly what it sums.
 */
const WORTH_CAPTION = 'Your cash plus what the cars on your lot cost you.';

/**
 * Both figures are **compact** (issue 387). Cash on hand and the store's worth
 * are the HUD's ambient position — nothing is committed against either, the
 * reading is the magnitude, and both are wide enough that exact dollars crowd
 * the headline they sit in. Anything the player commits cash against — a bid, a
 * build, a wage — states its own figure to the dollar in the room where it is
 * committed.
 */

/**
 * An empty lot is **not** an empty state: the store is worth its cash, and a
 * dash there would read as "unknown" on exactly the day a Tier-1 player has
 * sold out and is about to restock. One rule, always a number.
 */
export function buildStoreWorth(input: StoreWorthInputs): StoreWorthModel {
  return {
    cashLabel: CASH_LABEL,
    cashValue: compactMoney(input.cash),
    worthLabel: WORTH_LABEL,
    worthValue: compactMoney(input.total),
    worthCaption: WORTH_CAPTION,
  };
}
