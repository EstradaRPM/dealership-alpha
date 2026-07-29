import {
  createLocalStorageStore,
  createMemoryStore,
  createMultiSlotSaveStore,
  createWebDriver,
  createWebDriverFactory,
  resolveWebStorageBackend,
  type WebKeyValueStore,
} from '../src/game/SaveStore';
import { createPlatformDriverFactory } from '../src/app/storage';
import { readAppCompositionSource } from './helpers/appComposition';

// The web StorageDriver (#338) — the backend that lets the app boot on a target
// an agent can drive, without the native SQLite module.
//
// The IndexedDB backend itself is NOT unit-tested here: jsdom ships no
// IndexedDB, and a hand-rolled fake would only assert that the fake works. Its
// proof is the live web drive documented in `.claude/skills/verify` — boot
// `npm run web`, save, reload, resume. What IS tested here is everything that
// decides *which* backend runs and everything above the backend seam, which is
// where a regression would silently drop a career on the floor.

/**
 * Installs a stub `localStorage` on globalThis for the duration of one test.
 * Awaits `run` before restoring — a sync teardown would yank the stub out from
 * under the driver's first `await`.
 */
async function withStubLocalStorage<T>(
  run: (cells: Map<string, string>) => T | Promise<T>,
): Promise<T> {
  const cells = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => cells.get(k) ?? null,
      setItem: (k: string, v: string) => void cells.set(k, v),
      removeItem: (k: string) => void cells.delete(k),
    },
  });
  try {
    return await run(cells);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
}

describe('web StorageDriver', () => {
  it('round-trips a payload through the single-cell driver', async () => {
    const driver = createWebDriver({ backend: createMemoryStore() });
    expect(await driver.read()).toBeNull();
    await driver.write('{"cash":12000}');
    expect(await driver.read()).toBe('{"cash":12000}');
    await driver.clear();
    expect(await driver.read()).toBeNull();
  });

  it('isolates cells per key so one slot cannot read or clear another', async () => {
    const factory = createWebDriverFactory({ backend: createMemoryStore() });
    const slotA = factory('slot:a');
    const slotB = factory('slot:b');
    await slotA.write('career-a');
    await slotB.write('career-b');
    await slotA.clear();
    expect(await slotA.read()).toBeNull();
    expect(await slotB.read()).toBe('career-b');
  });

  it('returns the same driver instance for a repeated key', () => {
    const factory = createWebDriverFactory({ backend: createMemoryStore() });
    expect(factory('slot:a')).toBe(factory('slot:a'));
  });

  it('persists through localStorage under its namespaced key', async () => {
    await withStubLocalStorage(async (cells) => {
      const driver = createWebDriverFactory({
        backend: createLocalStorageStore('dealership'),
      })('slot:a');
      await driver.write('career-a');
      expect(cells.get('dealership:dealership:slot:a')).toBe('career-a');
      expect(await driver.read()).toBe('career-a');
    });
  });

  it('resolves to localStorage when IndexedDB is absent, memory when both are', async () => {
    expect(resolveWebStorageBackend().kind).toBe('memory');
    await withStubLocalStorage(() => {
      expect(resolveWebStorageBackend().kind).toBe('localstorage');
    });
  });

  // The acceptance criterion in issue #338: a reload resumes the same career.
  // Modeled as two independently-built factories over one surviving backend —
  // exactly what a page reload does to the driver layer.
  it('resumes the same career across a simulated reload', async () => {
    const surviving: WebKeyValueStore = createMemoryStore();

    const before = createMultiSlotSaveStore(createWebDriverFactory({ backend: surviving }));
    const slot = await before.createSlot('Reload Test');
    await before.save({ character: { name: 'Jo' }, masterSeed: 7 }, { day: 12, tier: 2 });

    const after = createMultiSlotSaveStore(createWebDriverFactory({ backend: surviving }));
    expect(await after.getActiveSlotId()).toBe(slot.id);
    const slots = await after.listSlots();
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ name: 'Reload Test', day: 12, tier: 2 });
    expect(await after.load()).toMatchObject({ masterSeed: 7 });
  });
});

describe('platform driver selection', () => {
  // Under Jest, Platform.OS is a native platform — so this asserts the branch
  // that ships on device, and that the selection is a real function call rather
  // than a constant nobody re-evaluates.
  it('builds a working factory for the running platform', async () => {
    const factory = createPlatformDriverFactory();
    expect(typeof factory).toBe('function');
    expect(factory('slot:a')).not.toBe(factory('slot:b'));
  });

  // Anti-orphan: the platform choice is only worth anything if the app's own
  // default driver goes through it. A stray `createSqliteDriverFactory()` left
  // in the composition root would boot web straight into the native module.
  it('is what the app composition root actually defaults to', () => {
    const source = readAppCompositionSource();
    expect(source).toContain('driverFactory ?? createPlatformDriverFactory()');
    // The sqlite factory still appears once — inside createPlatformDriverFactory
    // itself, which is its only legitimate caller. What must never come back is
    // it being the app's default, which is what boots web into the native module.
    expect(source).not.toContain('driverFactory ?? createSqliteDriverFactory()');
    expect(source).toContain("Platform.OS === 'web'");
  });
});
