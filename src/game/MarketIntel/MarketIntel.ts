import type { Economy } from '../Economy';
import {
  loadNewsGatingConfig,
  type NewsGatingConfig,
} from './marketIntelConfig';
import { resolveNewsAccess } from './newsAccess';
import type {
  MarketIntel,
  MarketIntelSnapshot,
  NewsAccess,
  NewsAccessRead,
  SubscriptionOption,
} from './types';

export interface MarketIntelDeps {
  /**
   * The money ledger. Only `forceDebit` is needed: a standing subscription
   * posts even on a low balance (mirrors rent/payroll) rather than throwing
   * mid-day — you don't get to read the wire for free because you're broke.
   */
  economy: Pick<Economy, 'forceDebit'>;
  config?: NewsGatingConfig;
}

/**
 * MarketIntel (#178, parent #150) — what the player has access to *know*, and
 * what that access costs.
 *
 * The industry wire publishes everything the market engine does; this module
 * owns the other half of the loop — which lanes of it reach the player, and the
 * two currencies that open them: **money** (a standing data subscription, its
 * cost debited every day it's on) and **people** (a used car manager on the
 * desk, whose forward calls come free with the hire per the channel-desk
 * `advise` rule). Career tier decides which doors are on the market at all.
 *
 * A library/factory module in the ServiceMarketing mold — **no EventBus
 * participation**. The composition root constructs it, drives `advanceDay` on
 * `clock:day_started`, and resolves access against the live tier + roster.
 *
 * **Determinism.** No randomness, and gating is read-side only: the engine's
 * headline stream is byte-identical whether or not anything is unlocked, so a
 * fixed seed replays the same world (#122) regardless of what the player bought.
 */
export function createMarketIntel(deps: MarketIntelDeps): MarketIntel {
  const config = deps.config ?? loadNewsGatingConfig();

  const subscriptions: readonly SubscriptionOption[] = config.unlocks
    .filter((u) => u.kind === 'subscription')
    .map((u) => ({
      id: u.id,
      label: u.label,
      blurb: u.blurb,
      dailyCost: u.dailyCost ?? 0,
      minTier: u.minTier,
    }));
  const byId = new Map(subscriptions.map((s) => [s.id, s]));

  const active = new Set<string>();

  /** Active ids in catalog order — a stable read for saves and for the UI. */
  function activeIds(): readonly string[] {
    return subscriptions.filter((s) => active.has(s.id)).map((s) => s.id);
  }

  return {
    subscriptions,
    config,

    isSubscribed: (id) => active.has(id),
    activeSubscriptions: activeIds,

    setSubscribed(id, on) {
      if (!byId.has(id)) throw new Error(`Unknown wire subscription '${id}'`);
      if (on) active.add(id);
      else active.delete(id);
    },

    dailySpend() {
      let total = 0;
      for (const id of active) total += byId.get(id)?.dailyCost ?? 0;
      return total;
    },

    accessFor(read: Omit<NewsAccessRead, 'activeSubscriptions'>): NewsAccess {
      return resolveNewsAccess(
        { ...read, activeSubscriptions: activeIds() },
        config,
      );
    },

    advanceDay(_day) {
      for (const id of activeIds()) {
        const sub = byId.get(id);
        if (sub && sub.dailyCost > 0) {
          deps.economy.forceDebit(sub.dailyCost, `Wire subscription: ${sub.id}`);
        }
      }
    },

    snapshot: (): MarketIntelSnapshot => ({
      schemaVersion: 1,
      activeSubscriptions: activeIds(),
    }),

    restore(snap: MarketIntelSnapshot) {
      // Defensive, mirroring ServiceMarketing: a subscription that no longer
      // exists in data is dropped rather than restored as a dangling id that
      // would bill for a product the catalog no longer sells.
      active.clear();
      for (const id of snap.activeSubscriptions) {
        if (byId.has(id)) active.add(id);
      }
    },
  };
}

export function createDefaultMarketIntelSnapshot(): MarketIntelSnapshot {
  return { schemaVersion: 1, activeSubscriptions: [] };
}
