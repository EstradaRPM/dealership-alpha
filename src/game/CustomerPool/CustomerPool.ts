import { createCustomer } from '../NPC';
import { createRng, deriveSeed } from '../NPC/Rng';
import type { CreateCustomerDeps, CustomerBundle } from '../NPC';
import type { EventBus } from '../EventBus';
import { transition, IllegalTransitionError } from './CustomerStateMachine';
import type { CustomerStage, CustomerAction } from './types';

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
}

export interface CustomerPool {
  getSessions(): readonly CustomerSession[];
  getSession(customerId: string): CustomerSession | undefined;
  dispatch(customerId: string, action: CustomerAction): void;
}

const SALES_ARCHETYPES: ReadonlyArray<{
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
}): CustomerPool {
  const { bus, npcDeps } = deps;
  const sessions = new Map<string, MutableSession>();

  function doDispatch(customerId: string, action: CustomerAction): void {
    const session = sessions.get(customerId);
    if (!session) throw new Error(`No session for customer "${customerId}"`);
    const from = session.stage;
    const to = transition(from, action);
    session.stage = to;
    bus.publish('customer:state_changed', { customerId, from, to });
    if (to === 'CLOSED' || to === 'WALK') {
      bus.publish('customer:resolved', {
        customerId,
        outcome: to === 'CLOSED' ? 'closed' : 'walk',
      });
    }
  }

  bus.subscribe('clock:day_started', ({ day }) => {
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
    });

    bus.publish('customer:arrived', { day, customerId, label: pick.label });
  });

  bus.subscribe('deal:closed', ({ customerId }) => {
    doDispatch(customerId, 'CLOSE');
  });

  bus.subscribe('bdc:callback_succeeded', ({ customerId }) => {
    const session = sessions.get(customerId);
    if (!session) return;
    const from = session.stage;
    session.stage = 'UNGREETED';
    bus.publish('customer:state_changed', { customerId, from, to: 'UNGREETED' });
  });

  return {
    getSessions() { return [...sessions.values()]; },
    getSession(customerId) { return sessions.get(customerId); },
    dispatch: doDispatch,
  };
}
