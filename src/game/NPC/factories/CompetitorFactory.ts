import { createRng, deriveSeed, type SeedContext } from '../Rng';
import { resolveEffects } from '../Trait';
import { CompetitorSchema } from '../schemas/competitor';
import type { Competitor } from '../schemas/competitor';
import type { TraitSet } from '../schemas/trait';
import type { CompetitorArchetypeCatalog } from '../schemas/competitor-archetype';
import type { BrandMarketShareCatalog } from '../schemas/competitor-archetype';

export const COMPETITOR_FACTORY_NAMESPACE = 'npc.competitor.factory';

export interface CreateCompetitorContext extends SeedContext {
  archetypeId: string;
  playerBrandId: string;
  day: number;
  slot: number;
}

export interface CreateCompetitorDeps {
  masterSeed: number;
  archetypes: CompetitorArchetypeCatalog;
  brandMarketShare: BrandMarketShareCatalog;
  traits: TraitSet;
}

function gaussian(rng: () => number, mu: number, sigma: number): number {
  let u1 = rng();
  while (u1 === 0) u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + sigma * z;
}

function pickTraits(
  rng: () => number,
  pool: readonly string[],
  min: number,
  max: number,
): string[] {
  const count = min + Math.floor(rng() * (max - min + 1));
  const available = [...pool];
  const chosen: string[] = [];
  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(rng() * available.length);
    chosen.push(available[idx]);
    available.splice(idx, 1);
  }
  return chosen;
}

export function createCompetitor(ctx: CreateCompetitorContext, deps: CreateCompetitorDeps): Competitor {
  const { masterSeed, archetypes, brandMarketShare, traits } = deps;

  const archetype = archetypes[ctx.archetypeId];
  if (!archetype) throw new Error(`Unknown competitor archetype "${ctx.archetypeId}"`);

  const brandEntry = brandMarketShare[archetype.brand_id];
  if (!brandEntry) {
    throw new Error(`Archetype "${ctx.archetypeId}" references unknown brand "${archetype.brand_id}"`);
  }

  const seedFor = (sub: string): number =>
    deriveSeed(masterSeed, `${COMPETITOR_FACTORY_NAMESPACE}.${sub}`, ctx);

  const rngTraits = createRng(seedFor('traits'));
  const trait_ids = pickTraits(
    rngTraits,
    archetype.trait_pool,
    archetype.trait_count.min,
    archetype.trait_count.max,
  );

  const resolvedTraits = trait_ids.map((id) => {
    const t = traits[id];
    if (!t) throw new Error(`Unknown trait "${id}"`);
    return t;
  });

  const rollAttr = (sub: string, mu: number, sigma: number): number =>
    gaussian(createRng(seedFor(sub)), mu, sigma);

  const baseAttributes = {
    csi: rollAttr('attr.csi', archetype.attributes.csi.mu, archetype.attributes.csi.sigma),
    inventory_size: rollAttr('attr.inventory_size', archetype.attributes.inventory_size.mu, archetype.attributes.inventory_size.sigma),
    pricing: rollAttr('attr.pricing', archetype.attributes.pricing.mu, archetype.attributes.pricing.sigma),
    reputation_drift: rollAttr('attr.reputation_drift', archetype.attributes.reputation_drift.mu, archetype.attributes.reputation_drift.sigma),
  };

  const effects = resolveEffects(resolvedTraits, {}, 'competitor');

  const attributes = {
    csi: baseAttributes.csi + (effects['competitor.csi'] ?? 0),
    inventory_size: baseAttributes.inventory_size + (effects['competitor.inventory_size'] ?? 0),
    pricing: baseAttributes.pricing + (effects['competitor.pricing'] ?? 0),
    reputation_drift: baseAttributes.reputation_drift + (effects['competitor.reputation_drift'] ?? 0),
  };

  const classification = archetype.brand_id === ctx.playerBrandId ? 'direct' : 'indirect';

  return CompetitorSchema.parse({
    id: `competitor:${ctx.archetypeId}:${ctx.day}:${ctx.slot}`,
    archetype_id: ctx.archetypeId,
    brand_id: archetype.brand_id,
    classification,
    trait_ids,
    attributes,
    market_share: brandEntry.share,
    tier: brandEntry.tier,
    segment: brandEntry.segment,
  });
}
