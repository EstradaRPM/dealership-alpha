export { resolveEffects, TraitAppliesError } from './Trait';
export type { Trait, TraitSet, AppliesTo, EffectKey, EffectVector } from './Trait';
export { loadTraitTaxonomy } from './TraitTaxonomy';

export { validateRoleDag, StaffRoleDagError } from './Staff';
export type {
  Staff,
  StaffCounters,
  StaffDepartment,
  StaffResources,
  StaffRole,
  StaffRoleCatalog,
  StaffSkill,
  StaffSkillCatalog,
  StaffTier,
} from './Staff';
export { loadStaffTaxonomy } from './StaffTaxonomy';
export type { StaffTaxonomy } from './StaffTaxonomy';

export {
  loadStaffArchetypes,
  validateArchetypes,
  StaffArchetypeValidationError,
} from './StaffArchetypes';
export type { StaffArchetype, StaffArchetypeCatalog } from './StaffArchetypes';

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
  SPACEDVector,
  PSQTCVector,
  Person,
  PersonCounters,
  VisitResources,
  SalesVisit,
  ServiceVisit,
  BodyVisit,
  Visit,
} from './Customer';

export { loadPersonArchetypes, loadVisitArchetypes } from './CustomerArchetypes';
export type {
  PersonArchetype,
  PersonArchetypeCatalog,
  VisitArchetype,
  VisitArchetypeCatalog,
} from './CustomerArchetypes';

export { CompetitorSchema } from './Competitor';
export type { Competitor, CompetitorClassification } from './Competitor';

export { loadCompetitorArchetypes, loadBrandMarketShare } from './CompetitorArchetypes';
export type {
  CompetitorArchetype,
  CompetitorArchetypeCatalog,
  BrandMarketShareEntry,
  BrandMarketShareCatalog,
} from './CompetitorArchetypes';

export { createCompetitor } from './factories/CompetitorFactory';
export type {
  CreateCompetitorContext,
  CreateCompetitorDeps,
} from './factories/CompetitorFactory';
