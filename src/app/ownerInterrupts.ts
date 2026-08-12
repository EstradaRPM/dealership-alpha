import { z } from 'zod';
import { parseData } from '../game/data';
import type { EventBus, EventName, EventPayload } from '../game/EventBus';

/**
 * The overnight interrupt channel (#384).
 *
 * A bite (#381) runs the store without the player, and the tracer stopped it on
 * the things that happen **on the floor** — an escalation, insolvency, a gate
 * verdict. The game's other class of "a moment you play" fires **between** days,
 * in the overnight managerial window: somebody asks for a raise, a rival makes
 * one of your people an offer. Inside a multi-day run every one of those would
 * be raised and cleared with nobody there to answer — the store auto-answering
 * by silence.
 *
 * This lives at the composition root because the composition root is the only
 * layer that knows what "a moment the player is needed" looks like in this app —
 * the same reason ClockBite takes no `EventBus` and latches nothing itself.
 *
 * **Registration, not enumeration.** A moment is declared once, here, with the
 * event that raises it and the read that names who needs the owner; the runner
 * learns no event names at all, and `useDayLoop` learns only "the channel
 * raised something". A hard-coded list of event names inside the runner is how
 * the fifth overnight prompt built next year silently becomes a moment the bite
 * answers for the player.
 *
 * **The test is a DECISION, not notability.** A finished construction job and a
 * news beat with no choice attached are not declared: they ride the Reveal like
 * any other beat. Halting on everything notable turns a week into seven days
 * with extra steps.
 */

export const OWNER_INTERRUPT_IDS = ['raise_demand', 'rival_offer'] as const;
export type OwnerInterruptId = (typeof OWNER_INTERRUPT_IDS)[number];

const OwnerInterruptCopySchema = z
  .object({
    id: z.enum(OWNER_INTERRUPT_IDS),
    /**
     * Fills the `{subject}` slot of the `owner_interrupt` halt sentence in
     * `data/clock-bites.json`. Its own `{person}` / `{rival}` slots are filled
     * at raise time from the moment's payload and the live roster.
     */
    subject: z.string().min(1),
  })
  .strict();

// Top level is deliberately NOT `.strict()` — the `_doc` annotations are the
// file's own record of why these moments halt and the others do not, and Zod
// strips them. Every nested object IS strict.
export const OwnerInterruptsConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    interrupts: z.array(OwnerInterruptCopySchema).nonempty(),
  })
  .refine(
    (c) => new Set(c.interrupts.map((i) => i.id)).size === c.interrupts.length,
    { message: 'owner interrupt ids must be unique' },
  )
  // A declared interrupt with no copy has nothing to state, which is how a run
  // stops with a sentence naming nobody.
  .refine(
    (c) => OWNER_INTERRUPT_IDS.every((id) => c.interrupts.some((i) => i.id === id)),
    { message: 'every owner interrupt id must be declared' },
  );

export type OwnerInterruptsConfig = z.infer<typeof OwnerInterruptsConfigSchema>;

export function loadOwnerInterrupts(): OwnerInterruptsConfig {
  const raw: unknown = require('../../data/owner-interrupts.json');
  return parseData(raw, OwnerInterruptsConfigSchema, 'data/owner-interrupts.json');
}

/**
 * What a declaration is allowed to know about the store when it names its
 * subject. Deliberately one narrow read rather than the `World`: an interrupt
 * declaration decides whether the player has a decision, not what the store
 * should do about it.
 */
export interface OwnerInterruptContext {
  /** The person's name, or null when they are no longer on the roster. */
  staffName: (staffId: string) => string | null;
}

/** A moment that stopped a run, and the phrase naming who needed the owner. */
export interface OwnerInterrupt {
  id: OwnerInterruptId;
  /** Fills the halt sentence's `{subject}` slot. */
  subject: string;
}

/** A registered moment, with its payload type erased so the set is one list. */
export interface OwnerInterruptDecl {
  readonly id: OwnerInterruptId;
  readonly event: EventName;
  readonly slots: (
    payload: unknown,
    ctx: OwnerInterruptContext,
  ) => Readonly<Record<string, string>> | null;
}

/**
 * Declare a moment as one that needs the owner.
 *
 * `slots` returns the values for this interrupt's `subject` copy, or **null**
 * when the moment is not this interrupt. Null is the one "does not halt"
 * answer there is: a moment that asks the owner nothing simply has no
 * declaration, and a declaration that cannot name its subject is not a decision
 * anybody can act on. Two declarations may share an event — the raise and the
 * poach are one event family (#357) and two different sentences, so which one a
 * given morning is falls out of the payload rather than out of a second event.
 */
export function declareOwnerInterrupt<K extends EventName>(decl: {
  id: OwnerInterruptId;
  event: K;
  slots: (
    payload: EventPayload<K>,
    ctx: OwnerInterruptContext,
  ) => Readonly<Record<string, string>> | null;
}): OwnerInterruptDecl {
  return {
    id: decl.id,
    event: decl.event,
    // The one erasure point: the bus hands back the payload for `decl.event`,
    // which is exactly `EventPayload<K>`, but a heterogeneous list of
    // declarations cannot carry that per-entry.
    slots: (payload, ctx) => decl.slots(payload as EventPayload<K>, ctx),
  };
}

/**
 * The registered overnight moments.
 *
 * Only `staff:raise_requested` qualifies today, in its two forms. The other
 * overnight beats were weighed and are deliberately absent: a finished build
 * (`facility:capacity_built`) and a published headline
 * (`news:headline_published`) report, they do not ask.
 */
export const OWNER_INTERRUPTS: readonly OwnerInterruptDecl[] = [
  // #356 — they outgrew their pay and asked for themselves. Two buttons, and
  // the wage the drain charges from tomorrow depends on which one is pressed.
  declareOwnerInterrupt({
    id: 'raise_demand',
    event: 'staff:raise_requested',
    slots: (p, ctx) => {
      if (p.rivalName) return null;
      const person = ctx.staffName(p.staffId);
      return person ? { person } : null;
    },
  }),
  // #357 — the same moment with a name and a deadline on it. This is the one
  // that most needs the channel: the offer expires on `deadlineDay`, so a run
  // that drove past it would let the store lose the person without ever putting
  // the choice in front of the owner.
  declareOwnerInterrupt({
    id: 'rival_offer',
    event: 'staff:raise_requested',
    slots: (p, ctx) => {
      if (!p.rivalName) return null;
      const person = ctx.staffName(p.staffId);
      return person ? { person, rival: p.rivalName } : null;
    },
  }),
];

export interface OwnerInterruptChannel {
  /** Drop every subscription (session teardown). */
  dispose: () => void;
}

/**
 * Wire the declared moments to the bus.
 *
 * The channel does not know whether a bite is running — it reports that a
 * moment needs the owner, and the caller decides what that means. That is what
 * keeps day-by-day play byte-identical to before this slice: with no run in
 * progress the raise is reported to a handler that does nothing with it, and
 * the prompt is presented by the surface that already presents it.
 */
export function createOwnerInterruptChannel(
  bus: EventBus,
  onRaised: (interrupt: OwnerInterrupt) => void,
  ctx: OwnerInterruptContext,
  decls: readonly OwnerInterruptDecl[] = OWNER_INTERRUPTS,
  config: OwnerInterruptsConfig = loadOwnerInterrupts(),
): OwnerInterruptChannel {
  const copyFor = (id: OwnerInterruptId) => {
    const copy = config.interrupts.find((i) => i.id === id);
    // The schema refuses a file missing any declared id, so this is a
    // programming error rather than a data one.
    if (!copy) throw new Error(`OwnerInterrupt: unknown interrupt "${id}"`);
    return copy.subject;
  };

  const bound = decls.map((decl) => {
    const listener = (payload: unknown) => {
      const slots = decl.slots(payload, ctx);
      if (!slots) return;
      onRaised({ id: decl.id, subject: fillSlots(copyFor(decl.id), slots) });
    };
    bus.subscribe(decl.event, listener);
    return { event: decl.event, listener };
  });

  return {
    dispose: () => {
      for (const b of bound) bus.unsubscribe(b.event, b.listener);
    },
  };
}

/**
 * The industry-wire filler, one file over: an unfilled slot is left literal so
 * a missing value reads as a visibly wrong sentence rather than a silently
 * truncated one.
 */
function fillSlots(text: string, slots: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => slots[key] ?? whole);
}
