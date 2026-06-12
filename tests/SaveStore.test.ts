import { createSaveStore, createInMemoryDriver } from '../src/game/SaveStore';

describe('SaveStore', () => {
  it('load() returns null when no save exists yet', async () => {
    const store = createSaveStore(createInMemoryDriver());
    expect(await store.load()).toBeNull();
  });

  it('round-trips an arbitrary state object (deep equal)', async () => {
    const store = createSaveStore(createInMemoryDriver());
    const state = {
      day: 17,
      cash: 125_400,
      inventory: [
        { vin: 'A1', model: 'civic', cost: 18_000 },
        { vin: 'A2', model: 'cr-v', cost: 26_500 },
      ],
      reputation: { local: 0.42, oem: { vanda: 0.61 } },
      flags: { tutorialDone: true, firstSale: false },
    };

    await store.save(state);
    const loaded = await store.load();

    expect(loaded).toEqual(state);
  });

  it('save() overwrites a previous save', async () => {
    const store = createSaveStore(createInMemoryDriver());
    await store.save({ day: 1 });
    await store.save({ day: 2 });
    expect(await store.load()).toEqual({ day: 2 });
  });

  it('round-trips the cash-delta baselines + split (#255 envelope fields)', async () => {
    // The Home vs-yesterday delta rides the envelope as three top-level fields
    // written at day close: the next-diff baselines and the displayed split.
    // This locks them through a save/load so a load renders the delta
    // immediately instead of waiting for the next day close.
    const store = createSaveStore(createInMemoryDriver());
    const state = {
      prevDayCash: 87_350,
      prevDayAcquisitionSpend: 38_000,
      cashDelta: { ops: 12_490, stock: 38_000 },
    };

    await store.save(state);
    const loaded = await store.load();

    expect(loaded?.prevDayCash).toBe(87_350);
    expect(loaded?.prevDayAcquisitionSpend).toBe(38_000);
    expect(loaded?.cashDelta).toEqual({ ops: 12_490, stock: 38_000 });
  });

  it('clear() removes the save so load() returns null again', async () => {
    const store = createSaveStore(createInMemoryDriver());
    await store.save({ day: 1 });
    await store.clear();
    expect(await store.load()).toBeNull();
  });
});
