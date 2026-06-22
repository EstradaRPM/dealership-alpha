import type { InstalledBaseConfig } from './installedBaseConfig';

/**
 * The pure feedback math behind the installed-base loop (#306). Kept free of the
 * EventBus / registry so it is isolation-testable on its own: the module joins
 * these with the live owner records and the pricing-posture read to move
 * loyalty + CSI, defect owners, and decide repeat-buyer leads.
 */

/** A resolved service outcome the feedback loop reacts to. */
export type ServiceOutcomeKind = 'closed' | 'missed' | 'unserved';

export interface ServiceOutcomeEffect {
  /** Signed loyalty delta to apply (clamped by the caller). */
  readonly loyaltyDelta: number;
  /** Signed CSI delta to apply (clamped by the caller). */
  readonly csiDelta: number;
  /** Whether this was a bad experience (counts toward defection; resets the
   *  bad-visit counter when false). */
  readonly isBadVisit: boolean;
  /** Reputation satisfaction-hit amount (≤ 0; 0 = no hit). */
  readonly reputationHit: number;
  /** Why — also the Reputation hit reason suffix. */
  readonly reason: 'served_fair' | 'gouged' | 'missed' | 'unserved';
}

/** A closed ticket at a posture above the fairness threshold is a gouge. */
export function isGouging(posture: number, config: InstalledBaseConfig): boolean {
  return posture > config.feedback.fairPostureThreshold;
}

/**
 * Map a service outcome to its loyalty/CSI/Reputation effect. A job served well
 * at a fair price raises loyalty + CSI; a miss (under-stock), an unserved job
 * (capacity starvation / long wait), or a gouged close (premium posture) drop
 * both and feed a negative Reputation signal.
 */
export function resolveServiceOutcome(input: {
  kind: ServiceOutcomeKind;
  posture: number;
  config: InstalledBaseConfig;
}): ServiceOutcomeEffect {
  const fb = input.config.feedback;
  switch (input.kind) {
    case 'closed':
      if (isGouging(input.posture, input.config)) {
        return {
          loyaltyDelta: -fb.gougeLoyaltyPenalty,
          csiDelta: -fb.gougeCsiPenalty,
          isBadVisit: true,
          reputationHit: fb.reputationGougeHit,
          reason: 'gouged',
        };
      }
      return {
        loyaltyDelta: fb.goodLoyaltyBonus,
        csiDelta: fb.goodCsiBonus,
        isBadVisit: false,
        reputationHit: 0,
        reason: 'served_fair',
      };
    case 'missed':
      return {
        loyaltyDelta: -fb.missLoyaltyPenalty,
        csiDelta: -fb.missCsiPenalty,
        isBadVisit: true,
        reputationHit: fb.reputationMissHit,
        reason: 'missed',
      };
    case 'unserved':
      return {
        loyaltyDelta: -fb.unservedLoyaltyPenalty,
        csiDelta: -fb.unservedCsiPenalty,
        isBadVisit: true,
        reputationHit: fb.reputationUnservedHit,
        reason: 'unserved',
      };
  }
}

/**
 * Whether an owner has permanently defected — sustained bad experiences OR
 * sustained non-returns. Once true the owner is removed from the base for good.
 */
export function shouldDefect(
  owner: { consecutiveBadVisits: number; consecutiveNoReturns: number },
  config: InstalledBaseConfig,
): boolean {
  return (
    owner.consecutiveBadVisits >= config.defection.badVisitsToDefect ||
    owner.consecutiveNoReturns >= config.defection.noReturnsToDefect
  );
}

/**
 * Whether an aged-out, still-loyal owner should emit a warm repeat-buyer lead.
 * Fires once per ownership (the caller marks `repeatLeadEmitted`).
 */
export function isRepeatBuyerDue(
  owner: { loyalty: number; repeatLeadEmitted: boolean },
  ageDays: number,
  config: InstalledBaseConfig,
): boolean {
  return (
    !owner.repeatLeadEmitted &&
    ageDays >= config.repeatBuyer.ageOutDays &&
    owner.loyalty >= config.repeatBuyer.minLoyalty
  );
}
