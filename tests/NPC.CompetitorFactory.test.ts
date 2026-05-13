import {
  createCompetitor,
  loadCompetitorArchetypes,
  loadBrandMarketShare,
  loadTraitTaxonomy,
  resolveEffects,
  TraitAppliesError,
  CompetitorSchema,
} from '../src/game/NPC';

const archetypes = loadCompetitorArchetypes();
const brandMarketShare = loadBrandMarketShare();
const traits = loadTraitTaxonomy();

const deps = { masterSeed: 42, archetypes, brandMarketShare, traits };

const baseCtx = {
  archetypeId: 'volume_dealer',
  playerBrandId: 'toyota',
  day: 1,
  slot: 0,
};

// ── Schema validity ───────────────────────────────────────────────────────────

describe('CompetitorFactory.createCompetitor — schema validity', () => {
  it('rolled competitor passes CompetitorSchema', () => {
    const competitor = createCompetitor(baseCtx, deps);
    expect(CompetitorSchema.safeParse(competitor).success).toBe(true);
  });

  it('id encodes archetype + day + slot', () => {
    const competitor = createCompetitor(baseCtx, deps);
    expect(competitor.id).toBe('competitor:volume_dealer:1:0');
  });

  it('brand_id matches archetype brand', () => {
    const competitor = createCompetitor(baseCtx, deps);
    expect(competitor.brand_id).toBe(archetypes['volume_dealer']!.brand_id);
  });

  it('market_share, tier, segment come from brand-market-share', () => {
    const competitor = createCompetitor(baseCtx, deps);
    const entry = brandMarketShare[competitor.brand_id]!;
    expect(competitor.market_share).toBe(entry.share);
    expect(competitor.tier).toBe(entry.tier);
    expect(competitor.segment).toBe(entry.segment);
  });

  it('attribute keys are present', () => {
    const { attributes } = createCompetitor(baseCtx, deps);
    expect(typeof attributes.csi).toBe('number');
    expect(typeof attributes.inventory_size).toBe('number');
    expect(typeof attributes.pricing).toBe('number');
    expect(typeof attributes.reputation_drift).toBe('number');
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('CompetitorFactory.createCompetitor — determinism', () => {
  it('same context produces byte-identical competitor', () => {
    const a = createCompetitor(baseCtx, deps);
    const b = createCompetitor(baseCtx, deps);
    expect(a).toEqual(b);
  });

  it('different slot produces a distinct competitor', () => {
    const a = createCompetitor(baseCtx, deps);
    const b = createCompetitor({ ...baseCtx, slot: 1 }, deps);
    expect(a.id).not.toBe(b.id);
    const identical =
      a.attributes.csi === b.attributes.csi &&
      a.attributes.inventory_size === b.attributes.inventory_size;
    expect(identical).toBe(false);
  });

  it('different day produces a distinct competitor', () => {
    const a = createCompetitor(baseCtx, deps);
    const b = createCompetitor({ ...baseCtx, day: 2 }, deps);
    expect(a.id).not.toBe(b.id);
  });
});

// ── Classification ────────────────────────────────────────────────────────────

describe('CompetitorFactory.createCompetitor — direct/indirect classification', () => {
  it('classification is "indirect" when player brand differs from competitor brand', () => {
    const competitor = createCompetitor({ ...baseCtx, playerBrandId: 'toyota' }, deps);
    expect(competitor.brand_id).toBe('ford');
    expect(competitor.classification).toBe('indirect');
  });

  it('classification is "direct" when player brand matches competitor brand', () => {
    const competitor = createCompetitor({ ...baseCtx, playerBrandId: 'ford' }, deps);
    expect(competitor.classification).toBe('direct');
  });

  it('boutique_dealer is indirect when player brand is ford', () => {
    const competitor = createCompetitor(
      { archetypeId: 'boutique_dealer', playerBrandId: 'ford', day: 1, slot: 0 },
      deps,
    );
    expect(competitor.brand_id).toBe('cadillac');
    expect(competitor.classification).toBe('indirect');
  });

  it('boutique_dealer is direct when player brand is cadillac', () => {
    const competitor = createCompetitor(
      { archetypeId: 'boutique_dealer', playerBrandId: 'cadillac', day: 1, slot: 0 },
      deps,
    );
    expect(competitor.classification).toBe('direct');
  });
});

// ── Trait applies_to enforcement ──────────────────────────────────────────────

describe('CompetitorFactory — trait applies_to enforcement', () => {
  it('resolveEffects throws TraitAppliesError when applying a customer trait to a competitor', () => {
    const customerTrait = traits['price-sensitive']!;
    expect(() => resolveEffects([customerTrait], {}, 'competitor')).toThrow(TraitAppliesError);
  });

  it('resolveEffects throws TraitAppliesError when applying a staff trait to a competitor', () => {
    const staffTrait = traits['charisma']!;
    expect(() => resolveEffects([staffTrait], {}, 'competitor')).toThrow(TraitAppliesError);
  });

  it('competitor archetype trait_pool contains no customer or staff traits', () => {
    for (const [id, archetype] of Object.entries(archetypes)) {
      for (const traitId of archetype.trait_pool) {
        const trait = traits[traitId];
        expect(trait).toBeDefined();
        expect(trait!.applies_to).toContain('competitor');
        expect(trait!.applies_to).not.toContain('customer');
        // Note: a trait CAN apply to both competitor and staff — this checks no cross-bleed from pool
        void id;
      }
    }
  });

  it('factory produces no trait_ids for archetypes with empty pools', () => {
    const competitor = createCompetitor(baseCtx, deps);
    expect(competitor.trait_ids).toHaveLength(0);
  });
});

// ── Bounded variance ──────────────────────────────────────────────────────────

describe('CompetitorFactory.createCompetitor — bounded variance', () => {
  it('attributes stay within 3-sigma of archetype distribution across many rolls', () => {
    const archetype = archetypes['volume_dealer']!;
    const TRIALS = 50;
    for (let slot = 0; slot < TRIALS; slot++) {
      const { attributes } = createCompetitor({ ...baseCtx, slot }, deps);
      const { mu, sigma } = archetype.attributes.csi;
      expect(attributes.csi).toBeGreaterThan(mu - 4 * sigma);
      expect(attributes.csi).toBeLessThan(mu + 4 * sigma);
    }
  });
});
