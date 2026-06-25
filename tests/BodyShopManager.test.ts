import {
  isBodyShopFunctionAutomated,
  autoBodyShopPar,
  autoBodyShopChannelPosture,
  shouldRushBodyShop,
} from '../src/bodyShopManager';
import {
  loadBodyShopManagerConfig,
  type BodyShopManagerConfig,
} from '../src/bodyShopManagerConfig';

const CONFIG: BodyShopManagerConfig = loadBodyShopManagerConfig();
const DEPS = { config: CONFIG };

describe('#316 body-shop-manager automation engine (pure)', () => {
  describe('isBodyShopFunctionAutomated — the act gate (mirrors service-manager)', () => {
    it('is closed with no manager on staff (null skill)', () => {
      expect(isBodyShopFunctionAutomated(null, 50)).toBe(false);
    });
    it('is a hard cliff at the threshold', () => {
      expect(isBodyShopFunctionAutomated(49, 50)).toBe(false);
      expect(isBodyShopFunctionAutomated(50, 50)).toBe(true);
      expect(isBodyShopFunctionAutomated(80, 50)).toBe(true);
    });
  });

  describe('autoBodyShopPar — demand-driven, monotonic, floored', () => {
    it('floors par at the configured minimums on an empty/cold window', () => {
      const [sp] = autoBodyShopPar([{ category: 'paint', demand: 0 }], DEPS);
      expect(sp.target).toBe(CONFIG.par.minTarget);
      expect(sp.reorderPoint).toBe(CONFIG.par.minReorderPoint);
    });

    it('raises target with demand and never lowers it (monotonic)', () => {
      const low = autoBodyShopPar([{ category: 'doors_panels', demand: 2 }], DEPS)[0];
      const high = autoBodyShopPar([{ category: 'doors_panels', demand: 20 }], DEPS)[0];
      expect(high.target).toBeGreaterThan(low.target);
      expect(high.reorderPoint).toBeGreaterThanOrEqual(low.reorderPoint);
    });

    it('keeps reorderPoint at or below target', () => {
      for (const demand of [0, 1, 3, 8, 25, 100]) {
        const sp = autoBodyShopPar([{ category: 'windows_glass', demand }], DEPS)[0];
        expect(sp.reorderPoint).toBeLessThanOrEqual(sp.target);
      }
    });

    it('is deterministic — same input, same setpoints', () => {
      const rows = [
        { category: 'paint', demand: 5 },
        { category: 'interior_trim', demand: 12 },
      ];
      expect(autoBodyShopPar(rows, DEPS)).toEqual(autoBodyShopPar(rows, DEPS));
    });
  });

  describe('autoBodyShopChannelPosture — reputation-driven, monotonic, clamped', () => {
    it('clamps to [minPosture, maxPosture]', () => {
      expect(autoBodyShopChannelPosture(0, DEPS)).toBeCloseTo(
        CONFIG.channel.minPosture,
      );
      expect(autoBodyShopChannelPosture(1, DEPS)).toBeCloseTo(
        CONFIG.channel.maxPosture,
      );
    });

    it('is non-decreasing in reputation (lean retail as reputation grows)', () => {
      let prev = -1;
      for (const rep of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
        const p = autoBodyShopChannelPosture(rep, DEPS);
        expect(p).toBeGreaterThanOrEqual(prev);
        prev = p;
      }
    });

    it('a stronger reputation leans further into retail', () => {
      expect(autoBodyShopChannelPosture(0.9, DEPS)).toBeGreaterThan(
        autoBodyShopChannelPosture(0.45, DEPS),
      );
    });
  });

  describe('shouldRushBodyShop — capacity-aware rush-vs-walk', () => {
    it('always rushes when the capacity function is not yet automated', () => {
      expect(shouldRushBodyShop({ utilization: 0.99, capacityAware: false }, DEPS)).toBe(true);
      expect(shouldRushBodyShop({ utilization: 0, capacityAware: false }, DEPS)).toBe(true);
    });

    it('rushes only while the shop has slack once capacity-aware', () => {
      const ceil = CONFIG.capacity.utilizationRushCeiling;
      expect(shouldRushBodyShop({ utilization: ceil - 0.01, capacityAware: true }, DEPS)).toBe(true);
      expect(shouldRushBodyShop({ utilization: ceil, capacityAware: true }, DEPS)).toBe(false);
      expect(shouldRushBodyShop({ utilization: 1, capacityAware: true }, DEPS)).toBe(false);
    });
  });
});
