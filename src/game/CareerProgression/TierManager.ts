import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { Reputation } from '../Reputation';
import { loadTierConfig, type TierConfig } from './tierData';

export interface TierManagerState {
  currentTier: number;
  businessName: string;
  accentColor: string;
  fontId: string;
  customersServed: number;
}

export interface TierManagerDeps {
  bus: EventBus;
  economy: Economy;
  reputation: Reputation;
  config?: TierConfig;
}

export interface TierManager {
  readonly currentTier: number;
  readonly businessName: string;
  readonly accentColor: string;
  readonly fontId: string;
  readonly customersServed: number;
  applyTierUp(opts: { businessName: string; accentColor: string; fontId: string }): void;
  getSerializableState(): TierManagerState;
  restoreState(state: TierManagerState): void;
}

export function createTierManager(deps: TierManagerDeps): TierManager {
  const { bus, economy, reputation } = deps;
  const config = deps.config ?? loadTierConfig();

  let currentTier = 1;
  let businessName = '';
  let accentColor = config.accentOptions[0].color;
  let fontId = config.fontOptions[0].id;
  let customersServed = 0;

  bus.subscribe('customer:resolved', () => {
    customersServed += 1;
  });

  bus.subscribe('clock:overnight_payroll', ({ day }) => {
    if (day % config.checkIntervalDays !== 0) return;

    // tiers array is 1-indexed by tier number; next tier is at index currentTier
    const nextTierEntry = config.tiers[currentTier];
    if (!nextTierEntry?.triggerThreshold) return;

    const { minCashOnHand, minCustomersServed, minReputationScore } =
      nextTierEntry.triggerThreshold;

    if (
      economy.cash >= minCashOnHand &&
      customersServed >= minCustomersServed &&
      reputation.reviewScore >= minReputationScore
    ) {
      const fromTier = currentTier;
      currentTier += 1;
      bus.publish('career:tier_up', { fromTier, toTier: currentTier, day });
    }
  });

  return {
    get currentTier() { return currentTier; },
    get businessName() { return businessName; },
    get accentColor() { return accentColor; },
    get fontId() { return fontId; },
    get customersServed() { return customersServed; },

    applyTierUp({ businessName: name, accentColor: color, fontId: font }) {
      businessName = name;
      accentColor = color;
      fontId = font;
    },

    getSerializableState() {
      return { currentTier, businessName, accentColor, fontId, customersServed };
    },

    restoreState(state) {
      currentTier = state.currentTier;
      businessName = state.businessName;
      accentColor = state.accentColor;
      fontId = state.fontId;
      customersServed = state.customersServed;
    },
  };
}
