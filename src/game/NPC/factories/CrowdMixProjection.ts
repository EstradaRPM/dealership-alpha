import { resolveEffects } from '../Trait';
import type { TraitSet } from '../schemas/trait';
import type { PersonArchetypeCatalog } from '../schemas/person-archetype';
import type { VisitArchetypeCatalog } from '../schemas/visit-archetype';

/**
 * The crowd's finance mix, projected rather than sampled (#371).
 *
 * `createCustomer` decides how one buyer pays by rolling three independent
 * seeded streams — the payment-trait incidence, the cash Bernoulli, and the
 * credit gaussian. This module answers the same question about the *coming*
 * crowd in closed form, off the identical data: no RNG is drawn, nothing is
 * simulated, and the seeded customer stream is not touched. That is what lets
 * the read be gated (#178's door model) without a fixed seed replaying
 * differently depending on what the player bought (#122).
 *
 * The two halves answer different questions on purpose:
 *  - `cashShare` / `financeShare` describe EVERY up walking in.
 *  - `creditMix` describes only the ones who would finance — the book the F&I
 *    office actually writes, which is the crowd the posture dial is set
 *    against. Credit and payment leaning are correlated through the archetype
 *    (the retiree with the best score is also the likeliest cash buyer), so an
 *    all-comers credit mix would systematically flatter the book.
 */
export interface CrowdFinanceMix {
  /** Share of the coming crowd who would pay cash. */
  readonly cashShare: number;
  /** Share who would take a note. `cashShare + financeShare === 1`. */
  readonly financeShare: number;
  /** Credit-tier shares AMONG the financed crowd, catalog order, summing to 1. */
  readonly creditMix: readonly CrowdCreditBandShare[];
}

export interface CrowdCreditBandShare {
  readonly tier: string;
  readonly share: number;
}

/** One archetype pairing and how much of the coming crowd it is. */
export interface CrowdArchetypeShare {
  readonly personArchetypeId: string;
  readonly visitArchetypeId: string;
  /** Relative weight. Normalized internally, so raw weights are fine. */
  readonly share: number;
}

/**
 * A credit tier as the projection needs it: the score at which it starts.
 * Injected as data rather than as a classifier function because a classifier
 * can answer "which tier is this score" but not "how much of a distribution
 * lands in this tier" — and the second question is the whole read.
 */
export interface CrowdCreditBand {
  readonly tier: string;
  readonly minScore: number;
}

export interface ProjectCrowdFinanceMixDeps {
  readonly personArchetypes: PersonArchetypeCatalog;
  readonly visitArchetypes: VisitArchetypeCatalog;
  readonly traits: TraitSet;
  readonly creditBands: readonly CrowdCreditBand[];
}

const EMPTY_MIX = (bands: readonly CrowdCreditBand[]): CrowdFinanceMix => ({
  cashShare: 0,
  financeShare: 0,
  creditMix: bands.map((b) => ({ tier: b.tier, share: 0 })),
});

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Abramowitz & Stegun 7.1.26 — the standard-normal CDF to ~1e-7. A closed-form
 * series, not a tunable: it approximates a mathematical constant, so it lives
 * in code rather than in `data/`.
 */
function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

/**
 * The chance one buyer of this archetype pays cash, exactly as
 * `createCustomer` would decide it — but integrated over the payment-trait
 * draw instead of sampling it.
 *
 * The traits are independent Bernoullis, so the exact answer enumerates the
 * subsets: `must-finance` is categorical and takes the whole branch to zero,
 * while `cash-buyer` shifts the archetype's base leaning and clamps. Averaging
 * the effects instead would be wrong in both directions — it would let a
 * partial must-finance chance partly forbid cash, and it would smear the clamp.
 * The two rules and their precedence stay stated once, at the roll in
 * `CustomerFactory`; this walks the same `resolveEffects` machinery so a third
 * payment trait needs no change here.
 */
function expectedCashProbability(
  baseCashProbability: number,
  incidence: Readonly<Record<string, number>> | undefined,
  traits: TraitSet,
): number {
  const ids = incidence ? Object.keys(incidence).sort() : [];
  let total = 0;
  for (let mask = 0; mask < 1 << ids.length; mask++) {
    let probability = 1;
    const present: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const rate = incidence?.[ids[i]] ?? 0;
      if (mask & (1 << i)) {
        probability *= rate;
        present.push(ids[i]);
      } else {
        probability *= 1 - rate;
      }
    }
    if (probability === 0) continue;
    const resolved = present.map((id) => {
      const trait = traits[id];
      if (!trait) throw new Error(`Unknown trait "${id}"`);
      return trait;
    });
    const effects = resolveEffects(resolved, {}, 'customer');
    const cashProbability =
      (effects['payment.must_finance'] ?? 0) > 0
        ? 0
        : clamp01(baseCashProbability + (effects['payment.cash_probability'] ?? 0));
    total += probability * cashProbability;
  }
  return total;
}

/** Mass of a `N(mu, sigma)` credit score landing in each band. Bands are
 *  half-open `[minScore, nextBandUp)`, the same reading `classifyCredit` gives
 *  a single score — highest threshold first. */
function creditBandMass(
  mu: number,
  sigma: number,
  bands: readonly CrowdCreditBand[],
): readonly number[] {
  const ordered = bands
    .map((band, index) => ({ band, index }))
    .sort((a, b) => b.band.minScore - a.band.minScore);
  const mass = bands.map(() => 0);
  let ceilingCdf = 1;
  for (const { band, index } of ordered) {
    const floorCdf = sigma <= 0 ? (mu >= band.minScore ? 0 : 1) : normalCdf((band.minScore - mu) / sigma);
    mass[index] = Math.max(0, ceilingCdf - floorCdf);
    ceilingCdf = floorCdf;
  }
  return mass;
}

/**
 * Project how the coming crowd would pay, from the live demand configuration.
 * Pure: draws no randomness and reads no world state, so calling it (or not)
 * cannot move a seeded replay.
 */
export function projectCrowdFinanceMix(
  crowd: readonly CrowdArchetypeShare[],
  deps: ProjectCrowdFinanceMixDeps,
): CrowdFinanceMix {
  const { personArchetypes, visitArchetypes, traits, creditBands } = deps;
  const totalShare = crowd.reduce((sum, entry) => sum + Math.max(0, entry.share), 0);
  if (totalShare <= 0 || creditBands.length === 0) return EMPTY_MIX(creditBands);

  let cashWeight = 0;
  let financeWeight = 0;
  const creditWeight = creditBands.map(() => 0);

  for (const entry of crowd) {
    const share = Math.max(0, entry.share) / totalShare;
    if (share === 0) continue;

    const person = personArchetypes[entry.personArchetypeId];
    if (!person) throw new Error(`Unknown person archetype "${entry.personArchetypeId}"`);
    const visit = visitArchetypes[entry.visitArchetypeId];
    if (!visit) throw new Error(`Unknown visit archetype "${entry.visitArchetypeId}"`);
    // Only a sales visit carries a payment leaning; a service up is not a
    // finance decision and never reaches this read.
    if (visit.kind !== 'sales') {
      throw new Error(`Visit archetype "${entry.visitArchetypeId}" is not a sales visit`);
    }

    const cashProbability = expectedCashProbability(
      visit.payment.cashProbability,
      person.payment_traits,
      traits,
    );
    const financeProbability = 1 - cashProbability;
    cashWeight += share * cashProbability;
    financeWeight += share * financeProbability;

    const mass = creditBandMass(person.credit.mu, person.credit.sigma, creditBands);
    for (let i = 0; i < creditBands.length; i++) {
      creditWeight[i] += share * financeProbability * mass[i];
    }
  }

  const financedTotal = creditWeight.reduce((sum, w) => sum + w, 0);
  return {
    cashShare: cashWeight,
    financeShare: financeWeight,
    creditMix: creditBands.map((band, i) => ({
      tier: band.tier,
      share: financedTotal <= 0 ? 0 : creditWeight[i] / financedTotal,
    })),
  };
}
