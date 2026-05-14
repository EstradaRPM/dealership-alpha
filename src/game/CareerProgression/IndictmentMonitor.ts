import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import { loadIndictmentTunables, type IndictmentTunables } from './failureData';
import type { TierManager } from './TierManager';

export interface IndictmentMonitorState {
  pressure: number;
  isTerminal: boolean;
}

export interface IndictmentMonitorDeps {
  bus: EventBus;
  economy: Economy;
  tierManager: TierManager;
  config?: IndictmentTunables;
}

export interface IndictmentMonitor {
  readonly pressure: number;
  readonly isTerminal: boolean;
  getSerializableState(): IndictmentMonitorState;
  restoreState(state: IndictmentMonitorState): void;
}

/**
 * Accumulates severe-event signals (lemon-law incidents, audit failures,
 * deal fraud flags) and routes an indictment to the tier-appropriate outcome
 * when accumulated pressure crosses the threshold (issue #32):
 *   Tier 1   → terminal game-over (prison-sentence end-card flavor)
 *   Tier 2   → personal liability isolation: cash stake penalty + contraction
 *   Tier 3+  → legal-defense investment + reputation crater; tier preserved
 *
 * Unlike regulatory pressure, indictment pressure does not decay — severe
 * legal signals are permanent unless the player avoids them entirely.
 */
export function createIndictmentMonitor(deps: IndictmentMonitorDeps): IndictmentMonitor {
  const { bus, economy, tierManager } = deps;
  const config = deps.config ?? loadIndictmentTunables();

  let pressure = 0;
  let isTerminal = false;

  function clampPressure(v: number): number {
    return Math.max(0, Math.min(config.pressureMax, v));
  }

  function addPressure(amount: number, day: number): void {
    if (isTerminal) return;
    pressure = clampPressure(pressure + amount);
    if (pressure >= config.pressureThreshold) {
      triggerIndictment(day);
    }
  }

  function triggerIndictment(day: number): void {
    if (isTerminal) return;
    const tier = tierManager.currentTier;
    const triggeredAt = pressure;

    if (tier === 1) {
      isTerminal = true;
      bus.publish('career:indictment_terminal', { day, tier: 1, pressure: triggeredAt });
      return;
    }

    if (tier === 2) {
      const fromTier = tier;
      economy.forceDebit(config.tier2.stakePenalty, 'Personal Liability Settlement');
      tierManager.applyContraction(1);
      pressure = 0;
      bus.publish('career:indictment_contraction', {
        day,
        fromTier,
        stakePenalty: config.tier2.stakePenalty,
      });
      return;
    }

    // Tier 3+: legal defense investment, tier preserved.
    economy.forceDebit(config.tier3Plus.legalDefenseCost, 'Legal Defense');
    bus.publish('reputation:satisfaction_hit', {
      day,
      amount: config.tier3Plus.reputationHit,
      reason: 'Indictment legal proceedings',
    });
    bus.publish('career:indictment_legal_defense', {
      day,
      tier,
      cashCost: config.tier3Plus.legalDefenseCost,
      reputationHit: config.tier3Plus.reputationHit,
    });
    pressure = 0;
  }

  bus.subscribe('regulatory:lemon_law_incident', ({ day }) => {
    addPressure(config.lemonLawPressure, day);
  });

  bus.subscribe('regulatory:audit_failure', ({ day }) => {
    addPressure(config.auditFailurePressure, day);
  });

  bus.subscribe('deal:fraud_flag', ({ day }) => {
    addPressure(config.fraudFlagPressure, day);
  });

  return {
    get pressure() { return pressure; },
    get isTerminal() { return isTerminal; },

    getSerializableState() {
      return { pressure, isTerminal };
    },

    restoreState(state) {
      pressure = state.pressure;
      isTerminal = state.isTerminal;
    },
  };
}
