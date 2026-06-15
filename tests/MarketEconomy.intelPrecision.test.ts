import {
  resolveIntelPrecision,
  loadIntelPrecisionConfig,
  type IntelPrecisionConfig,
} from '../src/game/MarketEconomy';

// Pricing-intel precision tiering (#284, Pricing/Demand spine S12). The profile
// is coarse when the player prices by gut and sharpens with the UCM's pricing
// skill — driving heat-map resolution, days-to-sell range/confidence, and the
// suggested-price band tightness off one read.
describe('resolveIntelPrecision (#284)', () => {
  const config: IntelPrecisionConfig = {
    schemaVersion: 1,
    coarse: {
      heatGranularity: 'coarse',
      suggestionBandPct: 0.12,
      daysRangePct: 0.5,
      confidenceScale: 0.6,
    },
    sharp: {
      heatGranularity: 'fine',
      suggestionBandPct: 0.04,
      daysRangePct: 0.15,
      confidenceScale: 1.0,
      skillReference: 70,
    },
  };

  it('ships a valid default config', () => {
    expect(() => loadIntelPrecisionConfig()).not.toThrow();
  });

  it('no UCM ⇒ the flat coarse profile (price by gut)', () => {
    const p = resolveIntelPrecision({ ucmPricingSkill: null }, { config });
    expect(p.level).toBe('coarse');
    expect(p.heatGranularity).toBe('coarse');
    expect(p.suggestionBandPct).toBe(0.12);
    expect(p.daysRangePct).toBe(0.5);
    expect(p.confidenceScale).toBe(0.6);
  });

  it('a UCM on staff flips heat granularity to fine regardless of skill', () => {
    const green = resolveIntelPrecision({ ucmPricingSkill: 1 }, { config });
    expect(green.level).toBe('sharp');
    expect(green.heatGranularity).toBe('fine');
  });

  it('a green UCM is only a touch sharper than gut; a seasoned one is pinpoint', () => {
    const green = resolveIntelPrecision({ ucmPricingSkill: 0 }, { config });
    // skill 0 ⇒ t=0 ⇒ numeric knobs equal the coarse endpoint (just a finer instrument).
    expect(green.suggestionBandPct).toBeCloseTo(0.12);
    expect(green.daysRangePct).toBeCloseTo(0.5);
    expect(green.confidenceScale).toBeCloseTo(0.6);

    const mid = resolveIntelPrecision({ ucmPricingSkill: 35 }, { config }); // t=0.5
    expect(mid.suggestionBandPct).toBeCloseTo(0.08);
    expect(mid.daysRangePct).toBeCloseTo(0.325);
    expect(mid.confidenceScale).toBeCloseTo(0.8);

    const seasoned = resolveIntelPrecision({ ucmPricingSkill: 70 }, { config }); // t=1
    expect(seasoned.suggestionBandPct).toBeCloseTo(0.04);
    expect(seasoned.daysRangePct).toBeCloseTo(0.15);
    expect(seasoned.confidenceScale).toBeCloseTo(1.0);
  });

  it('skill past the reference saturates (no over-sharpening)', () => {
    const expert = resolveIntelPrecision({ ucmPricingSkill: 100 }, { config });
    expect(expert.suggestionBandPct).toBeCloseTo(0.04);
    expect(expert.confidenceScale).toBeCloseTo(1.0);
  });

  it('tightening is monotonic in skill (more skill never widens the read)', () => {
    const skills = [0, 20, 40, 60, 80, 100];
    const bands = skills.map(
      (s) => resolveIntelPrecision({ ucmPricingSkill: s }, { config }).suggestionBandPct,
    );
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i]).toBeLessThanOrEqual(bands[i - 1]);
    }
  });
});
