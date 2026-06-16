import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { loadTunables } from '../src/game/data';
import type { CharacterProfile } from '../src/game/CareerProgression';

const SOURCING_GATE =
  loadTunables().managerGates.actThresholds.condition_reading;

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

type World = ReturnType<typeof createWorld>;

/** Hire a UCM (hireTier 2) onto the roster and return their mutable Staff. */
function hireUcm(world: World) {
  const tierState = world.tierManager.getSerializableState();
  world.tierManager.restoreState({ ...tierState, currentTier: 2 });
  const candidate = world.staffOrg.getCandidates('used-car-manager')[0];
  expect(candidate).toBeDefined();
  world.staffOrg.hire(candidate.candidateId);
  const ucm = world.staffOrg.currentRoster.find(
    (s) => s.role_id === 'used-car-manager',
  )!;
  expect(ucm).toBeDefined();
  return ucm;
}

let day = 1;
function prepNextDay(world: World, bus: ReturnType<typeof createEventBus>) {
  // Drive a fresh board scan (prepareDay → auto-fill) without running a floor.
  day += 1;
  bus.publish('clock:managerial_prep', { upcomingDay: day });
  return world.inventory.getLotVehicles().length;
}

describe('#293 UCM sourcing auto-fill — condition_reading gate (channel-desk M6)', () => {
  beforeEach(() => {
    day = 1;
  });

  it('does NOT auto-buy with no UCM, nor with a below-gate UCM; auto-fills only once condition_reading clears the gate', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 293, characterProfile: PROFILE });

    // --- No UCM: the desk can't act, the board is left to the player. ---
    const beforeNoUcm = world.inventory.getLotVehicles().length;
    const afterNoUcm = prepNextDay(world, bus);
    expect(afterNoUcm).toBe(beforeNoUcm);

    // --- Below-gate UCM: presence alone is NOT enough (earned-stripes). ---
    const ucm = hireUcm(world);
    ucm.skills['condition_reading'] = Math.max(0, SOURCING_GATE - 10);
    const beforeGreen = world.inventory.getLotVehicles().length;
    const afterGreen = prepNextDay(world, bus);
    expect(afterGreen).toBe(beforeGreen);

    // --- At/above the gate: the desk auto-fills from the board. ---
    ucm.skills['condition_reading'] = Math.min(100, SOURCING_GATE + 20);
    const beforeUcm = world.inventory.getLotVehicles().length;
    const afterUcm = prepNextDay(world, bus);
    expect(afterUcm).toBeGreaterThan(beforeUcm);
  });

  it('respects the player sourcing-lean getter (a live override drives the buys)', () => {
    const bus = createEventBus();
    // Pin the lean hard onto clean condition so the auto-fill clearly favors
    // clean metal — proving the per-slot lean getter is wired through.
    const world = createWorld({
      bus,
      masterSeed: 7,
      characterProfile: PROFILE,
      getSourcingLean: () => ({ margin: 0, condition: 1, demandFit: 0 }),
    });
    const ucm = hireUcm(world);
    ucm.skills['condition_reading'] = Math.min(100, SOURCING_GATE + 20);

    const before = world.inventory.getLotVehicles().length;
    prepNextDay(world, bus);
    const bought = world.inventory
      .getLotVehicles()
      .filter((v) => v.arrivalDay === day);
    expect(world.inventory.getLotVehicles().length).toBeGreaterThan(before);
    // A condition-only lean buys clean metal, never rough.
    expect(bought.some((v) => v.condition === 'clean')).toBe(true);
    expect(bought.every((v) => v.condition !== 'rough')).toBe(true);
  });
});
