import { z } from 'zod';
import { parseData } from '../../game/data';

/**
 * The one-shot teaching-beat catalog (#394).
 *
 * A **hint** (`data/hints.json`) is a muted line under a control, retired when
 * the player presses that control. A **beat** is the other half of the same
 * teaching cell: a moment the game stops and states something the player has no
 * control to press and no other way to learn — the failure stakes being the
 * first of them. Both retire off the per-slot `teaching:<id>` cell #386 minted,
 * so "Show hints again" re-arms both with one call.
 *
 * The copy is DATA for the same reason the hints are: a sentence inlined in a
 * component is a sentence nobody reviews. `tests/FailureStakes.test.tsx` scans
 * all of `src/` for a fragment of every string here and fails by name.
 */
export const TEACHING_BEAT_IDS = ['failure_stakes'] as const;

export type TeachingBeatId = (typeof TEACHING_BEAT_IDS)[number];

const TeachingBeatSchema = z
  .object({
    id: z.enum(TEACHING_BEAT_IDS),
    /** When the beat fires — orientation for the copy, not a key. */
    surface: z.string().min(1),
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
    schemaVersion: z.literal(1),
    beats: z.array(TeachingBeatSchema).nonempty(),
  })
  .refine((c) => new Set(c.beats.map((b) => b.id)).size === c.beats.length, {
    message: 'teaching-beat ids must be unique',
  })
  // Completeness, the `data/hints.json` idiom: a declared id with no copy is a
  // load-time failure, not a beat that quietly fires blank.
  .refine((c) => TEACHING_BEAT_IDS.every((id) => c.beats.some((b) => b.id === id)), {
    message: 'every teaching-beat id must be declared',
  })
  // Every string is a SENTENCE. A beat interrupts the player; a fragment is not
  // worth an interruption.
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
