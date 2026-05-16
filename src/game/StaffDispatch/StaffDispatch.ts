import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { StaffOrg } from '../StaffOrg';
import type { DepartmentQueue } from '../DepartmentQueue';
import type { StaffMorale } from '../StaffMorale';
import type { DeptDrain } from '../FloorSim';
import { createRng, deriveSeed } from '../NPC/Rng';
import { EXCEPTION_FLAGS } from './types';
import { loadStaffDispatchConfig, type StaffDispatchConfig } from './staffDispatchData';

export interface StaffDispatchDeps {
  bus: EventBus;
  staffOrg: StaffOrg;
  queue: DepartmentQueue;
  economy: Economy;
  masterSeed: number;
  staffMorale?: StaffMorale;
  config?: StaffDispatchConfig;
  getHasGm?: () => boolean;
}

// Intentionally empty — dispatch is fully autonomous.
export interface StaffDispatch {}

/** Outcome of a single auto-resolution attempt against one sales customer. */
type ResolveResult = 'resolved' | 'escalated' | 'declined';

function lerp(a: number, b: number, t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return a + (b - a) * clamped;
}

/**
 * Builds the per-customer sales auto-resolution closure shared by the legacy
 * once-per-admit path and the per-tick floor drain (#101). Resolution
 * behaviour — exception rolls, skill-scaled auto/close chances, gross, events,
 * RNG keying on (customerId, day) — is identical regardless of which path
 * invokes it, so cadence changes never change outcomes.
 */
function makeSalesResolver(deps: StaffDispatchDeps) {
  const { bus, staffOrg, queue, economy, masterSeed, staffMorale } = deps;
  const config = deps.config ?? loadStaffDispatchConfig();
  const getHasGm = deps.getHasGm;

  return function resolveSalesCustomer(
    customerId: string,
    day: number,
  ): ResolveResult {
    const salespeople = staffOrg.currentRoster.filter(
      s => s.role_id === 'salesperson',
    );
    if (salespeople.length === 0) return 'declined';

    const rng = createRng(
      deriveSeed(masterSeed, 'staff_dispatch', { customerId, day }),
    );

    const flagRates = getHasGm?.()
      ? config.gmExceptionFlagRates
      : config.exceptionFlagRates;

    // Pick highest-effectiveness salesperson. Selection draws no RNG, so
    // hoisting it above the exception roll keeps the RNG stream identical to
    // the legacy order — only the skill-scaled threshold changes outcomes.
    const salesperson = salespeople.reduce((best, s) =>
      s.effectiveness > best.effectiveness ? s : best,
    );

    // Forced-exception threshold = f(staff skill × role tier) (#103). Each
    // dramatic-case rate is raised to an exponent lerped by the best
    // salesperson's effectiveness; exponent ≥ 1 ⇒ rate^exp ≤ rate, so a more
    // skilled floor escalates fewer/rarer cases (rate 1.0 stays guaranteed).
    const skillExp = lerp(
      config.exceptionSkillExpMin,
      config.exceptionSkillExpMax,
      salesperson.effectiveness,
    );
    for (const flag of EXCEPTION_FLAGS) {
      const rate = flagRates[flag] ?? 0;
      if (rng() < Math.pow(rate, skillExp)) return 'escalated';
    }

    // Skill-based probability of auto-resolving (vs leaving for player).
    const autoChance = lerp(
      config.minAutoResolveRate,
      config.maxAutoResolveRate,
      salesperson.effectiveness,
    );
    if (rng() > autoChance) return 'declined';

    // Auto-resolve: remove workspace item the queue just added.
    queue.resolveByCustomerId(customerId);

    const moraleMult = staffMorale?.getMoraleMultiplier(salesperson.id) ?? 1.0;

    // Outcome quality scales with effectiveness and morale.
    const closeChance = Math.min(
      1,
      lerp(config.minCloseRate, config.maxCloseRate, salesperson.effectiveness) *
        moraleMult,
    );
    const isClosed = rng() < closeChance;

    if (isClosed) {
      const grossMod = Math.min(
        1,
        lerp(config.minGrossModifier, 1.0, salesperson.effectiveness) *
          moraleMult,
      );
      const gross = Math.round(config.baseAutoGross * grossMod);
      economy.postRevenue(gross, 'Auto-sale — salesperson');
      bus.publish('staff:auto_resolved', {
        customerId,
        staffId: salesperson.id,
        day,
        outcome: 'closed',
        grossImpact: gross,
      });
    } else {
      bus.publish('staff:auto_resolved', {
        customerId,
        staffId: salesperson.id,
        day,
        outcome: 'no_sale',
        grossImpact: 0,
      });
    }
    return 'resolved';
  };
}

export function createStaffDispatch(deps: StaffDispatchDeps): StaffDispatch {
  const resolveSalesCustomer = makeSalesResolver(deps);

  deps.bus.subscribe('capacity:customer_admitted', ({ customerId, day }) => {
    resolveSalesCustomer(customerId, day);
  });

  return {};
}

/**
 * Per-tick floor drain (#101) — the locked #99 `drain` seam for the Sales
 * department, FloorSim's per-tick counterpart to `createStaffDispatch`'s
 * legacy once-per-admit path. A per-day instance; the composition root wires
 * one (or the legacy path, never both) per FloorSim day. Each tick it pulls
 * up to a skill-scaled number of unattempted sales workspace items off the
 * routine queue and resolves them via the shared resolver, so the queue
 * drains across ticks instead of instantly. Resolution outcomes are identical
 * to the legacy path (same resolver, same (customerId, day) RNG keying) — only
 * the cadence differs. `escalated` is surfaced per the locked seam shape; the
 * forced-exception channel itself is wired in #103.
 */
export function createStaffFloorDrain(deps: StaffDispatchDeps): DeptDrain {
  const { staffOrg, queue } = deps;
  const config = deps.config ?? loadStaffDispatchConfig();
  const resolveSalesCustomer = makeSalesResolver({ ...deps, config });

  // Carry-over of the fractional per-tick throughput so sub-1.0 rates still
  // drain (deterministic — no RNG; skill is the only input).
  let acc = 0;
  // Items already attempted (resolved/escalated/declined) so a customer the
  // dispatch left for the player isn't re-attempted every subsequent tick.
  const attempted = new Set<string>();

  return {
    drain({ day }) {
      const salespeople = staffOrg.currentRoster.filter(
        s => s.role_id === 'salesperson',
      );
      let resolved = 0;
      let escalated = 0;
      if (salespeople.length === 0) return { resolved, escalated };

      const bestEff = salespeople.reduce(
        (m, s) => (s.effectiveness > m ? s.effectiveness : m),
        0,
      );
      acc += lerp(config.minDrainPerTick, config.maxDrainPerTick, bestEff);
      let budget = Math.floor(acc);
      acc -= budget;
      if (budget <= 0) return { resolved, escalated };

      // Snapshot first: resolveSalesCustomer splices the live queue array.
      const candidates = queue
        .getQueue('sales')
        .filter(
          item =>
            item.type === 'workspace' &&
            item.customerId !== undefined &&
            !attempted.has(item.id),
        );
      for (const item of candidates) {
        if (budget <= 0) break;
        attempted.add(item.id);
        budget -= 1;
        const result = resolveSalesCustomer(item.customerId as string, day);
        if (result === 'resolved') resolved += 1;
        else if (result === 'escalated') escalated += 1;
      }
      return { resolved, escalated };
    },
  };
}
