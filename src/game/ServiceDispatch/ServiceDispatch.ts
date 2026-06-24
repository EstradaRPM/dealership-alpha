import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { StaffOrg } from '../StaffOrg';
import type { DepartmentQueue } from '../DepartmentQueue';
import type { QueueItem, DeptKey } from '../DepartmentQueue';
import type { DeptDrain } from '../FloorSim';
import type { PartsInventory, PartCategory } from '../PartsInventory';
import type { JobCategory } from '../InstalledBase';
import { createRng, deriveSeed } from '../NPC/Rng';
import { loadServiceDispatchConfig, type ServiceDispatchConfig } from './serviceDispatchData';

/** Neutral default for the competitive↔premium pricing dial when no posture
 *  source is wired (isolation tests / pre-#305 callers). 0.5 = midway. */
const NEUTRAL_POSTURE = 0.5;

// ─── The shared department-dispatch engine (#311/#314) ──────────────────────
// This module is the department-agnostic auto-resolution + capacity + read-model
// engine the shared assembly line (docs/planning/shared-department-structure.md)
// reuses for BOTH Service and Body Shop. The engine owns the advisor pick, the
// skill-scaled auto-resolve roll, the parts gate, the min(bays, advisors) capacity
// model, eviction, and the live read-model — none of which is
// department-specific. Everything that DOES differ (advisor role, queue lane, RNG
// namespace, the event family it emits, the per-ticket pricing, the intake feed)
// is supplied by a `DeptDispatchProfile`. Service is the reference profile
// (built below, byte-stable with the pre-#314 behaviour); Body Shop supplies its
// own profile in `src/bodyShopDepartment.ts`. Per the locked event-name decision
// (#312) the two emit PARALLEL event families (`service:*` / `bodyshop:*`) bound
// to this same engine, not a collapsed `dept:*` family.

/** A pending dept intake item carrying the data resolution needs. Generic across
 *  Service and Body Shop; `jobCategory` widens to the full `PartCategory` union
 *  (Service activates 4, Body Shop its other 4) and `source` is the Body-Shop
 *  channel (insurance vs retail) the channel-posture pricing reads — undefined
 *  for Service. */
export interface DeptIntakeItem {
  itemId: string;
  label: string;
  baseRevenue: number;
  jobCategory: PartCategory;
  customerId: string;
  vehicleId: string;
  /** Body-Shop demand channel — `insurance` (DRP, rate-capped) vs `retail`
   *  (player-priced). Undefined for Service (uniform pricing dial). */
  source?: string;
}

/** The capacity/auto/CSI knobs the engine reads. `ServiceDispatchConfig` and the
 *  Body-Shop dispatch config both satisfy this structurally. Pricing knobs live
 *  in each department's profile, not here. */
export interface DeptCapacityConfig {
  minAutoResolveRate: number;
  maxAutoResolveRate: number;
  minPerSlotThroughput: number;
  maxPerSlotThroughput: number;
  baysByTier: Record<string, number>;
  maxWaitTicks: number;
  unservedCsiHit: number;
  missCsiHit: number;
}

/**
 * Everything department-specific the shared engine needs. The engine asks a
 * department only: who resolves (advisorRole), which lane (queueDept), how to
 * seed its RNG (rngKey/rngSeedInput, kept stable per department so a fixed seed
 * replays byte-identically), what a ticket is worth (priceTicket — Service's
 * uniform dial vs Body Shop's per-channel rate-capped/player-priced split), how
 * to label its revenue posting, which event family to emit, and how its intake
 * arrives (subscribeIntake + fromQueuedItem). The engine owns all the rest.
 */
export interface DeptDispatchProfile {
  /** StaffOrg `role_id` that resolves this department's tickets. */
  advisorRole: string;
  /** DepartmentQueue lane this department's items live in. */
  queueDept: DeptKey;
  /** NPC/Rng namespace for the per-ticket auto-resolve roll. */
  rngKey: string;
  /** Per-department RNG seed context (key NAME is load-bearing for byte-stability). */
  rngSeedInput(itemId: string, day: number): Record<string, string | number>;
  /** Final integer revenue for a ticket (Service: uniform competitive↔premium
   *  dial; Body Shop: insurance rate-capped vs retail player-priced). Used for
   *  both the closed-ticket posting and the unserved/eviction lost-revenue. */
  priceTicket(item: DeptIntakeItem): number;
  /** Economy ledger label for a posted ticket. */
  revenueLabel(item: DeptIntakeItem, rush: boolean): string;
  /** Subscribe the engine's enqueue to this department's intake event. */
  subscribeIntake(
    bus: EventBus,
    enqueue: (item: DeptIntakeItem, day: number) => void,
  ): void;
  /** Map an already-queued (restored / pre-drain) item back to an intake item,
   *  or null if it isn't this department's. */
  fromQueuedItem(item: QueueItem): { item: DeptIntakeItem; day: number } | null;
  /** The event family this department emits, abstracting the differing event
   *  names + id field (`serviceItemId` vs `bodyShopItemId`). */
  emit: DeptDispatchEmit;
}

export interface DeptDispatchEmit {
  ticketClosed(p: { itemId: string; day: number; revenue: number; advisorId: string }): void;
  partsConsumed(p: { itemId: string; day: number; jobCategory: PartCategory; advisorId: string }): void;
  jobMissed(p: {
    itemId: string;
    day: number;
    customerId: string;
    vehicleId: string;
    jobCategory: PartCategory;
    lostRevenue: number;
    csiHit: number;
    advisorId: string;
  }): void;
  jobRushed(p: {
    itemId: string;
    day: number;
    customerId: string;
    vehicleId: string;
    jobCategory: PartCategory;
    revenue: number;
    advisorId: string;
  }): void;
  jobUnserved(p: {
    itemId: string;
    day: number;
    customerId: string;
    vehicleId: string;
    jobCategory: PartCategory;
    lostRevenue: number;
    csiHit: number;
    waitTicks: number;
  }): void;
}

/** Generic engine deps (the department supplies the profile). */
export interface DeptDispatchDeps {
  bus: EventBus;
  staffOrg: StaffOrg;
  queue: DepartmentQueue;
  economy: Economy;
  masterSeed: number;
  config: DeptCapacityConfig;
  /** #304 parts gate. Optional: when absent a completed job resolves without
   *  consuming a part. When provided, every completed job consumes one
   *  matching-category unit; an under-stock miss routes to rush / lost-revenue. */
  partsInventory?: Pick<PartsInventory, 'consume' | 'rushOrder'>;
  /** #304 whether the rush emergency-order path is unlocked yet (read per-call). */
  isRushUnlocked?: () => boolean;
  /** #305 structural facility-tier bay count input — selects config.baysByTier. */
  facilityTier?: number;
  /** #305 live capacity read-model the per-tick drain writes each tick. */
  readModel?: DeptReadModelWriter;
  profile: DeptDispatchProfile;
}

// ─── Service deps (the reference profile) ───────────────────────────────────
// Kept byte-stable with the pre-#314 surface so every Service test + the Service
// package's call sites compile and replay unchanged. The Service profile is
// derived from these deps inside the Service builders below.
export interface ServiceDispatchDeps {
  bus: EventBus;
  staffOrg: StaffOrg;
  queue: DepartmentQueue;
  economy: Economy;
  masterSeed: number;
  config?: ServiceDispatchConfig;
  partsInventory?: Pick<PartsInventory, 'consume' | 'rushOrder'>;
  isRushUnlocked?: () => boolean;
  /** #305 service pricing posture, [0,1] on the competitive↔premium dial. */
  getPricingPosture?: () => number;
  facilityTier?: number;
  readModel?: ServiceReadModelWriter;
}

// Intentionally empty — dispatch is fully autonomous.
export interface ServiceDispatch {}

/** Back-compat alias: the Service intake item is the generic dept item. */
export type ServiceIntakeItem = DeptIntakeItem;

/**
 * #305 live capacity read-model snapshot for a department's page + floor card.
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

// Generic aliases for departments that aren't Service (the read-model is fully
// department-agnostic — same shape, same writer).
export type DeptLoad = ServiceLoad;
export type DeptReadModel = ServiceReadModel;
export type DeptReadModelWriter = ServiceReadModelWriter;

/**
 * Long-lived holder for a department's live capacity read-model. Created once in
 * the composition root; each per-day drain is handed the same instance and writes
 * the live snapshot into it every tick. Consumers (page / floor card) read
 * `.read()` — they never see the writer side. Mirrors how CapacityManager owns
 * `getDayFunnel()` while a per-day floor gate mutates it.
 */
export function createDeptReadModel(): DeptReadModelWriter {
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

/** Service-named alias (byte-stable for existing callers/tests). */
export const createServiceReadModel = createDeptReadModel;

function lerp(a: number, b: number, t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return a + (b - a) * clamped;
}

/**
 * Builds the per-item auto-resolution closure shared by the legacy
 * once-per-intake path and the per-tick floor drain (#101). Behaviour — advisor
 * pick, skill-scaled auto chance, the profile's pricing, the #304 parts gate,
 * the profile's event family, RNG keying — is identical regardless of caller, so
 * cadence changes never change outcomes. Both paths consume parts in the same
 * FIFO order, so the same jobs get a part and the same jobs miss. Returns true
 * iff the item was handled (closed OR turned away as a miss).
 */
function makeDeptResolver(deps: DeptDispatchDeps) {
  const { bus, staffOrg, queue, economy, masterSeed, partsInventory, isRushUnlocked, profile } = deps;

  return function resolveItem(item: DeptIntakeItem, day: number): boolean {
    const advisors = staffOrg.currentRoster.filter(
      s => s.role_id === profile.advisorRole,
    );
    if (advisors.length === 0) return false;

    // Pick highest-effectiveness advisor.
    const advisor = advisors.reduce((best, s) =>
      s.effectiveness > best.effectiveness ? s : best,
    );

    const autoChance = lerp(
      deps.config.minAutoResolveRate,
      deps.config.maxAutoResolveRate,
      advisor.effectiveness,
    );

    const rng = createRng(
      deriveSeed(masterSeed, profile.rngKey, profile.rngSeedInput(item.itemId, day)),
    );

    if (rng() > autoChance) return false;

    const revenue = profile.priceTicket(item);

    // #304 parts gate. Completing a job consumes one matching-category part.
    // No part on hand → the under-stock path: a rush order (premium, completes)
    // once unlocked, else a miss (lost revenue + CSI hit). Skipped entirely when
    // no PartsInventory is wired (pre-#304 callers / isolation tests).
    if (partsInventory && !partsInventory.consume(item.jobCategory)) {
      queue.resolveItem(item.itemId);
      if (isRushUnlocked?.()) {
        partsInventory.rushOrder(item.jobCategory, 1);
        if (revenue > 0) {
          economy.postRevenue(revenue, profile.revenueLabel(item, true));
        }
        profile.emit.jobRushed({
          itemId: item.itemId,
          day,
          customerId: item.customerId,
          vehicleId: item.vehicleId,
          jobCategory: item.jobCategory,
          revenue,
          advisorId: advisor.id,
        });
        profile.emit.ticketClosed({
          itemId: item.itemId,
          day,
          revenue,
          advisorId: advisor.id,
        });
        return true;
      }
      profile.emit.jobMissed({
        itemId: item.itemId,
        day,
        customerId: item.customerId,
        vehicleId: item.vehicleId,
        jobCategory: item.jobCategory,
        lostRevenue: revenue,
        csiHit: deps.config.missCsiHit,
        advisorId: advisor.id,
      });
      return true;
    }

    queue.resolveItem(item.itemId);

    if (revenue > 0) {
      economy.postRevenue(revenue, profile.revenueLabel(item, false));
    }

    if (partsInventory) {
      profile.emit.partsConsumed({
        itemId: item.itemId,
        day,
        jobCategory: item.jobCategory,
        advisorId: advisor.id,
      });
    }

    profile.emit.ticketClosed({
      itemId: item.itemId,
      day,
      revenue,
      advisorId: advisor.id,
    });
    return true;
  };
}

/**
 * Legacy once-per-intake dispatch (no capacity model). Subscribes to the
 * department's intake event via the profile and resolves immediately. Service
 * uses this when FloorSim isn't driving the drain; Body Shop only uses the drain.
 */
export function createDeptDispatch(deps: DeptDispatchDeps): ServiceDispatch {
  const resolveItem = makeDeptResolver(deps);
  deps.profile.subscribeIntake(deps.bus, (item, day) => {
    resolveItem(item, day);
  });
  return {};
}

/**
 * Per-tick floor drain (#101) — the locked #99 `drain` seam, FloorSim's per-tick
 * counterpart to the legacy once-per-intake path. A per-day instance; the
 * composition root wires one (or the legacy path, never both) per FloorSim day.
 * It captures intake payloads (and sweeps any already-queued items, which carry
 * `baseRevenue` + job/parts category since #303/#304) without resolving them,
 * then each tick resolves up to a capacity-bounded number via the **same
 * resolver** as the legacy path — identical per-job outcomes, only the cadence +
 * capacity gate differ. Neither department has an exception channel, so
 * `escalated` is always 0.
 *
 * #305 capacity model: concurrent work is bounded by `slots = min(bays, advisors
 * on duty)` — bays scale with facility tier (coarse), advisors with hiring.
 * Per-tick throughput is the sum over the `slots` busiest advisors of each one's
 * effectiveness-scaled per-slot rate, so sharper advisors clear more AND
 * bays/staff must scale in concert. Jobs that back up past `config.maxWaitTicks`
 * leave UNSERVED (capacity starvation, distinct from the #304 parts miss). The
 * live read-model is written every tick when a `readModel` is wired.
 */
export function createDeptFloorDrain(deps: DeptDispatchDeps): DeptDrain {
  const { bus, staffOrg, readModel, profile } = deps;
  const config = deps.config;
  const facilityTier = deps.facilityTier ?? 1;
  const bays =
    config.baysByTier[String(facilityTier)] ?? config.baysByTier['1'] ?? 0;
  const resolveItem = makeDeptResolver(deps);

  const pending: Array<{ item: DeptIntakeItem; day: number; arrivalTick: number }> = [];
  const seen = new Set<string>();
  // The most recent tick observed — stamped onto items enqueued between ticks
  // (intake_ready fires outside drain()). Items enqueued before the first tick
  // get tick 0, so their wait is measured from the day's open.
  let currentTick = 0;

  readModel?._resetDay();

  function enqueue(item: DeptIntakeItem, day: number): void {
    if (seen.has(item.itemId)) return;
    seen.add(item.itemId);
    pending.push({ item, day, arrivalTick: currentTick });
  }

  function captureQueuedItems(): void {
    for (const item of deps.queue.getQueue(profile.queueDept)) {
      const mapped = profile.fromQueuedItem(item);
      if (mapped) enqueue(mapped.item, mapped.day);
    }
  }

  profile.subscribeIntake(bus, enqueue);

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
      deps.queue.resolveItem(p.item.itemId);
      const lostRevenue = profile.priceTicket(p.item);
      profile.emit.jobUnserved({
        itemId: p.item.itemId,
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
      captureQueuedItems();
      evictExpired(ctx.tick);

      const advisorEffs = staffOrg.currentRoster
        .filter(s => s.role_id === profile.advisorRole)
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
        const next = pending.shift() as { item: DeptIntakeItem; day: number; arrivalTick: number };
        budget -= 1;
        if (resolveItem(next.item, next.day)) resolved += 1;
      }

      publishLoad(ctx.tick, slots, inProgress);
      return { resolved, escalated: 0 };
    },
  };
}

// ─── Service reference profile + builders (byte-stable) ─────────────────────

/** Builds the Service profile from Service deps. Preserves the exact pre-#314
 *  behaviour: `service-advisor` role, `service` lane, `service_dispatch` RNG
 *  namespace keyed on `serviceItemId`, the competitive↔premium pricing dial, and
 *  the `service:*` event family. */
function serviceProfile(
  deps: ServiceDispatchDeps,
  config: ServiceDispatchConfig,
): DeptDispatchProfile {
  const { bus, getPricingPosture } = deps;
  return {
    advisorRole: 'service-advisor',
    queueDept: 'service',
    rngKey: 'service_dispatch',
    rngSeedInput: (itemId, day) => ({ serviceItemId: itemId, day }),
    priceTicket: (item) => {
      const posture = getPricingPosture?.() ?? NEUTRAL_POSTURE;
      return Math.round(
        item.baseRevenue *
          lerp(config.competitivePriceMultiplier, config.premiumPriceMultiplier, posture),
      );
    },
    revenueLabel: (item, rush) =>
      rush ? `Service (rush) — ${item.label}` : `Service — ${item.label}`,
    subscribeIntake: (b, enqueue) => {
      b.subscribe('service:intake_ready', ({ day, items }) => {
        for (const item of items) {
          enqueue(
            {
              itemId: item.serviceItemId,
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
    },
    fromQueuedItem: (item) => {
      if (item.dept !== 'service' || item.type !== 'routine') return null;
      // The enriched intake carries baseRevenue + the job/parts category +
      // customer/vehicle onto the queue item (#303/#304). A legacy pre-#304
      // snapshot lacks jobCategory; fall back to the first category so the gate
      // still consumes deterministically.
      return {
        item: {
          itemId: item.id,
          label: item.label,
          baseRevenue: item.baseRevenue ?? 0,
          jobCategory: (item.jobCategory ?? 'oil_filters') as JobCategory,
          customerId: item.customerId ?? '',
          vehicleId: item.vehicleId ?? '',
        },
        day: item.createdDay,
      };
    },
    emit: {
      ticketClosed: (p) =>
        bus.publish('service:ticket_closed', {
          serviceItemId: p.itemId,
          day: p.day,
          revenue: p.revenue,
          advisorId: p.advisorId,
        }),
      partsConsumed: (p) =>
        bus.publish('service:parts_consumed', {
          serviceItemId: p.itemId,
          day: p.day,
          jobCategory: p.jobCategory as JobCategory,
          advisorId: p.advisorId,
        }),
      jobMissed: (p) =>
        bus.publish('service:job_missed', {
          serviceItemId: p.itemId,
          day: p.day,
          customerId: p.customerId,
          vehicleId: p.vehicleId,
          jobCategory: p.jobCategory as JobCategory,
          lostRevenue: p.lostRevenue,
          csiHit: p.csiHit,
          advisorId: p.advisorId,
        }),
      jobRushed: (p) =>
        bus.publish('service:job_rushed', {
          serviceItemId: p.itemId,
          day: p.day,
          customerId: p.customerId,
          vehicleId: p.vehicleId,
          jobCategory: p.jobCategory as JobCategory,
          revenue: p.revenue,
          advisorId: p.advisorId,
        }),
      jobUnserved: (p) =>
        bus.publish('service:job_unserved', {
          serviceItemId: p.itemId,
          day: p.day,
          customerId: p.customerId,
          vehicleId: p.vehicleId,
          jobCategory: p.jobCategory as JobCategory,
          lostRevenue: p.lostRevenue,
          csiHit: p.csiHit,
          waitTicks: p.waitTicks,
        }),
    },
  };
}

/** Resolve Service deps into generic engine deps + the Service profile. */
function serviceEngineDeps(deps: ServiceDispatchDeps): DeptDispatchDeps {
  const config = deps.config ?? loadServiceDispatchConfig();
  return {
    bus: deps.bus,
    staffOrg: deps.staffOrg,
    queue: deps.queue,
    economy: deps.economy,
    masterSeed: deps.masterSeed,
    config,
    partsInventory: deps.partsInventory,
    isRushUnlocked: deps.isRushUnlocked,
    facilityTier: deps.facilityTier,
    readModel: deps.readModel,
    profile: serviceProfile(deps, config),
  };
}

export function createServiceDispatch(deps: ServiceDispatchDeps): ServiceDispatch {
  return createDeptDispatch(serviceEngineDeps(deps));
}

export function createServiceFloorDrain(deps: ServiceDispatchDeps): DeptDrain {
  return createDeptFloorDrain(serviceEngineDeps(deps));
}
