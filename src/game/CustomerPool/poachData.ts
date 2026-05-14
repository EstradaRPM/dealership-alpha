import { z } from 'zod';
import { parseData } from '../data';

const PoachConfigSchema = z
  .object({
    shopAroundBaseRate: z.number().min(0).max(1),
    shopAroundHighRate: z.number().min(0).max(1),
    shopAroundTraitId: z.string().min(1),
  })
  .strict();

export type PoachConfig = z.infer<typeof PoachConfigSchema>;

export function loadPoachConfig(): PoachConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/poach-config.json');
  return parseData(raw, PoachConfigSchema, 'data/poach-config.json');
}
