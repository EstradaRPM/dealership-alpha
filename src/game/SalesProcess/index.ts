export {
  SalesProcessConfigSchema,
  VehicleSpacedConfigSchema,
  BrandTiersConfigSchema,
  CustomerNonnegotiablesConfigSchema,
  loadSalesProcessConfig,
  loadVehicleSpacedConfig,
  loadBrandTiersConfig,
  loadCustomerNonnegotiablesConfig,
} from './salesProcessData';
export { GATES } from './salesProcessData';
export type {
  SalesProcessConfig,
  Gate,
  VehicleSpacedConfig,
  BrandTiersConfig,
  CustomerNonnegotiablesConfig,
} from './salesProcessData';
export { vehicleSpaced } from './vehicleSpaced';
export type {
  SpacedAxis,
  SpacedVector,
  SpacedVehicleInput,
  VehicleSpacedDeps,
} from './vehicleSpaced';

export {
  GREEN_SALESPERSON,
  GREEN_SALESPERSON_SKILL,
  makeSalespersonProfile,
  staticMarketPrice,
  staticVehicleCost,
} from './seams';
export type {
  GateSkill,
  SalespersonSkill,
  PricedVehicleInput,
  MarketPriceFn,
  VehicleCostFn,
} from './seams';

export {
  evaluateGate,
  accumulateMeters,
  evaluateSalesProcess,
} from './evaluator';
export type {
  GateEvaluation,
  MeterState,
  GateInput,
  EvaluatorDeps,
  SalesProcessInput,
  SalesProcessResult,
} from './evaluator';
