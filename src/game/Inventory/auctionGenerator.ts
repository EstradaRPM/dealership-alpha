import { createRng, deriveSeed } from '../NPC/Rng';
import {
  loadMileageDistributionConfig,
  loadAuctionSourcesConfig,
  loadMotivatedSellerConfig,
  rollAuctionSourceReliability,
  sampleMotivatedSellerMultiplier,
  pickAuctionSource,
  computeAnchor,
  type MileageDistributionConfig,
  type AuctionSourcesConfig,
  type AuctionSourceReliability,
  type MotivatedSellerConfig,
  type AnchorDeps,
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
  const mean = shape.perYearMean * age;
  const spread = shape.perYearSpread * age;
  const draw = mean + spread * (rng() * 2 - 1);
  const clamped = Math.min(shape.ceiling, Math.max(shape.floor, draw));
  return Math.round(clamped / 500) * 500;
}

export interface AuctionGeneratorDeps {
  readonly mileageDist?: MileageDistributionConfig;
  readonly sources?: AuctionSourcesConfig;
  readonly sourceReliability?: AuctionSourceReliability;
  readonly motivatedSeller?: MotivatedSellerConfig;
  readonly anchorDeps?: AnchorDeps;
}

interface BuildListingArgs {
  readonly index: number;
  readonly day: number;
  readonly masterSeed: number;
  readonly template: VehicleTemplate;
  readonly condition: VehicleCondition;
  readonly tier: ConditionTier;
  readonly rng: () => number;
  readonly mileageDist: MileageDistributionConfig;
  readonly sources: AuctionSourcesConfig;
  readonly sourceReliability: AuctionSourceReliability;
  readonly motivatedSeller: MotivatedSellerConfig;
  readonly anchorDeps: AnchorDeps;
}

function buildListing(args: BuildListingArgs): AuctionListing {
  const {
    index, day, masterSeed, template, condition, tier, rng, mileageDist,
    sources, sourceReliability, motivatedSeller, anchorDeps,
  } = args;

  const year = lerp(template.yearRange[0], template.yearRange[1], rng());
  const baseMileage = rollMileage(year, template.category, rng, mileageDist);

  // Per-listing seed namespace (#160 AC): source pick + motivated-seller draw
  // route through their own seeds so source/multiplier remain stable across
  // unrelated changes to the day-level RNG sequence (template/year order, etc.).
  const sourcePick = pickAuctionSource(
    sources,
    createRng(
      deriveSeed(masterSeed, 'inventory.auction_source_pick', {
        day,
        index,
      }),
    ),
  );
  const reliability = sourceReliability.reliability[sourcePick.id] ?? 0.5;
  const mult = sampleMotivatedSellerMultiplier(
    reliability,
    deriveSeed(masterSeed, 'inventory.auction_motivated_seller', {
      day,
      index,
    }),
    motivatedSeller,
  );

  // listingPrice = bookValue × motivatedSellerMultiplier. bookValue here is
  // the engine's anchor (segment heat is unobserved at the auction — dealers
  // pay wholesale and ride heat as inventory). The condition-discount term
  // from the locked #182 formula is already baked into the anchor via
  // `conditionMod` (clean ↑, rough ↓). The legacy `tier.priceMultiplier` from
  // vehicles.json is unused by the new chain — kept in the data file for the
  // reconCost field other code reads.
  const anchorValue = computeAnchor(
    {
      templateId: template.id,
      make: template.make,
      year,
      mileage: baseMileage,
      category: template.category,
      condition,
    },
    anchorDeps,
  );
  const raw = anchorValue * mult;
  const askingPrice = Math.max(100, Math.round(raw / 100) * 100);

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
    sourceId: sourcePick.id,
    inspectionStatus: 'none',
  };
}

export function generateAuctionListings(
  day: number,
  masterSeed: number,
  data: VehicleData,
  deps: AuctionGeneratorDeps = {},
): AuctionListing[] {
  const { templates, conditionTiers, auctionConfig } = data;
  const mileageDist = deps.mileageDist ?? loadMileageDistributionConfig();
  const sources = deps.sources ?? loadAuctionSourcesConfig();
  const sourceReliability =
    deps.sourceReliability ?? rollAuctionSourceReliability(masterSeed, sources);
  const motivatedSeller = deps.motivatedSeller ?? loadMotivatedSellerConfig();
  const anchorDeps = deps.anchorDeps ?? {};

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
    let attempts = 0;
    do {
      template = templates[Math.floor(rng() * templates.length)];
      attempts++;
    } while (usedTemplates.has(template.id) && attempts < 10);
    usedTemplates.add(template.id);

    const condition = pickCondition(rng);
    const tier = conditionTiers[condition];
    listings.push(buildListing({
      index: i,
      day,
      masterSeed,
      template,
      condition,
      tier,
      rng,
      mileageDist,
      sources,
      sourceReliability,
      motivatedSeller,
      anchorDeps,
    }));
  }

  return listings;
}

export { CONDITIONS };
