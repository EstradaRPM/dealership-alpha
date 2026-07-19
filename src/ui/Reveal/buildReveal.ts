import { loadTunables } from '../../game/data';
import type { DayFunnel } from '../../game/CapacityManager';
import type { PrepBet, PrepCategory } from '../../game/PrepBet';
import type { RecordKind } from '../../game/Records';

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
 * match summary. S2 (#320) added individual starred win reactions and S3
 * (#321) the negative half (starred walk-offs). B1 S1 (#328) unifies those two
 * tracks: wins and starworthy losses are scored on ONE drama axis
 * (`scoreDrama`) and ranked in a single pool (`rankDrama`), so the top few
 * reactions are the day's most dramatic beats whatever their tone — a wanted-
 * in-stock walk can outrank a mild win and vice-versa. The scorer is a weighted
 * sum of per-axis terms so a new axis drops in as one more weight + one term.
 * B1 S3 (#330) takes that slot: a broken high-water mark (`records:broken`, off
 * the Records module) joins the same pool as a **crowned** reaction, weighted
 * above the ordinary win/loss axes so beating a personal best reliably takes a
 * star slot. Records are crowned reactions on this one feed — never a separate
 * screen. F&I (plug-in #2) is a later plug-in onto the same `reactions[]` shape.
 *
 * S4 (#322) closes the loop: the morning prep is captured as a bet (`PrepBet` —
 * the lot's stocking lean vs. the demand-heat read) and the scoreline resolves
 * it in plain-match voice — the lot you stocked vs. what the crowd actually
 * wanted today. When no bet was captured (empty lot / pre-S4 save) the scoreline
 * falls back to the S1 busy/slow + match phrasing.
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

/**
 * One high-water mark the day just beat (#330) — the UI-side shape of the
 * `records:broken` payload the Records module emits (#329). An entity with a
 * fate, same as a win or a walk-off: the mark, what it now stands at, and what
 * it displaced.
 */
export interface BrokenRecord {
  kind: RecordKind;
  value: number;
  /** The mark this beat, or null when it's the first mark of its kind. */
  previousValue: number | null;
  /** Running 1-based month index — `bestMonthGross` only. */
  month?: number;
}

/** A record that beat a standing mark — the only kind that earns a crown. */
export type CrownedRecord = BrokenRecord & { previousValue: number };

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

/**
 * Whether a walk-off's reason is painful/instructive enough to star at all
 * (the boring middle — a routine `no_close`/`patience_drain` — stays folded
 * into the day's aggregate). This boolean is the eligibility gate for the
 * drama pool; the `painByReason` tunable only tunes the *relative* pain among
 * reasons that pass it. Also the starworthiness check the live floor toast
 * draws on (#321).
 */
export function isStarworthyWalkOff(reason: string): boolean {
  return (WALK_OFF_COPY[reason] ?? FALLBACK_WALK_OFF_COPY).starworthy;
}

/**
 * Whether a broken mark earns a crown on the feed (#330). **A crown means you
 * beat yourself** — so a first-ever mark (`previousValue === null`) does not
 * crown. Records deliberately left this call to the presentation (#329): the
 * engine reports the truth that this IS your best day, but the first day of a
 * career sets four or five marks at once and crowning all of them would make
 * the crown mean "you played", not "you improved". It also spares the feed the
 * "longest selling streak: 1 day" crown. The mark still stands in the Records
 * scoreboard from the moment it's set — only the celebration waits for a beat.
 */
export function isCrownworthyRecord(record: BrokenRecord): record is CrownedRecord {
  return record.previousValue !== null;
}

/** Count phrasing for the two marks that aren't measured in dollars. */
function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Per-mark crown copy (#330) — names the mark, its new value, and the number it
 * displaced, in plain language a layperson reads right (no jargon: "per-car
 * average", not "PVR"). Hermes-safe `$` grouping via `money`.
 */
const RECORD_COPY: Record<RecordKind, (record: CrownedRecord) => string> = {
  bestDayGross: (r) =>
    `Best day yet — ${money(r.value)} gross, beating ${money(r.previousValue)}.`,
  bestMonthGross: (r) =>
    `Best month yet — ${money(r.value)} gross, beating ${money(r.previousValue)}.`,
  bestPvr: (r) =>
    `Best per-car average yet — ${money(r.value)} a car, beating ${money(r.previousValue)}.`,
  bestStreak: (r) =>
    `Longest selling streak — ${plural(r.value, 'day', 'days')} running, beating ${r.previousValue}.`,
  bestSingleDeal: (r) =>
    `Fattest deal ever — ${money(r.value)} front, beating ${money(r.previousValue)}.`,
  mostUnitsInDay: (r) =>
    `${plural(r.value, 'car', 'cars')} out the door — most in a day, beating ${r.previousValue}.`,
};

/** The plain-language crown narrative for one broken mark (#330). */
export function crownReactionText(record: CrownedRecord): string {
  return `👑 ${RECORD_COPY[record.kind](record)}`;
}

/**
 * One candidate on the unified drama feed — a win, a starworthy loss (#328), or
 * a crowned record (#330). All three are scored on ONE drama axis and ranked in
 * a single pool, so a dramatic loss can outrank a mild win and a crown outranks
 * both.
 */
export type DramaCandidate =
  | { kind: 'win'; sale: ClosedSale }
  | { kind: 'loss'; walkOff: WalkOff }
  | { kind: 'record'; record: CrownedRecord };

/** Per-day context the drama scorer measures a candidate against. */
interface DramaContext {
  /** Running-norm gross across the day's closes — the baseline gross surprise is measured from. */
  meanGross: number;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Assigns a candidate its numeric drama score (#328) — a weighted sum of the
 * per-axis terms available today:
 *   - **match strength** (wins): a strong-fit close is dramatic, a poor-fit one mild;
 *   - **gross surprise** (wins): a fat front well above the day's norm is dramatic,
 *     a thin one isn't (only the upside registers);
 *   - **walk-off pain** (losses): the per-reason pain weight (a wanted-in-stock
 *     walk hurts more than a rich-trade decline);
 *   - **record broken** (crowns, #330): a flat term every crown scores, plus a
 *     margin term for how far past the old mark it went — so smashing a record
 *     outranks squeaking past one. Weighted above the win/loss axes: beating a
 *     personal best is the day's headline.
 * All weights + scales come from `tunables.reveal.drama`. A new axis (e.g. the
 * coupling-fired beats) drops in as one more `weights` entry + one term here —
 * no restructuring of the ranker.
 */
export function scoreDrama(candidate: DramaCandidate, ctx: DramaContext): number {
  const drama = loadTunables().reveal.drama;
  if (candidate.kind === 'win') {
    const { sale } = candidate;
    const grossSurprise = clamp01((sale.gross - ctx.meanGross) / drama.grossSurpriseScale);
    return (
      drama.weights.matchStrength * clamp01(sale.matchQuality) +
      drama.weights.grossSurprise * grossSurprise
    );
  }
  if (candidate.kind === 'record') {
    const { value, previousValue } = candidate.record;
    // Relative improvement over the displaced mark. A non-positive old mark
    // can't be improved *on* proportionally, so it reads as a full-margin beat.
    const margin =
      previousValue > 0 ? clamp01((value - previousValue) / previousValue) : 1;
    return drama.weights.recordBroken + drama.weights.recordMargin * margin;
  }
  const pain = drama.painByReason[candidate.walkOff.reason] ?? drama.basePain;
  return drama.weights.walkOffPain * pain;
}

/** Score, sort drama-desc with a stable arrival-order tiebreak, take the top N. */
function topByDrama(
  candidates: readonly DramaCandidate[],
  ctx: DramaContext,
  limit: number,
): readonly DramaCandidate[] {
  return candidates
    .map((candidate, index) => ({ candidate, index, drama: scoreDrama(candidate, ctx) }))
    .sort((a, b) => b.drama - a.drama || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

/**
 * Ranks the day's wins, starworthy losses and crowned records in ONE pool by
 * drama score and takes the top `limit`. Two eligibility gates run before
 * scoring, so ineligible entries never crowd out real drama: non-starworthy
 * walk-offs are dropped entirely, and records are filtered to the crownworthy
 * ones then capped at `drama.crownBudget` (a great day can beat four marks at
 * once; without the cap the feed goes all-crown and the day's actual drama gets
 * pushed off). Pure + deterministic: ties break by arrival order, and the input
 * arrays are never mutated.
 */
export function rankDrama(
  closes: readonly ClosedSale[],
  walkOffs: readonly WalkOff[],
  records: readonly BrokenRecord[],
  limit: number,
): readonly DramaCandidate[] {
  const meanGross = closes.length
    ? closes.reduce((sum, c) => sum + c.gross, 0) / closes.length
    : 0;
  const ctx: DramaContext = { meanGross };
  const crowns = topByDrama(
    records
      .filter(isCrownworthyRecord)
      .map((record): DramaCandidate => ({ kind: 'record', record })),
    ctx,
    loadTunables().reveal.drama.crownBudget,
  );
  return topByDrama(
    [
      // Crowns lead the arrival order: the day's headline wins an exact tie.
      ...crowns,
      ...closes.map((sale): DramaCandidate => ({ kind: 'win', sale })),
      ...walkOffs
        .filter((w) => isStarworthyWalkOff(w.reason))
        .map((walkOff): DramaCandidate => ({ kind: 'loss', walkOff })),
    ],
    ctx,
    limit,
  );
}

function winReaction(sale: ClosedSale): RevealReaction {
  return {
    id: `win-${sale.customerId}`,
    tone: 'positive',
    text: winReactionText(sale),
  };
}

function walkOffReaction(walkOff: WalkOff): RevealReaction {
  return {
    id: `walk-${walkOff.customerId}`,
    tone: 'negative',
    text: walkOffReactionText(walkOff),
  };
}

function crownReaction(record: CrownedRecord): RevealReaction {
  return {
    id: `crown-${record.kind}`,
    tone: 'positive',
    text: crownReactionText(record),
  };
}

/** The reaction for one drama candidate — win, loss or crown, by kind. */
function dramaReaction(candidate: DramaCandidate): RevealReaction {
  switch (candidate.kind) {
    case 'win':
      return winReaction(candidate.sale);
    case 'loss':
      return walkOffReaction(candidate.walkOff);
    case 'record':
      return crownReaction(candidate.record);
  }
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

// Category noun phrasing for the plain-match verdict (#322). Capitalized for a
// sentence-leading subject ("Trucks filled your lot…"), lowercased mid-sentence
// ("the crowd wanted trucks") — SUVs stays upper in both.
const CATEGORY_PLURAL_LEAD: Record<PrepCategory, string> = {
  sedan: 'Sedans',
  truck: 'Trucks',
  suv: 'SUVs',
};
const CATEGORY_PLURAL_MID: Record<PrepCategory, string> = {
  sedan: 'sedans',
  truck: 'trucks',
  suv: 'SUVs',
};

/**
 * What the crowd actually wanted today — argmax of the categories the day's
 * closes bought and the day's wanted-category walk-offs asked for. `null` when
 * the day produced no expressed want (a dead day) or a dead tie; the bet then
 * falls back to the morning read as the crowd's stand-in.
 */
function dominantCrowdWant(
  closes: readonly ClosedSale[],
  walkOffs: readonly WalkOff[],
): PrepCategory | null {
  const tally: Record<PrepCategory, number> = { sedan: 0, truck: 0, suv: 0 };
  for (const sale of closes) tally[sale.vehicleCategory] += 1;
  for (const walkOff of walkOffs) {
    if (walkOff.wantedCategory) tally[walkOff.wantedCategory] += 1;
  }
  let best: PrepCategory | null = null;
  let bestCount = 0;
  let tied = false;
  for (const category of ['sedan', 'truck', 'suv'] as const) {
    const count = tally[category];
    if (count > bestCount) {
      best = category;
      bestCount = count;
      tied = false;
    } else if (count === bestCount && count > 0) {
      tied = true;
    }
  }
  return bestCount > 0 && !tied ? best : null;
}

/**
 * The plain-match bet→verdict scoreline (#322): the lot you stocked vs. what the
 * crowd wanted today. Returns `null` when there's no bet to resolve (no stocking
 * lean, or nothing to resolve against) so the caller falls back to the S1
 * scoreline.
 */
export function betVerdictScoreline(
  prepBet: PrepBet,
  matchTally: MatchTally,
  crowdWantActual: PrepCategory | null,
): string | null {
  const stocked = prepBet.stockedCategory;
  if (!stocked) return null;
  // Reality speaks when the day expressed a want; on a dead day the morning
  // read stands in for the crowd.
  const crowd = crowdWantActual ?? prepBet.readCategory;
  if (!crowd) return null;
  if (stocked === crowd) {
    return matchTally.matched > 0
      ? `${CATEGORY_PLURAL_LEAD[stocked]} filled your lot and your floor. Good match.`
      : `Right lot, wrong result — ${CATEGORY_PLURAL_MID[stocked]} wanted, none stuck.`;
  }
  return `Your lot was ${CATEGORY_PLURAL_MID[stocked]}; the crowd wanted ${CATEGORY_PLURAL_MID[crowd]}. Poor match.`;
}

export function buildReveal(
  funnel: DayFunnel,
  gross: number,
  matchTally: MatchTally,
  closes: readonly ClosedSale[] = [],
  walkOffs: readonly WalkOff[] = [],
  prepBet: PrepBet | null = null,
  records: readonly BrokenRecord[] = [],
): RevealModel {
  const tunables = loadTunables().reveal;
  // S4 (#322): lead with the resolved morning bet when one was captured; else
  // fall back to the S1 busy/slow + match scoreline (empty lot / pre-S4 save).
  const verdict = prepBet
    ? betVerdictScoreline(prepBet, matchTally, dominantCrowdWant(closes, walkOffs))
    : null;
  const scoreline = verdict ?? `${activityLabel(funnel)} — ${matchClause(matchTally)}.`;
  // #328/#330: wins, losses and crowned records ranked in one drama pool, top N
  // surfaced — no separate win/loss tracks and no separate records screen.
  const topDrama = rankDrama(closes, walkOffs, records, tunables.drama.starBudget);
  return {
    scoreline,
    reactions: [matchReaction(matchTally, gross), ...topDrama.map(dramaReaction)],
  };
}
