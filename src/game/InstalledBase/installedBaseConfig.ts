import { z } from 'zod';
import { parseData } from '../data/loadJson';

// InstalledBase tunables (#298). `loyaltySeedScale` maps a deal's
// satisfaction-at-sale `retentionSeed` ∈ [0,1] onto an owner's initial loyalty
// (`loyalty = clamp01(retentionSeed × loyaltySeedScale)`). Ships at 1.0
// (identity); the S14 balance pass (#286) tunes how strongly a good sale seeds
// future retention without touching code.
// Not `.strict()`: the JSON carries a `_doc` annotation that Zod strips.
const InstalledBaseConfigSchema = z.object({
  loyaltySeedScale: z.number().nonnegative(),
});

export type InstalledBaseConfig = z.infer<typeof InstalledBaseConfigSchema>;

export function loadInstalledBaseConfig(): InstalledBaseConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { installedBase: unknown })
    .installedBase;
  return parseData(
    raw,
    InstalledBaseConfigSchema,
    'data/tunables.json#installedBase',
  );
}
