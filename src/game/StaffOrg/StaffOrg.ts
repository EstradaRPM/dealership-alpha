import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { StaffTaxonomy } from '../NPC/StaffTaxonomy';
import type { StaffArchetypeCatalog } from '../NPC/schemas/staff-archetype';
import { createStaff, type StaffWithComposites } from '../NPC/factories/StaffFactory';
import { loadStaffOrgConfig, type StaffOrgConfig } from './staffOrgData';
import type { CandidateListing } from './types';

export interface StaffOrgDeps {
  bus: EventBus;
  economy: Economy;
  masterSeed: number;
  taxonomy: StaffTaxonomy;
  archetypes: StaffArchetypeCatalog;
  config?: StaffOrgConfig;
  getTier?: () => number;
}

export interface StaffOrg {
  readonly currentRoster: readonly StaffWithComposites[];
  getCandidates(roleId: string): readonly CandidateListing[];
  hire(candidateId: string): void;
  fire(staffId: string): void;
}

export class StaffOrgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaffOrgError';
  }
}

export function createStaffOrg(deps: StaffOrgDeps): StaffOrg {
  const { bus, economy, masterSeed, taxonomy, archetypes } = deps;
  const config = deps.config ?? loadStaffOrgConfig();
  const getTier = deps.getTier;

  const roster: StaffWithComposites[] = [];
  // candidateId → CandidateListing; cleared on day advance
  const candidatePool = new Map<string, CandidateListing>();
  // roleId → candidateId[] for that role's current pool
  const rolePool = new Map<string, string[]>();

  let currentDay = 1;

  bus.subscribe('clock:day_started', ({ day }) => {
    currentDay = day;
    candidatePool.clear();
    rolePool.clear();
  });

  bus.subscribe('staff:quit', ({ staffId }) => {
    const idx = roster.findIndex((s) => s.id === staffId);
    if (idx !== -1) roster.splice(idx, 1);
  });

  function hiringCostFor(roleId: string): number {
    const role = taxonomy.roles[roleId];
    if (!role) throw new StaffOrgError(`Unknown role "${roleId}"`);
    return config.hiringCostByTier[role.tier] ?? 1000;
  }

  function buildCandidatesForRole(roleId: string): void {
    const matchingArchetypeIds = Object.entries(archetypes)
      .filter(([, a]) => a.role_id === roleId)
      .map(([id]) => id);

    if (matchingArchetypeIds.length === 0) {
      throw new StaffOrgError(`No archetypes defined for role "${roleId}"`);
    }

    const cost = hiringCostFor(roleId);
    const ids: string[] = [];

    for (let slot = 0; slot < config.candidatesPerRole; slot++) {
      const archetypeId =
        matchingArchetypeIds[slot % matchingArchetypeIds.length];
      const candidateId = `candidate:${roleId}:${currentDay}:${slot}`;

      const staff = createStaff(
        { archetypeId, hireDay: currentDay, slot },
        { masterSeed, taxonomy, archetypes },
      );

      const listing: CandidateListing = { candidateId, archetypeId, staff, hiringCost: cost };
      candidatePool.set(candidateId, listing);
      ids.push(candidateId);
    }

    rolePool.set(roleId, ids);
  }

  return {
    get currentRoster(): readonly StaffWithComposites[] {
      return roster;
    },

    getCandidates(roleId: string): readonly CandidateListing[] {
      const role = taxonomy.roles[roleId];
      if (!role) throw new StaffOrgError(`Unknown role "${roleId}"`);
      if (role.hireTier !== undefined && getTier !== undefined) {
        const current = getTier();
        if (current < role.hireTier) {
          throw new StaffOrgError(
            `Role "${roleId}" requires dealership tier ${role.hireTier} (current: ${current})`,
          );
        }
      }
      if (!rolePool.has(roleId)) {
        buildCandidatesForRole(roleId);
      }
      return (rolePool.get(roleId) ?? []).map((id) => candidatePool.get(id)!);
    },

    hire(candidateId: string): void {
      const listing = candidatePool.get(candidateId);
      if (!listing) {
        throw new StaffOrgError(`Unknown candidate "${candidateId}"`);
      }

      economy.postExpense(listing.hiringCost, `Hiring — ${listing.staff.role_id}`);

      roster.push(listing.staff);
      candidatePool.delete(candidateId);

      const roleIds = rolePool.get(listing.staff.role_id);
      if (roleIds) {
        const idx = roleIds.indexOf(candidateId);
        if (idx !== -1) roleIds.splice(idx, 1);
      }

      bus.publish('staff:hired', {
        staffId: listing.staff.id,
        roleId: listing.staff.role_id,
        day: currentDay,
        hiringCost: listing.hiringCost,
      });
    },

    fire(staffId: string): void {
      const idx = roster.findIndex((s) => s.id === staffId);
      if (idx === -1) {
        throw new StaffOrgError(`Staff member "${staffId}" not on roster`);
      }
      const [fired] = roster.splice(idx, 1);
      bus.publish('staff:fired', {
        staffId: fired.id,
        roleId: fired.role_id,
        day: currentDay,
      });
    },
  };
}
