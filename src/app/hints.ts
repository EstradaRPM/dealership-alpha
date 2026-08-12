// ── Consequence-hint registry (#386, phase 12 D3-R2) ─────────────────────────
// The one teaching catalog. A hint is a line of muted text under a control that
// says what moving it costs the store; it draws until the player uses that
// control, then retires into the slot's `teaching:<id>` cell.
//
// Copy is DATA. `data/hints.json` holds every string, and `tests/HintCopy.test.ts`
// fails the build if one of them appears as a literal under `src/`. That is what
// keeps the copy pass (#388), the first-run spine (#213) and the unlock beats
// (#395) writing into one registry rather than three that can disagree about
// what the player has already been told.
import { z } from 'zod';
import { parseData } from '../game/data';

/**
 * The tracer's three: the standing desk dials a player sets once and then lets
 * the store run on for days. `sourcing_lean` — the fourth such lever, declared
 * alongside these three in `data/desk-orders.json` — is deliberately absent
 * because it has no rendered control anywhere in `src/ui` (persist-only since
 * #293). A hint pointing at nothing teaches nothing.
 */
export const HINT_IDS = [
  'pricing_strategy',
  'trade_policy',
  'fni_posture',
] as const;
export type HintId = (typeof HINT_IDS)[number];

const HintSchema = z
  .object({
    id: z.enum(HINT_IDS),
    /** The room the control lives in — orientation for the copy pass. */
    surface: z.string().min(1),
    /** The control's testID, so hint and control join without reading the component. */
    control: z.string().min(1),
    text: z.string().min(1),
  })
  .strict();

// Top level is deliberately NOT `.strict()` — the `_doc` annotations are the
// file's record of why retire-on-use is the rule, and Zod strips them. Every
// nested object IS strict.
export const HintsConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    hints: z.array(HintSchema).nonempty(),
  })
  .refine((c) => new Set(c.hints.map((h) => h.id)).size === c.hints.length, {
    message: 'hint ids must be unique',
  })
  // Completeness, the `data/desk-orders.json` idiom: a declared id with no copy
  // is a load-time failure, not a control that quietly teaches nothing.
  .refine((c) => HINT_IDS.every((id) => c.hints.some((h) => h.id === id)), {
    message: 'every hint id must be declared',
  });

export type HintsConfig = z.infer<typeof HintsConfigSchema>;

export function loadHints(): HintsConfig {
  const raw: unknown = require('../../data/hints.json');
  return parseData(raw, HintsConfigSchema, 'data/hints.json');
}
