import { z } from 'zod';
import { parseData } from '../../game/data';
import { EVENT_NAMES } from '../../game/EventBus';
import type { BadgeTone } from '../kit';

/**
 * The one-shot teaching-beat catalog (#394, generalized to progressive
 * disclosure by #395).
 *
 * A **hint** (`data/hints.json`) is a muted line under a control, retired when
 * the player presses that control. A **beat** is the other half of the same
 * teaching cell: a moment the game stops and states something the player has no
 * control to press and no other way to learn. Both retire off the per-slot
 * `teaching:<id>` cell #386 minted, so "Show hints again" re-arms both with one
 * call.
 *
 * **A beat fires when its mechanic first matters** — never as a front-loaded
 * tour on day one, which is what the #213 spine is for. `events` names the
 * published events that make the game re-ask the question and `when` names the
 * condition that must hold for the answer to be yes; the runner
 * (`src/app/teachingBeats.ts`) reads this catalog and knows no mechanic by name.
 *
 * The copy is DATA for the same reason the hints are: a sentence inlined in a
 * component is a sentence nobody reviews. `tests/TeachingBeats.test.tsx` scans
 * all of `src/` for a fragment of every string here and fails by name.
 */

/**
 * Declaration order IS presentation order — two beats that come due on the same
 * day are presented one at a time, this order first. The schema refines that
 * `data/teaching-beats.json` declares them in exactly this order, the
 * `data/spine-steps.json` idiom, so the union is the single ordering truth.
 */
export const TEACHING_BEAT_IDS = [
  'failure_stakes',
  'morning_bet',
  'service_annuity',
  'fni_posture',
  'parts_pars',
  'channel_posture',
  'bite_ladder',
] as const;

export type TeachingBeatId = (typeof TEACHING_BEAT_IDS)[number];

/**
 * The conditions a beat may declare in `when`.
 *
 * The union lives with the catalog because the catalog references it; the
 * predicates live at the composition root (`src/app/teachingBeats.ts`), which is
 * the only layer that may read the World. TypeScript requires the registry to be
 * total over this union, so a member added here without a predicate does not
 * compile.
 *
 * `job_turned_away` qualifies on its trigger alone — a job the shop could have
 * done and did not is the whole condition, and there is nothing further to ask
 * of the store. That is a real answer, not a missing one: some moments *are*
 * their event.
 */
export const BEAT_CONDITION_IDS = [
  'cash_first_low',
  'prep_bet_offered',
  'service_advisor_on_staff',
  'deal_financed',
  'job_turned_away',
  'body_shop_open',
  'bite_unlocked_above_day',
] as const;

export type BeatConditionId = (typeof BEAT_CONDITION_IDS)[number];

const EVENT_NAME_SET: ReadonlySet<string> = new Set(EVENT_NAMES);

/**
 * The chip tones a beat may declare. `satisfies` binds them to the kit's role
 * set at the catalog boundary, so the card never casts and a tone the theme has
 * no role for cannot be written into `data/`.
 */
const BEAT_TONES = [
  'neutral',
  'info',
  'positive',
  'reward',
  'danger',
] as const satisfies readonly BadgeTone[];

const TeachingBeatSchema = z
  .object({
    id: z.enum(TEACHING_BEAT_IDS),
    /** When the beat fires — orientation for the copy, not a key. */
    surface: z.string().min(1),
    /**
     * The published events that make the game re-ask this beat's question.
     *
     * Checked against the runtime `EVENT_NAMES` catalog rather than trusted: an
     * event name that nobody publishes is a subscription that silently never
     * fires, which is the one failure mode of a registration table that cannot
     * be found by playing the game.
     *
     * An array because a mechanic can start mattering by more than one route —
     * a service advisor arrives by hire OR by promotion, and a part can be
     * missing on either department's line.
     */
    events: z
      .array(z.string().refine((e) => EVENT_NAME_SET.has(e), {
        message: 'not an event declared in src/game/EventBus/events.ts',
      }))
      .nonempty(),
    when: z.enum(BEAT_CONDITION_IDS),
    /** The chip above the title. */
    badge: z.string().min(1),
    tone: z.enum(BEAT_TONES),
    title: z.string().min(1),
    /** The reading that raised it. */
    cause: z.string().min(1),
    /** What happens if nothing changes, in plain language. */
    cost: z.string().min(1),
    /** What the player can do about it. */
    path: z.string().min(1),
    /**
     * Appended to `path` when the store has undrawn credit. Optional because
     * not every beat has a second clause — and omitted at render time for a
     * store with no headroom, so it is never stated about zero dollars.
     */
    reach: z.string().min(1).optional(),
  })
  .strict();

// Top level is deliberately NOT `.strict()` — the `_doc` annotations carry the
// record of why this catalog is allowed to quote money when `data/hints.json`
// is not, and Zod strips them. The nested object IS strict.
export const TeachingBeatsConfigSchema = z
  .object({
    schemaVersion: z.literal(2),
    beats: z.array(TeachingBeatSchema).nonempty(),
  })
  // Completeness AND order, the `data/spine-steps.json` idiom: a declared id
  // with no copy is a load-time failure, and the order beats are presented in
  // is stated once (in the union) rather than twice.
  .refine(
    (c) =>
      c.beats.length === TEACHING_BEAT_IDS.length &&
      TEACHING_BEAT_IDS.every((id, i) => c.beats[i]?.id === id),
    { message: 'teaching beats must be declared in TEACHING_BEAT_IDS order' },
  )
  // Every string is a SENTENCE. A beat interrupts the player; a fragment is not
  // worth an interruption. The badge is a chip, not a sentence, and is exempt.
  .refine(
    (c) =>
      c.beats.every((b) =>
        [b.title, b.cause, b.cost, b.path, ...(b.reach ? [b.reach] : [])].every(
          (s) => /[.!?]$/.test(s.trim()),
        ),
      ),
    { message: 'every teaching-beat string must be a sentence' },
  );

export type TeachingBeatsConfig = z.infer<typeof TeachingBeatsConfigSchema>;
export type TeachingBeatEntry = TeachingBeatsConfig['beats'][number];

export function loadTeachingBeats(): TeachingBeatsConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/teaching-beats.json');
  return parseData(raw, TeachingBeatsConfigSchema, 'data/teaching-beats.json');
}

/**
 * The catalog is static copy, so it is loaded once per process rather than
 * injected — the same call `emptyStates` makes, and for the same reason. What
 * *is* player state (has this slot been taught yet?) lives in `useHints`, which
 * is why that one has to be a hook and this one does not.
 */
let cached: TeachingBeatsConfig | null = null;

/** The catalog entry for a beat, with no slots filled. */
export function teachingBeat(id: TeachingBeatId): TeachingBeatEntry {
  cached ??= loadTeachingBeats();
  const entry = cached.beats.find((b) => b.id === id);
  if (!entry) throw new Error(`TeachingBeat: unknown id "${id}"`);
  return entry;
}

/**
 * Fill a beat's `{slot}` placeholders.
 *
 * An unfilled slot is left literal — the industry-wire rule — so a missing fill
 * shows up as a visibly wrong sentence rather than a silently truncated one.
 */
export function fillSlots(
  text: string,
  slots: Readonly<Record<string, string>>,
): string {
  return Object.entries(slots).reduce(
    (out, [slot, value]) => out.replace(new RegExp(`\\{${slot}\\}`, 'g'), value),
    text,
  );
}
