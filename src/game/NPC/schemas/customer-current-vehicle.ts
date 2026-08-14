import { z } from 'zod';

const DistSchema = z
  .object({ mu: z.number(), sigma: z.number().min(0) })
  .strict();

const VehicleCategorySchema = z.enum(['sedan', 'truck', 'suv']);
const VehicleConditionSchema = z.enum(['clean', 'average', 'rough']);

/** A per-credit-tier (A best → D sub-prime) distribution. */
const TierKeyedDistSchema = z
  .object({ A: DistSchema, B: DistSchema, C: DistSchema, D: DistSchema })
  .strict();

/** A per-credit-tier integer (term in months). */
const TierKeyedIntSchema = z
  .object({
    A: z.number().int().positive(),
    B: z.number().int().positive(),
    C: z.number().int().positive(),
    D: z.number().int().positive(),
  })
  .strict();

/** A per-credit-tier rate (annual APR fraction). */
const TierKeyedRateSchema = z
  .object({
    A: z.number().min(0),
    B: z.number().min(0),
    C: z.number().min(0),
    D: z.number().min(0),
  })
  .strict();

const TemplateDefSchema = z
  .object({
    /**
     * Opaque canonical brand id (join key); never a display string.
     *
     * A template declares no brand NAME (#246) — the display name is the
     * brand's `label` from `data/brands.json`, resolved when the car is
     * generated, so a brand is named in exactly one place.
     */
    brand: z.string().min(1),
    model: z.string().min(1),
    category: VehicleCategorySchema,
  })
  .strict();

const ConditionWeightsSchema = z
  .object({
    clean: z.number().nonnegative(),
    average: z.number().nonnegative(),
    rough: z.number().nonnegative(),
  })
  .strict();

const CategoryWeightsSchema = z
  .object({
    sedan: z.number().nonnegative(),
    truck: z.number().nonnegative(),
    suv: z.number().nonnegative(),
  })
  .strict();

const TemplatePoolSchema = z
  .object({
    sedan: z.array(z.string().min(1)).min(1),
    truck: z.array(z.string().min(1)).min(1),
    suv: z.array(z.string().min(1)).min(1),
  })
  .strict();

const ArchetypeProfileSchema = z
  .object({
    categoryWeights: CategoryWeightsSchema,
    templatePool: TemplatePoolSchema,
    ageOffset: DistSchema,
    mileageMultiplier: DistSchema,
    conditionWeights: ConditionWeightsSchema,
    financeProbability: z.number().min(0).max(1),
  })
  .strict();

/**
 * Loan-payoff generation model (#282). Replaces the old per-archetype
 * absolute-dollar `payoffByTier` draw — which produced payoffs disconnected
 * from the car's value (the "$5k car / $35k payoff" absurdity). The payoff is
 * now derived *relative to the trade's current book value*:
 *
 *   payoff = currentBook × (ltvAtOrigination × remainingPrincipalFraction
 *                           ÷ depreciationOverLoanAge)
 *
 * Sub-prime tiers borrow more of the (higher) original value, stretch the term,
 * and pay a higher APR (slower principal paydown) — so they carry larger
 * payoffs *for the same car*. The vehicle-cost signal that the old per-archetype
 * table encoded now flows naturally through the book value (a luxury trade books
 * higher), so this block is tier-keyed, not archetype-keyed.
 */
const FinancingConfigSchema = z
  .object({
    _doc: z.string().optional(),
    /** Loan-to-value at origination, per credit tier (sub-prime borrows more). */
    ltvAtOrigination: TierKeyedDistSchema,
    /** Clamp applied to each sampled origination LTV `[lo, hi]`. */
    ltvClamp: z.tuple([z.number().positive(), z.number().positive()]),
    /** Loan term in months, per credit tier (sub-prime stretches longer). */
    termMonths: TierKeyedIntSchema,
    /** Annual APR fraction, per credit tier (sub-prime pays more → slower paydown). */
    aprAnnual: TierKeyedRateSchema,
    /**
     * Annual depreciation rate used to un-depreciate the current book back to
     * the value at origination (`book ÷ (1−rate)^loanAgeYears`).
     */
    annualDepreciation: z.number().min(0).max(1),
    /**
     * Tail weight (calibration S14): the share of trades drawn from the "fresh"
     * region of the loan term — early, high-balance loans where negative equity
     * concentrates. Higher = fatter deep-underwater tail.
     */
    deepTailWeight: z.number().min(0).max(1),
    /**
     * Fraction of the loan term that counts as "fresh". Fresh draws land in
     * `[0, freshCutoff]·term`; seasoned draws in `[freshCutoff, 1]·term`.
     */
    freshCutoff: z.number().min(0).max(1),
    /** Safety clamp on the final payoff/current-book ratio `[lo, hi]` (caps absurd liens). */
    ratioClamp: z.tuple([z.number().min(0), z.number().positive()]),
  })
  .strict();

export type FinancingConfig = z.infer<typeof FinancingConfigSchema>;

export const CustomerCurrentVehicleConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    referenceYear: z.number().int(),
    yearBounds: z.tuple([z.number().int(), z.number().int()]),
    mileagePerYear: z.number().positive(),
    financing: FinancingConfigSchema,
    templates: z.record(z.string().min(1), TemplateDefSchema),
    archetypes: z.record(z.string().min(1), ArchetypeProfileSchema),
  })
  .strict();

export type CustomerCurrentVehicleConfig = z.infer<
  typeof CustomerCurrentVehicleConfigSchema
>;

// ── CurrentVehicle attached to Person ────────────────────────────────────────

export const CurrentVehicleSchema = z
  .object({
    templateId: z.string().min(1),
    /** Opaque canonical brand id (join key); never a display string. */
    brand: z.string().min(1),
    /** The brand's display name, resolved from the catalog at generation. */
    make: z.string().min(1),
    model: z.string().min(1),
    year: z.number().int(),
    mileage: z.number().int().nonnegative(),
    condition: VehicleConditionSchema,
    category: VehicleCategorySchema,
    /** Outstanding loan balance for financed owners; null for cash-owners. */
    loanPayoff: z.number().nonnegative().nullable(),
  })
  .strict();
export type CurrentVehicle = z.infer<typeof CurrentVehicleSchema>;
