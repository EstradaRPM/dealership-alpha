import { computePrepBet, createPrepBetHolder, type PrepBetConfig } from '../src/game/PrepBet';

// #322 the pure morning-bet capture: the lot mix decides the stocking bet; the
// DemandShaper heat plus the Weather attribute lean decide the demand read.

const CONFIG: PrepBetConfig = {
  weatherWeight: 2,
  categoryAttributeProfiles: {
    sedan: { winterCapability: 0.3, openAir: 0.2, fuelEfficiency: 0.8 },
    truck: { winterCapability: 0.85, openAir: 0.3, fuelEfficiency: 0.2 },
    suv: { winterCapability: 0.7, openAir: 0.4, fuelEfficiency: 0.45 },
  },
};

const NO_WEATHER: Record<string, number> = {};

function lot(...categories: string[]): { category: string }[] {
  return categories.map((category) => ({ category }));
}

describe('#322 computePrepBet — stocking lean', () => {
  it('picks the heaviest lot category and its share', () => {
    const bet = computePrepBet({
      day: 3,
      lot: lot('truck', 'truck', 'truck', 'sedan'),
      demandMix: { sedan: 1, truck: 1, suv: 1 },
      weatherAttrLean: NO_WEATHER,
      config: CONFIG,
    });
    expect(bet.day).toBe(3);
    expect(bet.stockedCategory).toBe('truck');
    expect(bet.stockedShare).toBeCloseTo(0.75);
  });

  it('reports no stocking lean for an empty lot', () => {
    const bet = computePrepBet({
      day: 1,
      lot: [],
      demandMix: { sedan: 0.5, truck: 0.3, suv: 0.2 },
      weatherAttrLean: NO_WEATHER,
      config: CONFIG,
    });
    expect(bet.stockedCategory).toBeNull();
    expect(bet.stockedShare).toBe(0);
  });

  it('reports no stocking lean on a dead tie', () => {
    const bet = computePrepBet({
      day: 1,
      lot: lot('truck', 'sedan'),
      demandMix: { sedan: 1, truck: 1, suv: 1 },
      weatherAttrLean: NO_WEATHER,
      config: CONFIG,
    });
    expect(bet.stockedCategory).toBeNull();
  });

  it('ignores lot entries outside the sedan/truck/suv universe', () => {
    const bet = computePrepBet({
      day: 1,
      lot: lot('truck', 'van', 'van'),
      demandMix: { sedan: 1, truck: 1, suv: 1 },
      weatherAttrLean: NO_WEATHER,
      config: CONFIG,
    });
    expect(bet.stockedCategory).toBe('truck');
    // Share is over the whole lot length, unknown categories included.
    expect(bet.stockedShare).toBeCloseTo(1 / 3);
  });
});

describe('#322 computePrepBet — demand-heat read', () => {
  it('reads the top DemandShaper segment when weather is calm', () => {
    const bet = computePrepBet({
      day: 2,
      lot: lot('sedan'),
      demandMix: { sedan: 0.2, truck: 0.5, suv: 0.3 },
      weatherAttrLean: NO_WEATHER,
      config: CONFIG,
    });
    expect(bet.readCategory).toBe('truck');
  });

  it('lets a strong winter lean flip the read toward trucks over a sedan-leaning base', () => {
    const base = { sedan: 0.45, truck: 0.3, suv: 0.25 };
    const calm = computePrepBet({
      day: 2,
      lot: lot('sedan'),
      demandMix: base,
      weatherAttrLean: NO_WEATHER,
      config: CONFIG,
    });
    expect(calm.readCategory).toBe('sedan');

    const snowy = computePrepBet({
      day: 2,
      lot: lot('sedan'),
      demandMix: base,
      // Season winter (0.15) + storm condition (0.15) winterCapability lean.
      weatherAttrLean: { winterCapability: 0.3 },
      config: CONFIG,
    });
    expect(snowy.readCategory).toBe('truck');
  });

  it('reports no read on a flat heat map with no weather lean', () => {
    const bet = computePrepBet({
      day: 1,
      lot: lot('truck'),
      demandMix: { sedan: 1, truck: 1, suv: 1 },
      weatherAttrLean: NO_WEATHER,
      config: CONFIG,
    });
    expect(bet.readCategory).toBeNull();
  });
});

describe('#322 createPrepBetHolder', () => {
  it('holds and replaces the current bet', () => {
    const holder = createPrepBetHolder();
    expect(holder.get()).toBeNull();
    const bet = computePrepBet({
      day: 4,
      lot: lot('suv', 'suv'),
      demandMix: { sedan: 0.2, truck: 0.2, suv: 0.6 },
      weatherAttrLean: NO_WEATHER,
      config: CONFIG,
    });
    holder.set(bet);
    expect(holder.get()).toBe(bet);
    holder.set(null);
    expect(holder.get()).toBeNull();
  });
});
