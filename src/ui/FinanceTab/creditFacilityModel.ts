import type {
  CreditDrawRefusal,
  CreditFacilityState,
  CreditRepayRefusal,
} from '../../game/CreditFacility';
import { money } from '../kit';

/**
 * The borrowing facility, formatted (#393) — the surface half of #392.
 *
 * Pure: one engine read in, strings out. Every bound the panel obeys already
 * exists on `CreditFacilityState` (`available`, `maxRepayment`, `drawSteps`,
 * `dailyInterest`), so nothing here re-derives a rule the module owns — this
 * decides only how the facility reads.
 *
 * **Everything is exact** (#387). The whole panel is figures the player commits
 * against — an amount they are about to borrow, a balance they are about to pay
 * down, the headroom a refusal quotes back at them — and a compacted number
 * there would round something being signed for. It is also the Finance room,
 * where a figure must reconcile with the figure beside it.
 *
 * **It is a reading of this moment, never of the selected window.** The range
 * chips above it are a lens over what the store *did*; a limit, a balance and a
 * headroom are what the store *is*, exactly like the #380 worth line. That is
 * why `interestPaid` is the facility's lifetime charge rather than the window's:
 * what the debt cost over a period is the expenses breakdown's line, and it is
 * pinned there so the fold can never bury it.
 */

/** One amount the facility can be drawn or repaid in. */
export interface CreditAmountOption {
  /** Stable across renders — the amount itself, as a string. */
  readonly id: string;
  /** The amount, to the dollar. */
  readonly label: string;
  readonly amount: number;
}

export interface CreditFacilityPanelModel {
  readonly title: string;
  readonly caption: string;
  readonly limitLabel: string;
  readonly limitValue: string;
  readonly drawnLabel: string;
  readonly drawnValue: string;
  readonly availableLabel: string;
  readonly availableValue: string;
  readonly interestLabel: string;
  readonly interestValue: string;
  /** What tomorrow morning's charge will be on the balance standing now. */
  readonly nextChargeLabel: string;
  readonly nextChargeValue: string;
  readonly amountsLabel: string;
  readonly amounts: readonly CreditAmountOption[];
  readonly drawLabel: string;
  readonly repayLabel: string;
}

const TITLE = 'Your Credit Line';
/**
 * The caption states the ONE cost rule (`CreditFacility/CLAUDE.md`) in the
 * player's own words, and quotes no figure — the rate is stated as a number the
 * panel already shows nowhere, and every store's charge differs. A player who
 * reads this can predict every charge the facility will ever make.
 */
const CAPTION =
  'Money you can borrow against your name. Whatever is still borrowed when a day opens costs you a day of interest that morning.';

const LIMIT_LABEL = 'Your line';
const DRAWN_LABEL = 'Borrowed';
const AVAILABLE_LABEL = 'Left to borrow';
const INTEREST_LABEL = 'Interest paid so far';
const NEXT_CHARGE_LABEL = "Tomorrow morning's interest";
const AMOUNTS_LABEL = 'How much';
const DRAW_LABEL = 'Borrow this';
const REPAY_LABEL = 'Pay this back';

/**
 * The panel, or `null` for a store whose line is worth nothing.
 *
 * A limit of zero is a facility that cannot be drawn (#392) — one code path in
 * the engine, and one rule here: the room renders **nothing** rather than a
 * block of zeros with two dead buttons, which is the locked IA's rule 3 for a
 * mechanic a store does not have.
 */
export function buildCreditFacilityPanel(
  state: CreditFacilityState,
): CreditFacilityPanelModel | null {
  if (state.limit <= 0) return null;
  return {
    title: TITLE,
    caption: CAPTION,
    limitLabel: LIMIT_LABEL,
    limitValue: money(state.limit),
    drawnLabel: DRAWN_LABEL,
    drawnValue: money(state.drawn),
    availableLabel: AVAILABLE_LABEL,
    availableValue: money(state.available),
    interestLabel: INTEREST_LABEL,
    interestValue: money(state.interestPaidToDate),
    nextChargeLabel: NEXT_CHARGE_LABEL,
    nextChargeValue: money(state.dailyInterest),
    amountsLabel: AMOUNTS_LABEL,
    amounts: state.drawSteps.map((amount) => ({
      id: String(amount),
      label: money(amount),
      amount,
    })),
    drawLabel: DRAW_LABEL,
    repayLabel: REPAY_LABEL,
  };
}

/**
 * Why the engine said no, in a sentence that names the bound it was measured
 * against.
 *
 * **A refused draw is refused whole, never clamped** (#392) — a button that
 * quietly hands you less than you asked for is a second rule — so the notice has
 * to say what would have gone through instead of silently doing it. The figure
 * comes off the same `CreditFacilityState` the refusal was decided from, so the
 * headroom the player is told is the headroom the next press will be judged
 * against.
 */
export function creditDrawNotice(
  reason: CreditDrawRefusal,
  state: CreditFacilityState,
): string {
  switch (reason) {
    case 'over-limit':
      return `That is more than your line has left. You can borrow ${money(state.available)} more.`;
    case 'invalid-amount':
      return 'That is not an amount you can borrow.';
  }
}

export function creditRepayNotice(
  reason: CreditRepayRefusal,
  state: CreditFacilityState,
): string {
  switch (reason) {
    case 'over-balance':
      return `You owe less than that. You can pay back ${money(state.drawn)}.`;
    case 'cannot-afford':
      return `You do not have that in the bank. You can pay back ${money(state.maxRepayment)} today.`;
    case 'invalid-amount':
      return 'That is not an amount you can pay back.';
  }
}
