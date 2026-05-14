import { loadBackstories, getDay1Modifier, buildCharacterModifier } from '../src/game/CareerProgression';
import type { BackstoryId } from '../src/game/CareerProgression';

describe('loadBackstories', () => {
  it('returns all three backstory entries', () => {
    const entries = loadBackstories();
    expect(entries).toHaveLength(3);
    const ids = entries.map((e) => e.id);
    expect(ids).toContain('ex-mechanic');
    expect(ids).toContain('ex-banker');
    expect(ids).toContain('inheritor');
  });

  it('each entry has a non-empty label and flavor', () => {
    for (const entry of loadBackstories()) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.flavor.length).toBeGreaterThan(0);
    }
  });
});

describe('getDay1Modifier', () => {
  it('ex-mechanic grants reconJudgmentBonus > 0, no credit or capital', () => {
    const mod = getDay1Modifier('ex-mechanic');
    expect(mod.backstoryId).toBe('ex-mechanic');
    expect(mod.reconJudgmentBonus).toBeGreaterThan(0);
    expect(mod.startingCreditLine).toBe(0);
    expect(mod.startingCapitalBonus).toBe(0);
    expect(mod.grudgesFlag).toBe(false);
  });

  it('ex-banker grants startingCreditLine > 0, no recon or capital', () => {
    const mod = getDay1Modifier('ex-banker');
    expect(mod.backstoryId).toBe('ex-banker');
    expect(mod.reconJudgmentBonus).toBe(0);
    expect(mod.startingCreditLine).toBeGreaterThan(0);
    expect(mod.startingCapitalBonus).toBe(0);
    expect(mod.grudgesFlag).toBe(false);
  });

  it('inheritor grants startingCapitalBonus > 0 and grudgesFlag', () => {
    const mod = getDay1Modifier('inheritor');
    expect(mod.backstoryId).toBe('inheritor');
    expect(mod.reconJudgmentBonus).toBe(0);
    expect(mod.startingCreditLine).toBe(0);
    expect(mod.startingCapitalBonus).toBeGreaterThan(0);
    expect(mod.grudgesFlag).toBe(true);
  });

  it('each backstory grants exactly one non-zero numeric modifier', () => {
    const numericKeys: Array<keyof ReturnType<typeof getDay1Modifier>> = [
      'reconJudgmentBonus',
      'startingCreditLine',
      'startingCapitalBonus',
    ];
    const ids: BackstoryId[] = ['ex-mechanic', 'ex-banker', 'inheritor'];
    for (const id of ids) {
      const mod = getDay1Modifier(id);
      const nonZero = numericKeys.filter((k) => (mod[k] as number) > 0);
      expect(nonZero).toHaveLength(1);
    }
  });

  it('throws for an unknown backstory id', () => {
    expect(() => getDay1Modifier('unknown' as BackstoryId)).toThrow();
  });
});

describe('buildCharacterModifier', () => {
  it('embeds name and backstoryId in the returned profile', () => {
    const profile = buildCharacterModifier('Jordan', 'ex-banker');
    expect(profile.name).toBe('Jordan');
    expect(profile.backstoryId).toBe('ex-banker');
    expect(profile.day1Modifier.backstoryId).toBe('ex-banker');
  });

  it('day1Modifier is fully populated (no undefined fields)', () => {
    const profile = buildCharacterModifier('Alex', 'inheritor');
    const { day1Modifier: mod } = profile;
    expect(mod.reconJudgmentBonus).toBeDefined();
    expect(mod.startingCreditLine).toBeDefined();
    expect(mod.startingCapitalBonus).toBeDefined();
    expect(mod.grudgesFlag).toBeDefined();
  });
});
