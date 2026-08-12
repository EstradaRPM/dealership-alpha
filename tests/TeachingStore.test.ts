import {
  createTeachingStore,
  createInMemoryDriver,
  createInMemoryDriverFactory,
  createMultiSlotSaveStore,
} from '../src/game/SaveStore';

describe('TeachingStore (#386)', () => {
  it('starts with nothing taught', async () => {
    const store = createTeachingStore(createInMemoryDriver());
    expect(await store.listTaught()).toEqual([]);
  });

  it('records a taught id, and marking it twice does not duplicate it', async () => {
    const store = createTeachingStore(createInMemoryDriver());
    await store.markTaught('fni_posture');
    await store.markTaught('fni_posture');
    expect(await store.listTaught()).toEqual(['fni_posture']);
  });

  it('a taught mark survives a cold read', async () => {
    // Two independent stores over ONE cell — the cold-start path exactly: the
    // app that wrote the mark is gone, and a fresh store addresses the same key.
    const driver = createInMemoryDriver();
    await createTeachingStore(driver).markTaught('pricing_strategy');
    expect(await createTeachingStore(driver).listTaught()).toEqual([
      'pricing_strategy',
    ]);
  });

  it('resetAll re-arms every hint but keeps the cell', async () => {
    const driver = createInMemoryDriver();
    const store = createTeachingStore(driver);
    await store.markTaught('trade_policy');
    await store.markTaught('fni_posture');
    await store.resetAll();
    expect(await store.listTaught()).toEqual([]);
    // Still a written cell, not an absent one — the distinction matters because
    // `clear()` is what `deleteSlot` calls and this must not be that.
    expect(await driver.read()).not.toBeNull();
  });

  it('clear wipes the cell itself', async () => {
    const driver = createInMemoryDriver();
    const store = createTeachingStore(driver);
    await store.markTaught('trade_policy');
    await store.clear();
    expect(await driver.read()).toBeNull();
    expect(await store.listTaught()).toEqual([]);
  });

  it('a corrupt cell reads as nothing taught rather than throwing', async () => {
    // The failure mode of a teaching surface is showing the player too much,
    // never crashing the career it is attached to.
    const driver = createInMemoryDriver();
    await driver.write('{ not json');
    await expect(createTeachingStore(driver).listTaught()).resolves.toEqual([]);
  });

  describe('through the slot store', () => {
    it('returns null when no slot is selected', async () => {
      const store = createMultiSlotSaveStore(createInMemoryDriverFactory());
      expect(await store.teachingStore()).toBeNull();
    });

    it('addresses the active slot, and two careers learn independently', async () => {
      const store = createMultiSlotSaveStore(createInMemoryDriverFactory());
      const first = await store.createSlot('First');
      const second = await store.createSlot('Second');

      await (await store.teachingStore())!.markTaught('fni_posture');

      await store.selectSlot(second.id);
      expect(await (await store.teachingStore())!.listTaught()).toEqual([]);

      await store.selectSlot(first.id);
      expect(await (await store.teachingStore())!.listTaught()).toEqual([
        'fni_posture',
      ]);
    });
  });
});
