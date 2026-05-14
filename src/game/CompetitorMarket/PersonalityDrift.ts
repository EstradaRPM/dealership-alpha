import { z } from 'zod';
import { parseData } from '../data';

const DriftSigmaSchema = z
  .object({ rep: z.number().min(0), inventory: z.number().min(0), pricing: z.number().min(0) })
  .strict();

const PersonalityDriftCatalogSchema = z.record(z.string().min(1), DriftSigmaSchema);

export type DriftSigma = z.infer<typeof DriftSigmaSchema>;
export type PersonalityDriftCatalog = z.infer<typeof PersonalityDriftCatalogSchema>;

export function loadPersonalityDrift(): PersonalityDriftCatalog {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/competitor-personality-drift.json');
  return parseData(raw, PersonalityDriftCatalogSchema, 'data/competitor-personality-drift.json');
}
