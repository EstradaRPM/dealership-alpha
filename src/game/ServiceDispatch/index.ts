export {
  createServiceDispatch,
  createServiceFloorDrain,
  createServiceReadModel,
  // The shared department-dispatch engine (#311/#314) — Body Shop composes these
  // with its own DeptDispatchProfile (Service is the reference profile, wired by
  // the Service builders above).
  createDeptDispatch,
  createDeptFloorDrain,
  createDeptReadModel,
} from './ServiceDispatch';
export type {
  ServiceDispatch,
  ServiceDispatchDeps,
  ServiceLoad,
  ServiceReadModel,
  ServiceReadModelWriter,
  // Generic engine surface.
  DeptDispatchDeps,
  DeptDispatchProfile,
  DeptDispatchEmit,
  DeptIntakeItem,
  DeptCapacityConfig,
  DeptLoad,
  DeptReadModel,
  DeptReadModelWriter,
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
