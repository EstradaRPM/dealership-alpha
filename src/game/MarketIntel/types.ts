import type { NewsGatingConfig } from './marketIntelConfig';

/** What a lane costs to open, and in which currency. */
export type UnlockKind = 'subscription' | 'staff';

/** A purchasable wire subscription, as the player sees it. */
export interface SubscriptionOption {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
  readonly dailyCost: number;
  readonly minTier: number;
}

/**
 * One closed door between the player and a lane of the wire. Carries the
 * plain-language sentence that says how to open it — the *aspirational hint* of
 * #178: a locked row's whole job is telling you what you're missing and what it
 * would take.
 */
export interface NewsLock {
  readonly id: string;
  readonly kind: UnlockKind;
  /** "Auction data feed" / "A used car manager on the desk". */
  readonly label: string;
  /** What it gets you, in the player's words — shown once it's open. */
  readonly blurb: string;
  /** What opens it, in the player's words. Already cost-filled. */
  readonly hint: string;
  /** Daily cost when this is a subscription, else null. */
  readonly dailyCost: number | null;
  /** Whether the player's tier lets them act on the hint yet. */
  readonly available: boolean;
  /** Whether the door is already open (subscribed / manager hired). */
  readonly satisfied: boolean;
}

/**
 * The player's read access to the wire, resolved from tier + purchases + who is
 * on the desk. Pure lookup — holds no state of its own.
 */
export interface NewsAccess {
  /** Can the player read a headline from this (source, reliability) lane? */
  canRead(source: string, reliability: string): boolean;
  /**
   * The first door standing in the way, or null when the lane is open. A lane
   * reachable two ways reports the first shut one — enough for a headline row,
   * which has space for a single sentence.
   */
  lockFor(source: string, reliability: string): NewsLock | null;
  /**
   * EVERY door standing in the way, in declaration order — empty when the lane
   * is open. A surface with room to state both alternatives uses this, so a
   * lane the player could either buy or hire into says both out loud (#371).
   */
  locksFor(source: string, reliability: string): readonly NewsLock[];
  /** Every unlock the config defines, in declaration order, with live state. */
  readonly locks: readonly NewsLock[];
}

/** Everything the access resolution needs to know about the player. */
export interface NewsAccessRead {
  readonly tier: number;
  /** Subscription ids currently being paid for. */
  readonly activeSubscriptions: readonly string[];
  /**
   * The staff role ids currently on the roster. A staff door names the role
   * that opens it (`NewsUnlock.role`) and this is the key ring — read the same
   * way `activeSubscriptions` is read, so the two currencies share one rule.
   *
   * Access is always the HIRE, never a skill threshold: reading what is coming
   * is part of the job (manager-roles-channel-desk.md §3, "advise is free on
   * hire") for the used car manager's forward calls and for the F&I manager's
   * read on how the crowd pays (#371).
   */
  readonly staffedDesks: readonly string[];
}

/** The engine-side shape the gate needs off a published headline. */
export interface GateableHeadline {
  readonly source: string;
  readonly reliability: string;
}

/**
 * One headline as it reaches the UI: either readable, or a locked row that
 * still says who filed it and when — the tease is the mechanic.
 */
export type GatedHeadline<H extends GateableHeadline> =
  | { readonly readable: true; readonly headline: H }
  | { readonly readable: false; readonly headline: H; readonly lock: NewsLock };

export interface MarketIntelSnapshot {
  readonly schemaVersion: 1;
  readonly activeSubscriptions: readonly string[];
}

/**
 * MarketIntel — what the player has access to know, and what that access costs.
 *
 * A library/factory module in the ServiceMarketing mold: no EventBus
 * participation, driven by the composition root (`advanceDay` on the day tick,
 * which debits every active subscription).
 */
export interface MarketIntel {
  /** Every subscription the catalog sells, in declaration order. */
  readonly subscriptions: readonly SubscriptionOption[];
  readonly config: NewsGatingConfig;
  isSubscribed(id: string): boolean;
  /** Active subscription ids, in catalog order. */
  activeSubscriptions(): readonly string[];
  /** Throws on an unknown id — a typo must not silently no-op. */
  setSubscribed(id: string, on: boolean): void;
  /** Total daily burn of the active subscriptions. */
  dailySpend(): number;
  /** Resolve read access for the given player state. */
  accessFor(read: Omit<NewsAccessRead, 'activeSubscriptions'>): NewsAccess;
  /** Debit each active subscription. Called on `clock:day_started`. */
  advanceDay(day: number): void;
  snapshot(): MarketIntelSnapshot;
  restore(snap: MarketIntelSnapshot): void;
}
