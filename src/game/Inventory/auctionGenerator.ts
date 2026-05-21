import { createRng, deriveSeed } from '../NPC/Rng';
import {
  loadMileageDistributionConfig,
  type MileageDistributionConfig,
} from '../MarketEconomy';
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

function rollMileage(
  year: number,
  category: 'sedan' | 'truck' | 'suv',
  rng: () => number,
  dist: MileageDistributionConfig,
): number {
  const shape = dist.distributions[category];
  if (!shape) {
    throw new Error(`mileage-distribution: missing category "${category}"`);
  }
  const age = Math.max(1, dist.referenceYear - year + 1);
  // Symmetric uniform around mean*age; older cars get wider absolute spread
  // (the spread scales with age, so a 10-year-old truck varies more in
  // absolute miles than a 2-year-old one).
  const mean = shape.perYearMean * age;
  const spread = shape.perYearSpread * age;
  const draw = mean + spread * (rng() * 2 - 1);
  const clamped = Math.min(shape.ceiling, Math.max(shape.floor, draw));
  return Math.round(clamped / 500) * 500;
}

function buildListing(
  index: number,
  day: number,
  template: VehicleTemplate,
  condition: VehicleCondition,
  tier: ConditionTier,
  rng: () => number,
  mileageDist: MileageDistributionConfig,
): AuctionListing {
  const year = lerp(template.yearRange[0], template.yearRange[1], rng());
  const baseMileage = rollMileage(year, template.category, rng, mileageDist);
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
  mileageDist: MileageDistributionConfig = loadMileageDistributionConfig(),
): AuctionListing[] {
  const { templates, conditionTiers, auctionConfig } = data;
  const seed = deriveSeed(masterSeed, 'inventory.auction_listings', { day });
  const rng = createRng(seed);

  const { earlyGame } = auctionConfig;
  const useEarlyGame = earlyGame !== undefined && day <= earlyGame.throughDay;
  const minListings = useEarlyGame ? earlyGame!.minListings : auctionConfig.minListings;
  const maxListings = useEarlyGame ? earlyGame!.maxListings : auctionConfig.maxListings;
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
    listings.push(buildListing(i, day, template, condition, tier, rng, mileageDist));
  }

  return listings;
}

// Re-export for test use
export { CONDITIONS };
