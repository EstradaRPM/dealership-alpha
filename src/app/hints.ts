// ── Consequence-hint registry (#386 mechanism, #388 the full pass) ───────────
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
 * Every consequence a player can commit the store to from a live surface.
 *
 * The list is closed and the loader refuses a catalog missing any of it, so a
 * new id is a compile-time edit here plus a line of copy there — never a
 * control that quietly teaches nothing.
 *
 * `sourcing_lean` is deliberately ABSENT: it is a standing desk order with no
 * rendered control anywhere in `src/ui` (persist-only since #293, filed as
 * #396). A hint pointing at nothing teaches nothing.
 */
export const HINT_IDS = [
  // Operations — the standing desk dials (#386's three, plus the day length)
  'hours_of_operation',
  'pricing_strategy',
  'trade_policy',
  'fni_posture',
  // The Lot room and the two screens it opens
  'asking_price',
  'wholesale_unit',
  'auction_buy',
  'auction_inspection',
  // People
  'hire_candidate',
  'staff_moves',
  'raise_answer',
  // Finance — the one lever in a room of readings (#393)
  'credit_line',
  // Growth
  'advertising_campaign',
  'wire_subscription',
  'facility_build',
  // The department rooms
  'parts_policy',
  'service_pricing_posture',
  'service_marketing',
  'body_shop_channel_posture',
  'resolve_queue_item',
  // The clock, which is the one control every surface is played through
  'run_day',
  'run_bite',
] as const;
export type HintId = (typeof HINT_IDS)[number];

/**
 * One place a hint is taught. `control` is the testID of the control GROUP the
 * line sits under, and every pressable inside that group belongs to it —
 * `tests/Hints.coverage.test.tsx` resolves a rendered control by walking up to
 * the nearest declared testID, so a chip row's chips and a modal's two buttons
 * are covered by the block they live in rather than each needing an entry.
 *
 * More than one place is the point of the array: the same consequence can be
 * reachable from two rooms (a unit's price from the Lot list and from the
 * pricing screen; the parts par levels from Service and from the Body Shop),
 * and it is one lesson retired once — not two entries that can drift apart.
 */
const HintPlaceSchema = z
  .object({
    /** The room the control lives in — orientation for the copy. */
    surface: z.string().min(1),
    /** The control group's testID, or the prefix a templated one starts with. */
    control: z.string().min(1),
  })
  .strict();

const HintSchema = z
  .object({
    id: z.enum(HINT_IDS),
    places: z.array(HintPlaceSchema).nonempty(),
    text: z.string().min(1),
  })
  .strict();

const declaredControls = (c: {
  hints: readonly { places: readonly { control: string }[] }[];
  viewOnly: readonly string[];
}): string[] => [
  ...c.hints.flatMap((h) => h.places.map((p) => p.control)),
  ...c.viewOnly,
];

// Top level is deliberately NOT `.strict()` — the `_doc` annotations are the
// file's record of why retire-on-use is the rule, and Zod strips them. Every
// nested object IS strict.
export const HintsConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    hints: z.array(HintSchema).nonempty(),
    /**
     * Controls that move the player's VIEW and commit the store to nothing — a
     * tab, a back arrow, a fold, a reporting window. They teach no consequence,
     * so they carry no copy; they are declared because the coverage scan
     * demands that every rendered control be classified as one thing or the
     * other. That is the whole guard: the seventh control added next year
     * either gets a line of copy or gets named here, and cannot ship silent.
     */
    viewOnly: z.array(z.string().min(1)),
  })
  .refine((c) => new Set(c.hints.map((h) => h.id)).size === c.hints.length, {
    message: 'hint ids must be unique',
  })
  // Completeness, the `data/desk-orders.json` idiom: a declared id with no copy
  // is a load-time failure, not a control that quietly teaches nothing.
  .refine((c) => HINT_IDS.every((id) => c.hints.some((h) => h.id === id)), {
    message: 'every hint id must be declared',
  })
  .refine(
    (c) => new Set(declaredControls(c)).size === declaredControls(c).length,
    { message: 'a control may be declared once, as a hint or as view-only' },
  )
  // Resolution is nearest-declared-ancestor with prefix matching, so one
  // declared control sitting inside another's namespace would decide which
  // lesson a press belongs to by string length. Refuse the ambiguity.
  .refine(
    (c) => {
      const all = declaredControls(c);
      return !all.some((a) => all.some((b) => b !== a && a.startsWith(b)));
    },
    { message: 'no declared control may be a prefix of another' },
  );

export type HintsConfig = z.infer<typeof HintsConfigSchema>;

export function loadHints(): HintsConfig {
  const raw: unknown = require('../../data/hints.json');
  return parseData(raw, HintsConfigSchema, 'data/hints.json');
}

/**
 * Does `testID` belong to `control`? A control group owns its own testID and
 * every templated one built from it (`bite-run` owns `bite-run-week`), which is
 * what lets a per-row or per-option control be declared once.
 */
export function controlOwns(control: string, testID: string): boolean {
  return testID === control || testID.startsWith(`${control}-`);
}
