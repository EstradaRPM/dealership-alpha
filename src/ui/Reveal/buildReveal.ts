import { loadTunables } from '../../game/data';
import { biteStarBudget, type BiteId } from '../../game/ClockBite';
import type { DayFunnel } from '../../game/CapacityManager';
import type { PrepBet, PrepCategory } from '../../game/PrepBet';
import type { RecordKind } from '../../game/Records';
import type { FniMonthVerdict } from '../../game/DealEngine';

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
 * screen.
 *
 * B2 S12 (#373) takes the F&I slot and is the plug-in that proves the grammar
 * spans grains: the monthly F&I verdict is one more `reactions[]` entry scored
 * in the same pool by one more weight, but it resolves a bet placed at the MONTH
 * grain (the standing posture, #366) rather than a day's. The feed did not need
 * a month mode to carry it — a beat is a starred entity with a fate whatever
 * clock it came off, which is what "self-similar" was claiming and this is the
 * test of it.
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
  vehicle_sold_to_other: {
    // Two customers, one car (#364). Instructive: it is the lot telling you it
    // was one unit deep on something two people wanted.
    starworthy: true,
    text: (who) =>
      `${who} wanted a car another customer bought first. Walked.`,
  },
  finance_fell_through: {
    // The store reached on the rate and the bank passed (#367). Instructive:
    // it is the standing F&I posture showing up as a lost sale, which is the
    // only way "More per deal" reads as a trade rather than free money.
    starworthy: true,
    text: (who) =>
      `${who} agreed to buy, but no bank would take the loan at the rate you marked it up to. Walked.`,
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
  // Plain-language, and deliberately the same vocabulary the Finance tab's
  // breakdown already uses ("F&I Products" / "Rate Reserve"): one month's mark
  // and one tab's chart naming the same money two ways is how a player stops
  // believing they are two numbers.
  bestFniPvr: (r) =>
    `Best finance-office month yet — ${money(r.value)} a car from products and the rate, beating ${money(r.previousValue)}.`,
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
 * The monthly F&I verdict's plain-language narrative (#373) — the Reveal beat
 * that resolves the standing posture at the grain the bet was actually placed
 * at, and the plug-in that proves the feed's grammar spans from a daily beat to
 * a monthly strategic one.
 *
 * Two sentences, always in this order. The first **stars an entity with a fate**
 * — the F&I manager who worked the month, or the finance office that sat empty
 * when nobody was hired — never the number, because a bare metric is the thing
 * this feed exists not to be. The second is the mix read: whether the crowd that
 * walked in was the crowd the standing posture was a bet on, in the same
 * plain-language axis the dial itself is labelled on (paid cash ↔ financed).
 *
 * That second sentence is what teaches the #371 wire read and the #372
 * advertising lever without a tutorial: the player is told, in the month they
 * lived, that the crowd's payment mix is a thing that can be read ahead and a
 * thing that can be bought.
 */
export function fniVerdictReactionText(verdict: FniMonthVerdict): string {
  const who = verdict.deskName
    ? `${verdict.deskName} worked the desk on "${verdict.postureLabel}"`
    : `No finance office — "${verdict.postureLabel}" had nobody to carry it out`;
  const earned =
    `${money(verdict.backGross)} on ${plural(verdict.unitsRetailed, 'car', 'cars')} ` +
    `(${money(verdict.productGross)} products, ${money(verdict.reserveGross)} rate).`;
  const financed = `${verdict.financedUnits} of ${verdict.unitsRetailed} financed`;
  const mix =
    verdict.mix === 'too_few_financed'
      ? ` Only ${financed} — a cash-paying crowd, and a rate you mark up earns nothing on the ones who pay cash.`
      : verdict.mix === 'too_many_financed'
        ? ` ${financed} — that crowd was going to borrow anyway, and you held the rate down for them.`
        : ` ${financed} — that was the crowd this posture is a bet on.`;
  return `Month ${verdict.month}: ${who} — ${earned}${mix}`;
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
  | { kind: 'record'; record: CrownedRecord }
  | { kind: 'fni'; verdict: FniMonthVerdict };

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
  if (candidate.kind === 'fni') {
    // A flat term, deliberately with no margin half (#373). The month verdict is
    // not a competition against a previous month — it is the resolution of the
    // bet the player left standing, and it fires on exactly one bite a month, so
    // scaling it by how much money it made would let a quiet month's verdict get
    // pushed off the feed by an ordinary Tuesday's walk-off. The record it may
    // arrive beside (`bestFniPvr`) is where "how good was it" gets scored.
    return drama.weights.fniVerdict;
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

/** Score and sort drama-desc with a stable arrival-order tiebreak. */
function sortByDrama(
  candidates: readonly DramaCandidate[],
  ctx: DramaContext,
): readonly DramaCandidate[] {
  return candidates
    .map((candidate, index) => ({ candidate, index, drama: scoreDrama(candidate, ctx) }))
    .sort((a, b) => b.drama - a.drama || a.index - b.index)
    .map((entry) => entry.candidate);
}

/** Score, sort drama-desc with a stable arrival-order tiebreak, take the top N. */
function topByDrama(
  candidates: readonly DramaCandidate[],
  ctx: DramaContext,
  limit: number,
): readonly DramaCandidate[] {
  return sortByDrama(candidates, ctx).slice(0, limit);
}

/** What the ranking admitted, and how much of the eligible pool it cut (#382). */
export interface DramaPool {
  top: readonly DramaCandidate[];
  /**
   * Eligible candidates the budget left out. A bite states this as one line
   * rather than dropping it silently — a player who sold their best unit ever
   * on day 4 of a quiet week and was never told concludes the feed is noise.
   */
  remainder: number;
}

/**
 * The ranking proper (#382 split it out of `rankDrama` so the cut is countable).
 *
 * Two eligibility gates run before scoring, so ineligible entries never crowd
 * out real drama: non-starworthy walk-offs are dropped entirely, and records
 * are filtered to the crownworthy ones then capped at `drama.crownBudget`.
 *
 * A CROWN IS ADMITTED BEFORE THE BUDGET IS SPENT. #330 weights crowns above the
 * win/loss axes, but weighting is not a guarantee: a week that breaks three
 * marks and also has five loud walk-offs can rank a crown off the end. A
 * high-water mark is the one reaction the player provably cannot see anywhere
 * else on that screen, so it is reserved rather than merely favoured. The
 * admitted set is still emitted in the pool's own drama order — reserving a
 * slot must not reorder the feed.
 */
function rankDramaPool(
  closes: readonly ClosedSale[],
  walkOffs: readonly WalkOff[],
  records: readonly BrokenRecord[],
  limit: number,
  fniVerdict: FniMonthVerdict | null,
): DramaPool {
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
  const ordered = sortByDrama(
    [
      // The month verdict leads the arrival order ahead of the crowns (#373):
      // on the one bite a month where it exists, it is the headline, and a tie
      // with a crown it arrived beside should read verdict-then-crown.
      ...(fniVerdict ? [{ kind: 'fni', verdict: fniVerdict } as DramaCandidate] : []),
      // Crowns lead the arrival order: the day's headline wins an exact tie.
      ...crowns,
      ...closes.map((sale): DramaCandidate => ({ kind: 'win', sale })),
      ...walkOffs
        .filter((w) => isStarworthyWalkOff(w.reason))
        .map((walkOff): DramaCandidate => ({ kind: 'loss', walkOff })),
    ],
    ctx,
  );
  // Crowns first (capped by the budget itself — a feed cannot exceed its own
  // budget), then the rest of the pool in drama order until the budget is out.
  const admitted = new Set<DramaCandidate>(
    ordered.filter((c) => c.kind === 'record').slice(0, limit),
  );
  for (const candidate of ordered) {
    if (admitted.size >= limit) break;
    admitted.add(candidate);
  }
  const top = ordered.filter((c) => admitted.has(c));
  return { top, remainder: ordered.length - top.length };
}

/**
 * Ranks the bite's wins, starworthy losses and crowned records in ONE pool by
 * drama score and takes the top `limit`. Pure + deterministic: ties break by
 * arrival order, and the input arrays are never mutated. See `rankDramaPool`
 * for the gates and the crown reservation; this is the surface for callers that
 * only want the admitted reactions.
 */
export function rankDrama(
  closes: readonly ClosedSale[],
  walkOffs: readonly WalkOff[],
  records: readonly BrokenRecord[],
  limit: number,
  fniVerdict: FniMonthVerdict | null = null,
): readonly DramaCandidate[] {
  return rankDramaPool(closes, walkOffs, records, limit, fniVerdict).top;
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

/**
 * The month verdict's reaction (#373). Tone follows the MIX read, not the money:
 * a month can earn well and still have been the wrong standing bet, and the
 * lesson the beat exists to teach is which crowd the dial was pointed at.
 */
function fniVerdictReaction(verdict: FniMonthVerdict): RevealReaction {
  return {
    id: `fni-month-${verdict.month}`,
    tone: verdict.mix === 'matched' ? 'positive' : 'negative',
    text: fniVerdictReactionText(verdict),
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
    case 'fni':
      return fniVerdictReaction(candidate.verdict);
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

/**
 * The match-summary reaction — always the first (and, at S1, only) entry.
 *
 * `span` names the window the tally covers. It is "today" at the day grain and
 * the bite's own span at any bigger one (#381): a week's pooled figure printed
 * as "gross today" states a number the player can check and find wrong, which
 * is the one thing this feed cannot do.
 */
function matchReaction(
  tally: MatchTally,
  gross: number,
  span = 'today',
): RevealReaction {
  if (tally.matched <= 0) {
    return {
      id: 'match-summary',
      tone: 'neutral',
      text: `No sales closed ${span}. ${money(gross)} gross.`,
    };
  }
  const strong = majorityStrong(tally);
  const verdict = strong
    ? 'you had what the crowd wanted'
    : "the lot didn't fit the crowd";
  return {
    id: 'match-summary',
    tone: strong ? 'positive' : 'negative',
    text: `${tally.strong} of ${tally.matched} stuck — ${verdict}. ${money(gross)} gross ${span}.`,
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
  fniVerdict: FniMonthVerdict | null = null,
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
  // #373: on the first bite after a month closes, the F&I verdict rides the same
  // pool at the month grain — one feed, one grammar, two clocks.
  // #382: the budget is the DAY bite's, read off `data/clock-bites.json` — the
  // same catalog every other grain reads its own from. The day is a bite, so it
  // has no separate constant of its own.
  const topDrama = rankDrama(
    closes,
    walkOffs,
    records,
    biteStarBudget('day'),
    fniVerdict,
  );
  return {
    scoreline,
    reactions: [matchReaction(matchTally, gross), ...topDrama.map(dramaReaction)],
  };
}

// ---------------------------------------------------------------------------
// B4 S1 (#381): the same feed at the BITE grain.
//
// A multi-day run ends in ONE Reveal covering the days that actually ran. This
// is one more producer, not a second mode — #373 already proved the grammar
// spans grains, and the pooled reactions are ranked in the same single
// `rankDrama` pool the day uses. Per-day beats are captured AS EACH DAY CLOSES
// (the daily refs are cleared before the next `nextDay()`), so a runner that
// only read the final day would silently swallow the rest of the bite's wins,
// walk-offs, crowned records and month verdicts.
// ---------------------------------------------------------------------------

/** One closed day's beats, captured at its own day-close. */
export interface BiteDayBeats {
  funnel: DayFunnel;
  gross: number;
  matchTally: MatchTally;
  closes: readonly ClosedSale[];
  walkOffs: readonly WalkOff[];
  prepBet: PrepBet | null;
  records: readonly BrokenRecord[];
  fniVerdict: FniMonthVerdict | null;
}

export interface BiteSpan {
  /**
   * Which bite was run (#382). The star budget rides the bite, so the feed
   * needs to know which grain it is covering — not just how many days landed.
   * A week that halted on day 2 still gets the week's budget: the budget is a
   * property of the window the player bet on, not of how far it got.
   */
  biteId: BiteId;
  /** Days the bite asked for — 7 for the week, whatever halted or not. */
  daysRequested: number;
  /**
   * The halt's plain-language sentence, stated verbatim; null when the run
   * completed. Off `data/clock-bites.json` via ClockBite — never phrased here.
   */
  haltSentence: string | null;
}

/** Sum the funnel across the bite; the leak is the one that led on most days. */
function poolFunnel(days: readonly BiteDayBeats[]): DayFunnel {
  const leakDays = new Map<DayFunnel['leakCause'], number>();
  for (const d of days) {
    leakDays.set(d.funnel.leakCause, (leakDays.get(d.funnel.leakCause) ?? 0) + 1);
  }
  let leakCause = days[0].funnel.leakCause;
  let best = 0;
  for (const [cause, count] of leakDays) {
    if (count > best) {
      best = count;
      leakCause = cause;
    }
  }
  return {
    potentialTraffic: days.reduce((n, d) => n + d.funnel.potentialTraffic, 0),
    walkedIn: days.reduce((n, d) => n + d.funnel.walkedIn, 0),
    gated: days.reduce((n, d) => n + d.funnel.gated, 0),
    staffEngaged: days.reduce((n, d) => n + d.funnel.staffEngaged, 0),
    sold: days.reduce((n, d) => n + d.funnel.sold, 0),
    leakCause,
  };
}

/** The pooled totals a bite's recap and Reveal are both built from. */
export function poolBiteDays(days: readonly BiteDayBeats[]): {
  funnel: DayFunnel;
  gross: number;
  matchTally: MatchTally;
  closes: readonly ClosedSale[];
  walkOffs: readonly WalkOff[];
  records: readonly BrokenRecord[];
  fniVerdict: FniMonthVerdict | null;
} {
  return {
    funnel: poolFunnel(days),
    gross: days.reduce((n, d) => n + d.gross, 0),
    matchTally: {
      strong: days.reduce((n, d) => n + d.matchTally.strong, 0),
      matched: days.reduce((n, d) => n + d.matchTally.matched, 0),
    },
    closes: days.flatMap((d) => [...d.closes]),
    walkOffs: days.flatMap((d) => [...d.walkOffs]),
    records: days.flatMap((d) => [...d.records]),
    // At most one month can close inside a bite — a bite that crosses a month
    // boundary halts on the gate verdict — so the last one told is the one.
    fniVerdict: days.reduce<FniMonthVerdict | null>(
      (v, d) => d.fniVerdict ?? v,
      null,
    ),
  };
}

/**
 * The Reveal for a whole bite. Reactions are pooled from every day that ran and
 * ranked in the single existing drama pool.
 *
 * A one-day bite delegates straight to `buildReveal` — the live floor's day is
 * the day it has always been, including its morning bet. The bet at BITE grain
 * is #383's, deliberately not resolved here: pooling a week of per-day bets
 * into one verdict is a different bet, and inventing one now would be a rule
 * the player was never shown placing.
 */
export function buildBiteReveal(
  days: readonly BiteDayBeats[],
  span: BiteSpan,
): RevealModel {
  if (days.length === 0) {
    return {
      scoreline: `0 of ${span.daysRequested} days run.`,
      reactions: span.haltSentence
        ? [{ id: 'bite-halt', tone: 'neutral', text: span.haltSentence }]
        : [],
    };
  }
  if (span.daysRequested === 1) {
    const d = days[0];
    return buildReveal(
      d.funnel,
      d.gross,
      d.matchTally,
      d.closes,
      d.walkOffs,
      d.prepBet,
      d.records,
      d.fniVerdict,
    );
  }
  const pooled = poolBiteDays(days);
  // "3 of 7 days run" is itself the statement that the run stopped early; the
  // halt reaction below says why. Both, because the scoreline is what the
  // player reads first and the reason is what they act on.
  const spanClause = span.haltSentence
    ? `${days.length} of ${span.daysRequested} days run`
    : `${days.length} days run`;
  // The window the pooled figures actually cover. A week's gross printed as
  // "gross today" states a number the player can check and find wrong.
  const spanWord = `over ${days.length} days`;
  // #382: the budget rides the bite. A week runs seven days through the pool,
  // so a day's budget would throw away roughly seven times as much — and throw
  // it away silently, which is the failure: a player who sold their best unit
  // ever on day 4 of a quiet week finishes the week never told and concludes
  // the feed is noise.
  const pool = rankDramaPool(
    pooled.closes,
    pooled.walkOffs,
    pooled.records,
    biteStarBudget(span.biteId),
    pooled.fniVerdict,
  );
  const haltReactions: RevealReaction[] = span.haltSentence
    ? [{ id: 'bite-halt', tone: 'neutral', text: span.haltSentence }]
    : [];
  return {
    scoreline: `${spanClause} — ${matchClause(pooled.matchTally)}.`,
    reactions: [
      ...haltReactions,
      matchReaction(pooled.matchTally, pooled.gross, spanWord),
      ...pool.top.map(dramaReaction),
      ...remainderReactions(pool.remainder, spanWord),
    ],
  };
}

/**
 * What the budget left out, stated as ONE line (#382) — never dropped, and
 * never expanded into a list. The feed's job is the top of the pile; a surface
 * that can show everything is a report, not a Reveal.
 *
 * Deliberately absent at the DAY grain: a day's handful of beats through a
 * day's budget is the feed doing its job, and #382 filed the day's Reveal as
 * identical to before this slice. The line exists because a bite discards
 * multiples more.
 */
function remainderReactions(
  remainder: number,
  spanWord: string,
): readonly RevealReaction[] {
  if (remainder <= 0) return [];
  const moments = remainder === 1 ? 'smaller moment' : 'smaller moments';
  return [
    {
      id: 'bite-remainder',
      tone: 'neutral',
      text: `Plus ${remainder} ${moments} ${spanWord}, too small to make the cut.`,
    },
  ];
}
