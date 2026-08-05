import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { groupExpenses } from '../src/ui/FinanceTab/financeModel';
import { loadStaffPay, dailyWageFor } from '../src/game/StaffOrg';
import type { CharacterProfile } from '../src/game/CareerProgression';

// #353 — the daily wage drain. The engine tests prove StaffOrg sums the roster
// and Economy posts it; this proves the mechanic is actually wired into the
// *live* world (`createWorld` passes no `pay`, so it falls through to the
// shipped `data/staff-pay.json`) and that the money lands where the player
// reads it — Finance groups the ledger by label, so "Payroll" has to survive as
// its own line rather than disappearing into "Other".
//
// This is the guard against the class of hole this repo has hit before: a
// mechanic built, tested in isolation, and never actually charged in play. The
// old `weeklyPayrollStub` it replaced was the inverse — charged in play, but a
// flat number that had nothing to do with the roster.

const PROFILE: CharacterProfile = {
  name: 'Ray Estrada',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0.15,
    startingCreditLine: 0,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

function makeWorld(masterSeed: number, tier = 1) {
  const bus = createEventBus();
  const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
  if (tier !== 1) {
    const state = world.tierManager.getSerializableState();
    world.tierManager.restoreState({ ...state, currentTier: tier });
  }
  return { bus, world };
}

describe('Payroll reachability — the wage drain in a live world (#353)', () => {
  it('charges the shipped wage book, not an injected test table', () => {
    const { world } = makeWorld(515);
    const candidate = world.staffOrg.getCandidates('salesperson')[0];

    expect(candidate.dailyWage).toBe(
      dailyWageFor(loadStaffPay(), 'salesperson', candidate.grade),
    );
    expect(candidate.dailyWage).toBeGreaterThan(0);
  });

  it('drains the roster\'s wages every night, and the second hire is not free', () => {
    // Tier 2 — T1 has exactly one salesperson desk (#352), and the point here
    // is that the second body costs a second wage.
    const { world } = makeWorld(515, 2);
    const candidates = world.staffOrg.getCandidates('salesperson');
    world.staffOrg.hire(candidates[0].candidateId);

    const oneBody = world.staffOrg.dailyPayroll;
    expect(oneBody).toBe(candidates[0].dailyWage);

    world.staffOrg.hire(candidates[1].candidateId);
    const twoBodies = world.staffOrg.dailyPayroll;
    // The bug this replaced: the flat weekly stub charged the same for both.
    expect(twoBodies).toBeGreaterThan(oneBody);

    const cashBefore = world.economy.cash;
    world.clock.advanceDay();
    expect(cashBefore - world.economy.cash).toBeGreaterThanOrEqual(twoBodies);

    const payroll = world.economy
      .getPnL(1, world.clock.currentDay)
      .entries.filter((e) => e.label === 'Payroll');
    expect(payroll).toHaveLength(1);
    expect(payroll[0].amount).toBe(twoBodies);
  });

  it('reads in Finance as its own "Payroll" line, not folded into Other', () => {
    const { world } = makeWorld(515);
    world.staffOrg.hire(world.staffOrg.getCandidates('salesperson')[0].candidateId);

    // A full week: long enough that rent posts too, so Payroll is competing for
    // a bar rather than being the only expense in the window.
    for (let i = 0; i < 7; i++) world.clock.advanceDay();

    const pnl = world.economy.getPnL(1, world.clock.currentDay);
    const grouped = groupExpenses(pnl.entries);
    const line = grouped.find((g) => g.label === 'Payroll');

    expect(line).toBeDefined();
    expect(line!.amount).toBe(7 * world.staffOrg.dailyPayroll);
    expect(grouped.map((g) => g.label)).toContain('Rent');
  });

  it('an empty roster costs nothing — a store with no staff posts no payroll', () => {
    const { world } = makeWorld(515);
    expect(world.staffOrg.currentRoster).toHaveLength(0);

    for (let i = 0; i < 3; i++) world.clock.advanceDay();

    const labels = world.economy
      .getPnL(1, world.clock.currentDay)
      .entries.map((e) => e.label);
    expect(labels).not.toContain('Payroll');
  });
});
