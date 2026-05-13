import { parseData } from '../data';
import { TraitSetSchema } from './schemas/trait';
import type { TraitSet } from './schemas/trait';

export function loadTraitTaxonomy(): TraitSet {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/npc-traits.json');
  return parseData(raw, TraitSetSchema, 'data/npc-traits.json');
}
