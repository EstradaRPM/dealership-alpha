import { z } from 'zod';

const ProbSchema = z.number().min(0).max(1);

const CreditTierProbsSchema = z
  .object({
    A: ProbSchema,
    B: ProbSchema,
    C: ProbSchema,
    D: ProbSchema,
  })
  .strict();

const ArchetypeProbsSchema = z
  .object({
    cash: CreditTierProbsSchema,
    finance: CreditTierProbsSchema,
  })
  .strict();

export const TradeIncidenceConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    archetypes: z.record(z.string().min(1), ArchetypeProbsSchema),
  })
  .strict();

export type TradeIncidenceConfig = z.infer<typeof TradeIncidenceConfigSchema>;
