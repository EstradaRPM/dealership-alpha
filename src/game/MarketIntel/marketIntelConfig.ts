import { z } from 'zod';
import { parseData } from '../data';

/**
 * One unlock — a door with a price on it. `subscription` doors take money
 * (`dailyCost`, debited every day it stays open); `staff` doors take a hire.
 * `minTier` is the career tier at which the door can be opened at all: below it
 * the hint tells the player which tier sells it, above it the hint tells them
 * what to do about it.
 */
const UnlockSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['subscription', 'staff']),
    label: z.string().min(1),
    blurb: z.string().min(1),
    dailyCost: z.number().nonnegative().optional(),
    minTier: z.number().int().positive(),
    lockedHint: z.string().min(1),
    tierLockedHint: z.string().min(1),
  })
  .strict()
  .refine((u) => u.kind !== 'subscription' || u.dailyCost != null, {
    message: 'a subscription unlock needs a dailyCost',
  });

/**
 * One access lane. `'*'` is a wildcard on either axis. Matching is by
 * SPECIFICITY (exact source scores above exact reliability), never by array
 * order, so lanes can be listed in any order and a new voice slotted in
 * anywhere. `requires: null` is a free lane.
 */
const LaneSchema = z
  .object({
    source: z.string().min(1),
    reliability: z.string().min(1),
    requires: z.string().min(1).nullable(),
  })
  .strict();

const CopySchema = z
  .object({
    /** `{source}` — the filed-but-unreadable row. */
    lockedRowText: z.string().min(1),
    unlocksHeading: z.string().min(1),
    subscribeLabel: z.string().min(1),
    cancelLabel: z.string().min(1),
    /** `{cost}` — the standing note on an active subscription. */
    activeNote: z.string().min(1),
  })
  .strict();

/**
 * News access gating (#178, parent #150). Not `.strict()` at the top level: the
 * JSON carries `_doc` / `_lanesDoc` annotations that Zod strips.
 */
const NewsGatingConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    unlocks: z
      .array(UnlockSchema)
      .nonempty()
      .refine((arr) => new Set(arr.map((u) => u.id)).size === arr.length, {
        message: 'unlock ids must be unique',
      }),
    lanes: z.array(LaneSchema).nonempty(),
    copy: CopySchema,
  })
  .refine(
    (c) =>
      c.lanes.every(
        (lane) => lane.requires == null || c.unlocks.some((u) => u.id === lane.requires),
      ),
    { message: 'every lane requirement must name a declared unlock' },
  );

export type NewsGatingConfig = z.infer<typeof NewsGatingConfigSchema>;
export type NewsUnlock = z.infer<typeof UnlockSchema>;
export type NewsLane = z.infer<typeof LaneSchema>;

export function loadNewsGatingConfig(): NewsGatingConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/news-progression-gating.json');
  return parseData(
    raw,
    NewsGatingConfigSchema,
    'data/news-progression-gating.json',
  );
}
