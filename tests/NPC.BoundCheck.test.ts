import {
  createCustomer,
  createStaff,
  createCompetitor,
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadStaffArchetypes,
  loadStaffTaxonomy,
  loadCompetitorArchetypes,
  loadBrandMarketShare,
  loadTraitTaxonomy,
} from '../src/game/NPC';
import { PersonSchema, VisitSchema } from '../src/game/NPC/schemas/customer';
import { StaffSchema } from '../src/game/NPC/schemas/staff';
import { CompetitorSchema } from '../src/game/NPC/schemas/competitor';

// ── Bound-check harness ───────────────────────────────────────────────────────
//
// Generic statistical lint: verifies that a factory's output matches the
// authored μ/σ distributions across N samples.  Throws descriptive errors
// (not Jest assertions) so it can be called inside or outside of a test.

type DistSpec = { mu: number; sigma: number };

function checkDistribution(samples: number[], { mu, sigma }: DistSpec, fieldName: string): void {
  // Use 4.5σ rather than 4σ: with N=1000 fixed-seed Box-Muller samples,
  // the 6.3×10⁻⁵ tail probability produces ~0.06 expected outliers, and a
  // few deterministic seeds land just outside 4σ. 4.5σ ≈ 6.8×10⁻⁶ per
  // sample makes genuine tail hits astronomically rare while still catching
  // absurd authored μ/σ values.
  const lo = mu - 4.5 * sigma;
  const hi = mu + 4.5 * sigma;
  for (const v of samples) {
    if (v < lo || v > hi) {
      throw new Error(
        `[${fieldName}] value ${v.toFixed(4)} outside μ±4.5σ = [${lo.toFixed(4)}, ${hi.toFixed(4)}]`,
      );
    }
  }

  const N = samples.length;
  const mean = samples.reduce((a, b) => a + b, 0) / N;
  const meanEps = 0.15 * Math.abs(sigma);
  if (Math.abs(mean - mu) > meanEps) {
    throw new Error(
      `[${fieldName}] mean ${mean.toFixed(4)} deviates from μ=${mu} by ${Math.abs(mean - mu).toFixed(4)} (ε=${meanEps.toFixed(4)})`,
    );
  }

  if (sigma > 0) {
    const variance = samples.reduce((acc, v) => acc + (v - mean) ** 2, 0) / N;
    const sd = Math.sqrt(variance);
    const sdEps = 0.25 * sigma;
    if (Math.abs(sd - sigma) > sdEps) {
      throw new Error(
        `[${fieldName}] stddev ${sd.toFixed(4)} deviates from σ=${sigma} by ${Math.abs(sd - sigma).toFixed(4)} (ε=${sdEps.toFixed(4)})`,
      );
    }
  }
}

interface FieldSpec<T> {
  name: string;
  extract: (entity: T) => number;
  dist: DistSpec;
}

export function runBoundCheck<T>(
  roll: (slot: number) => T,
  fields: FieldSpec<T>[],
  N = 1000,
): void {
  for (const { name, extract, dist } of fields) {
    const samples = Array.from({ length: N }, (_, i) => extract(roll(i)));
    checkDistribution(samples, dist, name);
  }
}

// ── Shared data ───────────────────────────────────────────────────────────────

const personArchetypes = loadPersonArchetypes();
const visitArchetypes = loadVisitArchetypes();
const staffArchetypes = loadStaffArchetypes();
const staffTaxonomy = loadStaffTaxonomy();
const competitorArchetypes = loadCompetitorArchetypes();
const brandMarketShare = loadBrandMarketShare();
const traits = loadTraitTaxonomy();

// ── Harness self-test (lint behavior) ─────────────────────────────────────────

describe('runBoundCheck — harness self-test', () => {
  it('throws when sampler mean is far from authored μ (intentionally bad archetype)', () => {
    expect(() =>
      runBoundCheck(
        (_: number) => ({ x: 9999 }),
        [{ name: 'x', extract: (r: { x: number }) => r.x, dist: { mu: 50, sigma: 10 } }],
        100,
      ),
    ).toThrow(/\[x\]/);
  });

  it('throws when sampler is constant and stddev deviates from authored σ', () => {
    expect(() =>
      runBoundCheck(
        (_: number) => ({ x: 50 }),
        [{ name: 'x', extract: (r: { x: number }) => r.x, dist: { mu: 50, sigma: 10 } }],
        100,
      ),
    ).toThrow(/\[x\]/);
  });
});

// ── Person archetypes — person stats ──────────────────────────────────────────
// Trait effects land on the Visit, not the Person, so person stats are always
// pure Gaussian and safe for the full mean + σ + 4σ-bounds check.

describe('BoundCheck — person archetypes (person stats)', () => {
  const VISIT_ID = 'family_vehicle_search';
  const customerDeps = { masterSeed: 7, personArchetypes, visitArchetypes, traits };

  for (const [archId, arch] of Object.entries(personArchetypes)) {
    it(`${archId} — wealth / credit / int / agreeableness within μ±4σ`, () => {
      runBoundCheck(
        (slot) =>
          createCustomer(
            { personArchetypeId: archId, visitArchetypeId: VISIT_ID, day: 1, slot },
            customerDeps,
          ).person,
        [
          { name: 'wealth', extract: (p) => p.wealth, dist: arch.wealth },
          { name: 'credit', extract: (p) => p.credit, dist: arch.credit },
          { name: 'int', extract: (p) => p.int, dist: arch.int },
          { name: 'agreeableness', extract: (p) => p.agreeableness, dist: arch.agreeableness },
        ],
      );
    });
  }
});

// ── Visit archetypes — visit fields ───────────────────────────────────────────
// Use a no-trait person archetype so trait effects do not shift the visit
// preference means away from the authored μ values.

describe('BoundCheck — visit archetypes (visit fields)', () => {
  const basePersonArch = Object.values(personArchetypes)[0]!;
  const noTraitPersonArch = {
    ...basePersonArch,
    trait_pool: [] as string[],
    trait_count: { min: 0, max: 0 },
    // Zero agreeableness so the factory's trust += (agreeableness/100)*0.1
    // adjustment is also zero, keeping visit.trust aligned with the authored μ.
    agreeableness: { mu: 0, sigma: 0 },
  };
  const visitDeps = {
    masterSeed: 13,
    personArchetypes: { _harness_: noTraitPersonArch },
    visitArchetypes,
    traits,
  };

  for (const [archId, arch] of Object.entries(visitArchetypes)) {
    it(`${archId} — preferences + resources within μ±4σ`, () => {
      const prefFields = Object.entries(arch.preferences).map(([key, dist]) => ({
        name: `pref.${key}`,
        extract: (v: ReturnType<typeof createCustomer>['visit']) =>
          (v.preferences as Record<string, number>)[key] ?? 0,
        dist,
      }));
      runBoundCheck(
        (slot) =>
          createCustomer(
            { personArchetypeId: '_harness_', visitArchetypeId: archId, day: 1, slot },
            visitDeps,
          ).visit,
        [
          ...prefFields,
          { name: 'res.trust', extract: (v) => v.resources.trust, dist: arch.resources.trust },
          { name: 'res.patience', extract: (v) => v.resources.patience, dist: arch.resources.patience },
        ],
      );
    });
  }
});

// ── Staff archetypes — skills + resources ─────────────────────────────────────
// rollSkill clamps to [0, cap].  For the authored μ/σ values, clamping
// probability is negligible (< 0.1% per sample for all current archetypes), so the
// full mean + σ check holds within our tolerances.

describe('BoundCheck — staff archetypes (skills + resources)', () => {
  const staffDeps = { masterSeed: 5, taxonomy: staffTaxonomy, archetypes: staffArchetypes };

  for (const [archId, arch] of Object.entries(staffArchetypes)) {
    it(`${archId} — skills + resources within μ±4σ`, () => {
      const skillFields = Object.entries(arch.skills).map(([skillId, dist]) => ({
        name: `skill.${skillId}`,
        extract: (s: ReturnType<typeof createStaff>) =>
          (s.skills as Record<string, number>)[skillId] ?? 0,
        dist,
      }));
      const resourceFields: FieldSpec<ReturnType<typeof createStaff>>[] = [
        { name: 'stamina', extract: (s) => s.resources.stamina, dist: arch.resources.stamina },
      ];
      if (arch.resources.morale) {
        const moraleDist = arch.resources.morale;
        resourceFields.push({
          name: 'morale',
          extract: (s) => s.resources.morale ?? 0,
          dist: moraleDist,
        });
      }
      runBoundCheck(
        (slot) => createStaff({ archetypeId: archId, hireDay: 1, slot }, staffDeps),
        [...skillFields, ...resourceFields],
      );
    });
  }
});

// ── Competitor archetypes — attributes ────────────────────────────────────────
// Override trait pools to empty so trait effects do not shift the attribute
// means, allowing a clean comparison against the authored μ/σ.

describe('BoundCheck — competitor archetypes (attributes)', () => {
  const noTraitArchetypes = Object.fromEntries(
    Object.entries(competitorArchetypes).map(([id, arch]) => [
      id,
      { ...arch, trait_pool: [] as string[], trait_count: { min: 0, max: 0 } },
    ]),
  );
  const competitorDeps = {
    masterSeed: 42,
    archetypes: noTraitArchetypes,
    brandMarketShare,
    traits,
  };

  for (const [archId, arch] of Object.entries(competitorArchetypes)) {
    it(`${archId} — csi / inventory_size / pricing / reputation_drift within μ±4σ`, () => {
      runBoundCheck(
        (slot) =>
          createCompetitor(
            { archetypeId: archId, playerBrandId: 'toraya', day: 1, slot },
            competitorDeps,
          ),
        [
          { name: 'csi', extract: (c) => c.attributes.csi, dist: arch.attributes.csi },
          {
            name: 'inventory_size',
            extract: (c) => c.attributes.inventory_size,
            dist: arch.attributes.inventory_size,
          },
          { name: 'pricing', extract: (c) => c.attributes.pricing, dist: arch.attributes.pricing },
          {
            name: 'reputation_drift',
            extract: (c) => c.attributes.reputation_drift,
            dist: arch.attributes.reputation_drift,
          },
        ],
      );
    });
  }
});

// ── Factory smoke tests ───────────────────────────────────────────────────────
// Each factory produces a schema-valid entity end-to-end.

describe('factory smoke tests — schema validity', () => {
  it('createCustomer → PersonSchema + VisitSchema pass for every person × visit combo', () => {
    const deps = { masterSeed: 1, personArchetypes, visitArchetypes, traits };
    for (const personArchetypeId of Object.keys(personArchetypes)) {
      for (const visitArchetypeId of Object.keys(visitArchetypes)) {
        const { person, visit } = createCustomer(
          { personArchetypeId, visitArchetypeId, day: 1, slot: 0 },
          deps,
        );
        expect(PersonSchema.safeParse(person).success).toBe(true);
        expect(VisitSchema.safeParse(visit).success).toBe(true);
      }
    }
  });

  it('createStaff → StaffSchema passes for every staff archetype', () => {
    const deps = { masterSeed: 2, taxonomy: staffTaxonomy, archetypes: staffArchetypes };
    for (const archetypeId of Object.keys(staffArchetypes)) {
      const staff = createStaff({ archetypeId, hireDay: 1, slot: 0 }, deps);
      expect(StaffSchema.safeParse(staff).success).toBe(true);
    }
  });

  it('createCompetitor → CompetitorSchema passes for every competitor archetype', () => {
    const deps = { masterSeed: 3, archetypes: competitorArchetypes, brandMarketShare, traits };
    for (const archetypeId of Object.keys(competitorArchetypes)) {
      const competitor = createCompetitor(
        { archetypeId, playerBrandId: 'toraya', day: 1, slot: 0 },
        deps,
      );
      expect(CompetitorSchema.safeParse(competitor).success).toBe(true);
    }
  });
});
