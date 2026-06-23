import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { loadTunables } from '../src/game/data';
import {
  autoServicePosture,
  loadServiceManagerConfig,
} from '../src/game/ServiceDispatch';
import type { CharacterProfile } from '../src/game/CareerProgression';

const GATES = loadTunables().managerGates.serviceManager.actThresholds;
const SM_CONFIG = loadServiceManagerConfig();

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

/** Hire a service manager (hireTier 5) and return their mutable Staff record. */
function hireServiceManager(world: World) {
  const tierState = world.tierManager.getSerializableState();
  world.tierManager.restoreState({ ...tierState, currentTier: 5 });
  const candidate = world.staffOrg.getCandidates('service-manager')[0];
  expect(candidate).toBeDefined();
  world.staffOrg.hire(candidate.candidateId);
  const sm = world.staffOrg.currentRoster.find(
    (s) => s.role_id === 'service-manager',
  )!;
  expect(sm).toBeDefined();
  return sm;
}

function setSkill(
  sm: ReturnType<typeof hireServiceManager>,
  value: number,
): void {
  sm.skills['shop_throughput'] = value;
}

describe('#310 service-manager automation — gate engagement in the live world', () => {
  it('leaves the player in control with no service manager on staff', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 310, characterProfile: PROFILE });

    world.setServicePricingPosture(0.5);
    bus.publish('clock:day_started', { day: 2 });

    // No SM ⇒ the morning automation no-ops; the player's posture stands.
    expect(world.getServicePricingPosture()).toBe(0.5);
  });

  it('leaves the player in control with a below-gate (green) service manager', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 311, characterProfile: PROFILE });
    const sm = hireServiceManager(world);
    setSkill(sm, Math.max(0, GATES.pricing - 10));

    world.setServicePricingPosture(0.5);
    bus.publish('clock:day_started', { day: 2 });

    expect(world.getServicePricingPosture()).toBe(0.5);
  });

  it('takes over pricing posture once shop_throughput clears the pricing gate', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 312, characterProfile: PROFILE });
    const sm = hireServiceManager(world);
    setSkill(sm, Math.min(100, GATES.pricing + 20));

    world.setServicePricingPosture(0.5);
    bus.publish('clock:day_started', { day: 2 });

    const rep01 = Math.max(0, Math.min(1, world.reputation.reviewScore / 100));
    expect(world.getServicePricingPosture()).toBeCloseTo(
      autoServicePosture(rep01, { config: SM_CONFIG }),
    );
  });

  it('takes over par tuning once shop_throughput clears the (lower) par gate', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 313, characterProfile: PROFILE });
    const sm = hireServiceManager(world);
    // Above the par gate but a notch below pricing so we isolate the par ladder.
    setSkill(sm, GATES.par);

    // Pin a clearly non-automated par so the takeover is observable.
    world.partsInventory.setPolicy('oil_filters', { reorderPoint: 99, target: 199 });
    bus.publish('clock:day_started', { day: 2 });

    const policy = world.partsInventory.getPolicy('oil_filters');
    // Empty intake window ⇒ the SM floors par at the configured minimums.
    expect(policy.target).toBe(SM_CONFIG.par.minTarget);
    expect(policy.reorderPoint).toBe(SM_CONFIG.par.minReorderPoint);
  });

  it('engages functions progressively up the threshold ladder', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 314, characterProfile: PROFILE });
    const sm = hireServiceManager(world);

    // Skill between the par gate and the pricing gate: par automates, posture not.
    setSkill(sm, GATES.par);
    world.partsInventory.setPolicy('oil_filters', { reorderPoint: 99, target: 199 });
    world.setServicePricingPosture(0.5);
    bus.publish('clock:day_started', { day: 2 });

    expect(world.partsInventory.getPolicy('oil_filters').target).toBe(
      SM_CONFIG.par.minTarget,
    );
    expect(world.getServicePricingPosture()).toBe(0.5); // pricing gate not yet met
  });
});
