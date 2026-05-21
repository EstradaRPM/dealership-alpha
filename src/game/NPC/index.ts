export { resolveEffects, TraitAppliesError } from './Trait';
export type { Trait, TraitSet } from './Trait';
export { loadTraitTaxonomy } from './TraitTaxonomy';

export type { Staff, StaffRole, StaffSkill } from './Staff';
export { loadStaffTaxonomy } from './StaffTaxonomy';

export { loadStaffArchetypes } from './StaffArchetypes';

export { createStaff, promoteStaff } from './factories/StaffFactory';
export type {
  CreateStaffContext,
  CreateStaffDeps,
  StaffWithComposites,
} from './factories/StaffFactory';

export { createCustomer } from './factories/CustomerFactory';
export type {
  CreateCustomerContext,
  CreateCustomerDeps,
  CustomerBundle,
} from './factories/CustomerFactory';

export { hotButtons } from './Customer';
export type {
  Person,
  SalesVisit,
  ServiceVisit,
  BodyVisit,
  Visit,
} from './Customer';

export {
  rollCurrentVehicle,
  loadCustomerCurrentVehicleConfig,
} from './factories/CurrentVehicleFactory';
export type {
  RollCurrentVehicleContext,
  RollCurrentVehicleDeps,
} from './factories/CurrentVehicleFactory';
export type {
  CurrentVehicle,
  CustomerCurrentVehicleConfig,
} from './schemas/customer-current-vehicle';
export {
  CurrentVehicleSchema,
  CustomerCurrentVehicleConfigSchema,
} from './schemas/customer-current-vehicle';

export {
  rollHasTrade,
  loadTradeIncidenceConfig,
} from './factories/TradeIncidenceFactory';
export type {
  RollHasTradeContext,
  RollHasTradeDeps,
} from './factories/TradeIncidenceFactory';
export type { TradeIncidenceConfig } from './schemas/trade-incidence';
export { TradeIncidenceConfigSchema } from './schemas/trade-incidence';

export { loadPersonArchetypes, loadVisitArchetypes } from './CustomerArchetypes';

export { loadCustomerTunables } from './CustomerTunables';
export type { CustomerTunables } from './CustomerTunables';

export type { Competitor } from './Competitor';

export { loadCompetitorArchetypes, loadBrandMarketShare } from './CompetitorArchetypes';

export { createCompetitor } from './factories/CompetitorFactory';
export type {
  CreateCompetitorContext,
  CreateCompetitorDeps,
} from './factories/CompetitorFactory';
