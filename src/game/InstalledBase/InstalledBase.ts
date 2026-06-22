import type { EventBus } from '../EventBus';
import { createRng, deriveSeed } from '../NPC/Rng';
import type { InstalledBaseConfig } from './installedBaseConfig';
import {
  cadenceForPowertrain,
  isServiceDue,
  returnProbability,
  selectJobCategory,
} from './returnCadence';
import {
  isRepeatBuyerDue,
  resolveServiceOutcome,
  shouldDefect,
  type ServiceOutcomeKind,
} from './serviceFeedback';
import type {
  InstalledBase,
  InstalledBaseSnapshot,
  OwnerRecord,
  OwnerPowertrain,
  RepeatBuyerLead,
  ReturningOwner,
} from './types';

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * InstalledBase (#298/#300/#306, parent #297) — a living per-owner registry, the
 * foundation of the Service annuity. Accrues exactly one owner record per sale.
 *
 * **The join (#298).** A sale fans out three signals, all synchronously within
 * one `DealEngine.closeDeal`:
 *  1. `inventory:vehicle_sold` — the full vehicle snapshot (category/powertrain/
 *     sale day), keyed by `vehicleId`.
 *  2. `deal:closed` — `customerId` ↔ `vehicleId` (the join key).
 *  3. `customer:resolved` (`outcome:'closed'`) — `retentionSeed`, the
 *     satisfaction-at-sale loyalty seed, keyed by `customerId`. It is published
 *     from *inside* CustomerPool's `deal:closed` handler, so the relative order
 *     of this module's own handlers vs. CustomerPool's is not guaranteed.
 *
 * To stay order-independent we stash each signal in a pending buffer and attempt
 * to finalize from both the `deal:closed` and `customer:resolved` handlers —
 * whichever completes the trio last creates the record. Vehicle attributes are
 * taken straight from the sold-vehicle snapshot (never re-derived). The pending
 * buffers are transient join state (always empty at rest between closes) and are
 * deliberately NOT persisted.
 *
 * **Return cadence (#300).** On each `clock:day_started` every owner that is
 * service-due (a powertrain-varying interval measured from sale day) runs a
 * seeded return roll — `P = clamp01(loyalty × reputation × convenience −
 * priceSensitivity)`. Returners are stamped with the job category the car's age
 * makes them due for and published as the day's `installedBase:returns_ready`
 * stream. `reputation` is read live via an injected getter; each roll is seeded
 * off `masterSeed + day + ownerId` so the stream replays identically (#122).
 *
 * **Feedback loop (#306).** The module now consumes the enriched service outcome
 * events and closes the annuity loop:
 *  - `service:ticket_closed` — a served job. At a fair price it raises the
 *    owner's loyalty + CSI; at a premium ("gouging") posture it drops both and
 *    dings Reputation. (Rushed jobs also emit `ticket_closed`, so they count as
 *    served — we deliberately do not double-count `service:job_rushed`.)
 *  - `service:job_missed` (under-stock) / `service:job_unserved` (capacity /
 *    long wait) — drop loyalty + CSI and feed a negative Reputation signal.
 *  - Sustained bad experiences OR sustained non-returns permanently defect an
 *    owner (removed from the base, `installedBase:owner_defected`).
 *  - Aged-out, still-loyal owners emit warm repeat-buyer leads
 *    (`installedBase:repeat_buyer_ready`) the composition root spawns back into
 *    Sales.
 *
 * Reputation is decoupled — the module publishes the generic
 * `reputation:satisfaction_hit` channel rather than calling Reputation directly.
 */
export function createInstalledBase(deps: {
  bus: EventBus;
  config: InstalledBaseConfig;
  /** Seeds the per-owner return roll; defaults to 0 for legacy/test callers. */
  masterSeed?: number;
  /** Live [0,1] reputation read for the return roll; defaults to neutral 1. */
  reputation?: () => number;
  /** Live [0,1] service pricing-posture read for the gouging gate (#306);
   *  defaults to neutral 0.5 (fair). */
  getPricingPosture?: () => number;
}): InstalledBase {
  const { bus, config } = deps;
  const masterSeed = deps.masterSeed ?? 0;
  const readReputation = deps.reputation ?? (() => 1);
  const readPosture = deps.getPricingPosture ?? (() => 0.5);

  const owners = new Map<string, OwnerRecord>();

  // Pending join buffers — transient, never snapshotted.
  const pendingVehicle = new Map<
    string,
    { category: string; powertrain: OwnerPowertrain; saleDay: number }
  >();
  const pendingDeal = new Map<string, { vehicleId: string }>();
  const pendingSeed = new Map<string, number>();

  // #306 transient per-day map: serviceItemId → ownerId, rebuilt each
  // `service:intake_ready`. `service:ticket_closed` carries only the
  // serviceItemId, so this is how a served job is attributed to its owner.
  // Conquest tickets (no matching owner) are simply absent.
  const itemOwner = new Map<string, string>();

  function finalize(customerId: string): void {
    const deal = pendingDeal.get(customerId);
    if (!deal) return;
    const seed = pendingSeed.get(customerId);
    if (seed === undefined) return;
    const vehicle = pendingVehicle.get(deal.vehicleId);
    if (!vehicle) return;

    const ownerId = `${customerId}::${deal.vehicleId}`;
    const loyalty = clamp01(seed * config.loyaltySeedScale);
    owners.set(ownerId, {
      ownerId,
      customerId,
      vehicleId: deal.vehicleId,
      category: vehicle.category,
      powertrain: vehicle.powertrain,
      saleDay: vehicle.saleDay,
      loyalty,
      // CSI starts at the same satisfaction-at-sale seed as loyalty (#306).
      csi: loyalty,
      consecutiveBadVisits: 0,
      consecutiveNoReturns: 0,
      repeatLeadEmitted: false,
    });

    // Clear the consumed join state.
    pendingDeal.delete(customerId);
    pendingSeed.delete(customerId);
    pendingVehicle.delete(deal.vehicleId);
  }

  bus.subscribe('inventory:vehicle_sold', ({ vehicleId, category, day, powertrain }) => {
    pendingVehicle.set(vehicleId, { category, powertrain, saleDay: day });
  });

  bus.subscribe('deal:closed', ({ customerId, vehicleId }) => {
    pendingDeal.set(customerId, { vehicleId });
    finalize(customerId);
  });

  bus.subscribe('customer:resolved', ({ customerId, outcome, retentionSeed }) => {
    // Only closed deals enter the base; a walk has no vehicle to register.
    if (outcome !== 'closed') return;
    pendingSeed.set(customerId, retentionSeed);
    finalize(customerId);
  });

  /** Remove an owner permanently and announce the defection. */
  function defect(owner: OwnerRecord, day: number, reason: string): void {
    owners.delete(owner.ownerId);
    bus.publish('installedBase:owner_defected', {
      day,
      ownerId: owner.ownerId,
      customerId: owner.customerId,
      reason,
    });
  }

  /**
   * Apply a resolved service outcome to an owner: move loyalty + CSI, update the
   * bad-visit counter, ding Reputation, and defect on sustained neglect.
   */
  function applyOutcome(ownerId: string, kind: ServiceOutcomeKind, day: number): void {
    const owner = owners.get(ownerId);
    if (!owner) return;
    const effect = resolveServiceOutcome({ kind, posture: readPosture(), config });
    const updated: OwnerRecord = {
      ...owner,
      loyalty: clamp01(owner.loyalty + effect.loyaltyDelta),
      csi: clamp01(owner.csi + effect.csiDelta),
      consecutiveBadVisits: effect.isBadVisit ? owner.consecutiveBadVisits + 1 : 0,
    };
    owners.set(ownerId, updated);
    if (effect.reputationHit !== 0) {
      bus.publish('reputation:satisfaction_hit', {
        day,
        amount: effect.reputationHit,
        reason: `service_${effect.reason}`,
      });
    }
    if (shouldDefect(updated, config)) defect(updated, day, effect.reason);
  }

  bus.subscribe('service:intake_ready', ({ items }) => {
    itemOwner.clear();
    for (const item of items) {
      const ownerId = `${item.customerId}::${item.vehicleId}`;
      if (owners.has(ownerId)) itemOwner.set(item.serviceItemId, ownerId);
    }
  });

  bus.subscribe('service:ticket_closed', ({ serviceItemId, day }) => {
    const ownerId = itemOwner.get(serviceItemId);
    if (ownerId) applyOutcome(ownerId, 'closed', day);
  });

  bus.subscribe('service:job_missed', ({ customerId, vehicleId, day }) => {
    applyOutcome(`${customerId}::${vehicleId}`, 'missed', day);
  });

  bus.subscribe('service:job_unserved', ({ customerId, vehicleId, day }) => {
    applyOutcome(`${customerId}::${vehicleId}`, 'unserved', day);
  });

  // Return cadence (#300) + repeat-buyer age-out + non-return defection (#306):
  // a single morning sweep over the base. The per-owner return roll is keyed on
  // (day, ownerId) so it is order-independent and replays identically (#122).
  bus.subscribe('clock:day_started', ({ day }) => {
    const reputation = readReputation();
    const returns: ReturningOwner[] = [];
    const leads: RepeatBuyerLead[] = [];

    // Snapshot first: owners may be removed (defection) within the loop.
    for (const original of [...owners.values()]) {
      let owner = original;
      const ageDays = day - owner.saleDay;

      // Aged-out loyal owner → a warm repeat-buyer lead (once per ownership).
      if (isRepeatBuyerDue(owner, ageDays, config)) {
        leads.push({
          ownerId: owner.ownerId,
          customerId: owner.customerId,
          vehicleId: owner.vehicleId,
          category: owner.category,
          loyalty: owner.loyalty,
        });
        owner = { ...owner, repeatLeadEmitted: true };
      }

      // Return roll on a service-due day.
      const cadence = cadenceForPowertrain(owner.powertrain, config);
      if (isServiceDue(ageDays, cadence)) {
        const p = returnProbability({
          loyalty: owner.loyalty,
          reputation,
          convenience: config.returnRoll.convenience,
          priceSensitivity: config.returnRoll.priceSensitivity,
        });
        const rng = createRng(
          deriveSeed(masterSeed, 'installed_base.return', {
            day,
            ownerId: owner.ownerId,
          }),
        );
        if (rng() < p) {
          returns.push({
            ownerId: owner.ownerId,
            customerId: owner.customerId,
            vehicleId: owner.vehicleId,
            category: owner.category,
            powertrain: owner.powertrain,
            jobCategory: selectJobCategory(ageDays, config),
            ageDays,
          });
          owner = { ...owner, consecutiveNoReturns: 0 };
        } else {
          owner = { ...owner, consecutiveNoReturns: owner.consecutiveNoReturns + 1 };
        }
      }

      if (owner !== original) owners.set(owner.ownerId, owner);
      if (shouldDefect(owner, config)) defect(owner, day, 'sustained_non_return');
    }

    bus.publish('installedBase:returns_ready', { day, returns });
    bus.publish('installedBase:repeat_buyer_ready', { day, leads });
  });

  return {
    getOwners() {
      return [...owners.values()];
    },
    getOwner(ownerId) {
      return owners.get(ownerId);
    },
    get size() {
      return owners.size;
    },

    snapshot(): InstalledBaseSnapshot {
      return {
        schemaVersion: 2,
        owners: [...owners.values()],
      };
    },

    restore(snap) {
      owners.clear();
      if (snap.schemaVersion === 1) {
        // Migrate pre-#306 records forward with neutral feedback defaults.
        for (const o of snap.owners) {
          owners.set(o.ownerId, {
            ...o,
            csi: o.loyalty,
            consecutiveBadVisits: 0,
            consecutiveNoReturns: 0,
            repeatLeadEmitted: false,
          });
        }
      } else {
        for (const o of snap.owners) {
          owners.set(o.ownerId, { ...o });
        }
      }
      // Pending join buffers + the per-day item map are transient.
      pendingVehicle.clear();
      pendingDeal.clear();
      pendingSeed.clear();
      itemOwner.clear();
    },
  };
}
