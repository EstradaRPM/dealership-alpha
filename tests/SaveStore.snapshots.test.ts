import { createSnapshotStore, createInMemoryDriver } from '../src/game/SaveStore';

function makeStore() {
  return createSnapshotStore(createInMemoryDriver());
}

describe('SnapshotStore', () => {
  it('listSnapshots() returns empty array when nothing saved', async () => {
    const store = makeStore();
    expect(await store.listSnapshots()).toEqual([]);
  });

  it('saveSnapshot() persists a snapshot', async () => {
    const store = makeStore();
    await store.saveSnapshot({ cash: 5000 }, { day: 7, tier: 1 });
    const list = await store.listSnapshots();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ day: 7, tier: 1, state: { cash: 5000 } });
  });

  it('snapshots are stored newest-first', async () => {
    const store = makeStore();
    await store.saveSnapshot({ cash: 1 }, { day: 7, tier: 1 });
    await store.saveSnapshot({ cash: 2 }, { day: 14, tier: 1 });
    await store.saveSnapshot({ cash: 3 }, { day: 21, tier: 1 });

    const list = await store.listSnapshots();
    expect(list.map((s) => s.day)).toEqual([21, 14, 7]);
  });

  it('enforces rolling window of 6: oldest is dropped at 7th save', async () => {
    const store = makeStore();
    for (let week = 1; week <= 7; week++) {
      await store.saveSnapshot({ week }, { day: week * 7, tier: 1 });
    }
    const list = await store.listSnapshots();
    expect(list).toHaveLength(6);
    // Oldest (week 1, day 7) should have been evicted
    expect(list.map((s) => s.day)).not.toContain(7);
    // Newest (week 7, day 49) should be first
    expect(list[0]?.day).toBe(49);
    // Week 2 (day 14) is the oldest kept
    expect(list[5]?.day).toBe(14);
  });

  it('rollbackToSnapshot(0) returns most recent state', async () => {
    const store = makeStore();
    await store.saveSnapshot({ cash: 100 }, { day: 7, tier: 1 });
    await store.saveSnapshot({ cash: 200 }, { day: 14, tier: 1 });

    const state = await store.rollbackToSnapshot(0);
    expect(state).toEqual({ cash: 200 });
  });

  it('rollbackToSnapshot(n) returns nth snapshot state', async () => {
    const store = makeStore();
    await store.saveSnapshot({ cash: 100 }, { day: 7, tier: 1 });
    await store.saveSnapshot({ cash: 200 }, { day: 14, tier: 1 });
    await store.saveSnapshot({ cash: 300 }, { day: 21, tier: 1 });

    const state = await store.rollbackToSnapshot(2);
    expect(state).toEqual({ cash: 100 });
  });

  it('rollbackToSnapshot() returns null for out-of-bounds index', async () => {
    const store = makeStore();
    expect(await store.rollbackToSnapshot(0)).toBeNull();

    await store.saveSnapshot({ cash: 100 }, { day: 7, tier: 1 });
    expect(await store.rollbackToSnapshot(5)).toBeNull();
  });

  it('round-trips a complex state object deep-equal', async () => {
    const store = makeStore();
    const state = {
      day: 14,
      cash: 48_200,
      inventory: [{ vin: 'X1', model: 'camry', cost: 22_000 }],
      reputation: { local: 0.71, oem: { vanda: 0.55 } },
      flags: { tutorialDone: true },
    };

    await store.saveSnapshot(state, { day: 14, tier: 1 });
    const recovered = await store.rollbackToSnapshot(0);
    expect(recovered).toEqual(state);
  });

  it('clear() removes all snapshots', async () => {
    const store = makeStore();
    await store.saveSnapshot({ cash: 100 }, { day: 7, tier: 1 });
    await store.saveSnapshot({ cash: 200 }, { day: 14, tier: 1 });
    await store.clear();
    expect(await store.listSnapshots()).toEqual([]);
    expect(await store.rollbackToSnapshot(0)).toBeNull();
  });
});
