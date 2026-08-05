import { loadEconomyConfig } from '../src/game/Economy';

// #353 retired `weeklyPayrollStub`. The point of this file is that the key is
// gone from BOTH places — the JSON and the schema — in the same commit that
// replaced it. Leaving either behind means two numbers can disagree about what
// staff cost, which is the class of bug the deletion exists to prevent.

describe('economyData — the retired payroll stub', () => {
  it('the payroll stub key is gone from the config schema', () => {
    const config = loadEconomyConfig();
    expect(config).not.toHaveProperty('weeklyPayrollStub');
    expect(Object.keys(config)).toEqual(['weeklyRent']);
  });

  it('the payroll stub key is gone from data/tunables.json', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require('../data/tunables.json') as {
      economy: { tier1: Record<string, unknown> };
    };
    expect(raw.economy.tier1).not.toHaveProperty('weeklyPayrollStub');
  });

  it('still loads the rent it is left with', () => {
    expect(loadEconomyConfig().weeklyRent).toBeGreaterThan(0);
  });
});
