import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { TierManager } from '../CareerProgression';
import { loadRegulatoryTunables, type RegulatoryTunables } from './regulatoryData';

export interface RegulatoryMeterState {
  pressure: number;
  isTerminal: boolean;
  suspensionDaysRemaining: number;
  /**
   * Audit-failure latch (#327). True while pressure sits in the audit band, so
   * one crossing fires one `regulatory:audit_failure`. Optional for backward
   * compatibility with pre-#327 saves (defaults to false on restore).
   */
  auditFailed?: boolean;
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
  // Latched so one crossing into the audit band = one audit failure (#327).
  let auditFailed = false;

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

    // Compliance-audit-failure check (#327, IndictmentMonitor producer).
    // Sustained pressure sitting in the audit band `[auditThreshold,
    // pressureThreshold)` fails a regulator audit — the escalating warning
    // *below* the AG-complaint outcome. Latched so one crossing fires once;
    // resets when pressure falls back below the band floor. Pressure that jumps
    // straight to/over `pressureThreshold` skips the audit (the AG complaint
    // below is the bigger event), keeping the two signals distinct.
    const inAuditBand =
      pressure >= config.auditThreshold && pressure < config.pressureThreshold;
    if (inAuditBand) {
      if (!auditFailed) {
        auditFailed = true;
        bus.publish('regulatory:audit_failure', { day });
      }
    } else if (pressure < config.auditThreshold) {
      auditFailed = false;
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
      return { pressure, isTerminal, suspensionDaysRemaining, auditFailed };
    },

    restoreState(state) {
      pressure = state.pressure;
      isTerminal = state.isTerminal;
      suspensionDaysRemaining = state.suspensionDaysRemaining;
      auditFailed = state.auditFailed ?? false;
    },
  };
}
