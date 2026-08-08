/**
 * The coming crowd's finance mix, as the Growth tab renders it (#371).
 *
 * A forward read the player sets next month's finance posture against: a
 * posture set blind is a coin flip. It sits behind the wire's door model, so
 * the panel has exactly two states — open, or a locked row that names every
 * way in. The tease is the mechanic.
 */

/** One way into the lane, stated in the player's words. */
export interface FinanceMixDoorInput {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
}

/** One share of the crowd, pre-formatted. */
export interface FinanceMixRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /** 0–1, for the bar fill. */
  readonly share: number;
}

export interface FinanceMixModelInput {
  readonly open: boolean;
  readonly cashShare: number;
  readonly financeShare: number;
  readonly creditMix: readonly { readonly id: string; readonly label: string; readonly share: number }[];
  readonly doors: readonly FinanceMixDoorInput[];
}

export interface FinanceMixModel {
  readonly open: boolean;
  /** What the numbers mean, in one sentence. */
  readonly note: string;
  readonly paymentRows: readonly FinanceMixRow[];
  readonly creditHeading: string;
  readonly creditRows: readonly FinanceMixRow[];
  /** Non-empty only while the lane is closed. */
  readonly doors: readonly FinanceMixDoorInput[];
  /** Why the panel is empty, when it is. */
  readonly lockedNote: string;
}

const OPEN_NOTE =
  'How the people about to walk in intend to pay. Set your finance posture against it.';
const LOCKED_NOTE =
  'Nobody here reads how the crowd is paying yet, so next month’s finance posture is a guess.';
const CREDIT_HEADING = 'Credit of the ones who would finance';

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function buildFinanceMixModel(input: FinanceMixModelInput): FinanceMixModel {
  if (!input.open) {
    return {
      open: false,
      note: OPEN_NOTE,
      paymentRows: [],
      creditHeading: CREDIT_HEADING,
      creditRows: [],
      doors: input.doors,
      lockedNote: LOCKED_NOTE,
    };
  }
  return {
    open: true,
    note: OPEN_NOTE,
    paymentRows: [
      {
        id: 'finance',
        label: 'Taking a note',
        value: percent(input.financeShare),
        share: input.financeShare,
      },
      {
        id: 'cash',
        label: 'Paying cash',
        value: percent(input.cashShare),
        share: input.cashShare,
      },
    ],
    creditHeading: CREDIT_HEADING,
    creditRows: input.creditMix.map((band) => ({
      id: band.id,
      label: band.label,
      value: percent(band.share),
      share: band.share,
    })),
    doors: [],
    lockedNote: LOCKED_NOTE,
  };
}
