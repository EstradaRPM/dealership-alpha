import { createEventBus } from '../src/game/EventBus';
import { createEndCardManager } from '../src/game/EndCard';
import type { CharacterProfile, TierManager } from '../src/game/CareerProgression';

function makeProfile(overrides?: Partial<CharacterProfile>): CharacterProfile {
  return {
    name: 'Ray Estrada',
    backstoryId: 'ex-mechanic',
    day1Modifier: {
      backstoryId: 'ex-mechanic',
      reconJudgmentBonus: 0.15,
      startingCreditLine: 0,
      startingCapitalBonus: 0,
      grudgesFlag: false,
    },
    ...overrides,
  };
}

function makeTierManager(tier: number): TierManager {
  return {
    get currentTier() { return tier; },
    get businessName() { return ''; },
    get accentColor() { return ''; },
    get fontId() { return ''; },
    get customersServed() { return 0; },
    applyTierUp: jest.fn(),
    applyContraction: jest.fn(),
    getSerializableState: jest.fn(),
    restoreState: jest.fn(),
  };
}

describe('EndCardManager — bankruptcy terminal', () => {
  it('assembles EndCardData and publishes career:game_over', () => {
    const bus = createEventBus();
    const profile = makeProfile();
    const tm = makeTierManager(1);
    const gameOver = jest.fn();
    bus.subscribe('career:game_over', gameOver);

    const manager = createEndCardManager({ bus, characterProfile: profile, tierManager: tm });
    bus.publish('career:bankruptcy_terminal', { day: 100, tier: 1 });

    expect(manager.data).not.toBeNull();
    expect(manager.data!.reason).toBe('bankruptcy');
    expect(manager.data!.playerName).toBe('Ray Estrada');
    expect(manager.data!.careerYear).toBe(1); // day 100: floor(99/364)+1 = 1
    expect(manager.data!.tierReached).toBe(1);
    expect(manager.data!.flavorText).toBeTruthy();
    expect(gameOver).toHaveBeenCalledWith(expect.objectContaining({ day: 100 }));
  });

  it('computes careerYear from day number', () => {
    const bus = createEventBus();
    createEndCardManager({ bus, characterProfile: makeProfile(), tierManager: makeTierManager(1) });
    bus.publish('career:bankruptcy_terminal', { day: 730, tier: 1 }); // day 730 = year 3
    // day 730: Math.floor((730-1)/364)+1 = Math.floor(729/364)+1 = 2+1 = 3
    const bus2 = createEventBus();
    const manager2 = createEndCardManager({ bus: bus2, characterProfile: makeProfile(), tierManager: makeTierManager(1) });
    bus2.publish('career:bankruptcy_terminal', { day: 730, tier: 1 });
    expect(manager2.data!.careerYear).toBe(3);
  });
});

describe('EndCardManager — AG complaint terminal', () => {
  it('sets reason ag_complaint', () => {
    const bus = createEventBus();
    const manager = createEndCardManager({ bus, characterProfile: makeProfile(), tierManager: makeTierManager(1) });
    bus.publish('regulatory:ag_complaint_terminal', { day: 100, tier: 1, pressure: 80 });
    expect(manager.data!.reason).toBe('ag_complaint');
  });
});

describe('EndCardManager — indictment terminal', () => {
  it('sets reason indictment', () => {
    const bus = createEventBus();
    const manager = createEndCardManager({ bus, characterProfile: makeProfile(), tierManager: makeTierManager(1) });
    bus.publish('career:indictment_terminal', { day: 200, tier: 1, pressure: 100 });
    expect(manager.data!.reason).toBe('indictment');
  });
});

describe('EndCardManager — only first terminal wins', () => {
  it('ignores subsequent terminal events after the first', () => {
    const bus = createEventBus();
    const gameOver = jest.fn();
    bus.subscribe('career:game_over', gameOver);
    const manager = createEndCardManager({ bus, characterProfile: makeProfile(), tierManager: makeTierManager(1) });

    bus.publish('career:bankruptcy_terminal', { day: 100, tier: 1 });
    bus.publish('career:indictment_terminal', { day: 200, tier: 1, pressure: 50 });

    expect(gameOver).toHaveBeenCalledTimes(1);
    expect(manager.data!.reason).toBe('bankruptcy');
  });
});

describe('EndCardManager — state serialization', () => {
  it('round-trips EndCardData through getSerializableState / restoreState', () => {
    const bus = createEventBus();
    const manager = createEndCardManager({ bus, characterProfile: makeProfile(), tierManager: makeTierManager(2) });
    bus.publish('career:bankruptcy_terminal', { day: 500, tier: 2 });
    const snapshot = manager.getSerializableState();

    const bus2 = createEventBus();
    const manager2 = createEndCardManager({ bus: bus2, characterProfile: makeProfile(), tierManager: makeTierManager(1) });
    manager2.restoreState(snapshot);

    expect(manager2.data).toEqual(manager.data);
  });

  it('restores null data when no terminal occurred', () => {
    const bus = createEventBus();
    const manager = createEndCardManager({ bus, characterProfile: makeProfile(), tierManager: makeTierManager(1) });
    const snapshot = manager.getSerializableState();

    const bus2 = createEventBus();
    const manager2 = createEndCardManager({ bus: bus2, characterProfile: makeProfile(), tierManager: makeTierManager(1) });
    manager2.restoreState(snapshot);

    expect(manager2.data).toBeNull();
  });
});

describe('EndCardManager — flavor text per backstory', () => {
  const reasons = [
    'bankruptcy',
    'ag_complaint',
    'indictment',
    'retire',
    'sellout',
    'family_handoff',
  ] as const;
  const backstories = ['ex-mechanic', 'ex-banker', 'inheritor'] as const;

  for (const backstoryId of backstories) {
    for (const reason of reasons) {
      it(`has non-empty flavor for ${backstoryId} × ${reason}`, () => {
        const bus = createEventBus();
        const profile = makeProfile({ backstoryId, day1Modifier: { backstoryId, reconJudgmentBonus: 0, startingCreditLine: 0, startingCapitalBonus: 0, grudgesFlag: false } });
        const manager = createEndCardManager({ bus, characterProfile: profile, tierManager: makeTierManager(1) });

        if (reason === 'bankruptcy') bus.publish('career:bankruptcy_terminal', { day: 100, tier: 1 });
        if (reason === 'ag_complaint') bus.publish('regulatory:ag_complaint_terminal', { day: 100, tier: 1, pressure: 50 });
        if (reason === 'indictment') bus.publish('career:indictment_terminal', { day: 100, tier: 1, pressure: 50 });
        if (reason === 'retire') bus.publish('career:retired', { day: 100, tier: 1, cashOnHand: 1_000_000, careerYear: 9 });
        if (reason === 'sellout') bus.publish('career:pe_sellout', { day: 100, tier: 3, offerAmount: 2_000_000 });
        if (reason === 'family_handoff') bus.publish('career:family_handoff', { day: 100, tier: 2, careerYear: 16 });

        expect(manager.data!.flavorText.length).toBeGreaterThan(0);
      });
    }
  }
});

describe('EndCardManager — success endings', () => {
  it('routes career:retired to a retire end-card', () => {
    const bus = createEventBus();
    const manager = createEndCardManager({ bus, characterProfile: makeProfile(), tierManager: makeTierManager(2) });
    bus.publish('career:retired', { day: 9 * 364, tier: 2, cashOnHand: 1_000_000, careerYear: 9 });
    expect(manager.data!.reason).toBe('retire');
    expect(manager.data!.tierReached).toBe(2);
  });

  it('routes career:pe_sellout to a sellout end-card', () => {
    const bus = createEventBus();
    const manager = createEndCardManager({ bus, characterProfile: makeProfile(), tierManager: makeTierManager(3) });
    bus.publish('career:pe_sellout', { day: 1000, tier: 3, offerAmount: 2_500_000 });
    expect(manager.data!.reason).toBe('sellout');
  });

  it('routes career:family_handoff to a family_handoff end-card', () => {
    const bus = createEventBus();
    const manager = createEndCardManager({ bus, characterProfile: makeProfile(), tierManager: makeTierManager(2) });
    bus.publish('career:family_handoff', { day: 16 * 364, tier: 2, careerYear: 16 });
    expect(manager.data!.reason).toBe('family_handoff');
  });
});
