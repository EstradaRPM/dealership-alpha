import { createLegacyStore, createInMemoryDriver, createSaveStore } from '../src/game/SaveStore';
import type { LegacyEntry } from '../src/game/SaveStore';

function makeStore() {
  return createLegacyStore(createInMemoryDriver());
}

const ENTRY_A: LegacyEntry = {
  playerName: 'Alice Ruiz',
  backstoryId: 'mechanic',
  careerYear: 3,
  tierReached: 2,
  reason: 'retire',
  flavorText: 'Rode off into the sunset.',
  completedAt: '2026-01-01T00:00:00.000Z',
};

const ENTRY_B: LegacyEntry = {
  playerName: 'Bob Chen',
  backstoryId: 'salesperson',
  careerYear: 1,
  tierReached: 1,
  reason: 'bankruptcy',
  flavorText: 'The lot went dark.',
  completedAt: '2026-02-01T00:00:00.000Z',
};

describe('LegacyStore', () => {
  it('listLegacies() returns empty array when nothing saved', async () => {
    const store = makeStore();
    expect(await store.listLegacies()).toEqual([]);
  });

  it('appendLegacy() persists an entry', async () => {
    const store = makeStore();
    await store.appendLegacy(ENTRY_A);
    const list = await store.listLegacies();
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(ENTRY_A);
  });

  it('entries are stored newest-first', async () => {
    const store = makeStore();
    await store.appendLegacy(ENTRY_A);
    await store.appendLegacy(ENTRY_B);
    const list = await store.listLegacies();
    expect(list[0]).toEqual(ENTRY_B);
    expect(list[1]).toEqual(ENTRY_A);
  });

  it('accumulates across multiple appends', async () => {
    const store = makeStore();
    await store.appendLegacy(ENTRY_A);
    await store.appendLegacy(ENTRY_B);
    expect(await store.listLegacies()).toHaveLength(2);
  });

  it('legacies survive active-save reset (separate driver)', async () => {
    const legacyDriver = createInMemoryDriver();
    const saveDriver = createInMemoryDriver();

    const legacyStore = createLegacyStore(legacyDriver);
    const saveStore = createSaveStore(saveDriver);

    await legacyStore.appendLegacy(ENTRY_A);
    await saveStore.save({ cash: 5000 });

    // Reset the active save (new career)
    await saveStore.clear();
    expect(await saveStore.load()).toBeNull();

    // Legacy must still be present
    const legacies = await legacyStore.listLegacies();
    expect(legacies).toHaveLength(1);
    expect(legacies[0]).toEqual(ENTRY_A);
  });

  it('a second career appends without overwriting first legacy', async () => {
    const store = makeStore();
    await store.appendLegacy(ENTRY_A);

    // Simulate second career ending
    await store.appendLegacy(ENTRY_B);

    const list = await store.listLegacies();
    expect(list).toHaveLength(2);
    expect(list.map((e) => e.playerName)).toEqual([ENTRY_B.playerName, ENTRY_A.playerName]);
  });

  it('clear() removes all legacies', async () => {
    const store = makeStore();
    await store.appendLegacy(ENTRY_A);
    await store.appendLegacy(ENTRY_B);
    await store.clear();
    expect(await store.listLegacies()).toEqual([]);
  });

  it('round-trips full LegacyEntry deep-equal', async () => {
    const store = makeStore();
    await store.appendLegacy(ENTRY_A);
    const recovered = (await store.listLegacies())[0];
    expect(recovered).toEqual(ENTRY_A);
  });
});
