import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { StaffOrg } from '../StaffOrg';
import type { DepartmentQueue } from '../DepartmentQueue';
import type { QueueItem } from '../DepartmentQueue';
import type { DeptDrain } from '../FloorSim';
import type { PartCategory, PartsInventory } from '../PartsInventory';
import { createRng, deriveSeed } from '../NPC/Rng';
import { loadServiceDispatchConfig, type ServiceDispatchConfig } from './serviceDispatchData';

export interface ServiceDispatchDeps {
  bus: EventBus;
  staffOrg: StaffOrg;
  queue: DepartmentQueue;
  economy: Economy;
  masterSeed: number;
  config?: ServiceDispatchConfig;
  /**
   * #304 parts gate. Optional: when absent, a completed job resolves without
   * consuming a part (pre-#304 callers + isolation tests that don't exercise
   * the gate). When provided, every completed job consumes one matching-category
   * unit; an under-stock miss routes to the rush or lost-revenue path.
   */
  partsInventory?: Pick<PartsInventory, 'consume' | 'rushOrder'>;
  /**
   * #304 whether the rush emergency-order path is unlocked yet (the
   * operation-maturity gate, PRD #297 story 13). Absent / false ⇒ an under-stock
   * job is a flat miss; true ⇒ it rush-orders the part at a premium and
   * completes. Read per-call so a mid-game tier-up flips it live.
   */
  isRushUnlocked?: () => boolean;
}

// Intentionally empty — dispatch is fully autonomous.
export interface ServiceDispatch {}

/** A pending service intake item carrying the data resolution needs. */
interface ServiceIntakeItem {
  serviceItemId: string;
  label: string;
  baseRevenue: number;
  /** #304 the due job/parts category — selects the PartsInventory unit the
   *  parts gate consumes (and rush-orders / reports on a miss). */
  jobCategory: PartCategory;
  /** #304 customer + vehicle identity, carried so a miss/rush names them. */
  customerId: string;
  vehicleId: string;
}

function lerp(a: number, b: number, t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return a + (b - a) * clamped;
}

/**
 * Builds the per-item service auto-resolution closure shared by the legacy
 * once-per-intake path and the per-tick floor drain (#101). Behaviour — advisor
 * pick, skill-scaled auto chance, upsell-scaled revenue, the #304 parts gate,
 * events, RNG keying on (serviceItemId, day) — is identical regardless of
 * caller, so cadence changes never change outcomes. Both paths consume parts in
 * the same FIFO order, so the same jobs get a part and the same jobs miss.
 * Returns true iff the item was handled (closed OR turned away as a miss).
 */
function makeServiceResolver(deps: ServiceDispatchDeps) {
  const { bus, staffOrg, queue, economy, masterSeed, partsInventory, isRushUnlocked } = deps;
  const config = deps.config ?? loadServiceDispatchConfig();

  return function resolveServiceItem(
    item: ServiceIntakeItem,
    day: number,
  ): boolean {
    const advisors = staffOrg.currentRoster.filter(
      s => s.role_id === 'service-advisor',
    );
    if (advisors.length === 0) return false;

    // Pick highest-effectiveness advisor.
    const advisor = advisors.reduce((best, s) =>
      s.effectiveness > best.effectiveness ? s : best,
    );

    const autoChance = lerp(
      config.minAutoResolveRate,
      config.maxAutoResolveRate,
      advisor.effectiveness,
    );
    const upsellNorm = (advisor.skills['upsell'] ?? 0) / 100;

    const rng = createRng(
      deriveSeed(masterSeed, 'service_dispatch', {
        serviceItemId: item.serviceItemId,
        day,
      }),
    );

    if (rng() > autoChance) return false;

    const revenueMultiplier = lerp(
      config.minRevenueMultiplier,
      config.maxRevenueMultiplier,
      upsellNorm,
    );
    const revenue = Math.round(item.baseRevenue * revenueMultiplier);

    // #304 parts gate. Completing a job consumes one matching-category part.
    // No part on hand → the under-stock path: a rush order (premium, completes)
    // once unlocked, else a miss (lost revenue + CSI hit). Skipped entirely when
    // no PartsInventory is wired (pre-#304 callers / isolation tests).
    if (partsInventory && !partsInventory.consume(item.jobCategory)) {
      queue.resolveItem(item.serviceItemId);
      if (isRushUnlocked?.()) {
        partsInventory.rushOrder(item.jobCategory, 1);
        if (revenue > 0) {
          economy.postRevenue(revenue, `Service (rush) — ${item.label}`);
        }
        bus.publish('service:job_rushed', {
          serviceItemId: item.serviceItemId,
          day,
          customerId: item.customerId,
          vehicleId: item.vehicleId,
          jobCategory: item.jobCategory,
          revenue,
          advisorId: advisor.id,
        });
        bus.publish('service:ticket_closed', {
          serviceItemId: item.serviceItemId,
          day,
          revenue,
          advisorId: advisor.id,
        });
        return true;
      }
      bus.publish('service:job_missed', {
        serviceItemId: item.serviceItemId,
        day,
        customerId: item.customerId,
        vehicleId: item.vehicleId,
        jobCategory: item.jobCategory,
        lostRevenue: revenue,
        csiHit: config.missCsiHit,
        advisorId: advisor.id,
      });
      return true;
    }

    queue.resolveItem(item.serviceItemId);

    if (revenue > 0) {
      economy.postRevenue(revenue, `Service — ${item.label}`);
    }

    if (partsInventory) {
      bus.publish('service:parts_consumed', {
        serviceItemId: item.serviceItemId,
        day,
        jobCategory: item.jobCategory,
        advisorId: advisor.id,
      });
    }

    bus.publish('service:ticket_closed', {
      serviceItemId: item.serviceItemId,
      day,
      revenue,
      advisorId: advisor.id,
    });
    return true;
  };
}

export function createServiceDispatch(deps: ServiceDispatchDeps): ServiceDispatch {
  const resolveServiceItem = makeServiceResolver(deps);

  deps.bus.subscribe('service:intake_ready', ({ day, items }) => {
    for (const item of items) {
      resolveServiceItem(
        {
          serviceItemId: item.serviceItemId,
          label: item.label,
          baseRevenue: item.baseRevenue,
          jobCategory: item.jobCategory,
          customerId: item.customerId,
          vehicleId: item.vehicleId,
        },
        day,
      );
    }
  });

  return {};
}

/**
 * Per-tick floor drain (#101) — the locked #99 `drain` seam for the Service
 * department, FloorSim's per-tick counterpart to `createServiceDispatch`'s
 * legacy once-per-intake path. A per-day instance; the composition root wires
 * one (or the legacy path, never both) per FloorSim day. It captures intake
 * payloads (and sweeps any already-queued items, which carry `baseRevenue` since
 * #303) without resolving them, then each tick resolves up to a skill-scaled
 * number via the **same resolver**
 * as the legacy path — identical outcomes, only the cadence differs. Service
 * has no exception channel, so `escalated` is always 0.
 */
export function createServiceFloorDrain(deps: ServiceDispatchDeps): DeptDrain {
  const { bus, staffOrg } = deps;
  const config = deps.config ?? loadServiceDispatchConfig();
  const resolveServiceItem = makeServiceResolver({ ...deps, config });

  const pending: Array<{ item: ServiceIntakeItem; day: number }> = [];
  const seen = new Set<string>();

  function enqueue(item: ServiceIntakeItem, day: number): void {
    if (seen.has(item.serviceItemId)) return;
    seen.add(item.serviceItemId);
    pending.push({ item, day });
  }

  function fromQueuedServiceItem(item: QueueItem): { item: ServiceIntakeItem; day: number } | null {
    if (item.dept !== 'service' || item.type !== 'routine') return null;
    // The enriched intake carries baseRevenue + the job/parts category +
    // customer/vehicle onto the queue item (#303/#304), so a restored
    // (post-load) or pre-drain-bootstrap item resolves at its real revenue and
    // through the parts gate without the retired flat intake table. A legacy
    // pre-#304 snapshot lacks jobCategory; fall back to the first category so
    // the gate still consumes deterministically.
    return {
      item: {
        serviceItemId: item.id,
        label: item.label,
        baseRevenue: item.baseRevenue ?? 0,
        jobCategory: item.jobCategory ?? 'oil_filters',
        customerId: item.customerId ?? '',
        vehicleId: item.vehicleId ?? '',
      },
      day: item.createdDay,
    };
  }

  function captureQueuedServiceItems(): void {
    for (const item of deps.queue.getQueue('service')) {
      const pendingItem = fromQueuedServiceItem(item);
      if (pendingItem) enqueue(pendingItem.item, pendingItem.day);
    }
  }

  bus.subscribe('service:intake_ready', ({ day, items }) => {
    for (const item of items) {
      enqueue({
        serviceItemId: item.serviceItemId,
        label: item.label,
        baseRevenue: item.baseRevenue,
        jobCategory: item.jobCategory,
        customerId: item.customerId,
        vehicleId: item.vehicleId,
      }, day);
    }
  });

  // Fractional per-tick throughput carry-over (deterministic — skill only).
  let acc = 0;

  return {
    drain() {
      let resolved = 0;
      captureQueuedServiceItems();
      if (pending.length === 0) return { resolved, escalated: 0 };

      const advisors = staffOrg.currentRoster.filter(
        s => s.role_id === 'service-advisor',
      );
      if (advisors.length === 0) return { resolved, escalated: 0 };

      const bestEff = advisors.reduce(
        (m, s) => (s.effectiveness > m ? s.effectiveness : m),
        0,
      );
      acc += lerp(config.minDrainPerTick, config.maxDrainPerTick, bestEff);
      let budget = Math.floor(acc);
      acc -= budget;

      while (budget > 0 && pending.length > 0) {
        const next = pending.shift() as { item: ServiceIntakeItem; day: number };
        budget -= 1;
        if (resolveServiceItem(next.item, next.day)) resolved += 1;
      }
      return { resolved, escalated: 0 };
    },
  };
}
