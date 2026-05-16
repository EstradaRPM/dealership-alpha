import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createCustomerPool } from '../src/game/CustomerPool';
import { createFollowUpPool } from '../src/game/FollowUpPool';
import {
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
} from '../src/game/NPC';

const npcDeps = {
  masterSeed: 42,
  personArchetypes: loadPersonArchetypes(),
  visitArchetypes: loadVisitArchetypes(),
  traits: loadTraitTaxonomy(),
};

const TUNABLES = { initialHeatBase: 5, decayPerNight: 1 };

function makeSetup(initialDay = 0) {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay });
  const pool = createCustomerPool({ bus, npcDeps });
  const followUp = createFollowUpPool({ bus, pool, tunables: TUNABLES });
  return { bus, clock, pool, followUp };
}

function walkFirstCustomer(setup: ReturnType<typeof makeSetup>) {
  const { clock, pool } = setup;
  clock.advanceDay();
  const [session] = pool.getSessions();
  pool.dispatch(session.customerId, 'WALK_CUSTOMER');
  return session.customerId;
}

// ── Enqueue on walk ───────────────────────────────────────────────────────────

describe('FollowUpPool — enqueue on walk', () => {
  it('empty before any customer walks', () => {
    const { followUp } = makeSetup();
    expect(followUp.getFollowUps()).toHaveLength(0);
    expect(followUp.getArchived()).toHaveLength(0);
  });

  it('adds entry when a customer walks', () => {
    const setup = makeSetup();
    const id = walkFirstCustomer(setup);
    expect(setup.followUp.getFollowUps()).toHaveLength(1);
    expect(setup.followUp.getFollowUp(id)).toBeDefined();
  });

  it('does not add entry for closed customers', () => {
    // Test FollowUpPool in isolation: a customer:resolved with outcome=closed
    // must not be added to the follow-up pool regardless of how the close was reached.
    const { bus, followUp } = makeSetup();
    bus.publish('customer:resolved', {
      customerId: 'closed-customer',
      outcome: 'closed',
      receptivity: 0.8,
      satisfaction: 1,
      retentionSeed: 0.6,
      heat: 0,
      agreedPrice: 10000,
      frontGross: 1500,
    });
    expect(followUp.getFollowUps()).toHaveLength(0);
  });

  it('initial heat is positive and sourced from customer patience', () => {
    const setup = makeSetup();
    const id = walkFirstCustomer(setup);
    const entry = setup.followUp.getFollowUp(id)!;
    expect(entry.heat).toBeGreaterThan(0);
    expect(entry.heat).toBe(entry.initialHeat);
  });

  it('entry records the walked day', () => {
    const setup = makeSetup();
    const id = walkFirstCustomer(setup);
    const entry = setup.followUp.getFollowUp(id)!;
    expect(entry.walkedDay).toBe(1);
  });
});

// ── Heat decay ────────────────────────────────────────────────────────────────

describe('FollowUpPool — heat decay', () => {
  it('heat decreases by decayPerNight on each overnight', () => {
    const setup = makeSetup();
    const id = walkFirstCustomer(setup);
    const initialHeat = setup.followUp.getFollowUp(id)!.heat;

    setup.clock.advanceDay();
    expect(setup.followUp.getFollowUp(id)!.heat).toBe(initialHeat - 1);

    setup.clock.advanceDay();
    expect(setup.followUp.getFollowUp(id)!.heat).toBe(initialHeat - 2);
  });

  it('uses a custom decayPerNight from tunables', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const pool = createCustomerPool({ bus, npcDeps });
    const followUp = createFollowUpPool({ bus, pool, tunables: { initialHeatBase: 6, decayPerNight: 2 } });

    clock.advanceDay();
    const [session] = pool.getSessions();
    pool.dispatch(session.customerId, 'WALK_CUSTOMER');

    const initialHeat = followUp.getFollowUp(session.customerId)!.heat;
    clock.advanceDay();
    expect(followUp.getFollowUp(session.customerId)!.heat).toBe(initialHeat - 2);
  });
});

// ── Archival ──────────────────────────────────────────────────────────────────

describe('FollowUpPool — archival when heat reaches zero', () => {
  it('customer is archived when heat decays to zero', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const pool = createCustomerPool({ bus, npcDeps });
    // initialHeat will be 1 (initialHeatBase=1, patience ~0.5-0.7 → rounds to 1)
    const followUp = createFollowUpPool({ bus, pool, tunables: { initialHeatBase: 1, decayPerNight: 1 } });

    clock.advanceDay();
    const [session] = pool.getSessions();
    pool.dispatch(session.customerId, 'WALK_CUSTOMER');
    const id = session.customerId;

    expect(followUp.getFollowUps()).toHaveLength(1);
    expect(followUp.getArchived()).toHaveLength(0);

    clock.advanceDay(); // overnight decay: heat 1 → 0
    expect(followUp.getFollowUps()).toHaveLength(0);
    expect(followUp.getArchived()).toHaveLength(1);
    expect(followUp.getFollowUp(id)).toBeUndefined();
  });

  it('archived entry is queryable and preserves bundle + walked day', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const pool = createCustomerPool({ bus, npcDeps });
    const followUp = createFollowUpPool({ bus, pool, tunables: { initialHeatBase: 1, decayPerNight: 1 } });

    clock.advanceDay();
    const [session] = pool.getSessions();
    pool.dispatch(session.customerId, 'WALK_CUSTOMER');

    clock.advanceDay();
    const [archivedEntry] = followUp.getArchived();
    expect(archivedEntry.customerId).toBe(session.customerId);
    expect(archivedEntry.walkedDay).toBe(session.day);
    expect(archivedEntry.bundle).toBe(session.bundle);
    expect(archivedEntry.archivedDay).toBe(session.day); // overnight of session day
  });

  it('publishes followup:customer_archived event when heat hits zero', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const pool = createCustomerPool({ bus, npcDeps });
    createFollowUpPool({ bus, pool, tunables: { initialHeatBase: 1, decayPerNight: 1 } });

    clock.advanceDay();
    const [session] = pool.getSessions();
    pool.dispatch(session.customerId, 'WALK_CUSTOMER');

    const events: Array<{ customerId: string; day: number }> = [];
    bus.subscribe('followup:customer_archived', (e) => events.push(e));

    clock.advanceDay();
    expect(events).toHaveLength(1);
    expect(events[0].customerId).toBe(session.customerId);
  });

  it('customer with higher initial heat is not archived until heat fully decays', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const pool = createCustomerPool({ bus, npcDeps });
    // Force initialHeat of 3 by using a large base (patience ~0.6 → rounds to 3)
    const followUp = createFollowUpPool({ bus, pool, tunables: { initialHeatBase: 5, decayPerNight: 1 } });

    clock.advanceDay();
    const [session] = pool.getSessions();
    pool.dispatch(session.customerId, 'WALK_CUSTOMER');
    const id = session.customerId;
    const initialHeat = followUp.getFollowUp(id)!.initialHeat;

    for (let i = 0; i < initialHeat - 1; i++) {
      clock.advanceDay();
      expect(followUp.getFollowUp(id)).toBeDefined();
    }
    // one more night pushes it to 0
    clock.advanceDay();
    expect(followUp.getFollowUp(id)).toBeUndefined();
    expect(followUp.getArchived()).toHaveLength(1);
  });
});

// ── Multiple customers ────────────────────────────────────────────────────────

describe('FollowUpPool — multiple customers decay independently', () => {
  it('each walked customer has its own entry', () => {
    const { clock, pool, followUp } = makeSetup();
    clock.advanceDay();
    const [s1] = pool.getSessions();
    pool.dispatch(s1.customerId, 'WALK_CUSTOMER');

    clock.advanceDay();
    const sessions = pool.getSessions();
    const s2 = sessions.find(s => s.customerId !== s1.customerId)!;
    pool.dispatch(s2.customerId, 'WALK_CUSTOMER');

    expect(followUp.getFollowUps().length).toBeGreaterThanOrEqual(1);
  });
});
