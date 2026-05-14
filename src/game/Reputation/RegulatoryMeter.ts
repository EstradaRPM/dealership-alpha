import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { TierManager } from '../CareerProgression';
import { loadRegulatoryTunables, type RegulatoryTunables } from './regulatoryData';

export interface RegulatoryMeterState {
  pressure: number;
  isTerminal: boolean;
  suspensionDaysRemaining: number;
}

export interface RegulatoryMeterDeps {
  bus: EventBus;
  economy: Economy;
  tierManager: TierManager;
  config?: RegulatoryTunables;
}

export interface RegulatoryMeter {
  readonly pressure: number;
  readonly isTerminal: boolean;
  readonly isSuspended: boolean;
  readonly suspensionDaysRemaining: number;
  getSerializableState(): RegulatoryMeterState;
  restoreState(state: RegulatoryMeterState): void;
}

/**
 * Accumulates regulatory pressure from customer-facing failure signals
 * (walks, missed opportunities, walked-and-never-returned) and routes an
 * AG complaint to the tier-appropriate response when pressure crosses
 * the threshold (issue #31):
 *   Tier 1   → terminal game-over
 *   Tier 2   → license suspension + forced contraction to Tier 1
 *   Tier 3+  → consent decree: cash penalty + reputation hit, tier preserved
 *
 * Pressure decays each overnight so steady-state walks don't snowball.
 */
export function createRegulatoryMeter(deps: RegulatoryMeterDeps): RegulatoryMeter {
  const { bus, economy, tierManager } = deps;
  const config = deps.config ?? loadRegulatoryTunables();

  let pressure = 0;
  let isTerminal = false;
  let suspensionDaysRemaining = 0;

  function clampPressure(v: number): number {
    return Math.max(0, Math.min(config.pressureMax, v));
  }

  function addPressure(amount: number): void {
    if (isTerminal) return;
    pressure = clampPressure(pressure + amount);
  }

  bus.subscribe('customer:resolved', ({ outcome }) => {
    if (outcome === 'walk') addPressure(config.walkPressure);
  });

  bus.subscribe('capacity:missed_opportunity', () => {
    addPressure(config.missedOppPressure);
  });

  // A walked customer whose follow-up heat decayed to zero — never recovered.
  // Treated as the "customer-anger" signal: they walked away mad and stayed mad.
  bus.subscribe('followup:customer_archived', () => {
    addPressure(config.angerPressure);
  });

  bus.subscribe('clock:overnight_payroll', ({ day }) => {
    if (isTerminal) return;

    // Tick suspension window first; lift if we just hit zero.
    if (suspensionDaysRemaining > 0) {
      suspensionDaysRemaining -= 1;
      if (suspensionDaysRemaining === 0) {
        bus.publish('regulatory:suspension_lifted', { day });
      }
    }

    if (pressure < config.pressureThreshold) {
      pressure = Math.max(0, pressure - config.dailyDecay);
      return;
    }

    const tier = tierManager.currentTier;
    const triggeredAt = pressure;

    if (tier === 1) {
      isTerminal = true;
      bus.publish('regulatory:ag_complaint_terminal', {
        day,
        tier: 1,
        pressure: triggeredAt,
      });
      return;
    }

    if (tier === 2) {
      const fromTier = tier;
      tierManager.applyContraction(1);
      suspensionDaysRemaining = config.tier2.suspensionDays;
      pressure = 0;
      bus.publish('regulatory:ag_complaint_contraction', {
        day,
        fromTier,
        suspensionDays: config.tier2.suspensionDays,
      });
      return;
    }

    // Tier 3+: consent decree.
    economy.forceDebit(config.tier3Plus.complianceCost, 'AG Consent Decree');
    bus.publish('reputation:satisfaction_hit', {
      day,
      amount: config.tier3Plus.reputationHit,
      reason: 'AG consent decree',
    });
    bus.publish('regulatory:ag_complaint_consent_decree', {
      day,
      tier,
      cashCost: config.tier3Plus.complianceCost,
      reputationHit: config.tier3Plus.reputationHit,
    });
    pressure = 0;
  });

  return {
    get pressure() { return pressure; },
    get isTerminal() { return isTerminal; },
    get isSuspended() { return suspensionDaysRemaining > 0; },
    get suspensionDaysRemaining() { return suspensionDaysRemaining; },

    getSerializableState() {
      return { pressure, isTerminal, suspensionDaysRemaining };
    },

    restoreState(state) {
      pressure = state.pressure;
      isTerminal = state.isTerminal;
      suspensionDaysRemaining = state.suspensionDaysRemaining;
    },
  };
}
