import { teachingBeat, fillSlots } from '../copy';
import type { TeachingBeatId, TeachingBeatEntry } from '../copy';
import type { BadgeTone } from '../kit';

/**
 * The teaching-beat model (#394, generalized by #395).
 *
 * A new player used to learn a mechanic the first time it cost them — the
 * failure model from the EndCard, the service annuity from a service drive that
 * stayed empty. A beat states the same thing at the moment the mechanic first
 * matters and while there is still something to do about it, once per career,
 * off the same per-slot teaching cell every hint retires into.
 *
 * Presentation-only, the `recoveryBeat` split exactly: the composition root
 * decides that a beat is due and supplies the store's own figures, this module
 * assembles the sentences. The difference from a recovery beat is that
 * **nothing has been lost** — no hit landed, no tier was taken — which is why a
 * beat does not ride the recovery queue and does not carry that card's
 * "Setback" framing.
 */
export interface TeachingBeatInput {
  id: TeachingBeatId;
  /**
   * The `{slot}` fills for this beat's sentences, from the condition that
   * raised it. A `reach` fill is what turns the optional reach clause on — a
   * condition that leaves it out is stating that the store has no headroom, so
   * the clause is dropped whole rather than rendered about zero dollars.
   */
  slots: Readonly<Record<string, string>>;
}

/** The assembled beat, in the order the card renders it. */
export interface TeachingBeatModel {
  id: TeachingBeatId;
  badge: string;
  tone: BadgeTone;
  title: string;
  cause: string;
  cost: string;
  path: string;
}

export function buildTeachingBeat(
  input: TeachingBeatInput,
  entry: TeachingBeatEntry = teachingBeat(input.id),
): TeachingBeatModel {
  const { slots } = input;
  const hasReach = entry.reach != null && slots.reach != null;
  return {
    id: input.id,
    badge: entry.badge,
    tone: entry.tone,
    title: fillSlots(entry.title, slots),
    cause: fillSlots(entry.cause, slots),
    cost: fillSlots(entry.cost, slots),
    path: hasReach
      ? `${fillSlots(entry.path, slots)} ${fillSlots(entry.reach as string, slots)}`
      : fillSlots(entry.path, slots),
  };
}
