import type { EventBus } from '../EventBus';
import type { InstalledBaseConfig } from './installedBaseConfig';
import type {
  InstalledBase,
  InstalledBaseSnapshot,
  OwnerRecord,
  OwnerPowertrain,
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
 */
export function createInstalledBase(deps: {
  bus: EventBus;
  config: InstalledBaseConfig;
}): InstalledBase {
  const { bus, config } = deps;

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
