import type { EventBus } from '../EventBus';
import type { StaffOrg } from '../StaffOrg';
import type { DepartmentQueue } from '../DepartmentQueue';
import type { StaffMorale } from '../StaffMorale';
import type { DeptDrain } from '../FloorSim';
import type { Inventory } from '../Inventory';
import type { DealEngine, CreditTierCatalog } from '../DealEngine';
import type { Person, Visit } from '../NPC';
import { createRng, deriveSeed } from '../NPC/Rng';
import { EXCEPTION_FLAGS } from './types';
import { loadStaffDispatchConfig, type StaffDispatchConfig } from './staffDispatchData';
import {
  closeAndPrice,
  makeSalespersonProfile,
  pickVehicleFor,
  resolveSalesProcess,
  vehicleSpaced,
  type MatchCustomer,
  type ResolveDeps,
  type CloseDeps,
  type PickVehicleDeps,
  type SpacedVector,
} from '../SalesProcess';

/** Narrow shape this module needs from a CustomerPool session lookup. */
export interface StaffDispatchCustomerSession {
  readonly bundle: { readonly person: Person; readonly visit: Visit };
  readonly visitArchetypeId: string;
}

export interface StaffDispatchDeps {
  bus: EventBus;
  staffOrg: StaffOrg;
  queue: DepartmentQueue;
  masterSeed: number;
  inventory: Pick<Inventory, 'getLotVehicles'>;
  dealEngine: Pick<DealEngine, 'closeDeal' | 'classifyCredit' | 'computeAutoFni'>;
  creditTiers: CreditTierCatalog;
  /** Resolves the customer's NPC bundle + visit-archetype id. */
  getCustomerSession: (customerId: string) => StaffDispatchCustomerSession | undefined;
  staffMorale?: StaffMorale;
  config?: StaffDispatchConfig;
  getHasGm?: () => boolean;
  /** RNG for F&I auto-attach (defaults to Math.random). */
  fniRng?: () => number;
  /** Optional unlocked F&I roles override. Defaults to deriving from staffOrg roster. */
  unlockedRolesFn?: () => string[];
  /** Optional SalesProcess deps (configs, market/cost/book seam overrides). */
  salesProcessDeps?: ResolveDeps & CloseDeps & PickVehicleDeps;
}

// Intentionally empty — dispatch is fully autonomous.
export interface StaffDispatch {}

/** Outcome of a single auto-resolution attempt against one sales customer. */
type ResolveResult = 'resolved' | 'escalated' | 'declined';

function lerp(a: number, b: number, t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return a + (b - a) * clamped;
}

const clampUnit = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

// Per-gate patience drain rate: v1 balanced default (matches CustomerPool).
const ARCHETYPE_IMPATIENCE = 0.25;

/**
 * Builds the per-customer sales auto-resolution closure shared by the legacy
 * once-per-admit path and the per-tick floor drain (#101). #147 rewires the
 * close to the real machinery: pickVehicleFor → resolveSalesProcess →
 * closeAndPrice → DealEngine.closeDeal. Exception roll + hold-floor are
 * untouched; the synthetic close path is gone.
 */
function makeSalesResolver(deps: StaffDispatchDeps) {
  const { bus, staffOrg, queue, masterSeed, staffMorale } = deps;
  const config = deps.config ?? loadStaffDispatchConfig();
  const getHasGm = deps.getHasGm;

  function emitNoSale(
    customerId: string,
    staffId: string,
    day: number,
    reason: string,
  ): void {
    bus.publish('staff:auto_resolved', {
      customerId,
      staffId,
      day,
      outcome: 'no_sale',
      grossImpact: 0,
      reason,
    });
  }

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

    // Hold-floor model (#134): any salesperson on the roster always works
    // (holds) the up — there is no skill-gated decline.
    queue.resolveByCustomerId(customerId);

    const session = deps.getCustomerSession(customerId);
    if (!session) {
      emitNoSale(customerId, salesperson.id, day, 'no_session');
      return 'resolved';
    }
    const { bundle, visitArchetypeId } = session;
    const { person, visit } = bundle;
    if (visit.kind !== 'sales') {
      emitNoSale(customerId, salesperson.id, day, 'not_sales');
      return 'resolved';
    }

    // morale acts as a per-gate effectiveness multiplier on the salesperson's
    // composite skill profile (no more skill-independent close-rate dial).
    const moraleMult = staffMorale?.getMoraleMultiplier(salesperson.id) ?? 1.0;
    const effectiveness = clampUnit(salesperson.effectiveness * moraleMult);
    const trustworthiness = clampUnit(salesperson.trustworthiness ?? 0);
    const skill = makeSalespersonProfile({}, { effectiveness, trustworthiness });

    // Tier policy used by both finance affordability and deal-structuring.
    const tier =
      visit.paymentMethod === 'finance'
        ? deps.creditTiers.tiers[deps.dealEngine.classifyCredit(person.credit)]
        : undefined;

    const customerSpaced = visit.preferences as SpacedVector;
    const priceSensitivity = clampUnit(1 - person.wealth / 120000);
    const matchCustomer: MatchCustomer = {
      masterSeed,
      customerId,
      customerSpaced,
      priceSensitivity,
      visitArchetypeId,
      wealth: person.wealth,
      annualIncome: person.annualIncome,
      paymentMethod: visit.paymentMethod,
      // Cash buyers don't carry a stamped behavioral cash-spend fraction on
      // the visit yet (NPC schema follow-on). The matcher's headroom math
      // uses this; default to the full wealth ceiling so cash eligibility is
      // truly "can the buyer cover list price" without a behavioral haircut.
      cashSpendFraction: visit.paymentMethod === 'cash' ? 1 : undefined,
      downPaymentBehavior: visit.downPaymentBehavior,
    };

    const pickDeps: PickVehicleDeps = {
      ...(deps.salesProcessDeps ?? {}),
      tier,
    };
    const lot = deps.inventory.getLotVehicles();
    const vehicleId = pickVehicleFor(matchCustomer, lot, pickDeps);
    if (!vehicleId) {
      emitNoSale(customerId, salesperson.id, day, 'no_fit');
      return 'resolved';
    }
    const vehicle = lot.find(v => v.id === vehicleId);
    if (!vehicle) {
      // pickVehicleFor only returns ids from the lot snapshot, so this is
      // unreachable; the guard satisfies the type and is defensive vs. future
      // refactors.
      emitNoSale(customerId, salesperson.id, day, 'no_fit');
      return 'resolved';
    }

    const resolution = resolveSalesProcess(
      {
        masterSeed,
        customerId,
        day,
        skill,
        customerDifficulty: clampUnit(1 - person.agreeableness / 100),
        archetypeImpatience: ARCHETYPE_IMPATIENCE,
        initialPatience: visit.resources.patience,
        customerSpaced,
        vehicleSpaced: vehicleSpaced(vehicle, deps.salesProcessDeps),
        visitArchetypeId,
      },
      deps.salesProcessDeps,
    );
    if (resolution.outcome === 'walk') {
      emitNoSale(customerId, salesperson.id, day, resolution.cause);
      return 'resolved';
    }

    const close = closeAndPrice(
      {
        meters: resolution.meters,
        skill,
        priceSensitivity,
        vehicle,
      },
      deps.salesProcessDeps,
    );
    if (close.outcome !== 'buy') {
      emitNoSale(customerId, salesperson.id, day, 'no_close');
      return 'resolved';
    }

    const unlockedRoles =
      deps.unlockedRolesFn?.() ??
      Array.from(new Set(staffOrg.currentRoster.map(s => s.role_id)));
    const fni = deps.dealEngine.computeAutoFni(
      effectiveness * 100,
      unlockedRoles,
      deps.fniRng,
    );

    const agreedPrice = close.realizedPrice;
    let downPayment = 0;
    let loanAmount = 0;
    let term = 0;
    let apr = 0;
    if (visit.paymentMethod === 'cash') {
      downPayment = agreedPrice;
    } else {
      const policy = tier!;
      apr = policy.apr;
      term = policy.maxTerm;
      downPayment = agreedPrice * (visit.downPaymentBehavior ?? 0);
      loanAmount = agreedPrice - downPayment;
    }

    const result = deps.dealEngine.closeDeal({
      customerId,
      vehicleId: vehicle.id,
      agreedPrice,
      fniProducts: fni,
      paymentMethod: visit.paymentMethod,
      downPayment,
      loanAmount,
      term,
      apr,
    });

    bus.publish('staff:auto_resolved', {
      customerId,
      staffId: salesperson.id,
      day,
      outcome: 'closed',
      grossImpact: result.frontGross + result.backGross,
    });
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
 * the cadence differs. `escalated` is surfaced per the locked seam shape.
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
