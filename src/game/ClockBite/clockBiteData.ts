import { z } from 'zod';
import { parseData } from '../data';

/**
 * The bite catalog (#381) — `data/clock-bites.json`.
 *
 * The doors live in data, the predicates in code. Naming the required coverage
 * in the file is what keeps the two from drifting: #371 had to delete a
 * `hasDeskManager` boolean that lived in code precisely because it satisfied
 * every staff door at once.
 */

export const BITE_IDS = ['day', 'week', 'month'] as const;
export type BiteId = (typeof BITE_IDS)[number];

export const COVERAGE_FACT_IDS = [
  'discount_desking',
  'trade_approval',
  'general_manager',
] as const;
/** A capability the store has handed to somebody other than the player. */
export type CoverageFactId = (typeof COVERAGE_FACT_IDS)[number];

export const HALT_REASON_IDS = [
  'escalation',
  'insolvent',
  'gate_verdict',
  // #384: the overnight channel. Every moment that asks the owner a question
  // between days lands on this ONE reason — the sentence names which one
  // through its `{subject}` slot, so a fifth overnight prompt built next year
  // needs no new halt id and no edit to the runner.
  'owner_interrupt',
  // #385: a standing instruction the player left for a desk that the desk
  // cannot carry out. Same shape as the interrupt above — ONE reason, and the
  // `{subject}` slot names which order — so a fourth standing lever added later
  // needs a line of copy and no new halt id.
  'desk_order',
] as const;
export type HaltReasonId = (typeof HALT_REASON_IDS)[number];

const BiteIdSchema = z.enum(BITE_IDS);
const CoverageFactIdSchema = z.enum(COVERAGE_FACT_IDS);
const HaltReasonIdSchema = z.enum(HALT_REASON_IDS);

const CoverageFactSchema = z
  .object({
    id: CoverageFactIdSchema,
    /** Stated verbatim by the picker when this cover is the shut door. */
    missingSentence: z.string().min(1),
  })
  .strict();

const BiteSchema = z
  .object({
    id: BiteIdSchema,
    label: z.string().min(1),
    days: z.number().int().positive(),
    /**
     * #382: how many individual reactions the Reveal at this grain surfaces.
     * The budget rides the bite because the bite is the window the feed covers.
     */
    starBudget: z.number().int().positive(),
    /**
     * #383: what the player is wagering by picking this bite, stated at the
     * picker before they commit. Optional in the object schema and required by
     * the array refine below for every bite above the day — the day is watched
     * as it happens, so it has nothing to state in advance, and a field carried
     * with no reader is the dead-`tagline` trap #378 had to delete.
     */
    stakes: z.string().min(1).optional(),
    requires: z.array(CoverageFactIdSchema),
  })
  .strict();

const HaltSchema = z
  .object({
    id: HaltReasonIdSchema,
    /** Stated verbatim by the Reveal when the run stopped here. */
    sentence: z.string().min(1),
  })
  .strict();

// Top level is deliberately NOT `.strict()`: the `_doc` annotation fields are
// the file's own record of why the doors are what they are, and Zod strips
// them. Every nested object IS strict — a stale key inside a bite would
// otherwise be silently dropped while the file looked fine.
export const ClockBitesConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    coverage: z.array(CoverageFactSchema).nonempty(),
    bites: z.array(BiteSchema).nonempty(),
    halts: z.array(HaltSchema).nonempty(),
  })
  .refine(
    (c) => new Set(c.coverage.map((f) => f.id)).size === c.coverage.length,
    { message: 'coverage ids must be unique' },
  )
  .refine((c) => new Set(c.bites.map((b) => b.id)).size === c.bites.length, {
    message: 'bite ids must be unique',
  })
  .refine((c) => new Set(c.halts.map((h) => h.id)).size === c.halts.length, {
    message: 'halt ids must be unique',
  })
  // Every declared bite and halt reason must be present: the runner and the
  // picker index this catalog by id, so a missing entry is a crash at the
  // moment the player taps rather than a load-time error.
  .refine((c) => BITE_IDS.every((id) => c.bites.some((b) => b.id === id)), {
    message: 'every bite id must be declared',
  })
  .refine((c) => HALT_REASON_IDS.every((id) => c.halts.some((h) => h.id === id)), {
    message: 'every halt reason must be declared',
  })
  // #382: a longer bite covers strictly more of the calendar, so it may never
  // carry a SMALLER star budget than a shorter one — a week that surfaced fewer
  // moments than a day would be the feed getting quieter the more happened.
  // (Sub-linear growth is the design; shrinking is a typo.)
  .refine(
    (c) =>
      [...c.bites]
        .sort((a, b) => a.days - b.days)
        .every((b, i, sorted) => i === 0 || b.starBudget >= sorted[i - 1].starBudget),
    { message: 'a longer bite must not carry a smaller starBudget' },
  )
  // #383: a bite above the day is committed to blind — the player hands over N
  // days and does not look again — so it must state what it is wagering before
  // they tap. A bet you cannot read before placing is not a decision, which is
  // why this is a load refusal rather than a copy convention.
  .refine((c) => c.bites.every((b) => b.days === 1 || !!b.stakes), {
    message: 'a bite above the day must state its stakes',
  })
  // A door naming coverage the file never declares has no sentence to state,
  // which is how a locked bite ends up greyed out with no explanation.
  .refine(
    (c) =>
      c.bites.every((b) =>
        b.requires.every((r) => c.coverage.some((f) => f.id === r)),
      ),
    { message: 'every required coverage fact must be declared' },
  );

export type ClockBitesConfig = z.infer<typeof ClockBitesConfigSchema>;

export function loadClockBites(): ClockBitesConfig {
  const raw: unknown = require('../../../data/clock-bites.json');
  return parseData(raw, ClockBitesConfigSchema, 'data/clock-bites.json');
}
