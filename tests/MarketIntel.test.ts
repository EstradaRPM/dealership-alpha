import { createMarketIntel } from '../src/game/MarketIntel';
import {
  gateHeadlines,
  loadNewsGatingConfig,
  resolveNewsAccess,
  type NewsGatingConfig,
} from '../src/game/MarketIntel';
import { loadNewsTemplatesConfig } from '../src/game/MarketEconomy';

/**
 * #178 — news progression gating. The engine publishes everything; MarketIntel
 * decides which lanes reach the player, and what opening a lane costs.
 *
 * Isolation tests on the public surface: the access resolution across a full
 * tier × subscription × roster sweep, the headline gate, the daily billing, and
 * the persistence round-trip.
 */

const CONFIG = loadNewsGatingConfig();

function economyStub() {
  const debits: Array<{ amount: number; label: string }> = [];
  return {
    debits,
    economy: {
      forceDebit: (amount: number, label: string) => {
        debits.push({ amount, label });
      },
    },
  };
}

const T1_COLD = { tier: 1, activeSubscriptions: [], hasDeskManager: false };

describe('#178 news access — the free lane', () => {
  it('lets a cold Tier-1 lot read the public voices', () => {
    const access = resolveNewsAccess(T1_COLD, CONFIG);
    // Lot talk, the trade magazine and factory bulletins are what anybody in
    // town already knows — vague, late, or genuinely public.
    expect(access.canRead('lot_talk', 'direct')).toBe(true);
    expect(access.canRead('lot_talk', 'lagging')).toBe(true);
    expect(access.canRead('trade_press', 'lagging')).toBe(true);
    expect(access.canRead('trade_press', 'direct')).toBe(true);
    expect(access.canRead('oem_bulletin', 'direct')).toBe(true);
  });

  it('holds back the paid lanes and the forward calls', () => {
    const access = resolveNewsAccess(T1_COLD, CONFIG);
    expect(access.canRead('auction_report', 'direct')).toBe(false);
    expect(access.canRead('competitor_watch', 'direct')).toBe(false);
    expect(access.canRead('analyst_desk', 'leading')).toBe(false);
    expect(access.canRead('trade_press', 'leading')).toBe(false);
  });

  it('fails OPEN for a voice no lane names', () => {
    // A copy addition that outruns the gating config must never silently hide
    // news about something that really happened (the #177 fallback philosophy).
    const access = resolveNewsAccess(T1_COLD, CONFIG);
    expect(access.canRead('brand_new_voice', 'direct')).toBe(true);
    expect(access.lockFor('brand_new_voice', 'direct')).toBeNull();
  });

  it('resolves an exact source rule over a reliability wildcard', () => {
    // `trade_press`/`direct` is free even though a wildcard lane speaks for a
    // whole tier — specificity decides, not declaration order.
    const config: NewsGatingConfig = {
      ...CONFIG,
      lanes: [
        { source: '*', reliability: 'direct', requires: 'auction_data' },
        { source: 'lot_talk', reliability: '*', requires: null },
      ],
    };
    const access = resolveNewsAccess(T1_COLD, config);
    expect(access.canRead('lot_talk', 'direct')).toBe(true);
    expect(access.canRead('oem_bulletin', 'direct')).toBe(false);
  });
});

describe('#178 news access — the tier sweep', () => {
  const lanes: Array<[string, string]> = [
    ['auction_report', 'direct'],
    ['competitor_watch', 'direct'],
    ['analyst_desk', 'leading'],
  ];

  it('never opens a paid lane on tier alone', () => {
    for (let tier = 1; tier <= 5; tier += 1) {
      const access = resolveNewsAccess(
        { tier, activeSubscriptions: [], hasDeskManager: false },
        CONFIG,
      );
      for (const [source, reliability] of lanes) {
        expect(access.canRead(source, reliability)).toBe(false);
      }
    }
  });

  it('marks an unlock unavailable below its tier and available at or above it', () => {
    const feed = CONFIG.unlocks.find((u) => u.id === 'auction_data');
    if (!feed) throw new Error('auction_data unlock missing from config');
    for (let tier = 1; tier <= 5; tier += 1) {
      const lock = resolveNewsAccess(
        { tier, activeSubscriptions: [], hasDeskManager: false },
        CONFIG,
      ).lockFor('auction_report', 'direct');
      expect(lock?.available).toBe(tier >= feed.minTier);
      // The two hints are different sentences: below tier it names the tier,
      // at tier it names the action.
      expect(lock?.hint).toBe(
        tier >= feed.minTier
          ? feed.lockedHint.replace('{cost}', String(feed.dailyCost))
          : feed.tierLockedHint.replace('{tier}', String(feed.minTier)),
      );
    }
  });

  it('will not open a subscription lane below its tier even if it is somehow paid for', () => {
    const access = resolveNewsAccess(
      { tier: 1, activeSubscriptions: ['auction_data'], hasDeskManager: false },
      CONFIG,
    );
    expect(access.canRead('auction_report', 'direct')).toBe(false);
  });
});

describe('#178 news access — the two currencies', () => {
  it('opens exactly the lane a subscription pays for', () => {
    const access = resolveNewsAccess(
      { tier: 3, activeSubscriptions: ['auction_data'], hasDeskManager: false },
      CONFIG,
    );
    expect(access.canRead('auction_report', 'direct')).toBe(true);
    // Paying for the block does not buy you the rival tracking or the calls.
    expect(access.canRead('competitor_watch', 'direct')).toBe(false);
    expect(access.canRead('analyst_desk', 'leading')).toBe(false);
  });

  it('opens the forward calls on the hire itself, not on a skill threshold', () => {
    // Channel-desk §3: advise is free on hire. A green UCM reads the same wire
    // a seasoned one does — what skill buys is precision elsewhere (#284).
    const access = resolveNewsAccess(
      { tier: 3, activeSubscriptions: [], hasDeskManager: true },
      CONFIG,
    );
    expect(access.canRead('analyst_desk', 'leading')).toBe(true);
    expect(access.canRead('trade_press', 'leading')).toBe(true);
    expect(access.canRead('auction_report', 'direct')).toBe(false);
  });

  it('reports each door as satisfied or not', () => {
    const access = resolveNewsAccess(
      { tier: 3, activeSubscriptions: ['competitor_tracking'], hasDeskManager: true },
      CONFIG,
    );
    const byId = new Map(access.locks.map((l) => [l.id, l]));
    expect(byId.get('competitor_tracking')?.satisfied).toBe(true);
    expect(byId.get('desk_manager')?.satisfied).toBe(true);
    expect(byId.get('auction_data')?.satisfied).toBe(false);
    // Every declared unlock is reported, open or closed — the footer needs the
    // active ones too (there has to be something to cancel).
    expect(access.locks.length).toBe(CONFIG.unlocks.length);
  });
});

describe('#178 gateHeadlines', () => {
  const HEADLINES = [
    { id: 'a', source: 'auction_report', reliability: 'direct' },
    { id: 'b', source: 'lot_talk', reliability: 'lagging' },
    { id: 'c', source: 'analyst_desk', reliability: 'leading' },
  ];

  it('preserves order and marks each row readable or locked', () => {
    const rows = gateHeadlines(HEADLINES, resolveNewsAccess(T1_COLD, CONFIG));
    expect(rows.map((r) => r.headline.id)).toEqual(['a', 'b', 'c']);
    expect(rows.map((r) => r.readable)).toEqual([false, true, false]);
  });

  it('names the door standing in front of each locked row', () => {
    const rows = gateHeadlines(HEADLINES, resolveNewsAccess(T1_COLD, CONFIG));
    const locked = rows.filter((r) => !r.readable);
    expect(locked.map((r) => (r.readable ? null : r.lock.id))).toEqual([
      'auction_data',
      'desk_manager',
    ]);
  });

  it('opens every row once both currencies are spent', () => {
    const rows = gateHeadlines(
      HEADLINES,
      resolveNewsAccess(
        {
          tier: 3,
          activeSubscriptions: ['auction_data', 'competitor_tracking'],
          hasDeskManager: true,
        },
        CONFIG,
      ),
    );
    expect(rows.every((r) => r.readable)).toBe(true);
  });
});

describe('#178 catalog cross-check', () => {
  it('assigns every (source, reliability) the news catalog can publish to a deliberate lane', () => {
    // Guards the free catch-all: a voice added without a lane FAILS OPEN, which
    // is the right failure but the wrong default to discover in play. This
    // spells out the intended lane of every pair the catalog can produce.
    const expected: Record<string, string | null> = {
      'auction_report|direct': 'auction_data',
      'competitor_watch|direct': 'competitor_tracking',
      'analyst_desk|leading': 'desk_manager',
      'trade_press|leading': 'desk_manager',
      'lot_talk|direct': null,
      'lot_talk|lagging': null,
      'trade_press|direct': null,
      'trade_press|lagging': null,
      'oem_bulletin|direct': null,
    };
    const cold = resolveNewsAccess(T1_COLD, CONFIG);
    const catalog = loadNewsTemplatesConfig();
    const pairs = new Set(
      catalog.templates.map((t) => `${t.source}|${t.reliability}`),
    );
    for (const pair of pairs) {
      expect(Object.prototype.hasOwnProperty.call(expected, pair)).toBe(true);
      const [source, reliability] = pair.split('|');
      expect(cold.lockFor(source, reliability)?.id ?? null).toBe(expected[pair]);
    }
    // …and no stale expectation for a voice the catalog dropped.
    for (const pair of Object.keys(expected)) expect(pairs.has(pair)).toBe(true);
  });

  it('gives the weekly column own voice a free recap lane and a gated calls lane', () => {
    const catalog = loadNewsTemplatesConfig();
    const cold = resolveNewsAccess(T1_COLD, CONFIG);
    const source = catalog.weeklyReport.source;
    expect(cold.canRead(source, 'lagging')).toBe(true);
    expect(cold.canRead(source, 'leading')).toBe(false);
  });
});

describe('#178 MarketIntel — subscriptions', () => {
  it('sells only the subscription-kind unlocks', () => {
    const { economy } = economyStub();
    const intel = createMarketIntel({ economy });
    expect(intel.subscriptions.map((s) => s.id)).toEqual(
      CONFIG.unlocks.filter((u) => u.kind === 'subscription').map((u) => u.id),
    );
    expect(intel.subscriptions.every((s) => s.dailyCost > 0)).toBe(true);
  });

  it('toggles on and off, and throws on an id it does not sell', () => {
    const { economy } = economyStub();
    const intel = createMarketIntel({ economy });
    expect(intel.isSubscribed('auction_data')).toBe(false);
    intel.setSubscribed('auction_data', true);
    expect(intel.isSubscribed('auction_data')).toBe(true);
    expect(intel.activeSubscriptions()).toEqual(['auction_data']);
    intel.setSubscribed('auction_data', false);
    expect(intel.activeSubscriptions()).toEqual([]);
    // A staff unlock is not for sale — hiring is the price.
    expect(() => intel.setSubscribed('desk_manager', true)).toThrow(/desk_manager/);
    expect(() => intel.setSubscribed('nope', true)).toThrow(/nope/);
  });

  it('bills every active subscription once a day, and nothing when none are on', () => {
    const { economy, debits } = economyStub();
    const intel = createMarketIntel({ economy });
    intel.advanceDay(1);
    expect(debits).toEqual([]);

    intel.setSubscribed('auction_data', true);
    intel.setSubscribed('competitor_tracking', true);
    intel.advanceDay(2);
    intel.advanceDay(3);
    expect(debits.length).toBe(4);
    expect(debits.reduce((sum, d) => sum + d.amount, 0)).toBe(
      intel.dailySpend() * 2,
    );
    expect(debits[0].label).toMatch(/auction_data/);
  });

  it('resolves access against its own live subscriptions', () => {
    const { economy } = economyStub();
    const intel = createMarketIntel({ economy });
    expect(
      intel.accessFor({ tier: 3, hasDeskManager: false }).canRead('auction_report', 'direct'),
    ).toBe(false);
    intel.setSubscribed('auction_data', true);
    expect(
      intel.accessFor({ tier: 3, hasDeskManager: false }).canRead('auction_report', 'direct'),
    ).toBe(true);
  });

  it('round-trips through a snapshot, and drops a product no longer sold', () => {
    const { economy } = economyStub();
    const intel = createMarketIntel({ economy });
    intel.setSubscribed('competitor_tracking', true);
    const snap = intel.snapshot();

    const reloaded = createMarketIntel({ economy });
    reloaded.restore(snap);
    expect(reloaded.activeSubscriptions()).toEqual(['competitor_tracking']);

    reloaded.restore({ schemaVersion: 1, activeSubscriptions: ['discontinued'] });
    expect(reloaded.activeSubscriptions()).toEqual([]);
  });
});
