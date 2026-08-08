export {
  createCustomerPool,
  SALES_ARCHETYPES,
  resolveSegmentArchetypes,
} from './CustomerPool';
export type {
  CustomerPool,
  CustomerSession,
  SalesArchetype,
  SegmentArchetypeWeight,
} from './CustomerPool';
export { transition, IllegalTransitionError } from './CustomerStateMachine';
export type { CustomerStage, CustomerAction } from './types';
