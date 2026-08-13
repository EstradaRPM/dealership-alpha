import { z } from 'zod';
import { parseData } from '../data';
import type { BackstoryEntry, BackstoryId, Day1Modifier } from './types';

const BackstoryModifierSchema = z.object({
  reconJudgmentBonus: z.number().nonnegative(),
  startingCreditLine: z.number().nonnegative(),
  startingCapitalBonus: z.number().nonnegative(),
  grudgesFlag: z.boolean(),
});

const BackstoryEntrySchema = z.object({
  id: z.enum(['ex-mechanic', 'ex-banker', 'inheritor']),
  label: z.string().min(1),
  flavor: z.string().min(1),
  /**
   * What the pick MECHANICALLY does, in plain language (#390). Required, and a
   * sentence — the character-creation card reads it verbatim, so a backstory
   * whose levers changed without its description changing fails to load rather
   * than quietly telling the player something that is no longer true.
   */
  effect: z.string().min(1).regex(/[.!?]$/, 'effect must be a sentence'),
  modifier: BackstoryModifierSchema,
});

const BackstoryCatalogSchema = z.object({
  schemaVersion: z.literal(2),
  backstories: z.array(BackstoryEntrySchema).min(1),
});

let _catalog: BackstoryEntry[] | null = null;

export function loadBackstories(): BackstoryEntry[] {
  if (_catalog) return _catalog;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/backstories.json');
  const parsed = parseData(raw, BackstoryCatalogSchema, 'data/backstories.json');
  _catalog = parsed.backstories as BackstoryEntry[];
  return _catalog;
}

export function getDay1Modifier(backstoryId: BackstoryId): Day1Modifier {
  const backstories = loadBackstories();
  const entry = backstories.find((b) => b.id === backstoryId);
  if (!entry) throw new Error(`Unknown backstory id: ${backstoryId}`);
  return { backstoryId, ...entry.modifier };
}

export function buildCharacterModifier(name: string, backstoryId: BackstoryId) {
  return {
    name,
    backstoryId,
    day1Modifier: getDay1Modifier(backstoryId),
  };
}
