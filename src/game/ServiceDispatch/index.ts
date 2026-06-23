export {
  createServiceDispatch,
  createServiceFloorDrain,
  createServiceReadModel,
} from './ServiceDispatch';
export type {
  ServiceDispatch,
  ServiceDispatchDeps,
  ServiceLoad,
  ServiceReadModel,
  ServiceReadModelWriter,
} from './ServiceDispatch';
export { loadServiceDispatchConfig } from './serviceDispatchData';
export type { ServiceDispatchConfig } from './serviceDispatchData';
// #310 service-manager automation engine (parent #297).
export {
  isServiceFunctionAutomated,
  autoServicePar,
  autoServicePosture,
  autoServiceMarketing,
  shouldRush,
} from './serviceManager';
export type {
  ServiceManagerFunction,
  ServiceManagerDeps,
  ServiceParInput,
  ServiceParSetpoint,
  ServiceMarketingHealth,
  ServiceMarketingCoverage,
  AutoServiceMarketingInput,
  ServiceMarketingDecision,
  ShouldRushInput,
} from './serviceManager';
export { loadServiceManagerConfig } from './serviceManagerData';
export type { ServiceManagerConfig } from './serviceManagerData';
