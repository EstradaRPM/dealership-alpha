import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import { DAYS_PER_WEEK } from '../GameClock';
import { loadFailureTunables, type FailureTunables } from './failureData';
import type { TierManager } from './TierManager';

export interface BankruptcyMonitorState {
  insolventDayCount: number;
  outstandingDebt: number;
  isTerminal: boolean;
}

export interface BankruptcyMonitorDeps {
  bus: EventBus;
  economy: Economy;
  tierManager: TierManager;
  config?: FailureTunables;
}

export interface BankruptcyMonitor {
  readonly insolventDayCount: number;
  readonly outstandingDebt: number;
  readonly isTerminal: boolean;
  getSerializableState(): BankruptcyMonitorState;
  restoreState(state: BankruptcyMonitorState): void;
}

/**
 * Watches the overnight payroll tick for sustained insolvency and routes
 * bankruptcy to the tier-appropriate outcome (issue #30):
 *   Tier 1   → terminal (publish `career:bankruptcy_terminal`, end-card flow)
 *   Tier 2   → contraction to Tier 1 + debt obligation (weekly amortization)
 *   Tier 3+  → auto-applied compliance cost + reputation hit; tier preserved
 *
 * Insolvency is "cash < cashFloor for N consecutive overnights"; a single
 * day above the floor resets the counter (recovery wins reset the clock).
 */
export function createBankruptcyMonitor(
  deps: BankruptcyMonitorDeps,
): BankruptcyMonitor {
  const { bus, economy, tierManager } = deps;
  const config = deps.config ?? loadFailureTunables();

  let insolventDayCount = 0;
  let outstandingDebt = 0;
  let isTerminal = false;

  bus.subscribe('clock:overnight_payroll', ({ day }) => {
    if (isTerminal) return;

    // Service any outstanding T2 contraction debt on weekly tick.
    if (outstandingDebt > 0 && day % DAYS_PER_WEEK === 0) {
      const payment = Math.min(config.tier2.weeklyDebtPayment, outstandingDebt);
      economy.forceDebit(payment, 'Bankruptcy Debt Service');
      outstandingDebt -= payment;
      bus.publish('career:debt_payment_made', {
        day,
        amount: payment,
        remainingBalance: outstandingDebt,
      });
    }

    if (economy.cash < config.cashFloor) {
      insolventDayCount += 1;
    } else {
      insolventDayCount = 0;
      return;
    }

    if (insolventDayCount < config.consecutiveDaysToTrigger) return;

    const tier = tierManager.currentTier;
    insolventDayCount = 0;

    if (tier === 1) {
      isTerminal = true;
      bus.publish('career:bankruptcy_terminal', { day, tier: 1 });
      return;
    }

    if (tier === 2) {
      const fromTier = tier;
      tierManager.applyContraction(1);
      outstandingDebt += config.tier2.debtPrincipal;
      bus.publish('career:bankruptcy_contraction', {
        day,
        fromTier,
        debtPrincipal: config.tier2.debtPrincipal,
      });
      return;
    }

    // Tier 3+: auto compliance investment, tier preserved.
    economy.forceDebit(config.tier3Plus.complianceCost, 'Compliance Investment');
    bus.publish('reputation:satisfaction_hit', {
      day,
      amount: config.tier3Plus.reputationHit,
      reason: 'Bankruptcy compliance investment',
    });
    bus.publish('career:bankruptcy_compliance', {
      day,
      tier,
      cashCost: config.tier3Plus.complianceCost,
      reputationHit: config.tier3Plus.reputationHit,
    });
  });

  return {
    get insolventDayCount() { return insolventDayCount; },
    get outstandingDebt() { return outstandingDebt; },
    get isTerminal() { return isTerminal; },

    getSerializableState() {
      return { insolventDayCount, outstandingDebt, isTerminal };
    },

    restoreState(state) {
      insolventDayCount = state.insolventDayCount;
      outstandingDebt = state.outstandingDebt;
      isTerminal = state.isTerminal;
    },
  };
}
