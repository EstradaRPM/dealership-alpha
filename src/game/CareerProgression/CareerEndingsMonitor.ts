import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import { DAYS_PER_YEAR } from '../GameClock';
import { loadEndingsTunables, type EndingsTunables } from './endingsData';
import type { TierManager } from './TierManager';

export interface PESelloutOffer {
  day: number;
  tier: number;
  amount: number;
}

export interface CareerEndingsMonitorState {
  currentOffer: PESelloutOffer | null;
  lastOfferDay: number;
  isEnded: boolean;
}

export interface CareerEndingsMonitorDeps {
  bus: EventBus;
  economy: Economy;
  tierManager: TierManager;
  config?: EndingsTunables;
}

export interface CareerEndingsMonitor {
  readonly currentOffer: PESelloutOffer | null;
  readonly isEnded: boolean;
  canRetire(day: number): boolean;
  canFamilyHandoff(day: number): boolean;
  retire(day: number): boolean;
  acceptSellout(day: number): boolean;
  declineSellout(day: number): boolean;
  familyHandoff(day: number): boolean;
  getSerializableState(): CareerEndingsMonitorState;
  restoreState(state: CareerEndingsMonitorState): void;
}

function careerYearFromDay(day: number): number {
  return Math.floor((day - 1) / DAYS_PER_YEAR) + 1;
}

/**
 * Tracks successful career ending eligibility (issue #35):
 *   retire        — cash + tenure threshold; player-initiated.
 *   sellout       — Tier 3+ periodic PE offer; declinable cash exit.
 *   family_handoff — tenure threshold (Tier 2+); player-initiated.
 *
 * The monitor exposes eligibility flags + action methods. Each action
 * publishes the matching career:* event which EndCardManager consumes
 * to produce a success end-card. PE offers surface on a fixed cadence
 * via clock:overnight_payroll; a new offer replaces the previous one.
 */
export function createCareerEndingsMonitor(
  deps: CareerEndingsMonitorDeps,
): CareerEndingsMonitor {
  const { bus, economy, tierManager } = deps;
  const config = deps.config ?? loadEndingsTunables();

  let currentOffer: PESelloutOffer | null = null;
  let lastOfferDay = 0;
  let isEnded = false;

  function valuation(): number {
    return (
      config.sellout.baseValuation +
      tierManager.customersServed * config.sellout.valuationPerCustomer
    );
  }

  bus.subscribe('clock:overnight_payroll', ({ day }) => {
    if (isEnded) return;
    if (tierManager.currentTier < config.sellout.minTier) return;
    if (day - lastOfferDay < config.sellout.offerIntervalDays) return;

    const amount = valuation();
    currentOffer = { day, tier: tierManager.currentTier, amount };
    lastOfferDay = day;
    bus.publish('career:pe_offer_made', {
      day,
      tier: tierManager.currentTier,
      offerAmount: amount,
    });
  });

  return {
    get currentOffer() { return currentOffer; },
    get isEnded() { return isEnded; },

    canRetire(day: number): boolean {
      if (isEnded) return false;
      return (
        economy.cash >= config.retire.minCashOnHand &&
        careerYearFromDay(day) >= config.retire.minCareerYears
      );
    },

    canFamilyHandoff(day: number): boolean {
      if (isEnded) return false;
      return (
        tierManager.currentTier >= config.familyHandoff.minTier &&
        careerYearFromDay(day) >= config.familyHandoff.minCareerYears
      );
    },

    retire(day: number): boolean {
      if (isEnded) return false;
      if (!this.canRetire(day)) return false;
      isEnded = true;
      bus.publish('career:retired', {
        day,
        tier: tierManager.currentTier,
        cashOnHand: economy.cash,
        careerYear: careerYearFromDay(day),
      });
      return true;
    },

    acceptSellout(day: number): boolean {
      if (isEnded) return false;
      if (currentOffer === null) return false;
      const offer = currentOffer;
      isEnded = true;
      currentOffer = null;
      economy.postRevenue(offer.amount, 'PE Sellout');
      bus.publish('career:pe_sellout', {
        day,
        tier: offer.tier,
        offerAmount: offer.amount,
      });
      return true;
    },

    declineSellout(_day: number): boolean {
      if (isEnded) return false;
      if (currentOffer === null) return false;
      currentOffer = null;
      return true;
    },

    familyHandoff(day: number): boolean {
      if (isEnded) return false;
      if (!this.canFamilyHandoff(day)) return false;
      isEnded = true;
      bus.publish('career:family_handoff', {
        day,
        tier: tierManager.currentTier,
        careerYear: careerYearFromDay(day),
      });
      return true;
    },

    getSerializableState() {
      return { currentOffer, lastOfferDay, isEnded };
    },

    restoreState(state) {
      currentOffer = state.currentOffer;
      lastOfferDay = state.lastOfferDay;
      isEnded = state.isEnded;
    },
  };
}
