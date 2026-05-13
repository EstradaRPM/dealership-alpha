import { parseData } from '../data';
import {
  StaffArchetypeCatalogSchema,
  type StaffArchetypeCatalog,
} from './schemas/staff-archetype';
import type { StaffRoleCatalog } from './schemas/staff';
import type { TraitSet } from './schemas/trait';

export type { StaffArchetype, StaffArchetypeCatalog } from './schemas/staff-archetype';

export class StaffArchetypeValidationError extends Error {
  constructor(message: string) {
    super(`Invalid staff archetype catalog: ${message}`);
    this.name = 'StaffArchetypeValidationError';
  }
}

export function validateArchetypes(
  archetypes: StaffArchetypeCatalog,
  roles: StaffRoleCatalog,
  traits: TraitSet,
): void {
  for (const [id, a] of Object.entries(archetypes)) {
    if (!roles[a.role_id]) {
      throw new StaffArchetypeValidationError(
        `archetype "${id}" references unknown role "${a.role_id}"`,
      );
    }
    for (const traitId of a.trait_pool) {
      const trait = traits[traitId];
      if (!trait) {
        throw new StaffArchetypeValidationError(
          `archetype "${id}" references unknown trait "${traitId}"`,
        );
      }
      if (!trait.applies_to.includes('staff')) {
        throw new StaffArchetypeValidationError(
          `archetype "${id}" references trait "${traitId}" that does not apply to staff`,
        );
      }
    }
    if (a.trait_count.max > a.trait_pool.length) {
      throw new StaffArchetypeValidationError(
        `archetype "${id}" trait_count.max (${a.trait_count.max}) exceeds trait_pool size (${a.trait_pool.length})`,
      );
    }
  }
}

export function loadStaffArchetypes(): StaffArchetypeCatalog {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/staff-archetypes.json');
  return parseData(raw, StaffArchetypeCatalogSchema, 'data/staff-archetypes.json');
}
