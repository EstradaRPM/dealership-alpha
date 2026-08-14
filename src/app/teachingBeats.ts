import type { EventBus } from '../game/EventBus';
import { availableBites, loadClockBites } from '../game/ClockBite';
import type { World } from '../createWorld';
import { money } from '../ui/kit';
import { BEAT_CONDITION_IDS, type BeatConditionId } from '../ui/copy';
import { resolveBiteCoverage } from './config';

/**
 * The progressive-disclosure runner (#395).
 *
 * #213's spine teaches the store's opening moves on day one. Everything the
 * game grew *after* that — the service annuity, the morning bet, parts levels,
 * the body shop's two customers, the finance desk's second profit, runs longer
 * than a day — cannot be taught there: a front-loaded tour of nine mechanics on
 * day one is nine things forgotten by the time any of them is reachable. Each is
 * taught at the moment it **first matters** instead.
 *
 * **Registration, not enumeration — the #384 channel shape exactly.**
 * `data/teaching-beats.json` declares the events that make the game re-ask a
 * beat's question and the condition that has to hold for the answer to be yes.
 * The runner below subscribes to whatever those declarations name and knows no
 * mechanic by name at all: it is generic over the id type, so the catalog and a
 * test's synthetic beats go through byte-identical code.
 *
 * The two halves live apart on purpose. The **declaration** is data, because
 * "when does this matter" is a design fact somebody should be able to read in
 * one file. The **condition** is code, because it is a read of the live store
 * and only the composition root may make one. A beat for a mechanic whose
 * condition already exists needs no code at all.
 */

/**
 * What a condition is allowed to know about the store.
 *
 * Deliberately a handful of narrow reads rather than the `World`: a condition
 * decides whether a mechanic has started mattering, never what the store should
 * do about it. Every accessor is a function so the context is built once and
 * always answers for the store as it stands *now*.
 */
export interface TeachingBeatContext {
  tier: () => number;
  cashOnHand: () => number;
  isCashLow: () => boolean;
  daysBelowFloorToFail: () => number;
  /** Undrawn credit (#392), 0 for a store with no line or no headroom. */
  creditAvailable: () => number;
  hasRole: (roleId: string) => boolean;
  /** #383 — a stocking bet has been captured for the day now open. */
  prepBetCaptured: () => boolean;
  /** The clock's day. 1 is the opening day — nothing has been played yet. */
  currentDay: () => number;
  /** #381 — at least one run longer than a single day is unlocked. */
  runAboveDayUnlocked: () => boolean;
}

export function createTeachingBeatContext(
  worldOf: () => World | null,
): TeachingBeatContext {
  // Every read goes through `worldOf()` rather than closing over a World, so a
  // context built once at mount still answers for the world the player loaded
  // afterwards.
  const w = worldOf;
  // Parsed ONCE. `availableBites`' default argument re-reads and re-validates
  // `data/clock-bites.json` on every call, and `bite_ladder` asks this question
  // on every single `clock:day_started` for as long as it stays untaught — which
  // at Tier 1 is the whole career. A Zod parse per game-day is a cost a teaching
  // question has no business adding to the day loop.
  const bites = loadClockBites();
  return {
    tier: () => w()?.tierManager.currentTier ?? 0,
    cashOnHand: () => w()?.economy.cash ?? 0,
    isCashLow: () => w()?.bankruptcyMonitor.isCashLow ?? false,
    daysBelowFloorToFail: () => w()?.bankruptcyMonitor.daysBelowFloorToFail ?? 0,
    creditAvailable: () => w()?.creditFacility.getFacility().available ?? 0,
    hasRole: (roleId) =>
      w()?.staffOrg.currentRoster.some((s) => s.role_id === roleId) ?? false,
    prepBetCaptured: () => w()?.getPrepBet() != null,
    currentDay: () => w()?.clock.currentDay ?? 1,
    runAboveDayUnlocked: () => {
      const world = w();
      if (!world) return false;
      return availableBites(resolveBiteCoverage(world), bites).some(
        (b) => b.days > 1 && b.unlocked,
      );
    },
  };
}

/**
 * A condition's answer: the `{slot}` fills for the beat's sentences, or **null**
 * when the mechanic has not started mattering yet. Null is the one "not now"
 * answer there is — the same shape `declareOwnerInterrupt`'s `slots` uses, and
 * for the same reason: a moment that cannot state itself is not a moment.
 *
 * An empty object is a *yes with nothing to fill*, which is what most beats
 * are. It is deliberately distinct from null.
 */
export type BeatCondition = (
  ctx: TeachingBeatContext,
  payload: unknown,
) => Readonly<Record<string, string>> | null;

/** Read one field off a bus payload without trusting its shape. */
function payloadField(payload: unknown, key: string): unknown {
  if (typeof payload !== 'object' || payload === null) return undefined;
  return (payload as Record<string, unknown>)[key];
}

/**
 * The conditions, total over `BEAT_CONDITION_IDS`.
 *
 * TypeScript requires this record to be complete, so a condition id added to the
 * catalog's union without a predicate here does not compile — the catalog can
 * never name a question nobody answers.
 */
export const BEAT_CONDITIONS: Readonly<Record<BeatConditionId, BeatCondition>> = {
  /**
   * #394. Tier 1 ONLY, and that is honesty rather than narrowing: running out
   * at Tier 1 ends the career, while Tier 2 contracts you back a tier and
   * Tier 3+ buys a compliance bill — both of which the #326 recovery beat
   * already states when they land.
   *
   * The reach clause is omitted WHOLE for a store with no headroom: the slot is
   * simply absent, so the sentence is never rendered about zero dollars.
   */
  cash_first_low: (ctx) => {
    if (ctx.tier() !== 1 || !ctx.isCashLow()) return null;
    const reach = ctx.creditAvailable();
    return {
      // Exact, not compact (#387): the player is about to act on this figure,
      // and a beat fired against ONE store's position can afford to be exact
      // about it in a way a hint written once against every store never can.
      cash: money(Math.max(0, ctx.cashOnHand())),
      days: String(ctx.daysBelowFloorToFail()),
      ...(reach > 0 ? { reach: money(reach) } : {}),
    };
  },
  /**
   * #383 — a wager is recorded against the day now opening, and it is not the
   * opening day's.
   *
   * The day check is what makes this "when it first matters" rather than "on
   * day one". A bet is captured every morning including the first, but the
   * opening lot is the #296 seed inventory the store came with — so the day-1
   * wager is not the player's and the sentence would be teaching them about a
   * decision they have not made. `nextDay()` skips its advance on the cold
   * start, so day 2 is the first morning the player has had a night to change
   * the lot. It also keeps the card clear of the #213 spine, whose fourth step
   * is the first Run the Day.
   *
   * A lifetime-acquisition read was tried first and is wrong: reconditioning
   * the seed lot posts `inventoryAcquisition` before the player has bought
   * anything, so "has the store spent on stock" is true on day 1.
   */
  prep_bet_offered: (ctx) =>
    ctx.prepBetCaptured() && ctx.currentDay() > 1 ? {} : null,
  /**
   * The advisor is read off the ROSTER, not off the event that woke the
   * question. A hire and a promotion put the same person on the same desk, and
   * a condition that read `roleId` off the payload would have to know both
   * payload shapes to say so.
   */
  service_advisor_on_staff: (ctx) => (ctx.hasRole('service-advisor') ? {} : null),
  /**
   * The one condition that must read its payload: whether a closed deal was
   * financed is a fact about that deal, not about the store afterwards.
   */
  deal_financed: (_ctx, payload) =>
    payloadField(payload, 'paymentMethod') === 'finance' ? {} : null,
  /**
   * Qualifies on the trigger alone. A job the shop could have done and did not
   * is the whole condition — there is nothing further to ask of the store, and
   * saying so explicitly beats inventing a read that is always true.
   */
  job_turned_away: () => ({}),
  /** The Body Shop is dark below the showroom tier. */
  body_shop_open: (ctx) => (ctx.tier() >= 3 ? {} : null),
  /** #381 — the ladder above the day has opened. */
  bite_unlocked_above_day: (ctx) => (ctx.runAboveDayUnlocked() ? {} : null),
};

/** A beat's registration, as the runner sees it: three strings and nothing else. */
export interface BeatDecl<Id extends string> {
  readonly id: Id;
  readonly events: readonly string[];
  readonly when: string;
}

/** A beat that came due, with the fills its condition resolved. */
export interface RaisedBeat<Id extends string> {
  readonly id: Id;
  readonly slots: Readonly<Record<string, string>>;
}

export interface TeachingBeatChannelDeps<Id extends string> {
  readonly decls: readonly BeatDecl<Id>[];
  readonly conditions: Readonly<Record<string, BeatCondition>>;
  readonly ctx: TeachingBeatContext;
  /** The per-slot teaching cell (#386) — the same one hints retire into. */
  readonly hasTaught: (id: Id) => boolean;
  readonly markTaught: (id: Id) => void;
}

export interface TeachingBeatChannel {
  /** Drop every subscription (session teardown). */
  dispose: () => void;
}

/**
 * Wire the declared beats to the bus.
 *
 * Generic over the id type so the shipped catalog and a test's synthetic beats
 * run through identical code — that is what "adding a beat needs no runner
 * edit" means concretely, rather than as a claim.
 *
 * One subscription per (declaration, event) pair. When an event fires, every
 * beat bound to it is asked **in declaration order**, and each one that is due
 * is marked taught and reported. Marking at raise time rather than at dismissal
 * is what stops a beat firing again on the next tick of the same condition —
 * `isCashLow` is true every day, not just the first.
 *
 * The channel does not know whether a bite is running, and deliberately does not
 * halt one: #384's rule is that a moment stops a run when it puts a *decision*
 * in front of the owner. A beat reports, so it is waiting on the card stack when
 * the run ends. It is also why a beat cannot be skipped by a multi-day run —
 * these are bus subscriptions, not a branch inside the day-close handler that an
 * early return could step over.
 */
export function createTeachingBeatChannel<Id extends string>(
  bus: EventBus,
  onRaised: (beat: RaisedBeat<Id>) => void,
  deps: TeachingBeatChannelDeps<Id>,
): TeachingBeatChannel {
  const { decls, conditions, ctx, hasTaught, markTaught } = deps;

  // Group by event so one event's beats are asked in declaration order, in one
  // listener — rather than in whatever order the bus happens to hold N
  // independent subscriptions.
  const byEvent = new Map<string, BeatDecl<Id>[]>();
  for (const decl of decls) {
    for (const event of decl.events) {
      const list = byEvent.get(event) ?? [];
      list.push(decl);
      byEvent.set(event, list);
    }
  }

  const bound: { event: string; listener: (p: unknown) => void }[] = [];
  for (const [event, list] of byEvent) {
    const listener = (payload: unknown) => {
      for (const decl of list) {
        if (hasTaught(decl.id)) continue;
        const condition = conditions[decl.when];
        // The catalog's `when` is a closed union and the registry is total over
        // it, so this is a programming error rather than a data one.
        if (!condition) throw new Error(`TeachingBeat: unknown condition "${decl.when}"`);
        const slots = condition(ctx, payload);
        if (!slots) continue;
        markTaught(decl.id);
        onRaised({ id: decl.id, slots });
      }
    };
    // `event` is validated against EVENT_NAMES at catalog load, so the cast at
    // this one boundary is the erasure of a check that already happened.
    bus.subscribe(event as Parameters<EventBus['subscribe']>[0], listener);
    bound.push({ event, listener });
  }

  return {
    dispose: () => {
      for (const b of bound) {
        bus.unsubscribe(
          b.event as Parameters<EventBus['unsubscribe']>[0],
          b.listener,
        );
      }
    },
  };
}

/** Re-exported so a caller needs one import to build a channel. */
export { BEAT_CONDITION_IDS };
