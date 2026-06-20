import type { EventBus } from '../EventBus';
import { createRng, deriveSeed } from '../NPC/Rng';
import type { InstalledBaseConfig } from './installedBaseConfig';
import {
  cadenceForPowertrain,
  isServiceDue,
  returnProbability,
  selectJobCategory,
} from './returnCadence';
import type {
  InstalledBase,
  InstalledBaseSnapshot,
  OwnerRecord,
  OwnerPowertrain,
  ReturningOwner,
} from './types';

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * InstalledBase (#298, parent #297) — a living per-owner registry, the
 * foundation of the Service annuity. Accrues exactly one owner record per sale.
 *
 * **The join.** A sale fans out three signals, all synchronously within one
 * `DealEngine.closeDeal`:
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
 * stream for the future ServiceDemand to consume. `reputation` is read live via
 * an injected getter (the composition root binds it to the Reputation module,
 * keeping InstalledBase Reputation-free); each roll is seeded off
 * `masterSeed + day + ownerId` so the stream replays identically (#122). No new
 * persisted state — the stream regenerates deterministically from the registry.
 */
export function createInstalledBase(deps: {
  bus: EventBus;
  config: InstalledBaseConfig;
  /** Seeds the per-owner return roll; defaults to 0 for legacy/test callers. */
  masterSeed?: number;
  /** Live [0,1] reputation read for the return roll; defaults to neutral 1. */
  reputation?: () => number;
}): InstalledBase {
  const { bus, config } = deps;
  const masterSeed = deps.masterSeed ?? 0;
  const readReputation = deps.reputation ?? (() => 1);

  const owners = new Map<string, OwnerRecord>();

  // Pending join buffers — transient, never snapshotted.
  const pendingVehicle = new Map<
    string,
    { category: string; powertrain: OwnerPowertrain; saleDay: number }
  >();
  const pendingDeal = new Map<string, { vehicleId: string }>();
  const pendingSeed = new Map<string, number>();

  function finalize(customerId: string): void {
    const deal = pendingDeal.get(customerId);
    if (!deal) return;
    const seed = pendingSeed.get(customerId);
    if (seed === undefined) return;
    const vehicle = pendingVehicle.get(deal.vehicleId);
    if (!vehicle) return;

    const ownerId = `${customerId}::${deal.vehicleId}`;
    owners.set(ownerId, {
      ownerId,
      customerId,
      vehicleId: deal.vehicleId,
      category: vehicle.category,
      powertrain: vehicle.powertrain,
      saleDay: vehicle.saleDay,
      loyalty: clamp01(seed * config.loyaltySeedScale),
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

  // Return cadence (#300): each morning, roll the day's returning owners and
  // publish the stream for ServiceDemand. Fires every day (possibly empty) so
  // downstream gets a reliable daily signal. The per-owner roll is keyed on
  // (day, ownerId) so it is order-independent and replays identically (#122).
  bus.subscribe('clock:day_started', ({ day }) => {
    const reputation = readReputation();
    const returns: ReturningOwner[] = [];

    for (const owner of owners.values()) {
      const ageDays = day - owner.saleDay;
      const cadence = cadenceForPowertrain(owner.powertrain, config);
      if (!isServiceDue(ageDays, cadence)) continue;

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
      if (rng() >= p) continue;

      returns.push({
        ownerId: owner.ownerId,
        customerId: owner.customerId,
        vehicleId: owner.vehicleId,
        category: owner.category,
        powertrain: owner.powertrain,
        jobCategory: selectJobCategory(ageDays, config),
        ageDays,
      });
    }

    bus.publish('installedBase:returns_ready', { day, returns });
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
        schemaVersion: 1,
        owners: [...owners.values()],
      };
    },

    restore(snap) {
      owners.clear();
      for (const owner of snap.owners) {
        owners.set(owner.ownerId, { ...owner });
      }
      // Pending join buffers are transient; a restore starts them empty.
      pendingVehicle.clear();
      pendingDeal.clear();
      pendingSeed.clear();
    },
  };
}
