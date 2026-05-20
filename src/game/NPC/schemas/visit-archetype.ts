import { z } from 'zod';

const DistributionSchema = z
  .object({
    mu: z.number(),
    sigma: z.number().min(0),
  })
  .strict();

const SPACEDDistSchema = z
  .object({
    safety: DistributionSchema,
    performance: DistributionSchema,
    appearance: DistributionSchema,
    comfort: DistributionSchema,
    economy: DistributionSchema,
    dependability: DistributionSchema,
  })
  .strict();

const PSQTCDistSchema = z
  .object({
    price: DistributionSchema,
    speed: DistributionSchema,
    quality: DistributionSchema,
    trust_in_shop: DistributionSchema,
    convenience: DistributionSchema,
  })
  .strict();

const VisitResourcesDistSchema = z
  .object({
    trust: DistributionSchema,
    patience: DistributionSchema,
  })
  .strict();

const SalesPaymentSchema = z
  .object({
    cashProbability: z.number().min(0).max(1),
    cashSpendFraction: DistributionSchema,
    downPaymentBehavior: DistributionSchema,
  })
  .strict();

export const SalesVisitArchetypeSchema = z
  .object({
    kind: z.literal('sales'),
    preferences: SPACEDDistSchema,
    resources: VisitResourcesDistSchema,
    payment: SalesPaymentSchema,
  })
  .strict();

export const ServiceVisitArchetypeSchema = z
  .object({
    kind: z.literal('service'),
    preferences: PSQTCDistSchema,
    resources: VisitResourcesDistSchema,
  })
  .strict();

export const BodyVisitArchetypeSchema = z
  .object({
    kind: z.literal('body'),
    preferences: PSQTCDistSchema,
    resources: VisitResourcesDistSchema,
  })
  .strict();

export const VisitArchetypeSchema = z.discriminatedUnion('kind', [
  SalesVisitArchetypeSchema,
  ServiceVisitArchetypeSchema,
  BodyVisitArchetypeSchema,
]);

export const VisitArchetypeCatalogSchema = z.record(
  z.string().min(1),
  VisitArchetypeSchema,
);

export type SalesVisitArchetype = z.infer<typeof SalesVisitArchetypeSchema>;
export type ServiceVisitArchetype = z.infer<typeof ServiceVisitArchetypeSchema>;
export type BodyVisitArchetype = z.infer<typeof BodyVisitArchetypeSchema>;
export type VisitArchetype = z.infer<typeof VisitArchetypeSchema>;
export type VisitArchetypeCatalog = z.infer<typeof VisitArchetypeCatalogSchema>;
