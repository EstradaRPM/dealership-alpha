import { createCustomer } from '../NPC';
import { createRng, deriveSeed } from '../NPC/Rng';
import type { CreateCustomerDeps, CustomerBundle } from '../NPC';
import type { EventBus } from '../EventBus';
import type { BrandCatalog } from '../CompetitorMarket/schemas/brand';
import type { Competitor } from '../CompetitorMarket/Competitor';
import type { DealEngine, CreditTierCatalog } from '../DealEngine';
import type { Inventory } from '../Inventory';
import { transition, IllegalTransitionError } from './CustomerStateMachine';
import type { CustomerStage, CustomerAction } from './types';
import { checkPoach } from './PoachEngine';
import { loadPoachConfig, type PoachConfig } from './poachData';
import {
  resolveSalesProcess,
  closeAndPrice,
  accumulateMeters,
  GREEN_SALESPERSON,
  vehicleSpaced,
  GATES,
  type SalesProcessResolution,
  type CloseResult,
  type SalespersonSkill,
  type SpacedVehicleInput,
  type PricedVehicleInput,
  type SpacedVector,
} from '../SalesProcess';

const clampUnit = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

// Per-gate patience drain rate: v1 balanced default; replace with per-archetype data when tuning.
const ARCHETYPE_IMPATIENCE = 0.25;

// Stub vehicle used until Inventory wiring lands; values produce a realistic Tier-1 range.
const STUB_VEHICLE_SPACED: SpacedVehicleInput = {
  category: 'sedan',
  templateId: 'base_sedan', // unknown template → inherits sedan category base
  make: 'generic',          // unknown make → no brand-tier modifier
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

export const SALES_ARCHETYPES: ReadonlyArray<{
  personId: string;
  visitId: string;
  label: string;
}> = [
  { personId: 'young_family',  visitId: 'family_vehicle_search',  label: 'Young Family'  },
  { personId: 'enthusiast',    visitId: 'performance_test_drive', label: 'Enthusiast'    },
  { personId: 'commuter',      visitId: 'commuter_replacement',   label: 'Commuter'      },
  { personId: 'retiree',       visitId: 'retirement_upgrade',     label: 'Retiree'       },
  { personId: 'tradesperson',  visitId: 'work_truck_purchase',    label: 'Tradesperson'  },
];

export function createCustomerPool(deps: {
  bus: EventBus;
  npcDeps: CreateCustomerDeps;
  brands?: BrandCatalog;
  getPlayerStrength?: () => number;
  poachConfig?: PoachConfig;
  /** Injected salesperson skill (defaults to GREEN_SALESPERSON). StaffOrg wiring is a follow-on. */
  skill?: SalespersonSkill;
  /**
   * Legacy once-per-day arrival generator on `clock:day_started` (the old
   * live-day path). Default `true` preserves prior behavior + tests. The
   * #114 composition root passes `false`: FloorSim owns arrivals via the
   * injected customer-source seam, so this auto-generation must not also
   * fire. `currentDay` tracking + poach checks still run regardless.
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
  dealEngine?: Pick<DealEngine, 'closeDeal' | 'classifyCredit'>;
  inventory?: Pick<Inventory, 'getLotVehicles'>;
  creditTiers?: CreditTierCatalog;
}): CustomerPool {
  const { bus, npcDeps } = deps;
  const sessions = new Map<string, MutableSession>();
  let adminSpawnSlot = 9000;
  let currentDay = 0;

  let latestCompetitors: ReadonlyArray<Competitor> = [];
  let resolvedPoachConfig: PoachConfig | undefined;

  bus.subscribe('market:competitive_pressure', ({ competitors }) => {
    latestCompetitors = competitors;
  });

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

    const receptivity = resolution.meters.trustIntegrity;

    // heat = f(stage reached, Value meter) + trust warmth boost. 0 for successful closes.
    function computeHeat(closeResult?: CloseResult): number {
      if (closeResult?.outcome === 'buy') return 0;
      const stageProgress =
        resolution.outcome === 'walk'
          ? GATES.indexOf(resolution.gate) / Math.max(1, GATES.length - 1)
          : 1.0;
      return clampUnit(stageProgress * 0.5 + resolution.meters.value * 0.3 + resolution.meters.trustIntegrity * 0.2);
    }

    if (resolution.outcome === 'walk') {
      return {
        outcome: 'walk',
        receptivity,
        satisfaction: 0,
        retentionSeed: clampUnit(resolution.meters.trustIntegrity * 0.6),
        heat: computeHeat(),
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
      receptivity,
      satisfaction: closeResult.badReview ? -1 : closed ? 1 : 0,
      retentionSeed: clampUnit(resolution.meters.trustIntegrity * 0.6 + closeResult.objectiveDeal * 0.4),
      heat: computeHeat(closeResult),
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
          if (paymentMethod === 'cash') {
            downPayment = agreedPrice;
          } else {
            const tier = deps.dealEngine.classifyCredit(session.bundle.person.credit);
            const policy = deps.creditTiers.tiers[tier];
            apr = policy.apr;
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

  function runPoachChecks(day: number): void {
    if (!deps.brands || !deps.getPlayerStrength) return;

    resolvedPoachConfig ??= deps.poachConfig ?? loadPoachConfig();
    const config = resolvedPoachConfig;
    const playerStrength = deps.getPlayerStrength();

    const toPoach: Array<{ session: MutableSession; competitor: Competitor }> = [];

    for (const session of sessions.values()) {
      if (session.stage === 'CLOSED' || session.stage === 'WALK') continue;

      const visit = session.bundle.visit;
      if (visit.kind !== 'sales') continue;

      const rng = createRng(
        deriveSeed(npcDeps.masterSeed, 'customer_pool.poach', {
          day,
          customerId: session.customerId,
        }),
      );

      const result = checkPoach({
        traitIds: session.bundle.person.trait_ids,
        visit,
        competitors: latestCompetitors,
        brands: deps.brands,
        playerStrength,
        shopAroundBaseRate: config.shopAroundBaseRate,
        shopAroundHighRate: config.shopAroundHighRate,
        shopAroundTraitId: config.shopAroundTraitId,
        rng,
      });

      if (result.poached) {
        toPoach.push({ session, competitor: result.competitor });
      }
    }

    for (const { session, competitor } of toPoach) {
      sessions.delete(session.customerId);
      bus.publish('customer:poached', {
        customerId: session.customerId,
        day,
        competitorId: competitor.id,
        competitorName: competitor.name,
      });
    }
  }

  const legacyDailyArrivals = deps.legacyDailyArrivals ?? true;

  bus.subscribe('clock:day_started', ({ day }) => {
    currentDay = day;

    // Old live-day path: FloorSim owns arrivals via the customer-source seam
    // in the #114 composition, so the legacy auto-generator is opted out
    // there. currentDay tracking + poach checks always run.
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

    runPoachChecks(day);
  });

  bus.subscribe('deal:closed', ({ customerId, agreedPrice, frontGross }) => {
    // DealEngine is the authoritative source for deal closes; bypass SalesProcess outcome
    // determination. Still run SalesProcess for quality scalars (receptivity, satisfaction,
    // retentionSeed) which are independent of who determined the close.
    const session = sessions.get(customerId);
    if (!session) return;
    const from = session.stage;
    session.stage = 'CLOSED';
    bus.publish('customer:state_changed', { customerId, from, to: 'CLOSED' });
    const scalars = resolveViaProcess(session);
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
