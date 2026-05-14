import type {
  Staff,
  StaffCounters,
  StaffDepartment,
  StaffResources,
  StaffRole,
  StaffRoleCatalog,
  StaffSkill,
  StaffSkillCatalog,
  StaffTier,
} from './schemas/staff';

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
};

export class StaffRoleDagError extends Error {
  constructor(message: string) {
    super(`Invalid staff role catalog: ${message}`);
    this.name = 'StaffRoleDagError';
  }
}

export function validateRoleDag(
  roles: StaffRoleCatalog,
  skills: StaffSkillCatalog,
): void {
  const roleIds = new Set(Object.keys(roles));
  const skillIds = new Set(Object.keys(skills));

  for (const [id, role] of Object.entries(roles)) {
    for (const skillId of role.grants_skills) {
      if (!skillIds.has(skillId)) {
        throw new StaffRoleDagError(
          `role "${id}" grants unknown skill "${skillId}"`,
        );
      }
    }
    for (const gateSkill of Object.keys(role.promotion_gates)) {
      // gates can reference composites or skill ids; only enforce non-empty
      if (gateSkill.length === 0) {
        throw new StaffRoleDagError(`role "${id}" has empty promotion gate key`);
      }
    }
    for (const target of role.promotes_to) {
      if (!roleIds.has(target)) {
        throw new StaffRoleDagError(
          `role "${id}" promotes to unknown role "${target}"`,
        );
      }
    }
    if (role.tier === 'gm' && role.promotes_to.length > 0) {
      throw new StaffRoleDagError(
        `role "${id}" is tier "gm" but has outgoing promotes_to edges (GM must be a sink)`,
      );
    }
  }

  // Cycle detection via DFS with white/gray/black coloring.
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of roleIds) color.set(id, WHITE);

  const visit = (id: string, stack: string[]): void => {
    color.set(id, GRAY);
    for (const next of roles[id].promotes_to) {
      const c = color.get(next);
      if (c === GRAY) {
        throw new StaffRoleDagError(
          `cycle in promotes_to: ${[...stack, id, next].join(' -> ')}`,
        );
      }
      if (c === WHITE) visit(next, [...stack, id]);
    }
    color.set(id, BLACK);
  };

  for (const id of roleIds) {
    if (color.get(id) === WHITE) visit(id, []);
  }
}
