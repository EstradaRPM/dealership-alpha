import { z } from 'zod';
import { parseData } from '../data';

const unit = z.number().min(0).max(1);

const SpacedVectorSchema = z
  .object({
    safety: unit,
    performance: unit,
    appearance: unit,
    comfort: unit,
    economy: unit,
    dependability: unit,
  })
  .strict();

const SpacedModifierSchema = z
  .object({
    safety: z.number().min(-1).max(1),
    performance: z.number().min(-1).max(1),
    appearance: z.number().min(-1).max(1),
    comfort: z.number().min(-1).max(1),
    economy: z.number().min(-1).max(1),
    dependability: z.number().min(-1).max(1),
  })
  .partial()
  .strict();

// Vehicle ATTRIBUTE axes (#231 S4) — the across-the-board physical traits honest
// weather nuance rides, complementing the 6 persona-SPACED axes: drivetrain/
// ground-clearance (`winterCapability`), convertible body (`openAir`), and fuel
// economy (`fuelEfficiency`). Stored with the same categoryBase + per-template
// override pattern so every template gets a coherent value with no per-model
// hand-maintenance. Unit-scaled like SPACED; weather leans (data) bias the match
// along these axes so the seasonal effect stays emergent (no per-model rules).
const AttributeVectorSchema = z
  .object({
    winterCapability: unit,
    openAir: unit,
    fuelEfficiency: unit,
  })
  .strict();

const AttributeOverrideSchema = AttributeVectorSchema.partial().strict();

export const GATES = ['GREET', 'QUALIFY', 'DEMO', 'NEGOTIATE'] as const;
const GateEnum = z.enum(GATES);

const MeterWeightsSchema = z
  .object({ trust: unit, value: unit })
  .strict();

export const SalesProcessConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    gates: z.array(GateEnum).nonempty(),
    rng: z
      .object({
        seedNamespace: z.string().min(1),
        jitterBand: unit,
      })
      .strict(),
    core: z
      .object({
        skillWeight: z.number().nonnegative(),
        fitWeight: z.number().nonnegative(),
        easeWeight: z.number().nonnegative(),
      })
      .strict()
      .refine(
        (c) => c.skillWeight + c.fitWeight + c.easeWeight > 0,
        { message: 'core weights must sum to a positive value' },
      ),
    meters: z.record(GateEnum, MeterWeightsSchema),
    walk: z
      .object({
        trustCollapseFloor: unit,
        patienceFloor: z.number(),
      })
      .strict(),
    nonnegotiables: z
      .object({
        // QUALIFY quality at or above this reveals the customer's
        // nonnegotiables; below it the DEMO pick is blind (PRD decision 5).
        qualifyRevealThreshold: unit,
        // A nonnegotiable axis is satisfied when the vehicle's SPACED value
        // is within this slack below the customer's required level.
        tolerance: unit,
      })
      .strict(),
    close: z
      .object({
        buyThreshold: unit,
        softThreshold: unit,
        trustFloor: unit,
      })
      .strict(),
    price: z
      .object({
        base: z.number(),
        valueGapWeight: z.number(),
        sensitivityWeight: z.number(),
        skillHoldWeight: z.number(),
        trustHoldWeight: z.number(),
        minGross: z.number().nonnegative(),
        overageAllowed: z.number().nonnegative(),
        /** Closing-skill boost to objectiveDeal for price-sensitive customers. */
        framingWeight: z.number().nonnegative(),
      })
      .strict(),
    calibration: z
      .object({
        positiveMin: unit,
        apatheticMin: unit,
        apatheticMax: unit,
        negativeDealMin: unit,
        negativeDealMax: unit,
      })
      .strict(),
  })
  .strict();

export type SalesProcessConfig = z.infer<typeof SalesProcessConfigSchema>;
export type Gate = z.infer<typeof GateEnum>;

export const VehicleSpacedConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    categoryBase: z.record(z.string().min(1), SpacedVectorSchema),
    templateOverrides: z.record(z.string().min(1), SpacedModifierSchema),
    yearModifier: z
      .object({
        referenceYear: z.number().int(),
        perYearDelta: SpacedModifierSchema,
        maxAbs: unit,
      })
      .strict(),
    // #231 S4: per-category attribute base + per-template overrides. Categories
    // here must cover the same set as `categoryBase` (the accessor throws on a
    // category with no attribute base, mirroring `vehicleSpaced`).
    attributeBase: z.record(z.string().min(1), AttributeVectorSchema),
    attributeOverrides: z.record(z.string().min(1), AttributeOverrideSchema),
  })
  .strict();

export type VehicleSpacedConfig = z.infer<typeof VehicleSpacedConfigSchema>;

export const BrandTiersConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    tiers: z.record(
      z.string().min(1),
      z.object({ modifier: SpacedModifierSchema }).strict(),
    ),
    // Keyed by opaque brand id (never a make display string). The join key for
    // vehicle → brand-tier resolution.
    brands: z.record(z.string().min(1), z.string().min(1)),
  })
  .strict()
  .refine(
    (cfg) => Object.values(cfg.brands).every((tier) => tier in cfg.tiers),
    { message: 'every brand must map to a defined tier' },
  );

export type BrandTiersConfig = z.infer<typeof BrandTiersConfigSchema>;

export const CustomerNonnegotiablesConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    axes: z.array(z.string().min(1)).length(6),
    nonnegotiableCountWeights: z.record(
      z.string().regex(/^[0-9]+$/),
      z.number().min(0),
    ),
    remainingAxisWantProbability: unit,
    visitArchetypeBias: z.record(
      z.string().min(1),
      z
        .object({
          nonnegotiableCountWeights: z
            .record(z.string().regex(/^[0-9]+$/), z.number().min(0))
            .optional(),
          remainingAxisWantProbability: unit.optional(),
        })
        .strict(),
    ),
  })
  .strict();

export type CustomerNonnegotiablesConfig = z.infer<
  typeof CustomerNonnegotiablesConfigSchema
>;

export function loadSalesProcessConfig(): SalesProcessConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/sales-process.json');
  return parseData(raw, SalesProcessConfigSchema, 'data/sales-process.json');
}

export function loadVehicleSpacedConfig(): VehicleSpacedConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/vehicle-spaced.json');
  return parseData(raw, VehicleSpacedConfigSchema, 'data/vehicle-spaced.json');
}

export function loadBrandTiersConfig(): BrandTiersConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/brand-tiers.json');
  return parseData(raw, BrandTiersConfigSchema, 'data/brand-tiers.json');
}

export function loadCustomerNonnegotiablesConfig(): CustomerNonnegotiablesConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/customer-nonnegotiables.json');
  return parseData(
    raw,
    CustomerNonnegotiablesConfigSchema,
    'data/customer-nonnegotiables.json',
  );
}
