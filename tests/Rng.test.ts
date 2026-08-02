import { deriveSeed, createRng } from '../src/game/Rng';
import * as RngBarrel from '../src/game/Rng';
import * as NPCBarrel from '../src/game/NPC';

describe('Rng', () => {
  describe('deriveSeed', () => {
    it('returns a deterministic 32-bit seed', () => {
      const a = deriveSeed(12345, 'customer', { day: 1, slot: 0 });
      const b = deriveSeed(12345, 'customer', { day: 1, slot: 0 });
      expect(a).toBe(b);
      expect(Number.isInteger(a)).toBe(true);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(0xffffffff);
    });

    it('produces a different seed when any input changes', () => {
      const base = deriveSeed(12345, 'customer', { day: 1, slot: 0 });
      expect(deriveSeed(12346, 'customer', { day: 1, slot: 0 })).not.toBe(base);
      expect(deriveSeed(12345, 'customer', { day: 1, slot: 1 })).not.toBe(base);
      expect(deriveSeed(12345, 'customer', { day: 2, slot: 0 })).not.toBe(base);
      expect(deriveSeed(12345, 'staff', { day: 1, slot: 0 })).not.toBe(base);
    });

    it('is independent of ctx key ordering', () => {
      const a = deriveSeed(12345, 'customer', { day: 1, slot: 0 });
      const b = deriveSeed(12345, 'customer', { slot: 0, day: 1 });
      expect(a).toBe(b);
    });

    it('produces a stable seed for a known input (regression lock)', () => {
      expect(deriveSeed(12345, 'customer', { day: 1, slot: 0 })).toBe(3789376038);
    });
  });

  describe('createRng', () => {
    it('returns values in [0, 1)', () => {
      const r = createRng(42);
      for (let i = 0; i < 1000; i++) {
        const v = r();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });

    it('produces byte-identical sequences for the same seed', () => {
      const r1 = createRng(2170378250);
      const r2 = createRng(2170378250);
      for (let i = 0; i < 100; i++) {
        expect(r1()).toBe(r2());
      }
    });

    it('produces a stable sequence for a known seed (regression lock)', () => {
      const r = createRng(2170378250);
      const seq = [r(), r(), r(), r(), r()];
      expect(seq).toEqual([
        0.3812162613030523,
        0.45399993378669024,
        0.6125830800738186,
        0.0792856568004936,
        0.4596988863777369,
      ]);
    });
  });

  describe('determinism via deriveSeed + createRng', () => {
    it('same (saveSeed, day, slot) produces byte-identical sequence', () => {
      const seed1 = deriveSeed(7777, 'customer', { day: 3, slot: 5 });
      const seed2 = deriveSeed(7777, 'customer', { day: 3, slot: 5 });
      const r1 = createRng(seed1);
      const r2 = createRng(seed2);
      for (let i = 0; i < 50; i++) {
        expect(r1()).toBe(r2());
      }
    });
  });

  describe('namespace independence', () => {
    it('adding rolls in namespace A does not shift namespace B output', () => {
      const masterSeed = 99;
      const seedB = deriveSeed(masterSeed, 'B', { day: 1 });

      const rBalone = createRng(seedB);
      const baseline = [rBalone(), rBalone(), rBalone(), rBalone(), rBalone()];

      const seedA = deriveSeed(masterSeed, 'A', { day: 1 });
      const rA = createRng(seedA);
      for (let i = 0; i < 100; i++) rA();

      const rBafter = createRng(seedB);
      const after = [rBafter(), rBafter(), rBafter(), rBafter(), rBafter()];

      expect(after).toEqual(baseline);
    });

    it('different namespaces yield different seeds for the same ctx', () => {
      const ctx = { day: 1, slot: 0 };
      const sA = deriveSeed(42, 'A', ctx);
      const sB = deriveSeed(42, 'B', ctx);
      expect(sA).not.toBe(sB);
    });
  });

  describe('module boundary (#342)', () => {
    it('exposes the seeded RNG through its own barrel', () => {
      expect(typeof RngBarrel.deriveSeed).toBe('function');
      expect(typeof RngBarrel.createRng).toBe('function');
    });

    // The whole point of the #342 move: seeded RNG is shared infrastructure, not
    // part of NPC's public promise. Re-exporting it from NPC would put the old
    // reach-ins back as legal imports and re-create the false claim about NPC.
    it('is not re-exported from the NPC barrel', () => {
      expect((NPCBarrel as Record<string, unknown>).deriveSeed).toBeUndefined();
      expect((NPCBarrel as Record<string, unknown>).createRng).toBeUndefined();
    });

    it('keeps the barrel narrow — the two functions and nothing else', () => {
      expect(Object.keys(RngBarrel).sort()).toEqual(['createRng', 'deriveSeed']);
    });
  });
});
