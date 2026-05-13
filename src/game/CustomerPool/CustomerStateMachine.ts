import type { CustomerStage, CustomerAction } from './types';

export class IllegalTransitionError extends Error {
  readonly from: CustomerStage;
  readonly action: CustomerAction;
  constructor(from: CustomerStage, action: CustomerAction) {
    super(`Illegal transition: ${action} from ${from}`);
    this.name = 'IllegalTransitionError';
    this.from = from;
    this.action = action;
  }
}

const TRANSITIONS: Partial<Record<CustomerStage, Partial<Record<CustomerAction, CustomerStage>>>> = {
  UNGREETED:   { GREET: 'GREETED',        WALK_CUSTOMER: 'WALK' },
  GREETED:     { QUALIFY: 'QUALIFIED',     WALK_CUSTOMER: 'WALK' },
  QUALIFIED:   { DEMO: 'DEMOED',           WALK_CUSTOMER: 'WALK' },
  DEMOED:      { NEGOTIATE: 'NEGOTIATING', WALK_CUSTOMER: 'WALK' },
  NEGOTIATING: { CLOSE: 'CLOSED',          WALK_CUSTOMER: 'WALK' },
};

export function transition(from: CustomerStage, action: CustomerAction): CustomerStage {
  const next = TRANSITIONS[from]?.[action];
  if (next === undefined) throw new IllegalTransitionError(from, action);
  return next;
}
