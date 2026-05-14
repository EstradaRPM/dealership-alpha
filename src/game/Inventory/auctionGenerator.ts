import { createRng, deriveSeed } from '../NPC/Rng';
import type { VehicleData, VehicleTemplate, ConditionTier } from './vehicleData';
import type { AuctionListing, VehicleCondition } from './types';

const CONDITIONS: VehicleCondition[] = ['clean', 'average', 'rough'];

function pickCondition(rng: () => number): VehicleCondition {
  // weight: 30% clean, 45% average, 25% rough — matches realistic auction distribution
  const roll = rng();
  if (roll < 0.30) return 'clean';
  if (roll < 0.75) return 'average';
  return 'rough';
}

function lerp(min: number, max: number, t: number): number {
  return Math.round(min + (max - min) * t);
}

function buildListing(
  index: number,
  day: number,
  template: VehicleTemplate,
  condition: VehicleCondition,
  tier: ConditionTier,
  rng: () => number,
): AuctionListing {
  const year = lerp(template.yearRange[0], template.yearRange[1], rng());
  const baseMileage = lerp(template.mileageRange[0], template.mileageRange[1], rng());
  const basePrice = lerp(template.basePriceRange[0], template.basePriceRange[1], rng());
  const askingPrice = Math.round(basePrice * tier.priceMultiplier / 100) * 100;

  return {
    id: `auction-day${day}-${index}-${template.id}`,
    templateId: template.id,
    year,
    make: template.make,
    model: template.model,
    trim: template.trim,
    mileage: baseMileage,
    condition,
    conditionReport: tier.report,
    askingPrice,
    reconCost: tier.reconCost,
    category: template.category,
  };
}

export function generateAuctionListings(
  day: number,
  masterSeed: number,
  data: VehicleData,
): AuctionListing[] {
  const { templates, conditionTiers, auctionConfig } = data;
  const seed = deriveSeed(masterSeed, 'inventory.auction_listings', { day });
  const rng = createRng(seed);

  const { minListings, maxListings } = auctionConfig;
  const count = minListings + Math.floor(rng() * (maxListings - minListings + 1));

  const listings: AuctionListing[] = [];
  const usedTemplates = new Set<string>();

  for (let i = 0; i < count; i++) {
    let template: VehicleTemplate;
    // avoid picking same template twice when pool is large enough
    let attempts = 0;
    do {
      template = templates[Math.floor(rng() * templates.length)];
      attempts++;
    } while (usedTemplates.has(template.id) && attempts < 10);
    usedTemplates.add(template.id);

    const condition = pickCondition(rng);
    const tier = conditionTiers[condition];
    listings.push(buildListing(i, day, template, condition, tier, rng));
  }

  return listings;
}

// Re-export for test use
export { CONDITIONS };
