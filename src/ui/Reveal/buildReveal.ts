import { loadTunables } from '../../game/data';
import type { DayFunnel } from '../../game/CapacityManager';

/**
 * Pure read-model builder for **The Reveal** (#319, design record
 * `docs/planning/engagement-spine.md`) — the shared close-of-bite engagement
 * beat. T1's daily Reveal reuses the funnel + gross + inventory-buyer match
 * tally already assembled for `DayRecapModel` (#199/#253) and reframes them
 * as a plain-language scoreline plus a starred-reaction feed. No new
 * modeling: the renderer aggregates and phrases what the sim already emits.
 *
 * Self-similar by design (design record §2): this same shape — one scoreline
 * + a reactions list, each reaction starring an entity with a fate — is what
 * later plug-ins (individual sale wins/losses in #320/#321, F&I as plug-in
 * #2, higher-tier zooms) feed into. S1 ships exactly one reaction: the
 * aggregate match summary.
 */

/** Tally of today's closed deals scored for inventory-buyer fit (#199). */
export interface MatchTally {
  strong: number;
  matched: number;
}

export type RevealReactionTone = 'positive' | 'negative' | 'neutral';

/** One starred reaction on the Reveal feed — never a bare metric. */
export interface RevealReaction {
  id: string;
  tone: RevealReactionTone;
  text: string;
}

export interface RevealModel {
  /** The day's plain-language verdict — busy/slow framing + match result. */
  scoreline: string;
  reactions: RevealReaction[];
}

function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}

/** Busy/slow framing off the funnel — no temperature words. */
function activityLabel(funnel: DayFunnel): string {
  if (funnel.potentialTraffic <= 0) return 'No traffic';
  const threshold = loadTunables().reveal.busyWalkedInThreshold;
  return funnel.walkedIn >= threshold ? 'Busy day' : 'Slow day';
}

/** Majority of today's closes matched the buyer's wants — the day's verdict. */
function majorityStrong(tally: MatchTally): boolean {
  return tally.matched > 0 && tally.strong * 2 >= tally.matched;
}

/** Mid-sentence clause for the scoreline. */
function matchClause(tally: MatchTally): string {
  if (tally.matched <= 0) return 'nothing closed today';
  return majorityStrong(tally)
    ? `you had what the crowd wanted: ${tally.strong} of ${tally.matched} stuck`
    : `the lot didn't fit the crowd: ${tally.strong} of ${tally.matched} stuck`;
}

/** The match-summary reaction — always the first (and, at S1, only) entry. */
function matchReaction(tally: MatchTally, gross: number): RevealReaction {
  if (tally.matched <= 0) {
    return {
      id: 'match-summary',
      tone: 'neutral',
      text: `No sales closed today. ${money(gross)} gross.`,
    };
  }
  const strong = majorityStrong(tally);
  const verdict = strong
    ? 'you had what the crowd wanted'
    : "the lot didn't fit the crowd";
  return {
    id: 'match-summary',
    tone: strong ? 'positive' : 'negative',
    text: `${tally.strong} of ${tally.matched} stuck — ${verdict}. ${money(gross)} gross today.`,
  };
}

export function buildReveal(
  funnel: DayFunnel,
  gross: number,
  matchTally: MatchTally,
): RevealModel {
  const scoreline = `${activityLabel(funnel)} — ${matchClause(matchTally)}.`;
  return {
    scoreline,
    reactions: [matchReaction(matchTally, gross)],
  };
}
