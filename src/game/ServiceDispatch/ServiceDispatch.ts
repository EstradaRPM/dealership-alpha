import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { StaffOrg } from '../StaffOrg';
import type { DepartmentQueue } from '../DepartmentQueue';
import type { QueueItem } from '../DepartmentQueue';
import type { DeptDrain } from '../FloorSim';
import type { PartsInventory } from '../PartsInventory';
import type { JobCategory } from '../InstalledBase';
import { createRng, deriveSeed } from '../NPC/Rng';
import { loadServiceDispatchConfig, type ServiceDispatchConfig } from './serviceDispatchData';

/** Neutral default for the competitive↔premium pricing dial when no posture
 *  source is wired (isolation tests / pre-#305 callers). 0.5 = midway. */
const NEUTRAL_POSTURE = 0.5;

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
  /**
   * #305 service pricing posture, [0,1] on the single competitive↔premium dial
   * (0 = competitive labor + markup, 1 = premium). Read per-resolve so a live
   * dial change applies to the next ticket. Drives per-ticket revenue via
   * config.{competitive,premium}PriceMultiplier. Omitted ⇒ NEUTRAL_POSTURE.
   */
  getPricingPosture?: () => number;
  /**
   * #305 structural facility-tier bay count input — selects the bay ceiling
   * from config.baysByTier. The drain reads it at construction (per-day in the
   * composition root, so a mid-game tier-up applies the next day). Omitted ⇒ 1.
   */
  facilityTier?: number;
  /**
   * #305 live capacity read-model the per-tick drain writes each tick (waiting /
   * in-progress / avg-wait / utilization). Drain path only — the legacy
   * once-per-intake path has no per-tick capacity model. Omitted ⇒ no read-model
   * (isolation tests that don't assert it).
   */
  readModel?: ServiceReadModelWriter;
}

// Intentionally empty — dispatch is fully autonomous.
export interface ServiceDispatch {}

/** A pending service intake item carrying the data resolution needs. */
interface ServiceIntakeItem {
  serviceItemId: string;
  label: string;
  baseRevenue: number;
  /** #304 the due job/parts category — selects the PartsInventory unit the
   *  parts gate consumes (and rush-orders / reports on a miss). The Service-side
   *  union (`JobCategory`, the same type ServiceDemand/`service:intake_ready`
   *  use); it is a subset of the wider 8-category `PartCategory`, so passing it
   *  to `PartsInventory.consume`/`rushOrder` type-checks. */
  jobCategory: JobCategory;
  /** #304 customer + vehicle identity, carried so a miss/rush names them. */
  customerId: string;
  vehicleId: string;
}

/**
 * #305 live capacity read-model snapshot for the Service page + floor card.
 * A pure read derived from the per-tick drain's state, refreshed every tick.
 */
export interface ServiceLoad {
  /** Concurrent capacity this tick: min(bays, advisors on duty). */
  slots: number;
  /** Slots actively working a job this tick (bays occupied). */
  inProgress: number;
  /** Jobs backed up past capacity (queued, not yet worked). */
  waiting: number;
  /** Mean wait (in FloorSim ticks) of the still-waiting jobs. 0 if none. */
  avgWaitTicks: number;
  /** Capacity saturation, [0,1]: inProgress / slots (0 when slots = 0). */
  utilization: number;
}

const EMPTY_LOAD: ServiceLoad = {
  slots: 0,
  inProgress: 0,
  waiting: 0,
  avgWaitTicks: 0,
  utilization: 0,
};

/** Public read surface the composition root exposes (e.g. on the World seam). */
export interface ServiceReadModel {
  read(): ServiceLoad;
}

/** Drain-internal writer side of the read-model (the `_`-prefixed methods are
 *  not part of the consumer-facing {@link ServiceReadModel} surface). */
export interface ServiceReadModelWriter extends ServiceReadModel {
  _apply(load: ServiceLoad): void;
  _resetDay(): void;
}

/**
 * Long-lived holder for the live service capacity read-model. Created once in
 * the composition root; each per-day drain (`createServiceFloorDrain`) is handed
 * the same instance and writes the live snapshot into it every tick. Consumers
 * (Service page / floor card) read `.read()` — they never see the writer side.
 * Mirrors how CapacityManager owns `getDayFunnel()` while a per-day floor gate
 * mutates it.
 */
export function createServiceReadModel(): ServiceReadModelWriter {
  let load: ServiceLoad = { ...EMPTY_LOAD };
  return {
    read: () => load,
    _apply: (next) => {
      load = next;
    },
    _resetDay: () => {
      load = { ...EMPTY_LOAD };
    },
  };
}

function lerp(a: number, b: number, t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return a + (b - a) * clamped;
}

/**
 * Builds the per-item service auto-resolution closure shared by the legacy
 * once-per-intake path and the per-tick floor drain (#101). Behaviour — advisor
 * pick, skill-scaled auto chance, the #305 pricing-posture-scaled revenue, the
 * #304 parts gate, events, RNG keying on (serviceItemId, day) — is identical
 * regardless of caller, so cadence changes never change outcomes. Both paths
 * consume parts in the same FIFO order, so the same jobs get a part and the same
 * jobs miss. Returns true iff the item was handled (closed OR turned away as a
 * miss).
 */
function makeServiceResolver(deps: ServiceDispatchDeps) {
  const { bus, staffOrg, queue, economy, masterSeed, partsInventory, isRushUnlocked, getPricingPosture } = deps;
  const config = deps.config ?? loadServiceDispatchConfig();

  // #305 per-ticket revenue scales by the competitive↔premium pricing dial
  // (labor + markup), read live each resolve. The retired flat-upsell multiplier
  // is gone — advisor skill now governs throughput (the capacity model), not
  // per-ticket price.
  function postureRevenue(baseRevenue: number): number {
    const posture = getPricingPosture?.() ?? NEUTRAL_POSTURE;
    return Math.round(
      baseRevenue *
        lerp(config.competitivePriceMultiplier, config.premiumPriceMultiplier, posture),
    );
  }

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

    const rng = createRng(
      deriveSeed(masterSeed, 'service_dispatch', {
        serviceItemId: item.serviceItemId,
        day,
      }),
    );

    if (rng() > autoChance) return false;

    const revenue = postureRevenue(item.baseRevenue);

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
 * payloads (and sweeps any already-queued items, which carry `baseRevenue` +
 * job/parts category since #303/#304) without resolving them, then each tick
 * resolves up to a capacity-bounded number via the **same resolver** as the
 * legacy path — identical per-job outcomes, only the cadence + capacity gate
 * differ. Service has no exception channel, so `escalated` is always 0.
 *
 * #305 capacity model: concurrent work is bounded by `slots = min(bays,
 * advisors on duty)` — bays scale with facility tier (coarse), advisors with
 * hiring. Per-tick throughput is the sum over the `slots` busiest advisors of
 * each one's effectiveness-scaled per-slot rate, so sharper advisors clear more
 * AND bays/staff must scale in concert. Jobs that back up past
 * `config.maxWaitTicks` leave UNSERVED (capacity starvation — a CSI hit,
 * distinct from the #304 parts miss). The live read-model (waiting / in-progress
 * / avg-wait / utilization) is written every tick when a `readModel` is wired.
 */
export function createServiceFloorDrain(deps: ServiceDispatchDeps): DeptDrain {
  const { bus, staffOrg, readModel } = deps;
  const config = deps.config ?? loadServiceDispatchConfig();
  const facilityTier = deps.facilityTier ?? 1;
  const bays =
    config.baysByTier[String(facilityTier)] ?? config.baysByTier['1'] ?? 0;
  const getPricingPosture = deps.getPricingPosture;
  const resolveServiceItem = makeServiceResolver({ ...deps, config });

  const pending: Array<{ item: ServiceIntakeItem; day: number; arrivalTick: number }> = [];
  const seen = new Set<string>();
  // The most recent tick observed — stamped onto items enqueued between ticks
  // (intake_ready fires outside drain()). Items enqueued before the first tick
  // get tick 0, so their wait is measured from the day's open.
  let currentTick = 0;

  readModel?._resetDay();

  function enqueue(item: ServiceIntakeItem, day: number): void {
    if (seen.has(item.serviceItemId)) return;
    seen.add(item.serviceItemId);
    pending.push({ item, day, arrivalTick: currentTick });
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

  // Concurrency = min(bays, advisors on duty). Per-tick throughput is the sum
  // over the `slots` busiest advisors of each one's effectiveness-scaled per-slot
  // rate, so only `slots` advisors contribute (the min(bays,advisors) bound) and
  // a sharper advisor clears more (PRD #297 stories 22-23).
  function computeSlots(advisorEffs: number[]): number {
    return Math.min(bays, advisorEffs.length);
  }

  function computeThroughput(advisorEffs: number[], slots: number): number {
    return advisorEffs
      .slice()
      .sort((a, b) => b - a)
      .slice(0, slots)
      .reduce(
        (sum, eff) =>
          sum + lerp(config.minPerSlotThroughput, config.maxPerSlotThroughput, eff),
        0,
      );
  }

  // Evict jobs that have waited past maxWaitTicks → terminal UNSERVED (capacity
  // starvation). Runs before service each tick so the oldest backlog drops out
  // rather than being served late. Distinct from the #304 parts miss.
  function evictExpired(tick: number): void {
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i];
      const waitTicks = tick - p.arrivalTick;
      if (waitTicks <= config.maxWaitTicks) continue;
      pending.splice(i, 1);
      deps.queue.resolveItem(p.item.serviceItemId);
      const posture = getPricingPosture?.() ?? NEUTRAL_POSTURE;
      const lostRevenue = Math.round(
        p.item.baseRevenue *
          lerp(config.competitivePriceMultiplier, config.premiumPriceMultiplier, posture),
      );
      bus.publish('service:job_unserved', {
        serviceItemId: p.item.serviceItemId,
        day: p.day,
        customerId: p.item.customerId,
        vehicleId: p.item.vehicleId,
        jobCategory: p.item.jobCategory,
        lostRevenue,
        csiHit: config.unservedCsiHit,
        waitTicks,
      });
    }
  }

  function publishLoad(tick: number, slots: number, inProgress: number): void {
    if (!readModel) return;
    const waiting = pending.length;
    const totalWait = pending.reduce((sum, p) => sum + (tick - p.arrivalTick), 0);
    readModel._apply({
      slots,
      inProgress,
      waiting,
      avgWaitTicks: waiting === 0 ? 0 : totalWait / waiting,
      utilization: slots === 0 ? 0 : inProgress / slots,
    });
  }

  // Fractional per-tick throughput carry-over (deterministic — skill only).
  let acc = 0;

  return {
    drain(ctx: { day: number; tick: number }) {
      let resolved = 0;
      currentTick = ctx.tick;
      captureQueuedServiceItems();
      evictExpired(ctx.tick);

      const advisorEffs = staffOrg.currentRoster
        .filter(s => s.role_id === 'service-advisor')
        .map(s => s.effectiveness);
      const slots = computeSlots(advisorEffs);

      if (pending.length === 0 || slots === 0) {
        publishLoad(ctx.tick, slots, 0);
        return { resolved, escalated: 0 };
      }

      // Bays occupied this tick = slots with a job to work (read-model only).
      const inProgress = Math.min(slots, pending.length);

      acc += computeThroughput(advisorEffs, slots);
      let budget = Math.floor(acc);
      acc -= budget;

      while (budget > 0 && pending.length > 0) {
        const next = pending.shift() as { item: ServiceIntakeItem; day: number; arrivalTick: number };
        budget -= 1;
        if (resolveServiceItem(next.item, next.day)) resolved += 1;
      }

      publishLoad(ctx.tick, slots, inProgress);
      return { resolved, escalated: 0 };
    },
  };
}
