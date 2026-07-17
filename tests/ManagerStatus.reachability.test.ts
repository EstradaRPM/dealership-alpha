import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { buildManagerStatus } from '../src/app/config';
import { loadTunables } from '../src/game/data';
import { readAppCompositionSource } from './helpers/appComposition';
import type { CharacterProfile } from '../src/game/CareerProgression';
import type { UcmAxis } from '../src/ui/PeopleTab';

const GATES = loadTunables().managerGates.actThresholds;

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

function ucmFact(world: ReturnType<typeof createWorld>, axis: UcmAxis) {
  return buildManagerStatus(world).ucm.find((f) => f.axis === axis)!;
}

describe('#325 manager status — buildManagerStatus reflects live gate state', () => {
  it('starts with no managers: every capability manual, both departments absent', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 325, characterProfile: PROFILE });

    const model = buildManagerStatus(world);
    expect(model.ucmPresent).toBe(false);
    for (const fact of model.ucm) {
      expect(fact.delegated).toBe(false);
      expect(fact.skill).toBeNull();
    }
    expect(model.departments.map((d) => d.dept)).toEqual(['service', 'body']);
    for (const dept of model.departments) {
      expect(dept.present).toBe(false);
      // Below the gate (no manager) no rung is automated.
      expect(dept.functions.every((fn) => !fn.automated)).toBe(true);
    }
  });

  it('crossing the pricing gate flips the surfaced pricing capability to delegated', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 325, characterProfile: PROFILE });

    // UCM hireTier is 3; force tier 3 so the role is hireable.
    const tierState = world.tierManager.getSerializableState();
    world.tierManager.restoreState({ ...tierState, currentTier: 3 });
    const candidate = world.staffOrg.getCandidates('used-car-manager')[0];
    expect(candidate).toBeDefined();
    world.staffOrg.hire(candidate.candidateId);
    const ucm = world.staffOrg.currentRoster.find(
      (s) => s.role_id === 'used-car-manager',
    )!;
    expect(ucm).toBeDefined();

    // Present but below the gate: the card reads "advising" — a non-null skill
    // that hasn't earned the act, not delegated.
    ucm.skills['pricing'] = Math.max(0, GATES.pricing - 10);
    let fact = ucmFact(world, 'pricing');
    expect(buildManagerStatus(world).ucmPresent).toBe(true);
    expect(fact.skill).not.toBeNull();
    expect(fact.delegated).toBe(false);

    // At/above the gate: the pricing capability flips to delegated.
    ucm.skills['pricing'] = Math.min(100, GATES.pricing + 10);
    fact = ucmFact(world, 'pricing');
    expect(fact.delegated).toBe(true);
    expect(fact.skill).toBeGreaterThanOrEqual(fact.threshold);

    // The card gates each capability independently, not as a single on/off:
    // hold t_o_closing below its gate and it stays undelegated while pricing is on.
    ucm.skills['t_o_closing'] = Math.max(0, GATES.t_o_closing - 10);
    expect(ucmFact(world, 'pricing').delegated).toBe(true);
    expect(ucmFact(world, 't_o_closing').delegated).toBe(false);
  });

  it('is wired into the app composition (People tab consumes buildManagerStatus)', () => {
    const src = readAppCompositionSource();
    expect(src).toMatch(/buildManagerStatus\(world\)/);
    expect(src).toMatch(/managerStatus=\{/);
  });
});
