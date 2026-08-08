import { loadCreditTiers } from './creditTier';
import {
  fallThroughProbability,
  loadFniDealKillConfig,
  type FniDealKillConfig,
} from './dealKill';
import {
  loadFniCsiDragConfig,
  markupSatisfactionHit,
  type FniCsiDragConfig,
} from './csiDrag';
import {
  computeReserve,
  loadFniPostureConfig,
  loadFniReserveConfig,
  type FniPostureConfig,
} from './reserve';
import type { CreditTier, CreditTierCatalog, FniReserveConfig } from './types';

/**
 * The peak model behind the posture meter (#370, grill Q4 as revised by Q5/Q9).
 *
 * The dial (#366) is one standing choice with two teeth on it — the lender's
 * fall-through (#367) and the customer's CSI drag (#368) — and without a
 * surface those teeth are invisible until they have already bitten. This is
 * that surface's model: what each of the three postures is worth per financed
 * contract, and which of them the store's expected back gross **crests** at.
 *
 * It is a **feedback read, never an input**. Nothing here changes state, draws
 * RNG, or reaches a module: it composes the three pure rules that already
 * exist (`computeReserve`, `fallThroughProbability`, `markupSatisfactionHit`)
 * over the store's own financed book. The peak therefore moves when the store
 * moves — a sharper F&I manager pushes the lender's frontier out and slides it
 * toward the aggressive end, a subprime-heavy book clamps the markup and slides
 * it back — and it is never a number a player can memorize.
 */

/**
 * One financed contract the store actually wrote, as the meter reads it.
 *
 * Deliberately the store's OWN book rather than a modeled crowd: the credit mix
 * that matters is the mix that walks through this door, and the deals already
 * record it. A structural shape, so `KPIDashboard.getFinancedBook()` satisfies
 * it without either module importing the other's types.
 */
export interface FinancedDealSample {
  readonly creditTier: CreditTier;
  /** Principal after down payment and trade equity. */
  readonly amountFinanced: number;
  readonly termMonths: number;
  /**
   * Everything but the reserve that this contract earned — front gross plus
   * product gross.
   *
   * It is here because a contract the lender passes on does not cost the store
   * a thinner back end, it costs the store **the sale** (#367: the guard fires
   * before `trade:resolved` and the customer walks). A meter that weighed only
   * the reserve against the fall-through would report the aggressive posture as
   * costing a few dollars of spread when what it actually risks is the whole
   * deal, and would name a peak the business does not have.
   *
   * Reserve is deliberately NOT included: it is the one part of the gross that
   * changes with the posture, so the model recomputes it per posture instead of
   * reading the one the deal happened to be written at.
   */
  readonly dealGross: number;
}

/** What one posture is worth over the book, per financed contract. */
export interface FniPostureProjection {
  readonly id: string;
  readonly label: string;
  /** The posture's own markup target, before any tier's cap clamps it. */
  readonly markupPts: number;
  /** Mean reserve on a contract that gets bought, in dollars. */
  readonly reservePerDeal: number;
  /** Share of contracts the lender still buys at this markup, 0–1. */
  readonly stickRate: number;
  /**
   * What a worked financed customer is expected to be worth at this posture:
   * `(dealGross + reserve) x stick`, averaged over the book. This is the curve
   * the peak is found on, and it is the **whole deal** rather than the back end
   * alone — a contract the lender passes on costs the store the sale, not a
   * thinner spread.
   *
   * The mean of the products rather than the product of the means: a tier whose
   * cap clamps the markup keeps its whole deal, and blending the bars first
   * would smear that across the book.
   */
  readonly expectedGrossPerDeal: number;
  /**
   * Mean satisfaction the store gives up per contract at this markup (#368),
   * ≤ 0. Reported beside the money and deliberately NOT folded into it: a
   * satisfaction point is not a dollar, and inventing an exchange rate to make
   * the curve crest would be a second pricing rule the player cannot see.
   */
  readonly satisfactionCostPerDeal: number;
}

export interface FniPeakReading {
  /** One projection per posture, in catalog order. */
  readonly postures: readonly FniPostureProjection[];
  /**
   * The posture the expected-gross curve crests at, or `null` when the
   * store has financed nothing yet and there is no book to read. Ties resolve
   * to the **less** aggressive posture: identical money for less markup is the
   * same money with less satisfaction given up, which is a rule the meter
   * already reports rather than a preference invented here.
   */
  readonly peakId: string | null;
  /** How many financed contracts the reading was computed over. */
  readonly dealsRead: number;
}

export interface FniPeakInput {
  readonly book: readonly FinancedDealSample[];
  /**
   * The F&I manager's resolved `finance_structuring` composite, or `null` when
   * the store has no finance office (#369) — it moves the lender's frontier the
   * fall-through is measured against, and nothing else.
   */
  readonly financeStructuringSkill: number | null;
}

export interface FniPeakDeps {
  readonly tiers?: CreditTierCatalog;
  readonly postureConfig?: FniPostureConfig;
  readonly reserveConfig?: FniReserveConfig;
  readonly dealKillConfig?: FniDealKillConfig;
  readonly csiDragConfig?: FniCsiDragConfig;
}

/**
 * Project all three postures over the store's financed book and name the peak.
 *
 * Pure and allocation-cheap: the surface re-renders freely, and re-rendering it
 * a hundred times is a hundred identical answers.
 */
export function projectFniPostures(
  input: FniPeakInput,
  deps: FniPeakDeps = {},
): FniPeakReading {
  const tiers = deps.tiers ?? loadCreditTiers();
  const postureConfig = deps.postureConfig ?? loadFniPostureConfig();
  const reserveConfig = deps.reserveConfig ?? loadFniReserveConfig();
  const dealKillConfig = deps.dealKillConfig ?? loadFniDealKillConfig();
  const csiDragConfig = deps.csiDragConfig ?? loadFniCsiDragConfig();

  const { book, financeStructuringSkill } = input;
  const dealsRead = book.length;

  const postures = postureConfig.postures.map((posture) =>
    projectOne(posture.id, posture.label, posture.markupPts, {
      book,
      financeStructuringSkill,
      tiers,
      reserveConfig,
      dealKillConfig,
      csiDragConfig,
    }),
  );

  return { postures, peakId: findPeakId(postures), dealsRead };
}

interface ProjectOneDeps {
  readonly book: readonly FinancedDealSample[];
  readonly financeStructuringSkill: number | null;
  readonly tiers: CreditTierCatalog;
  readonly reserveConfig: FniReserveConfig;
  readonly dealKillConfig: FniDealKillConfig;
  readonly csiDragConfig: FniCsiDragConfig;
}

function projectOne(
  id: string,
  label: string,
  markupPts: number,
  deps: ProjectOneDeps,
): FniPostureProjection {
  const { book } = deps;
  if (book.length === 0) {
    return {
      id,
      label,
      markupPts,
      reservePerDeal: 0,
      stickRate: 0,
      expectedGrossPerDeal: 0,
      satisfactionCostPerDeal: 0,
    };
  }

  let reserveTotal = 0;
  let stickTotal = 0;
  let expectedGrossTotal = 0;
  let satisfactionTotal = 0;

  for (const sample of book) {
    const tierDef = deps.tiers.tiers[sample.creditTier];
    // The same clamp `resolveFinanceQuote` applies at the close: the lender's
    // cap is a hard ceiling, which is why a subprime-heavy book cannot be
    // gouged at all and reads a peak at the calm end of the dial.
    const markup = Math.max(0, Math.min(markupPts, tierDef.markupCapPts));
    const reserve = computeReserve(
      {
        amountFinanced: sample.amountFinanced,
        termMonths: sample.termMonths,
        buyRate: tierDef.buyRate,
        customerRate: tierDef.buyRate + markup,
      },
      deps.reserveConfig.dealerSharePct,
    );
    const stick =
      1 -
      fallThroughProbability(
        markup,
        deps.dealKillConfig,
        deps.financeStructuringSkill,
      );

    reserveTotal += reserve;
    stickTotal += stick;
    // The whole deal rides on the lender buying the paper, not just the spread
    // the markup created — a fall-through sends the customer home in their own
    // car (#367), so the front and product gross die with the contract.
    expectedGrossTotal += (sample.dealGross + reserve) * stick;
    satisfactionTotal += markupSatisfactionHit(markup, deps.csiDragConfig);
  }

  const n = book.length;
  return {
    id,
    label,
    markupPts,
    reservePerDeal: reserveTotal / n,
    stickRate: stickTotal / n,
    expectedGrossPerDeal: expectedGrossTotal / n,
    satisfactionCostPerDeal: satisfactionTotal / n,
  };
}

/**
 * The crest. Scanned from the calmest posture upward with a strict `>`, so a
 * tie keeps the calmer answer — see `FniPeakReading.peakId`.
 */
function findPeakId(
  postures: readonly FniPostureProjection[],
): string | null {
  // Nothing financed, or nothing earned at any posture: there is no peak to
  // name, and naming one anyway would dress a flat line up as a decision.
  if (!postures.some((p) => p.expectedGrossPerDeal > 0)) return null;

  const calmestFirst = [...postures].sort((a, b) => a.markupPts - b.markupPts);
  let best = calmestFirst[0];
  for (const posture of calmestFirst) {
    if (posture.expectedGrossPerDeal > best.expectedGrossPerDeal) best = posture;
  }
  return best.id;
}
