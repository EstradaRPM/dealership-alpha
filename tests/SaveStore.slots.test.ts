import {
  createMultiSlotSaveStore,
  createInMemoryDriverFactory,
} from '../src/game/SaveStore';

describe('MultiSlotSaveStore', () => {
  it('starts with no slots and no active selection', async () => {
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory());
    expect(await store.listSlots()).toEqual([]);
    expect(await store.getActiveSlotId()).toBeNull();
    expect(await store.load()).toBeNull();
  });

  it('creates slots with metadata and auto-activates the first', async () => {
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory(), {
      now: () => '2026-05-17T00:00:00.000Z',
    });
    const a = await store.createSlot('Alice');
    expect(a).toEqual({
      id: 'slot-1',
      name: 'Alice',
      day: 0,
      lastPlayed: '2026-05-17T00:00:00.000Z',
    });
    expect(await store.getActiveSlotId()).toBe('slot-1');

    const b = await store.createSlot('Bob');
    expect(b.id).toBe('slot-2');
    // Creating a second slot does not steal the active selection.
    expect(await store.getActiveSlotId()).toBe('slot-1');
    expect((await store.listSlots()).map((s) => s.name)).toEqual(['Alice', 'Bob']);
  });

  it('enforces the max-slot cap (default 3)', async () => {
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory());
    await store.createSlot('one');
    await store.createSlot('two');
    await store.createSlot('three');
    await expect(store.createSlot('four')).rejects.toThrow(/max of 3/);
  });

  it('honors a custom max-slot cap', async () => {
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory(), {
      maxSlots: 2,
    });
    await store.createSlot('one');
    await store.createSlot('two');
    await expect(store.createSlot('three')).rejects.toThrow(/max of 2/);
  });

  it('saves/loads against the active slot and refreshes its metadata', async () => {
    let clock = '2026-05-17T08:00:00.000Z';
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory(), {
      now: () => clock,
    });
    await store.createSlot('Alice');
    clock = '2026-05-18T09:30:00.000Z';
    await store.save({ cash: 50_000 }, { day: 4 });

    expect(await store.load()).toEqual({ cash: 50_000 });
    const [meta] = await store.listSlots();
    expect(meta.day).toBe(4);
    expect(meta.lastPlayed).toBe('2026-05-18T09:30:00.000Z');
  });

  it('throws when saving with no active slot', async () => {
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory());
    await expect(store.save({ x: 1 }, { day: 1 })).rejects.toThrow(
      /no active slot/,
    );
  });

  it('selectSlot switches which blob save/load addresses', async () => {
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory());
    const a = await store.createSlot('Alice');
    const b = await store.createSlot('Bob');

    await store.save({ who: 'alice' }, { day: 1 });
    await store.selectSlot(b.id);
    await store.save({ who: 'bob' }, { day: 1 });

    expect(await store.load()).toEqual({ who: 'bob' });
    await store.selectSlot(a.id);
    expect(await store.load()).toEqual({ who: 'alice' });
  });

  it('selectSlot rejects an unknown slot', async () => {
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory());
    await expect(store.selectSlot('slot-99')).rejects.toThrow(/unknown slot/);
  });

  it('keeps slot blobs independent', async () => {
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory());
    const a = await store.createSlot('Alice');
    const b = await store.createSlot('Bob');

    await store.selectSlot(a.id);
    await store.save({ progress: 'a-deep' }, { day: 30 });
    await store.selectSlot(b.id);
    await store.save({ progress: 'b-early' }, { day: 2 });

    await store.selectSlot(a.id);
    expect(await store.load()).toEqual({ progress: 'a-deep' });
    const slots = await store.listSlots();
    expect(slots.find((s) => s.id === a.id)?.day).toBe(30);
    expect(slots.find((s) => s.id === b.id)?.day).toBe(2);
  });

  it('deletes a slot in isolation without corrupting siblings', async () => {
    const factory = createInMemoryDriverFactory();
    const store = createMultiSlotSaveStore(factory);
    const a = await store.createSlot('Alice');
    const b = await store.createSlot('Bob');

    await store.selectSlot(a.id);
    await store.save({ keep: true }, { day: 5 });
    await store.selectSlot(b.id);
    await store.save({ doomed: true }, { day: 9 });

    await store.deleteSlot(b.id);

    expect((await store.listSlots()).map((s) => s.id)).toEqual([a.id]);
    // Active was the deleted slot — selection clears.
    expect(await store.getActiveSlotId()).toBeNull();

    await store.selectSlot(a.id);
    expect(await store.load()).toEqual({ keep: true });
  });

  it('deleting a non-active slot leaves the active selection intact', async () => {
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory());
    const a = await store.createSlot('Alice');
    const b = await store.createSlot('Bob');
    await store.selectSlot(a.id);

    await store.deleteSlot(b.id);
    expect(await store.getActiveSlotId()).toBe(a.id);
  });

  it('deleting an unknown slot is a no-op', async () => {
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory());
    await store.createSlot('Alice');
    await store.deleteSlot('slot-404');
    expect((await store.listSlots()).length).toBe(1);
  });

  it('a recreated slot id never reuses a deleted slot blob', async () => {
    const factory = createInMemoryDriverFactory();
    const store = createMultiSlotSaveStore(factory);
    const a = await store.createSlot('Alice');
    await store.save({ stale: true }, { day: 1 });
    await store.deleteSlot(a.id);

    const fresh = await store.createSlot('Alice2');
    expect(fresh.id).not.toBe(a.id);
    await store.selectSlot(fresh.id);
    expect(await store.load()).toBeNull();
  });

  it('persists slots and active selection across a cold start', async () => {
    const factory = createInMemoryDriverFactory();
    const first = createMultiSlotSaveStore(factory);
    const a = await first.createSlot('Alice');
    const b = await first.createSlot('Bob');
    await first.selectSlot(b.id);
    await first.save({ resumed: 'bob' }, { day: 12 });

    // Simulate a process restart over the same backing storage.
    const reloaded = createMultiSlotSaveStore(factory);
    expect(await reloaded.getActiveSlotId()).toBe(b.id);
    expect((await reloaded.listSlots()).map((s) => s.id)).toEqual([a.id, b.id]);
    expect(await reloaded.load()).toEqual({ resumed: 'bob' });
  });
});

describe('MultiSlotSaveStore mid-day checkpoint (#109)', () => {
  const sampleCheckpoint = (overrides = {}) => ({
    seed: 42,
    day: 3,
    dayContext: { reputation: 0.7, marketShare: 0.12, season: 'spring' },
    currentTick: 57,
    actionLog: [
      { kind: 'grab', customerId: 'c1', tick: 10 },
      { kind: 'approach', choiceId: 'lowball', tick: 12 },
      { kind: 'skipToClose', tick: 40 },
    ],
    ...overrides,
  });

  it('round-trips write → cold read losslessly', async () => {
    const factory = createInMemoryDriverFactory();
    const store = createMultiSlotSaveStore(factory);
    await store.createSlot('Alice');
    const cp = sampleCheckpoint();
    await store.writeCheckpoint(cp);

    // Cold restart over the same backing storage.
    const reloaded = createMultiSlotSaveStore(factory);
    const read = await reloaded.readCheckpoint();
    expect(read).toEqual(cp);
    // Deterministic: a second read yields the identical structure.
    expect(await reloaded.readCheckpoint()).toEqual(cp);
  });

  it('returns null when the active slot has no checkpoint', async () => {
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory());
    await store.createSlot('Alice');
    expect(await store.readCheckpoint()).toBeNull();
  });

  it('writeCheckpoint overwrites the prior checkpoint', async () => {
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory());
    await store.createSlot('Alice');
    await store.writeCheckpoint(sampleCheckpoint());
    await store.writeCheckpoint(sampleCheckpoint({ currentTick: 99 }));
    expect((await store.readCheckpoint())?.currentTick).toBe(99);
  });

  it('clearCheckpoint removes the active slot checkpoint', async () => {
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory());
    await store.createSlot('Alice');
    await store.writeCheckpoint(sampleCheckpoint());
    await store.clearCheckpoint();
    expect(await store.readCheckpoint()).toBeNull();
  });

  it('keeps checkpoints independent per slot', async () => {
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory());
    const a = await store.createSlot('Alice');
    const b = await store.createSlot('Bob');

    await store.selectSlot(a.id);
    await store.writeCheckpoint(sampleCheckpoint({ day: 1, currentTick: 5 }));
    await store.selectSlot(b.id);
    await store.writeCheckpoint(sampleCheckpoint({ day: 2, currentTick: 80 }));

    await store.selectSlot(a.id);
    expect(await store.readCheckpoint()).toMatchObject({ day: 1, currentTick: 5 });
    // Clearing one slot's checkpoint leaves the sibling's intact.
    await store.clearCheckpoint();
    await store.selectSlot(b.id);
    expect(await store.readCheckpoint()).toMatchObject({ day: 2, currentTick: 80 });
  });

  it('does not address a checkpoint with no active slot', async () => {
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory());
    expect(await store.readCheckpoint()).toBeNull();
    await expect(store.writeCheckpoint(sampleCheckpoint())).rejects.toThrow(
      /no active slot/,
    );
    // Clearing with no active slot is a harmless no-op.
    await expect(store.clearCheckpoint()).resolves.toBeUndefined();
  });

  it('deleteSlot wipes the slot checkpoint so a recreated id is clean', async () => {
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory());
    const a = await store.createSlot('Alice');
    await store.writeCheckpoint(sampleCheckpoint());
    await store.deleteSlot(a.id);

    const recreated = await store.createSlot('Alice2');
    await store.selectSlot(recreated.id);
    expect(await store.readCheckpoint()).toBeNull();
  });
});
