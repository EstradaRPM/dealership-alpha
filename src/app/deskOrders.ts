import { z } from 'zod';
import { parseData } from '../game/data';
import type { BiteHalt } from '../game/ClockBite';
import type { SourcingLean } from '../game/MarketEconomy';
import type { World } from '../createWorld';
import {
  buildManagerStatus,
  DEFAULT_SOURCING_LEAN,
  FNI_POSTURE,
  PRICING_STRATEGIES,
} from './config';

/**
 * Standing desk orders (#385, closing #124's second must-handle class).
 *
 * A bite (#381) runs the store on the player's **standing orders** — that is
 * literally what the stakes copy wagers ("the lot you stocked and the policy
 * you set have to carry them"). So an order that no desk can carry out is the
 * run proceeding on a policy that is not actually in force, silently, for up to
 * thirty days. That is a decision the owner has to make — put the dial back, or
 * hire/grow the desk that executes it — and a decision is what stops a run.
 *
 * **An order only counts once the player has moved the dial off its default.**
 * The default *is* "no instruction": market pricing is the honest suggestion
 * the store already stamps on an intake, a flat lean expresses no preference,
 * and the default F&I posture makes no bet on the payment mix. So a player who
 * never touched a dial is never halted by this, and the halt is a consequence
 * of a choice rather than a tax on the ladder.
 *
 * **Registration, not enumeration**, the same shape as the overnight interrupt
 * channel (`ownerInterrupts.ts`): a lever is declared once with the two reads
 * that decide it, and the runner learns nothing. This lives at the composition
 * root for the same reason that channel does — it is the only layer that sees
 * both the player's dials and the roster that executes them, and ClockBite
 * takes no `EventBus` and imports no sibling.
 */

export const DESK_ORDER_IDS = [
  'pricing_strategy',
  'sourcing_lean',
  'fni_posture',
] as const;
export type DeskOrderId = (typeof DESK_ORDER_IDS)[number];

const DeskOrderCopySchema = z
  .object({
    id: z.enum(DESK_ORDER_IDS),
    /**
     * Fills the `{subject}` slot of the `desk_order` halt sentence in
     * `data/clock-bites.json` — the halt's cadence is written once there and
     * who-could-not-do-what once here.
     */
    subject: z.string().min(1),
  })
  .strict();

// Top level is deliberately NOT `.strict()` — the `_doc` annotations are the
// file's record of why a dial off its default is a decision, and Zod strips
// them. Every nested object IS strict.
export const DeskOrdersConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    orders: z.array(DeskOrderCopySchema).nonempty(),
  })
  .refine((c) => new Set(c.orders.map((o) => o.id)).size === c.orders.length, {
    message: 'desk order ids must be unique',
  })
  // A declared order with no copy has nothing to state, which is how a run
  // stops with a sentence naming no dial the player can go and change.
  .refine(
    (c) => DESK_ORDER_IDS.every((id) => c.orders.some((o) => o.id === id)),
    { message: 'every desk order id must be declared' },
  );

export type DeskOrdersConfig = z.infer<typeof DeskOrdersConfigSchema>;

export function loadDeskOrders(): DeskOrdersConfig {
  const raw: unknown = require('../../data/desk-orders.json');
  return parseData(raw, DeskOrdersConfigSchema, 'data/desk-orders.json');
}

/** The dials the player currently has set, straight off the per-slot levers. */
export interface StandingOrders {
  readonly pricingStrategyId: string;
  readonly sourcingLean: SourcingLean;
  readonly fniPostureId: string;
}

/**
 * What a declaration may read: the player's dials, plus the two narrow
 * questions about who can act on them.
 *
 * `delegated` is resolved from `buildManagerStatus` — the **same** act-gate
 * predicate reads the engine gates on, for exactly the reason
 * `resolveBiteCoverage` derives from it: a second read here is how the halt and
 * the desk start disagreeing about what the desk is doing. (#371's deleted
 * `hasDeskManager` boolean is the standing example.)
 */
export interface DeskOrderRead extends StandingOrders {
  /** Is a UCM axis at/above its act threshold right now? */
  readonly delegated: (axis: string) => boolean;
  /** Is anybody in this role on the roster right now? */
  readonly staffed: (roleId: string) => boolean;
}

export interface DeskOrderDecl {
  readonly id: DeskOrderId;
  /** Has the player moved this dial off its default — is there an order at all? */
  readonly standing: (read: DeskOrderRead) => boolean;
  /** Can the desk that executes this order act on it? */
  readonly executable: (read: DeskOrderRead) => boolean;
}

/** Two leans are the same instruction iff all three axes agree. */
function sameLean(a: SourcingLean, b: SourcingLean): boolean {
  return (
    a.margin === b.margin &&
    a.condition === b.condition &&
    a.demandFit === b.demandFit
  );
}

/**
 * The registered standing orders.
 *
 * Three of the five per-slot levers are desk orders; the other two are not, and
 * that is a boundary rather than an omission. Hours-of-operation is the owner's
 * own decision and no desk executes it. The **trade policy** is a multiplier
 * applied inside the appraisal math itself — it is in force whoever is standing
 * at the desk — so there is no state in which it goes uncarried-out. Only a
 * lever that a *named desk* performs can be left dead by that desk being absent.
 */
export const DESK_ORDERS: readonly DeskOrderDecl[] = [
  // #285/#289 — the standing auto-pricing policy. Below the UCM's `pricing` act
  // threshold `resolveIntakeAsk` is never consulted and every intake is stamped
  // at the honest market suggestion, so a player who set "hold for gross" has
  // been quietly running at market instead.
  {
    id: 'pricing_strategy',
    standing: (r) => r.pricingStrategyId !== PRICING_STRATEGIES.defaultStrategy,
    executable: (r) => r.delegated('pricing'),
  },
  // #293 — the UCM's sourcing lean. Below the `condition_reading` act threshold
  // `autoSourceFn` returns nothing at all, so a lean toward margin or clean
  // metal buys the store precisely no cars for the length of the run.
  {
    id: 'sourcing_lean',
    standing: (r) => !sameLean(r.sourcingLean, DEFAULT_SOURCING_LEAN),
    executable: (r) => r.delegated('condition_reading'),
  },
  // #366/#369 — the F&I posture. It is a *presence* test, not a threshold: with
  // no `f&i-manager` on the desk the store earns the ambient markup and the
  // posture's markup is not applied to anything (`reserve.ts`), so an aggressive
  // dial on an unstaffed finance office is a bet nobody is placing.
  {
    id: 'fni_posture',
    standing: (r) => r.fniPostureId !== FNI_POSTURE.defaultId,
    executable: (r) => r.staffed('f&i-manager'),
  },
];

/**
 * Assemble the read from the live world plus the player's dials.
 *
 * The roster half comes from the world and the dial half from the per-slot
 * levers, which is why this is assembled here rather than off `World` alone.
 */
export function readDeskOrders(
  world: World,
  orders: StandingOrders,
): DeskOrderRead {
  const status = buildManagerStatus(world);
  return {
    ...orders,
    delegated: (axis) =>
      status.ucm.find((f) => f.axis === axis)?.delegated === true,
    staffed: (roleId) =>
      world.staffOrg.currentRoster.some((s) => s.role_id === roleId),
  };
}

/**
 * The first standing order no desk can carry out, as the halt the runner takes,
 * or `null` when every order the player left is actually in force.
 *
 * "First" is declaration order. A run stops at one thing and states one
 * sentence — the same rule the floor halts and the overnight channel follow —
 * so listing the rest would be a report rather than the moment the run stopped.
 * Fixing that one and running again surfaces the next.
 */
export function findDeadDeskOrder(
  read: DeskOrderRead,
  decls: readonly DeskOrderDecl[] = DESK_ORDERS,
  config: DeskOrdersConfig = loadDeskOrders(),
): BiteHalt | null {
  for (const decl of decls) {
    if (!decl.standing(read) || decl.executable(read)) continue;
    const copy = config.orders.find((o) => o.id === decl.id);
    // The schema refuses a file missing any declared id, so this is a
    // programming error rather than a data one.
    if (!copy) throw new Error(`DeskOrder: unknown order "${decl.id}"`);
    return { id: 'desk_order', subject: copy.subject };
  }
  return null;
}
