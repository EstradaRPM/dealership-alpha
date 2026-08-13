import { money } from '../kit';
import { teachingBeat, fillSlots } from '../copy';

/**
 * The failure-stakes beat (#394).
 *
 * A new player used to learn the failure model from the EndCard — the first
 * time they heard that running out of money ends the career was when it already
 * had. This states the same consequence while there is still something to do
 * about it, once per career, off the same per-slot teaching cell every hint
 * retires into.
 *
 * Presentation-only, the `recoveryBeat` split exactly: the composition root
 * supplies the store's numbers, this module assembles the sentences. The
 * difference from a recovery beat is that **nothing has happened** — no hit
 * landed, no tier was lost. It is a reading, not an event, which is why it does
 * not ride the recovery queue and does not carry that card's "Setback" framing.
 */
export interface StakesBeatInput {
  /** Cash on hand at the close that raised it. */
  cash: number;
  /** Nights below the failure floor that end a Tier 1 career. */
  daysToFail: number;
  /**
   * Undrawn credit, or 0 for a store with no line / no headroom. The reach
   * clause is omitted entirely at zero — a store is never told it can reach for
   * nothing.
   */
  creditAvailable: number;
}

/** The assembled beat, in the order the card renders it. */
export interface StakesBeat {
  title: string;
  cause: string;
  cost: string;
  path: string;
}

export function buildStakesBeat(input: StakesBeatInput): StakesBeat {
  const entry = teachingBeat('failure_stakes');
  // Exact, not compact (#387): the player is about to act on this figure, and a
  // beat fired against ONE store's position can afford to be exact about it in
  // a way a hint written once against every store never can.
  const cash = money(Math.max(0, input.cash));
  const hasReach = input.creditAvailable > 0 && entry.reach != null;
  return {
    title: entry.title,
    cause: fillSlots(entry.cause, { cash }),
    cost: fillSlots(entry.cost, { days: String(input.daysToFail) }),
    path: hasReach
      ? `${entry.path} ${fillSlots(entry.reach as string, {
          reach: money(input.creditAvailable),
        })}`
      : entry.path,
  };
}
