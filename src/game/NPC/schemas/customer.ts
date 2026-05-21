import { z } from 'zod';
import { CurrentVehicleSchema } from './customer-current-vehicle';
export type { CurrentVehicle } from './customer-current-vehicle';

// ── Preference vectors ────────────────────────────────────────────────────────

export const SPACEDVectorSchema = z
  .object({
    safety: z.number(),
    performance: z.number(),
    appearance: z.number(),
    comfort: z.number(),
    economy: z.number(),
    dependability: z.number(),
  })
  .strict();
export type SPACEDVector = z.infer<typeof SPACEDVectorSchema>;

export const PSQTCVectorSchema = z
  .object({
    price: z.number(),
    speed: z.number(),
    quality: z.number(),
    trust_in_shop: z.number(),
    convenience: z.number(),
  })
  .strict();
export type PSQTCVector = z.infer<typeof PSQTCVectorSchema>;

// ── Person ────────────────────────────────────────────────────────────────────

export const PersonCountersSchema = z
  .object({
    prior_visits: z.number().int().min(0),
    prior_deals: z.number().int().min(0),
    days_since_last_visit: z.number().int().min(0),
  })
  .strict();
export type PersonCounters = z.infer<typeof PersonCountersSchema>;

export const PersonSchema = z
  .object({
    id: z.string().min(1),
    trait_ids: z.array(z.string().min(1)),
    wealth: z.number(),
    credit: z.number(),
    annualIncome: z.number().positive(),
    int: z.number(),
    agreeableness: z.number(),
    brand_affinity: z.record(z.string().min(1), z.number()),
    counters: PersonCountersSchema,
    /**
     * The car this person actually drove in on. Generated at pool entry
     * (slice #165) so the customer is a person with a real history rather
     * than a transaction. Trade-in slices (#166–#171) consume this directly.
     * Optional only for legacy fixtures predating #165.
     */
    currentVehicle: CurrentVehicleSchema.optional(),
  })
  .strict();
export type Person = z.infer<typeof PersonSchema>;

// ── Visit resources ───────────────────────────────────────────────────────────

export const VisitResourcesSchema = z
  .object({
    trust: z.number(),
    patience: z.number(),
  })
  .strict();
export type VisitResources = z.infer<typeof VisitResourcesSchema>;

// ── Visit (discriminated union) ───────────────────────────────────────────────

export const SalesVisitSchema = z
  .object({
    kind: z.literal('sales'),
    person_id: z.string().min(1),
    preferences: SPACEDVectorSchema,
    resources: VisitResourcesSchema,
    paymentMethod: z.enum(['cash', 'finance']),
    // Behavioral down-payment fraction the customer brings (finance only).
    // Clamped at roll time to [tier.minDownPct, 0.5]; cash customers omit it.
    downPaymentBehavior: z.number().min(0).max(0.5).optional(),
    /**
     * Whether this visit arrived with a trade. Rolled at visit creation from
     * the composite (archetype × paymentMethod × creditTier) incidence matrix
     * (#166). Optional only for legacy fixtures predating #166 — production
     * customers always carry it once `tradeIncidenceConfig` is wired through.
     */
    hasTrade: z.boolean().optional(),
  })
  .strict();
export type SalesVisit = z.infer<typeof SalesVisitSchema>;

export const ServiceVisitSchema = z
  .object({
    kind: z.literal('service'),
    person_id: z.string().min(1),
    preferences: PSQTCVectorSchema,
    resources: VisitResourcesSchema,
  })
  .strict();
export type ServiceVisit = z.infer<typeof ServiceVisitSchema>;

export const BodyVisitSchema = z
  .object({
    kind: z.literal('body'),
    person_id: z.string().min(1),
    preferences: PSQTCVectorSchema,
    resources: VisitResourcesSchema,
  })
  .strict();
export type BodyVisit = z.infer<typeof BodyVisitSchema>;

export const VisitSchema = z.discriminatedUnion('kind', [
  SalesVisitSchema,
  ServiceVisitSchema,
  BodyVisitSchema,
]);
export type Visit = z.infer<typeof VisitSchema>;
