import {
  isServiceFunctionAutomated,
  autoServicePar,
  autoServicePosture,
  autoServiceMarketing,
  shouldRush,
  loadServiceManagerConfig,
  type ServiceManagerConfig,
} from '../src/game/ServiceDispatch';

const CONFIG: ServiceManagerConfig = loadServiceManagerConfig();
const DEPS = { config: CONFIG };

describe('#310 service-manager automation engine (pure)', () => {
  describe('isServiceFunctionAutomated — the act gate (mirrors channel-desk)', () => {
    it('is closed with no SM on staff (null skill)', () => {
      expect(isServiceFunctionAutomated(null, 50)).toBe(false);
    });
    it('is a hard cliff at the threshold', () => {
      expect(isServiceFunctionAutomated(49, 50)).toBe(false);
      expect(isServiceFunctionAutomated(50, 50)).toBe(true);
      expect(isServiceFunctionAutomated(80, 50)).toBe(true);
    });
  });

  describe('autoServicePar — demand-driven, monotonic, floored', () => {
    it('floors par at the configured minimums on an empty/cold window', () => {
      const [sp] = autoServicePar([{ category: 'oil_filters', demand: 0 }], DEPS);
      expect(sp.target).toBe(CONFIG.par.minTarget);
      expect(sp.reorderPoint).toBe(CONFIG.par.minReorderPoint);
    });

    it('raises target with demand and never lowers it (monotonic)', () => {
      const low = autoServicePar([{ category: 'tires_brakes', demand: 2 }], DEPS)[0];
      const high = autoServicePar([{ category: 'tires_brakes', demand: 20 }], DEPS)[0];
      expect(high.target).toBeGreaterThan(low.target);
      expect(high.reorderPoint).toBeGreaterThanOrEqual(low.reorderPoint);
    });

    it('keeps reorderPoint at or below target', () => {
      for (const demand of [0, 1, 3, 8, 25, 100]) {
        const sp = autoServicePar([{ category: 'drivetrain', demand }], DEPS)[0];
        expect(sp.reorderPoint).toBeLessThanOrEqual(sp.target);
      }
    });

    it('is deterministic — same input, same setpoints', () => {
      const rows = [
        { category: 'oil_filters', demand: 5 },
        { category: 'electronics', demand: 12 },
      ];
      expect(autoServicePar(rows, DEPS)).toEqual(autoServicePar(rows, DEPS));
    });
  });

  describe('autoServicePosture — reputation-driven, monotonic, clamped', () => {
    it('clamps to [minPosture, maxPosture]', () => {
      expect(autoServicePosture(0, DEPS)).toBeCloseTo(CONFIG.posture.minPosture);
      expect(autoServicePosture(1, DEPS)).toBeCloseTo(CONFIG.posture.maxPosture);
    });

    it('is non-decreasing in reputation', () => {
      let prev = -1;
      for (const rep of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
        const p = autoServicePosture(rep, DEPS);
        expect(p).toBeGreaterThanOrEqual(prev);
        prev = p;
      }
    });

    it('a stronger reputation supports a more premium posture', () => {
      expect(autoServicePosture(0.9, DEPS)).toBeGreaterThan(
        autoServicePosture(0.45, DEPS),
      );
    });
  });

  describe('autoServiceMarketing — base-health + over-stock driven', () => {
    const healthyBase = {
      size: 100,
      atRiskCount: 5,
      churnTrend: 'steady' as const,
    };
    const coveredStock = [
      { category: 'oil_filters', demand: 5, onHand: 4 },
      { category: 'tires_brakes', demand: 5, onHand: 5 },
    ];

    it('runs no arm on a healthy base with balanced stock', () => {
      const d = autoServiceMarketing(
        {
          health: healthyBase,
          coverage: coveredStock,
          retentionCampaignId: 'winback',
        },
        DEPS,
      );
      expect(d.retentionId).toBe('none');
      expect(d.conquestCategory).toBe('none');
    });

    it('runs retention when at-risk share crosses the trigger', () => {
      const d = autoServiceMarketing(
        {
          health: { size: 100, atRiskCount: 40, churnTrend: 'steady' },
          coverage: coveredStock,
          retentionCampaignId: 'winback',
        },
        DEPS,
      );
      expect(d.retentionId).toBe('winback');
    });

    it('runs retention when churn is already rising even below the share trigger', () => {
      const d = autoServiceMarketing(
        {
          health: { size: 100, atRiskCount: 1, churnTrend: 'rising' },
          coverage: coveredStock,
          retentionCampaignId: 'winback',
        },
        DEPS,
      );
      expect(d.retentionId).toBe('winback');
    });

    it('aims conquest at the most over-stocked category to clear dead capital', () => {
      const d = autoServiceMarketing(
        {
          health: healthyBase,
          coverage: [
            { category: 'oil_filters', demand: 5, onHand: 5 },
            { category: 'tires_brakes', demand: 1, onHand: 30 }, // 30x — most over-stocked
            { category: 'drivetrain', demand: 2, onHand: 8 }, // 4x
          ],
          retentionCampaignId: 'winback',
        },
        DEPS,
      );
      expect(d.conquestCategory).toBe('tires_brakes');
    });

    it('is deterministic', () => {
      const input = {
        health: { size: 80, atRiskCount: 30, churnTrend: 'rising' as const },
        coverage: [{ category: 'electronics', demand: 1, onHand: 20 }],
        retentionCampaignId: 'winback',
      };
      expect(autoServiceMarketing(input, DEPS)).toEqual(
        autoServiceMarketing(input, DEPS),
      );
    });
  });

  describe('shouldRush — capacity-aware rush-vs-walk', () => {
    it('always rushes when the capacity function is not yet automated', () => {
      expect(shouldRush({ utilization: 0.99, capacityAware: false }, DEPS)).toBe(true);
      expect(shouldRush({ utilization: 0, capacityAware: false }, DEPS)).toBe(true);
    });

    it('rushes only while the shop has slack once capacity-aware', () => {
      const ceil = CONFIG.capacity.utilizationRushCeiling;
      expect(shouldRush({ utilization: ceil - 0.01, capacityAware: true }, DEPS)).toBe(true);
      expect(shouldRush({ utilization: ceil, capacityAware: true }, DEPS)).toBe(false);
      expect(shouldRush({ utilization: 1, capacityAware: true }, DEPS)).toBe(false);
    });
  });
});
