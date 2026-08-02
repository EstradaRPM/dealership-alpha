import {
  skillDriftFraction,
  signedSkillDrift,
  type SkillDriftConfig,
} from '../src/game/NPC';
import { deriveSeed } from '../src/game/Rng';

const CFG: SkillDriftConfig = { maxDriftFraction: 0.2, skillReference: 90 };

describe('skillDriftFraction (channel-desk M5 #292)', () => {
  it('is deterministic in (skill, seed)', () => {
    const seed = deriveSeed(1234, 'drift', { customerId: 'c1', day: 3 });
    expect(skillDriftFraction(50, seed, CFG)).toBe(
      skillDriftFraction(50, seed, CFG),
    );
  });

  it('stays within [0, deficit×maxDriftFraction)', () => {
    // deficit at skill 0 = 1, so the span is the full maxDriftFraction.
    for (let s = 0; s < 200; s++) {
      const seed = deriveSeed(7, 'drift', { i: s });
      const d = skillDriftFraction(0, seed, CFG);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(CFG.maxDriftFraction);
    }
  });

  it('tightens monotonically as skill rises (expected drift shrinks)', () => {
    const mean = (skill: number): number => {
      let total = 0;
      const n = 400;
      for (let i = 0; i < n; i++) {
        total += skillDriftFraction(skill, deriveSeed(99, 'd', { skill, i }), CFG);
      }
      return total / n;
    };
    const low = mean(30);
    const mid = mean(60);
    const high = mean(85);
    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
  });

  it('is zero at/above skillReference (perfect adherence)', () => {
    for (let i = 0; i < 50; i++) {
      const seed = deriveSeed(3, 'd', { i });
      expect(skillDriftFraction(90, seed, CFG)).toBe(0);
      expect(skillDriftFraction(100, seed, CFG)).toBe(0);
    }
  });
});

describe('signedSkillDrift (two-sided mis-target)', () => {
  it('is deterministic in (skill, seed)', () => {
    const seed = deriveSeed(42, 'price', { vehicleId: 'v9', day: 2 });
    expect(signedSkillDrift(55, seed, CFG)).toBe(signedSkillDrift(55, seed, CFG));
  });

  it('stays within (−span, +span) and produces both signs', () => {
    let sawNeg = false;
    let sawPos = false;
    for (let i = 0; i < 300; i++) {
      const seed = deriveSeed(5, 'p', { i });
      const d = signedSkillDrift(20, seed, CFG);
      expect(Math.abs(d)).toBeLessThan(CFG.maxDriftFraction);
      if (d < 0) sawNeg = true;
      if (d > 0) sawPos = true;
    }
    expect(sawNeg && sawPos).toBe(true);
  });

  it('is zero at/above skillReference', () => {
    const seed = deriveSeed(8, 'p', { i: 1 });
    expect(signedSkillDrift(90, seed, CFG)).toBe(0);
  });
});
