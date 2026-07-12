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
 * plug-ins feed into. S1 (#319) shipped exactly one reaction, the aggregate
 * match summary. S2 (#320) adds individual starred win reactions, ranked by
 * drama off the day's closes. S3 (#321) adds the negative half — starred
 * walk-off reactions off the day's `no_sale` outcomes. F&I (plug-in #2) is a
 * later plug-in onto the same `reactions[]` shape.
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

/**
 * One closed sale's win narrative (#320): the "who" (customer archetype
 * label), "what" (vehicle category), "how well" (want-axis match quality),
 * and "outcome" (gross) — an entity with a fate, never a bare metric.
 * Sourced straight off `staff:auto_resolved`'s `outcome: 'closed'` fields.
 */
export interface ClosedSale {
  customerId: string;
  archetypeLabel: string;
  vehicleCategory: 'sedan' | 'truck' | 'suv';
  matchQuality: number;
  gross: number;
}

/**
 * One walk-off's loss narrative (#321): the "who" (customer archetype label,
 * when a session existed), "what" (their wanted vehicle category, when
 * derivable), and "why" (the named `no_sale` reason off `staff:auto_resolved`
 * — see `events.ts` for the full code list). An entity with a fate, never a
 * bare metric.
 */
export interface WalkOff {
  customerId: string;
  archetypeLabel?: string;
  wantedCategory?: ClosedSale['vehicleCategory'];
  reason: string;
}

function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}

const CATEGORY_PHRASE: Record<ClosedSale['vehicleCategory'], string> = {
  sedan: 'a sedan',
  truck: 'a truck',
  suv: 'an SUV',
};

/** The plain-language win narrative shared by the Reveal reaction and the live floor toast (#320). */
export function winReactionText(sale: ClosedSale): string {
  return `${sale.archetypeLabel} wanted ${CATEGORY_PHRASE[sale.vehicleCategory]} — you had one. SOLD ${money(sale.gross)} front.`;
}

/**
 * Reason-code → plain-language walk-off copy (#321). The single source both
 * the live floor toast and the Reveal reaction draw from — no per-reason
 * strings elsewhere. `starworthy` marks the painful/instructive losses worth a
 * star; the rest stay folded into the day's aggregate (the boring middle
 * stays a number, per the design record).
 */
const WALK_OFF_COPY: Record<
  string,
  { starworthy: boolean; text: (who: string, what: string | undefined) => string }
> = {
  no_fit: {
    starworthy: true,
    text: (who, what) =>
      what
        ? `${who} wanted ${what} — your lot didn't have one. Walked.`
        : `${who} wanted something you didn't have. Walked.`,
  },
  trade_negative_equity: {
    starworthy: true,
    text: (who) => `${who}'s trade was underwater — the numbers never worked. Walked.`,
  },
  trade_manager_declined: {
    starworthy: true,
    text: (who) => `${who}'s trade came in too rich for the desk. Walked.`,
  },
  discount_below_cost: {
    starworthy: true,
    text: (who) => `${who} wanted a price that would've lost you money. Walked.`,
  },
  demo_nonnegotiable_miss: {
    starworthy: true,
    text: (who) => `${who} needed something the vehicle didn't have. Walked.`,
  },
  no_close: {
    starworthy: false,
    text: (who) => `${who} couldn't agree on a price. Walked.`,
  },
  trade_player_declined: {
    starworthy: false,
    text: (who) => `${who}'s trade offer wasn't enough. Walked.`,
  },
  discount_player_declined: {
    starworthy: false,
    text: (who) => `${who} wanted a deeper discount than you'd give. Walked.`,
  },
  discount_haggle_exhausted: {
    starworthy: false,
    text: (who) => `${who} and the salesperson never met in the middle. Walked.`,
  },
  patience_drain: {
    starworthy: false,
    text: (who) => `${who} ran out of patience. Walked.`,
  },
  trust_collapse: {
    starworthy: false,
    text: (who) => `${who} stopped trusting the pitch. Walked.`,
  },
  no_session: {
    starworthy: false,
    text: (who) => `${who} left before anyone reached them. Walked.`,
  },
  not_sales: {
    starworthy: false,
    text: (who) => `${who} wasn't here to buy. Walked.`,
  },
};

const FALLBACK_WALK_OFF_COPY = {
  starworthy: false,
  text: (who: string) => `${who} walked.`,
};

/** The plain-language loss narrative shared by the Reveal reaction and the live floor toast (#321). */
export function walkOffReactionText(walkOff: WalkOff): string {
  const copy = WALK_OFF_COPY[walkOff.reason] ?? FALLBACK_WALK_OFF_COPY;
  const who = walkOff.archetypeLabel ?? 'A customer';
  const what = walkOff.wantedCategory ? CATEGORY_PHRASE[walkOff.wantedCategory] : undefined;
  return copy.text(who, what);
}

function isStarworthyWalkOff(reason: string): boolean {
  return (WALK_OFF_COPY[reason] ?? FALLBACK_WALK_OFF_COPY).starworthy;
}

/**
 * Ranks the day's closes by drama — match strength first, gross as the
 * tiebreak — and takes the top `limit`. Pure, deterministic (stable sort).
 */
export function rankTopCloses(
  closes: readonly ClosedSale[],
  limit: number,
): readonly ClosedSale[] {
  return [...closes]
    .sort((a, b) => b.matchQuality - a.matchQuality || b.gross - a.gross)
    .slice(0, limit);
}

function winReaction(sale: ClosedSale): RevealReaction {
  return {
    id: `win-${sale.customerId}`,
    tone: 'positive',
    text: winReactionText(sale),
  };
}

/**
 * Selects the day's painful/instructive walk-offs — the boring middle (a
 * routine `no_close`/`patience_drain`/etc.) never makes the cut — and takes
 * the top `limit` in emission order. Pure; no numeric "drama" axis exists for
 * a loss the way match-quality does for a win, so order is simply stable
 * arrival order among the starworthy reasons.
 */
export function rankTopWalkOffs(
  walkOffs: readonly WalkOff[],
  limit: number,
): readonly WalkOff[] {
  return walkOffs.filter((w) => isStarworthyWalkOff(w.reason)).slice(0, limit);
}

function walkOffReaction(walkOff: WalkOff): RevealReaction {
  return {
    id: `walk-${walkOff.customerId}`,
    tone: 'negative',
    text: walkOffReactionText(walkOff),
  };
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
  closes: readonly ClosedSale[] = [],
  walkOffs: readonly WalkOff[] = [],
): RevealModel {
  const tunables = loadTunables().reveal;
  const scoreline = `${activityLabel(funnel)} — ${matchClause(matchTally)}.`;
  const topCloses = rankTopCloses(closes, tunables.starBudget);
  const topWalkOffs = rankTopWalkOffs(walkOffs, tunables.lossStarBudget);
  return {
    scoreline,
    reactions: [
      matchReaction(matchTally, gross),
      ...topCloses.map(winReaction),
      ...topWalkOffs.map(walkOffReaction),
    ],
  };
}
