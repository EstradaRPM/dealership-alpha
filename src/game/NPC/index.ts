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
