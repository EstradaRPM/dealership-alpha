import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { loadTunables } from '../src/game/data';
import {
  autoBodyShopChannelPosture,
} from '../src/bodyShopManager';
import { loadBodyShopManagerConfig } from '../src/bodyShopManagerConfig';
import type { CharacterProfile } from '../src/game/CareerProgression';

const GATES = loadTunables().managerGates.bodyShopManager.actThresholds;
const BSM_CONFIG = loadBodyShopManagerConfig();

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

/** Hire a body-shop manager (hireTier 5) and return their mutable Staff record. */
function hireBodyShopManager(world: World) {
  const tierState = world.tierManager.getSerializableState();
  world.tierManager.restoreState({ ...tierState, currentTier: 5 });
  const candidate = world.staffOrg.getCandidates('body-shop-manager')[0];
  expect(candidate).toBeDefined();
  world.staffOrg.hire(candidate.candidateId);
  const bsm = world.staffOrg.currentRoster.find(
    (s) => s.role_id === 'body-shop-manager',
  )!;
  expect(bsm).toBeDefined();
  return bsm;
}

function setSkill(
  bsm: ReturnType<typeof hireBodyShopManager>,
  value: number,
): void {
  bsm.skills['shop_throughput'] = value;
}

describe('#316 body-shop-manager automation — gate engagement in the live world', () => {
  it('leaves the player in control with no body-shop manager on staff', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 316, characterProfile: PROFILE });

    world.setBodyShopChannelPosture(0.5);
    bus.publish('clock:day_started', { day: 2 });

    // No manager ⇒ the morning automation no-ops; the player's posture stands.
    expect(world.getBodyShopChannelPosture()).toBe(0.5);
  });

  it('leaves the player in control with a below-gate (green) body-shop manager', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 317, characterProfile: PROFILE });
    const bsm = hireBodyShopManager(world);
    setSkill(bsm, Math.max(0, GATES.channel - 10));

    world.setBodyShopChannelPosture(0.5);
    bus.publish('clock:day_started', { day: 2 });

    expect(world.getBodyShopChannelPosture()).toBe(0.5);
  });

  it('takes over the channel posture once shop_throughput clears the channel gate', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 318, characterProfile: PROFILE });
    const bsm = hireBodyShopManager(world);
    setSkill(bsm, Math.min(100, GATES.channel + 20));

    world.setBodyShopChannelPosture(0.5);
    bus.publish('clock:day_started', { day: 2 });

    const rep01 = Math.max(0, Math.min(1, world.reputation.reviewScore / 100));
    expect(world.getBodyShopChannelPosture()).toBeCloseTo(
      autoBodyShopChannelPosture(rep01, { config: BSM_CONFIG }),
    );
  });

  it('takes over par tuning once shop_throughput clears the (lower) par gate', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 319, characterProfile: PROFILE });
    const bsm = hireBodyShopManager(world);
    // Above the par gate but a notch below channel so we isolate the par ladder.
    setSkill(bsm, GATES.par);

    // Pin a clearly non-automated par so the takeover is observable.
    world.partsInventory.setPolicy('paint', { reorderPoint: 99, target: 199 });
    bus.publish('clock:day_started', { day: 2 });

    const policy = world.partsInventory.getPolicy('paint');
    // Empty intake window (dark below Tier 3 demand) ⇒ par floored at the minimums.
    expect(policy.target).toBe(BSM_CONFIG.par.minTarget);
    expect(policy.reorderPoint).toBe(BSM_CONFIG.par.minReorderPoint);
  });

  it('engages functions progressively up the threshold ladder', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 320, characterProfile: PROFILE });
    const bsm = hireBodyShopManager(world);

    // Skill between the par gate and the channel gate: par automates, channel not.
    setSkill(bsm, GATES.par);
    world.partsInventory.setPolicy('paint', { reorderPoint: 99, target: 199 });
    world.setBodyShopChannelPosture(0.5);
    bus.publish('clock:day_started', { day: 2 });

    expect(world.partsInventory.getPolicy('paint').target).toBe(
      BSM_CONFIG.par.minTarget,
    );
    expect(world.getBodyShopChannelPosture()).toBe(0.5); // channel gate not yet met
  });
});
