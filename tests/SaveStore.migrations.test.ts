import {
  CURRENT_SAVE_VERSION,
  migrate,
  wrap,
  type Migration,
  type SaveEnvelope,
} from '../src/game/SaveStore';

describe('SaveStore migrations', () => {
  it('wrap() stamps the envelope with the current version', () => {
    const env = wrap({ foo: 1 });
    expect(env.v).toBe(CURRENT_SAVE_VERSION);
    expect(env.state).toEqual({ foo: 1 });
  });

  it('passes through when envelope is already at target version', () => {
    const env: SaveEnvelope = { v: 2, state: { x: 1 } };
    expect(migrate(env, {}, 2)).toEqual({ x: 1 });
  });

  it('runs registered migrations in order from envelope.v up to target', () => {
    const env: SaveEnvelope = { v: 1, state: { a: 1 } };
    const migrations: Record<number, Migration> = {
      1: (s) => ({ ...s, b: 2 }),
      2: (s) => ({ ...s, c: 3 }),
    };
    expect(migrate(env, migrations, 3)).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('refuses to load a save written by a newer game version', () => {
    const env: SaveEnvelope = { v: 5, state: {} };
    expect(() => migrate(env, {}, 1)).toThrow(/newer game version/);
  });

  it('throws when a migration step is missing', () => {
    const env: SaveEnvelope = { v: 1, state: {} };
    expect(() => migrate(env, {}, 3)).toThrow(/No migration registered from save v1/);
  });
});
