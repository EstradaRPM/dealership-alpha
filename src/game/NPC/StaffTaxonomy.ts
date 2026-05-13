import { parseData } from '../data';
import { validateRoleDag } from './Staff';
import {
  StaffRoleCatalogSchema,
  StaffSkillCatalogSchema,
} from './schemas/staff';
import type { StaffRoleCatalog, StaffSkillCatalog } from './schemas/staff';

export interface StaffTaxonomy {
  skills: StaffSkillCatalog;
  roles: StaffRoleCatalog;
}

export function loadStaffTaxonomy(): StaffTaxonomy {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const rawSkills: unknown = require('../../../data/staff-skills.json');
  const rawRoles: unknown = require('../../../data/staff-roles.json');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const skills = parseData(
    rawSkills,
    StaffSkillCatalogSchema,
    'data/staff-skills.json',
  );
  const roles = parseData(
    rawRoles,
    StaffRoleCatalogSchema,
    'data/staff-roles.json',
  );
  validateRoleDag(roles, skills);
  return { skills, roles };
}
