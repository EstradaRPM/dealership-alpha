import { createCustomer } from '../NPC';
import { createRng, deriveSeed } from '../Rng';
import type { CreateCustomerDeps, CustomerBundle } from '../NPC';
import type { EventBus } from '../EventBus';
import type { DealEngine, CreditTierCatalog, CreditTier } from '../DealEngine';
import type { Inventory } from '../Inventory';
import { transition, IllegalTransitionError } from './CustomerStateMachine';
import type { CustomerStage, CustomerAction } from './types';
import {
  resolveSalesProcess,
  closeAndPrice,
  accumulateMeters,
  residualHeat,
  resolutionQuality,
  GREEN_SALESPERSON,
  vehicleSpaced,
  type SalesProcessResolution,
  type CloseResult,
  type SalespersonSkill,
  type SpacedVehicleInput,
  type PricedVehicleInput,
  type SpacedVector,
} from '../SalesProcess';

const clampUnit = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

// Per-gate patience drain rate: balanced default; replace with per-archetype data when tuning.
const ARCHETYPE_IMPATIENCE = 0.25;

// Stub vehicle used until Inventory wiring lands; values produce a realistic Tier-1 range.
const STUB_VEHICLE_SPACED: SpacedVehicleInput = {
  category: 'sedan',
  templateId: 'base_sedan', // unknown template → inherits sedan category base
  brand: 'generic',         // unknown brand → no brand-tier modifier
  year: 2020,               // reference year → no year modifier
};
const STUB_PRICED_VEHICLE: PricedVehicleInput = { purchasePrice: 8000, reconCost: 500 };

export type { IllegalTransitionError };

export interface CustomerSession {
  readonly customerId: string;
  readonly day: number;
  readonly bundle: CustomerBundle;
  readonly stage: CustomerStage;
  readonly archetypeLabel: string;
  /** Visit-archetype id, used by SalesProcess's nonnegotiable-distribution seam. */
  readonly visitArchetypeId: string;
}

interface MutableSession extends Omit<CustomerSession, 'stage'> {
  stage: CustomerStage;
  /** visitArchetypeId for the nonnegotiable distribution seam in SalesProcess. */
  visitArchetypeId: string;
}

export interface CustomerPool {
  getSessions(): readonly CustomerSession[];
  getSession(customerId: string): CustomerSession | undefined;
  dispatch(customerId: string, action: CustomerAction): void;
  spawnCustomer(personArchetypeId: string, visitArchetypeId: string, label: string): string;
}

export interface SalesArchetype {
  personId: string;
  visitId: string;
  label: string;
}

export const SALES_ARCHETYPES: readonly SalesArchetype[] = [
  { personId: 'young_family',  visitId: 'family_vehicle_search',  label: 'Young Family'  },
  { personId: 'enthusiast',    visitId: 'performance_test_drive', label: 'Enthusiast'    },
  { personId: 'commuter',      visitId: 'commuter_replacement',   label: 'Commuter'      },
  { personId: 'retiree',       visitId: 'retirement_upgrade',     label: 'Retiree'       },
  { personId: 'tradesperson',  visitId: 'work_truck_purchase',    label: 'Tradesperson'  },
];

/** One archetype's weight within its segment, resolved to a real pairing. */
export interface SegmentArchetypeWeight extends SalesArchetype {
  readonly weight: number;
}

/**
 * Resolve `demandShaper.segmentArchetypes` (segment → personId → weight) against
 * the real archetype pairings, dropping any personId the catalog doesn't
 * actually spawn.
 *
 * This is the ONE reading of that table. The spawn seam draws from it and the
 * #371 finance-mix projection integrates over it, and the two must describe the
 * same crowd — a second copy of the filter or the normalization is how the
 * forward read starts describing a crowd that never walks in.
 */
export function resolveSegmentArchetypes(
  table: Readonly<Record<string, Readonly<Record<string, number>>>>,
): ReadonlyMap<string, readonly SegmentArchetypeWeight[]> {
  const byPersona = new Map(SALES_ARCHETYPES.map((a) => [a.personId, a]));
  return new Map(
    Object.entries(table).map(([segment, weights]) => [
      segment,
      Object.entries(weights)
        .filter(([personId]) => byPersona.has(personId))
        .map(([personId, weight]) => ({ ...byPersona.get(personId)!, weight })),
    ]),
  );
}

/**
 * Apply an additive person-archetype skew (#372, advertising's second lane) to
 * one segment's resolved archetype weights, clamping each at zero.
 *
 * This is the ONE place the skew is applied, for the same reason
 * `resolveSegmentArchetypes` is the one reading of the table: the spawn draw
 * and the #371 finance-mix projection have to describe the same crowd, and a
 * second copy of the clamp is how a forward read starts promising buyers who
 * never walk in.
 *
 * A skew that zeroes out every candidate returns the segment UNSKEWED rather
 * than an empty list — advertising bends who walks in, it cannot close a
 * segment the heat map still spawns, and an empty list would fall through to a
 * persona that does not belong to the segment at all.
 */
export function skewSegmentArchetypes(
  candidates: readonly SegmentArchetypeWeight[],
  skew: Readonly<Record<string, number>>,
): readonly SegmentArchetypeWeight[] {
  if (candidates.length === 0) return candidates;
  const skewed = candidates.map((candidate) => ({
    ...candidate,
    weight: Math.max(0, candidate.weight + (skew[candidate.personId] ?? 0)),
  }));
  const total = skewed.reduce((sum, c) => sum + c.weight, 0);
  return total > 0 ? skewed : candidates;
}

export function createCustomerPool(deps: {
  bus: EventBus;
  npcDeps: CreateCustomerDeps;
  /** Injected salesperson skill (defaults to GREEN_SALESPERSON). StaffOrg wiring is a follow-on. */
  skill?: SalespersonSkill;
  /**
   * Legacy once-per-day arrival generator on `clock:day_started` (the old
   * live-day path). Default `true` preserves prior behavior + tests. The
   * #114 composition root passes `false`: FloorSim owns arrivals via the
   * injected customer-source seam, so this auto-generation must not also
   * fire. `currentDay` tracking still runs regardless.
   */
  legacyDailyArrivals?: boolean;
  /**
   * Real-close wiring (#146): when supplied, `dispatch(CLOSE)` with a
   * successful resolution routes through `DealEngine.closeDeal` instead of
   * synthesizing `customer:resolved` against a stub vehicle. Requires all
   * three (dealEngine + inventory + creditTiers) plus a non-empty lot;
   * otherwise falls back to the legacy SalesProcess-direct emit so test
   * harnesses without inventory wiring still close.
   */
  dealEngine?: Pick<DealEngine, 'closeDeal' | 'classifyCredit' | 'quoteFinance'>;
  inventory?: Pick<Inventory, 'getLotVehicles'>;
  creditTiers?: CreditTierCatalog;
}): CustomerPool {
  const { bus, npcDeps } = deps;
  const sessions = new Map<string, MutableSession>();
  let adminSpawnSlot = 9000;
  let currentDay = 0;

  /** Compute the SalesProcess-driven scalar outputs for a customer resolution. */
  function resolveViaProcess(session: MutableSession): {
    outcome: 'closed' | 'walk';
    receptivity: number;
    satisfaction: number;
    retentionSeed: number;
    heat: number;
    agreedPrice: number;
    frontGross: number;
  } {
    const { person, visit } = session.bundle;

    if (visit.kind !== 'sales') {
      return { outcome: 'walk', receptivity: 0, satisfaction: 0, retentionSeed: 0, heat: 0, agreedPrice: 0, frontGross: 0 };
    }

    // NPC SPACEDVector and SalesProcess SpacedVector share identical axis keys.
    const customerSpaced = visit.preferences as SpacedVector;

    const resolution: SalesProcessResolution = resolveSalesProcess({
      masterSeed: npcDeps.masterSeed,
      customerId: session.customerId,
      day: currentDay,
      skill: deps.skill ?? GREEN_SALESPERSON,
      customerDifficulty: clampUnit(1 - person.agreeableness / 100),
      archetypeImpatience: ARCHETYPE_IMPATIENCE,
      initialPatience: visit.resources.patience,
      customerSpaced,
      vehicleSpaced: vehicleSpaced(STUB_VEHICLE_SPACED),
      visitArchetypeId: session.visitArchetypeId,
    });

    // Observability only (issue #92): emit one customer:gate_evaluated per gate
    // in resolution order. Per-gate meter delta = the marginal change to each
    // running meter from adding this gate, reusing the same exported
    // accumulateMeters roll-up resolve.ts uses internally (no re-derived logic).
    let prevTrust = 0;
    let prevValue = 0;
    resolution.evaluations.forEach((ev, i) => {
      const running = accumulateMeters(resolution.evaluations.slice(0, i + 1));
      const isWalkGate =
        resolution.outcome === 'walk' &&
        i === resolution.evaluations.length - 1;
      bus.publish('customer:gate_evaluated', {
        customerId: session.customerId,
        day: currentDay,
        gate: ev.gate,
        q: ev.q,
        meterDelta: {
          trustIntegrity: running.trustIntegrity - prevTrust,
          value: running.value - prevValue,
        },
        walkCause: isWalkGate ? resolution.cause : null,
      });
      prevTrust = running.trustIntegrity;
      prevValue = running.value;
    });

    if (resolution.outcome === 'walk') {
      return {
        outcome: 'walk',
        ...resolutionQuality({ resolution }),
        heat: residualHeat({ resolution }),
        agreedPrice: 0,
        frontGross: 0,
      };
    }

    // reached_close → run quadrant close + price formation
    const priceSensitivity = clampUnit(1 - person.wealth / 120000);
    const closeResult: CloseResult = closeAndPrice({
      meters: resolution.meters,
      skill: deps.skill ?? GREEN_SALESPERSON,
      priceSensitivity,
      vehicle: STUB_PRICED_VEHICLE,
    });

    const closed = closeResult.outcome === 'buy';
    return {
      outcome: closed ? 'closed' : 'walk',
      ...resolutionQuality({ resolution, close: closeResult }),
      heat: residualHeat({ resolution, bought: closed }),
      agreedPrice: closed ? closeResult.realizedPrice : 0,
      frontGross: closed ? closeResult.frontGross : 0,
    };
  }

  function doDispatch(customerId: string, action: CustomerAction): void {
    const session = sessions.get(customerId);
    if (!session) throw new Error(`No session for customer "${customerId}"`);
    const from = session.stage;

    // transition() validates the action; throws IllegalTransitionError on illegal dispatch.
    const fsmTo = transition(from, action);

    if (action === 'WALK_CUSTOMER') {
      // Forced walk: player decision, not SalesProcess-driven.
      // Use visit patience as heat proxy (customer warmth independent of process quality).
      const { visit } = session.bundle;
      const patience = visit.kind === 'sales' ? visit.resources.patience : 0.5;
      session.stage = 'WALK';
      bus.publish('customer:state_changed', { customerId, from, to: 'WALK' });
      bus.publish('customer:resolved', {
        customerId,
        outcome: 'walk',
        receptivity: 0,
        satisfaction: 0,
        retentionSeed: 0,
        heat: clampUnit(patience),
        agreedPrice: 0,
        frontGross: 0,
      });
    } else if (action === 'CLOSE') {
      const resolved = resolveViaProcess(session);

      // Real-close path (#146): when DealEngine + inventory + tiers are wired
      // AND the lot has a vehicle AND SalesProcess resolved 'closed', route
      // through DealEngine.closeDeal so the canonical deal:closed (with the
      // five deal-structuring fields) fires. The existing deal:closed listener
      // below transitions the session to CLOSED and emits customer:resolved.
      if (resolved.outcome === 'closed' && deps.dealEngine && deps.inventory && deps.creditTiers) {
        const lot = deps.inventory.getLotVehicles();
        if (lot.length > 0) {
          const vehicle = lot[0];
          const visit = session.bundle.visit;
          const paymentMethod = visit.kind === 'sales' ? visit.paymentMethod : 'cash';
          const downBehavior =
            visit.kind === 'sales' ? visit.downPaymentBehavior ?? 0 : 0;
          const agreedPrice = resolved.agreedPrice;

          let downPayment = 0;
          let loanAmount = 0;
          let term = 0;
          let apr = 0;
          let buyRate = 0;
          // #370: the lender program this contract is written on, recorded on
          // the close so the store's financed book carries its own credit mix.
          let creditTier: CreditTier | undefined;
          if (paymentMethod === 'cash') {
            downPayment = agreedPrice;
          } else {
            const tier = deps.dealEngine.classifyCredit(session.bundle.person.credit);
            creditTier = tier;
            const policy = deps.creditTiers.tiers[tier];
            // #365: the customer is quoted buy rate + markup, and the close
            // carries both so the reserve half of back gross can be earned.
            const quote = deps.dealEngine.quoteFinance(tier);
            apr = quote.customerRate;
            buyRate = quote.buyRate;
            term = policy.maxTerm;
            downPayment = agreedPrice * downBehavior;
            loanAmount = agreedPrice - downPayment;
          }

          deps.dealEngine.closeDeal({
            customerId,
            vehicleId: vehicle.id,
            agreedPrice,
            paymentMethod,
            downPayment,
            loanAmount,
            term,
            apr,
            buyRate,
            creditTier,
          });
          return;
        }
      }

      // Fallback path: legacy SalesProcess-direct close — used by harnesses
      // without inventory/DealEngine wiring, and as the walk path always.
      const to: CustomerStage = resolved.outcome === 'closed' ? 'CLOSED' : 'WALK';
      session.stage = to;
      bus.publish('customer:state_changed', { customerId, from, to });
      bus.publish('customer:resolved', { customerId, ...resolved });
    } else {
      session.stage = fsmTo;
      bus.publish('customer:state_changed', { customerId, from, to: fsmTo });
    }
  }

  const legacyDailyArrivals = deps.legacyDailyArrivals ?? true;

  bus.subscribe('clock:day_started', ({ day }) => {
    currentDay = day;

    // Old live-day path: FloorSim owns arrivals via the customer-source seam
    // in the #114 composition, so the legacy auto-generator is opted out
    // there. currentDay tracking always runs.
    if (legacyDailyArrivals) {
      const rng = createRng(
        deriveSeed(npcDeps.masterSeed, 'customer_pool.archetype_pick', { day }),
      );
      const pick = SALES_ARCHETYPES[Math.floor(rng() * SALES_ARCHETYPES.length)];

      const bundle = createCustomer(
        { personArchetypeId: pick.personId, visitArchetypeId: pick.visitId, day, slot: 0 },
        npcDeps,
      );

      const customerId = bundle.person.id;
      sessions.set(customerId, {
        customerId,
        day,
        bundle,
        stage: 'UNGREETED',
        archetypeLabel: pick.label,
        visitArchetypeId: pick.visitId,
      });

      bus.publish('customer:arrived', { day, customerId, label: pick.label });
    }
  });

  bus.subscribe(
    'deal:closed',
    ({ customerId, agreedPrice, frontGross, salesQuality }) => {
      // DealEngine is the authoritative source for deal closes; bypass SalesProcess
      // outcome determination.
      const session = sessions.get(customerId);
      if (!session) return;
      const from = session.stage;
      session.stage = 'CLOSED';
      bus.publish('customer:state_changed', { customerId, from, to: 'CLOSED' });
      // #363: prefer the quality the closing flow actually measured. The live
      // floor ran the whole process against the unit the customer was shown and
      // carries the result on the close; re-running it here would score the
      // visit against STUB_VEHICLE_SPACED — a car nobody saw — and emit a
      // phantom `customer:gate_evaluated` stream for gates that never ran.
      // Absent (legacy harnesses, direct closeDeal callers), fall back to the
      // local evaluation so those paths publish exactly as they always did.
      const scalars = salesQuality ?? resolveViaProcess(session);
      bus.publish('customer:resolved', {
        customerId,
        outcome: 'closed',
        receptivity: scalars.receptivity,
        satisfaction: scalars.satisfaction,
        retentionSeed: scalars.retentionSeed,
        heat: 0,
        agreedPrice,
        frontGross,
      });
    },
  );

  // The live sales floor's walk (#363). StaffDispatch owns the outcome truth for
  // a customer a salesperson actually worked, and a `no_sale` there is a
  // resolution just as much as a close is — but before this bridge existed it
  // published only `staff:auto_resolved`, so FollowUpPool, Reputation's walk
  // penalty, RegulatoryMeter's walk pressure and TierManager's `customersServed`
  // never saw the ~97% of live ups that walk.
  //
  // `heat` comes straight off the event: it is `SalesProcess.residualHeat` over
  // the resolution that ran, computed for exactly the population FollowUpPool
  // wants. The three pre-process reasons (`no_session`, `not_sales`, `no_fit`)
  // carry none — a customer the lot had nothing for never got far enough to
  // leave a temperature — and resolve at 0 rather than not resolving at all.
  bus.subscribe('staff:auto_resolved', ({ customerId, outcome, heat }) => {
    if (outcome !== 'no_sale') return;
    const session = sessions.get(customerId);
    // An already-terminal session has been resolved once; publishing again would
    // charge Reputation and RegulatoryMeter twice for one customer. A customer
    // BDC brought back sits at UNGREETED again and may legitimately re-resolve.
    if (session && (session.stage === 'WALK' || session.stage === 'CLOSED')) return;
    if (session) {
      const from = session.stage;
      session.stage = 'WALK';
      bus.publish('customer:state_changed', { customerId, from, to: 'WALK' });
    }
    bus.publish('customer:resolved', {
      customerId,
      outcome: 'walk',
      receptivity: 0,
      satisfaction: 0,
      retentionSeed: 0,
      heat: heat ?? 0,
      agreedPrice: 0,
      frontGross: 0,
    });
  });

  bus.subscribe('bdc:callback_succeeded', ({ customerId }) => {
    const session = sessions.get(customerId);
    if (!session) return;
    const from = session.stage;
    session.stage = 'UNGREETED';
    bus.publish('customer:state_changed', { customerId, from, to: 'UNGREETED' });
  });

  function doSpawnCustomer(personArchetypeId: string, visitArchetypeId: string, label: string): string {
    const slot = adminSpawnSlot++;
    const bundle = createCustomer(
      { personArchetypeId, visitArchetypeId, day: 0, slot },
      npcDeps,
    );
    const customerId = bundle.person.id;
    sessions.set(customerId, { customerId, day: 0, bundle, stage: 'UNGREETED', archetypeLabel: label, visitArchetypeId });
    bus.publish('customer:arrived', { day: 0, customerId, label });
    return customerId;
  }

  return {
    getSessions() { return [...sessions.values()]; },
    getSession(customerId) { return sessions.get(customerId); },
    dispatch: doDispatch,
    spawnCustomer: doSpawnCustomer,
  };
}
