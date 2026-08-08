import {
  loadFniPostureConfig,
  resolveFniPosture,
  type FniPostureConfig,
} from './reserve';

/**
 * The monthly F&I verdict (#373) — the payoff half of the posture dial.
 *
 * The dial (#366) is a bet the player places and then leaves standing; the two
 * teeth on it (#367 fall-through, #368 CSI drag) bite one deal at a time and are
 * invisible at that grain. This is the model behind the beat that resolves the
 * bet at the grain it was actually placed at: what the finance office earned
 * over the month, split into the half that came from products and the half that
 * came from the rate, and whether the crowd that walked in was the crowd the
 * standing posture was a bet on.
 *
 * It is pure and reads nothing — every number is handed in, so the same model
 * serves the live month close and a test. The engine-side composition (the KPI
 * window, who was on the desk, which posture was standing) happens once, at the
 * composition root, and the Reveal phrases what comes back.
 *
 * **The mix judgement is ONE comparison**: was the month's financed share inside
 * the band this posture is a bet on? Reserve is earned on financed contracts and
 * nowhere else, so reaching for markup in a month the crowd paid cash is a bet
 * with nothing to bite on, and holding the rate down in a month that financed
 * nearly everything gave away gross the crowd would have paid. Both sides of
 * that are the same rule read from opposite ends, which is why there is one
 * band per posture rather than a table of situations.
 */

/** What the F&I office is judged on for one closed month. */
export interface FniMonthInput {
  /** Running 1-based month index — the same one `bestMonthGross` reports. */
  readonly month: number;
  /** The posture that was standing when the month closed; unknown ⇒ the catalog default. */
  readonly postureId: string | undefined;
  /**
   * The person working the desk, or `null` for a store with no finance office.
   * A name, because the reaction stars an entity with a fate — a month is worked
   * by somebody, and "the finance office sat empty" is that same fact when there
   * is nobody to name.
   */
  readonly deskName: string | null;
  readonly unitsRetailed: number;
  readonly financedUnits: number;
  /** Margin on the F&I products that attached over the month. */
  readonly productGross: number;
  /** The store's share of the rate spread over the month — zero on every cash deal. */
  readonly reserveGross: number;
}

/**
 * How the month's payment mix sat against the standing posture. `matched` is not
 * "you did well" — it is "this was the crowd this bet was for"; the money is
 * reported separately and says the rest.
 */
export type FniMixVerdict = 'matched' | 'too_few_financed' | 'too_many_financed';

export interface FniMonthVerdict {
  readonly month: number;
  readonly postureId: string;
  readonly postureLabel: string;
  readonly deskName: string | null;
  readonly unitsRetailed: number;
  readonly financedUnits: number;
  /** Financed units ÷ retail units, 0–1. */
  readonly financedShare: number;
  readonly productGross: number;
  readonly reserveGross: number;
  /** `productGross + reserveGross` — the month's whole back end. */
  readonly backGross: number;
  /** Back gross per retail unit — the number the F&I record is chased on. */
  readonly perUnit: number;
  readonly mix: FniMixVerdict;
}

/**
 * The month's F&I verdict, or `null` when the store retailed nothing.
 *
 * A month with no units has no per-unit number and no mix to judge — there was
 * no crowd, so there is no bet to resolve. Reporting "the posture earned $0 a
 * car" on a dead month would blame the dial for a floor problem, so the beat
 * simply does not fire (and neither does its record).
 */
export function buildFniMonthVerdict(
  input: FniMonthInput,
  config: FniPostureConfig = loadFniPostureConfig(),
): FniMonthVerdict | null {
  if (input.unitsRetailed <= 0) return null;
  const posture = resolveFniPosture(input.postureId, config);
  const backGross = input.productGross + input.reserveGross;
  const financedShare = input.financedUnits / input.unitsRetailed;
  const band = posture.financedShareBand;
  const mix: FniMixVerdict =
    financedShare < band.min
      ? 'too_few_financed'
      : financedShare > band.max
        ? 'too_many_financed'
        : 'matched';
  return {
    month: input.month,
    postureId: posture.id,
    postureLabel: posture.label,
    deskName: input.deskName,
    unitsRetailed: input.unitsRetailed,
    financedUnits: input.financedUnits,
    financedShare,
    productGross: input.productGross,
    reserveGross: input.reserveGross,
    backGross,
    perUnit: backGross / input.unitsRetailed,
    mix,
  };
}
