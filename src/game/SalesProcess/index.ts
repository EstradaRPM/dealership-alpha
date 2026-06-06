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
  staticBookValue,
} from './seams';
export type {
  GateSkill,
  SalespersonSkill,
  PricedVehicleInput,
  MarketPriceFn,
  VehicleCostFn,
  BookValueFn,
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

export {
  classifyAxes,
  revealsNonnegotiables,
  wantAxisFit,
  nonnegotiablesSatisfied,
} from './nonnegotiables';
export type {
  AxisClass,
  CustomerAxisProfile,
  ClassifyAxesInput,
  NonnegotiablesDeps,
} from './nonnegotiables';

export { resolveSalesProcess } from './resolve';
export type {
  WalkCause,
  SalesProcessVisitInput,
  SalesProcessResolution,
  ResolveDeps,
} from './resolve';

export { closeAndPrice } from './close';
export type {
  CloseInput,
  CloseDeps,
  CloseOutcome,
  CloseResult,
  PriceFormation,
} from './close';

export { cashEligible, financeEligible, isEligible } from './affordability';
export type {
  AffordabilityCustomer,
  AffordabilityDeps,
  CreditTierPolicy,
  FinanceEligibility,
  FinanceFailReason,
} from './affordability';

export { pickVehicleFor, pickVehicleForMatch } from './pickVehicle';
export type {
  MatchableVehicle,
  MatchCustomer,
  PickVehicleDeps,
  ReputationBonusFn,
  VehicleMatch,
} from './pickVehicle';
