import { z } from 'zod';
import {
  parseData,
  DataValidationError,
  TunablesSchema,
  loadTunables,
} from '../src/game/data';

describe('parseData', () => {
  const schema = z.object({ name: z.string(), count: z.number().int() });

  it('returns typed value when raw matches schema', () => {
    const out = parseData({ name: 'a', count: 3 }, schema, 'test');
    expect(out).toEqual({ name: 'a', count: 3 });
  });

  it('throws DataValidationError with field path when raw is invalid', () => {
    expect(() => parseData({ name: 'a', count: 'oops' }, schema, 'test')).toThrow(
      DataValidationError,
    );
    expect(() => parseData({ name: 'a', count: 'oops' }, schema, 'test')).toThrow(
      /count/,
    );
  });

  it('error message includes the label', () => {
    expect(() => parseData({}, schema, 'tunables.json')).toThrow(/tunables\.json/);
  });
});

describe('loadTunables', () => {
  it('loads and validates the bundled sample file', () => {
    const t = loadTunables();
    expect(t.schemaVersion).toBe(1);
    expect(t.clock.minutesPerTick).toBeGreaterThan(0);
    expect(t.economy.startingCash).toBeGreaterThanOrEqual(0);
  });

  it('rejects a payload missing required fields', () => {
    expect(() => TunablesSchema.parse({ schemaVersion: 1 })).toThrow();
  });

  it('rejects an unsupported schemaVersion', () => {
    const bad = { schemaVersion: 2, clock: {}, economy: {} };
    expect(() => TunablesSchema.parse(bad)).toThrow();
  });
});
