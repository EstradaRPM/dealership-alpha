import {
  suggestListPrice,
  resolveIntakeAsk,
  classifyPricePosition,
  deriveCompetitorComps,
  loadPricingStrategiesConfig,
  type PricingStrategiesConfig,
} from '../src/game/MarketEconomy';

const config: PricingStrategiesConfig = loadPricingStrategiesConfig();

describe('suggestListPrice', () => {
  // book well below market so the market target always clears the gross floor.
  const base = { bookValue: 18000, marketPrice: 22000 };

  test('market strategy targets honest market price', () => {
    const r = suggestListPrice({ ...base, strategy: 'market' }, { config });
    expect(r.marketTarget).toBe(22000);
    expect(r.suggestedPrice).toBe(22000);
    expect(r.floored).toBe(false);
  });

  test('aggressive lists above market, value below', () => {
    const agg = suggestListPrice({ ...base, strategy: 'aggressive' }, { config });
    const val = suggestListPrice({ ...base, strategy: 'value' }, { config });
    expect(agg.suggestedPrice).toBeGreaterThan(22000);
    expect(val.suggestedPrice).toBeLessThan(22000);
  });

  test('gross floor binds when market target dips below book + target gross', () => {
    // Thin-margin unit: market barely above book. Value posture would list
    // below the book+gross floor, so the floor wins.
    const r = suggestListPrice(
      { bookValue: 20000, marketPrice: 20200, strategy: 'value' },
      { config },
    );
    expect(r.floored).toBe(true);
    expect(r.suggestedPrice).toBe(r.floor);
    expect(r.suggestedPrice).toBeGreaterThan(r.marketTarget);
  });

  test('unknown strategy id falls back to the default strategy', () => {
    const fallback = suggestListPrice(
      { ...base, strategy: 'nonsense' },
      { config },
    );
    const def = suggestListPrice(
      { ...base, strategy: config.defaultStrategy },
      { config },
    );
    expect(fallback.suggestedPrice).toBe(def.suggestedPrice);
  });

  test('deterministic — same input yields same output', () => {
    const a = suggestListPrice({ ...base, strategy: 'aggressive' }, { config });
    const b = suggestListPrice({ ...base, strategy: 'aggressive' }, { config });
    expect(a).toEqual(b);
  });
});

describe('resolveIntakeAsk (#285, spine S13)', () => {
  const base = { bookValue: 18000, marketPrice: 22000 };

  test('locked (no UCM) → ask sits at the honest market suggestion, strategy ignored', () => {
    const market = resolveIntakeAsk(
      { ...base, strategy: 'market', automationUnlocked: false },
      { config },
    );
    const aggressive = resolveIntakeAsk(
      { ...base, strategy: 'aggressive', automationUnlocked: false },
      { config },
    );
    expect(market).toBe(22000);
    // Suggestion-only: the toggle does NOT move the default ask below the gate.
    expect(aggressive).toBe(22000);
  });

  test('unlocked (UCM) → ask follows the strategy target', () => {
    const aggressive = resolveIntakeAsk(
      { ...base, strategy: 'aggressive', automationUnlocked: true },
      { config },
    );
    const value = resolveIntakeAsk(
      { ...base, strategy: 'value', automationUnlocked: true },
      { config },
    );
    expect(aggressive).toBe(
      suggestListPrice({ ...base, strategy: 'aggressive' }, { config })
        .suggestedPrice,
    );
    expect(aggressive).toBeGreaterThan(22000);
    expect(value).toBeLessThan(22000);
  });
});

describe('resolveIntakeAsk execution drift (channel-desk M5 #292)', () => {
  const base = { bookValue: 18000, marketPrice: 22000 };
  const driftConfig = { maxDriftFraction: 0.2, skillReference: 90 };
  const target = suggestListPrice(
    { ...base, strategy: 'market' },
    { config },
  ).suggestedPrice;

  // Average |ask − target| over a spread of seeds at a given UCM pricing skill.
  const meanDeviation = (skill: number): number => {
    let total = 0;
    const n = 300;
    for (let i = 0; i < n; i++) {
      const ask = resolveIntakeAsk(
        {
          ...base,
          strategy: 'market',
          automationUnlocked: true,
          drift: { ucmPricingSkill: skill, seed: 1000 + i, config: driftConfig },
        },
        { config },
      );
      total += Math.abs(ask - target);
    }
    return total / n;
  };

  test('drift is deterministic in (skill, seed)', () => {
    const input = {
      ...base,
      strategy: 'market',
      automationUnlocked: true,
      drift: { ucmPricingSkill: 50, seed: 777, config: driftConfig },
    } as const;
    expect(resolveIntakeAsk(input, { config })).toBe(
      resolveIntakeAsk(input, { config }),
    );
  });

  test('higher skill → tighter adherence (smaller mis-price)', () => {
    expect(meanDeviation(30)).toBeGreaterThan(meanDeviation(60));
    expect(meanDeviation(60)).toBeGreaterThan(meanDeviation(85));
  });

  test('a UCM at/above skillReference nails the target exactly', () => {
    const ask = resolveIntakeAsk(
      {
        ...base,
        strategy: 'market',
        automationUnlocked: true,
        drift: { ucmPricingSkill: 90, seed: 5, config: driftConfig },
      },
      { config },
    );
    expect(ask).toBe(target);
  });

  test('never lists below the gross floor even with a sloppy desk', () => {
    // Thin-margin unit: the suggestion is floored, so any downward drift must
    // still clamp at the floor (the desk won't sell under cost-plus-target).
    const thin = { bookValue: 20000, marketPrice: 20200 };
    const floor = suggestListPrice({ ...thin, strategy: 'value' }, { config }).floor;
    for (let i = 0; i < 200; i++) {
      const ask = resolveIntakeAsk(
        {
          ...thin,
          strategy: 'value',
          automationUnlocked: true,
          drift: { ucmPricingSkill: 0, seed: i, config: driftConfig },
        },
        { config },
      );
      expect(ask).toBeGreaterThanOrEqual(floor);
    }
  });
});

describe('classifyPricePosition', () => {
  const market = 20000;

  test('classifies the full band ladder', () => {
    expect(classifyPricePosition(16000, market, { config })).toBe('fire-sale'); // 0.80
    expect(classifyPricePosition(19000, market, { config })).toBe('below-market'); // 0.95
    expect(classifyPricePosition(20000, market, { config })).toBe('at-market'); // 1.00
    expect(classifyPricePosition(21000, market, { config })).toBe('above-market'); // 1.05
    expect(classifyPricePosition(24000, market, { config })).toBe('wishful'); // 1.20
  });

  test('non-positive market price is always wishful', () => {
    expect(classifyPricePosition(15000, 0, { config })).toBe('wishful');
  });

  test('monotonic — position never moves backward as ask rises', () => {
    const order: Record<string, number> = {
      'fire-sale': 0,
      'below-market': 1,
      'at-market': 2,
      'above-market': 3,
      wishful: 4,
    };
    let prev = -1;
    for (let ask = 12000; ask <= 28000; ask += 250) {
      const rank = order[classifyPricePosition(ask, market, { config })];
      expect(rank).toBeGreaterThanOrEqual(prev);
      prev = rank;
    }
  });
});

describe('deriveCompetitorComps', () => {
  const competitors = [
    { id: 'a', name: 'Budget Bros', price_point: 'budget', pricing: 0.2 },
    { id: 'b', name: 'Fair Deal', price_point: 'standard', pricing: 0.5 },
    { id: 'c', name: 'Luxe Motors', price_point: 'premium', pricing: 0.9 },
  ];

  test('at-market competitor comps at the market price; lean spreads around it', () => {
    const comps = deriveCompetitorComps(20000, competitors, { config });
    const [low, mid, high] = comps;
    expect(mid.price).toBe(20000);
    expect(low.price).toBeLessThan(20000);
    expect(high.price).toBeGreaterThan(20000);
    expect(low.name).toBe('Budget Bros');
    expect(high.pricePoint).toBe('premium');
  });

  test('empty roster yields no comps', () => {
    expect(deriveCompetitorComps(20000, [], { config })).toEqual([]);
  });
});
