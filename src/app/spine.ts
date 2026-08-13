// ── The first-run spine registry (#213) ──────────────────────────────────────
// The five moves that make one day of this game — read the market, find the
// coverage gap, stock to match it, run the day, read the recap — taught in
// order, once per career, as numbered coachmarks drawn ON the surface where the
// next move is made.
//
// It is the third catalog in the ONE teaching cell #386 minted, beside the
// consequence hints (`data/hints.json`) and the one-shot beats
// (`data/teaching-beats.json`). There is no tutorial state machine and no
// tutorial-only save field: a step is done because its id is in the slot's
// `teaching:<id>` cell, or because the hint whose control performs it has
// already retired into that same cell.
import { z } from 'zod';
import { parseData } from '../game/data';
import { HINT_IDS } from './hints';

/**
 * The spine, in the order it is taught. The union IS the order — the loader
 * refuses a catalog that declares the steps in any other sequence, so the
 * sequence a player walks is readable here rather than only in the JSON.
 */
export const SPINE_STEP_IDS = [
  'spine_read_demand',
  'spine_cover_the_gap',
  'spine_stock_to_match',
  'spine_run_the_day',
  'spine_read_the_reveal',
] as const;
export type SpineStepId = (typeof SPINE_STEP_IDS)[number];

/**
 * The "What should I do?" ladder, read top to bottom — the first entry whose
 * condition holds is the answer. `run_the_day` is the floor and is always true,
 * which is what stops the menu entry going dead once onboarding is over.
 */
export const SPINE_ADVICE_IDS = [
  'cash_low',
  'coverage_gap',
  'lot_has_room',
  'run_the_day',
] as const;
export type SpineAdviceId = (typeof SPINE_ADVICE_IDS)[number];

const SpineStepSchema = z
  .object({
    id: z.enum(SPINE_STEP_IDS),
    /** The room the step is performed in — orientation for the copy. */
    surface: z.string().min(1),
    /**
     * The testID of the region the coachmark draws inside. The surface renders
     * it, so an unmounted anchor draws nothing — there is no floating overlay
     * to skip, because there was never one to place.
     */
    anchor: z.string().min(1),
    title: z.string().min(1),
    text: z.string().min(1),
    /**
     * The hint whose control performs this step. Present ⇒ the step is done the
     * moment that hint retires. Absent ⇒ the step is a READING, and the only
     * honest signal a reading gives is the player saying they have read it.
     */
    completedBy: z.enum(HINT_IDS).optional(),
  })
  .strict();

const SpineAdviceSchema = z
  .object({ id: z.enum(SPINE_ADVICE_IDS), text: z.string().min(1) })
  .strict();

const sentences = (strings: readonly string[]) =>
  strings.every((s) => /[.!?]$/.test(s.trim()));

// Top level is deliberately NOT `.strict()` — the `_doc` annotations carry the
// record of why the catalog is shaped this way, and Zod strips them. Every
// nested object IS strict.
export const SpineConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    steps: z.array(SpineStepSchema).nonempty(),
    advice: z.array(SpineAdviceSchema).nonempty(),
  })
  // Completeness + ORDER in one refine: the declared sequence must be exactly
  // the union's sequence. A step reordered in the JSON alone would silently
  // change what a new player is taught first.
  .refine((c) => c.steps.map((s) => s.id).join() === SPINE_STEP_IDS.join(), {
    message: 'spine steps must declare every id, in SPINE_STEP_IDS order',
  })
  // The advice ladder is likewise ordered — "first true wins" is meaningless if
  // the order is whatever the file happens to hold.
  .refine((c) => c.advice.map((a) => a.id).join() === SPINE_ADVICE_IDS.join(), {
    message: 'spine advice must declare every id, in SPINE_ADVICE_IDS order',
  })
  .refine((c) => c.steps.every((s) => sentences([s.title, s.text])), {
    message: 'every spine-step string must be a sentence',
  })
  .refine((c) => sentences(c.advice.map((a) => a.text)), {
    message: 'every spine-advice string must be a sentence',
  })
  // Two anchors on one surface would put two coachmarks in one place the first
  // time the order changed. One step, one region.
  .refine((c) => new Set(c.steps.map((s) => s.anchor)).size === c.steps.length, {
    message: 'each spine step must anchor to its own region',
  });

export type SpineConfig = z.infer<typeof SpineConfigSchema>;
export type SpineStepEntry = SpineConfig['steps'][number];

export function loadSpine(): SpineConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../data/spine-steps.json');
  return parseData(raw, SpineConfigSchema, 'data/spine-steps.json');
}

/**
 * The live reading the advice ladder is resolved against — three facts, all
 * read off the World by the composition root. Kept as plain booleans so the
 * ladder itself is a pure function with nothing to mock.
 */
export interface SpineReading {
  /** The bankruptcy monitor says the store is below its warning floor. */
  readonly cashLow: boolean;
  /** Recent buyers wanted a category the lot stocks none of. */
  readonly coverageGap: boolean;
  /** There is at least one unused space on the lot. */
  readonly lotHasRoom: boolean;
}

/** The first rung of the ladder whose condition holds. Never null. */
export function nextAdviceId(reading: SpineReading): SpineAdviceId {
  if (reading.cashLow) return 'cash_low';
  if (reading.coverageGap) return 'coverage_gap';
  if (reading.lotHasRoom) return 'lot_has_room';
  return 'run_the_day';
}
