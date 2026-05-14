import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createCustomerPool } from '../src/game/CustomerPool';
import { createFollowUpPool } from '../src/game/FollowUpPool';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
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
  const queue = createDepartmentQueue({ bus });
  return { bus, clock, pool, followUp, queue };
}

function walkFirstCustomer(setup: ReturnType<typeof makeSetup>) {
  const { clock, pool } = setup;
  clock.advanceDay();
  const [session] = pool.getSessions();
  pool.dispatch(session.customerId, 'WALK_CUSTOMER');
  return session.customerId;
}

// ── BDC morning task generation ───────────────────────────────────────────────

describe('BDCCallback — morning task generation', () => {
  it('no BDC task when follow-up pool is empty', () => {
    const { clock, queue } = makeSetup();
    clock.advanceDay();
    expect(queue.getBadgeCount('bdc')).toBe(0);
  });

  it('BDC task appears the morning after a customer walks', () => {
    const setup = makeSetup();
    walkFirstCustomer(setup);
    // Advance again — overnight decay runs, then day_started fires BDC tasks
    setup.clock.advanceDay();
    expect(setup.queue.getBadgeCount('bdc')).toBe(1);
  });

  it('BDC item has type callback and correct dept', () => {
    const setup = makeSetup();
    walkFirstCustomer(setup);
    setup.clock.advanceDay();
    const [item] = setup.queue.getQueue('bdc');
    expect(item.type).toBe('callback');
    expect(item.dept).toBe('bdc');
  });

  it('BDC item carries the walked customer id', () => {
    const setup = makeSetup();
    const customerId = walkFirstCustomer(setup);
    setup.clock.advanceDay();
    const [item] = setup.queue.getQueue('bdc');
    expect(item.customerId).toBe(customerId);
  });

  it('BDC item label includes archetype label and heat', () => {
    const setup = makeSetup();
    const customerId = walkFirstCustomer(setup);
    setup.clock.advanceDay();
    const [item] = setup.queue.getQueue('bdc');
    const entry = setup.followUp.getFollowUp(customerId)!;
    expect(item.label).toContain(entry.archetypeLabel);
    expect(item.label).toContain(String(entry.heat));
  });

  it('no BDC task on same day customer walks (only next morning)', () => {
    const setup = makeSetup();
    // walkFirstCustomer advances a day but that day_started fires before the walk
    walkFirstCustomer(setup);
    // BDC queue should still be empty at this point — task fires next morning
    expect(setup.queue.getBadgeCount('bdc')).toBe(0);
  });
});

// ── attemptCallback probability ───────────────────────────────────────────────

describe('BDCCallback — callback probability', () => {
  it('roll below heat/initialHeat yields success', () => {
    const setup = makeSetup();
    const customerId = walkFirstCustomer(setup);
    setup.clock.advanceDay(); // BDC task surfaced
    const entry = setup.followUp.getFollowUp(customerId)!;
    const threshold = entry.heat / entry.initialHeat;

    const outcome = setup.followUp.attemptCallback(customerId, threshold - 0.01);
    expect(outcome).toBe('success');
  });

  it('roll equal to or above heat/initialHeat yields failure', () => {
    const setup = makeSetup();
    const customerId = walkFirstCustomer(setup);
    setup.clock.advanceDay();
    const entry = setup.followUp.getFollowUp(customerId)!;
    const threshold = entry.heat / entry.initialHeat;

    const outcome = setup.followUp.attemptCallback(customerId, threshold);
    expect(outcome).toBe('failure');
  });

  it('full heat (= initialHeat) guarantees success when roll = 0', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const pool = createCustomerPool({ bus, npcDeps });
    // Use decayPerNight=0 so heat stays at initialHeat through the night
    const followUp = createFollowUpPool({ bus, pool, tunables: { initialHeatBase: 5, decayPerNight: 0 } });
    createDepartmentQueue({ bus });

    clock.advanceDay();
    const [session] = pool.getSessions();
    pool.dispatch(session.customerId, 'WALK_CUSTOMER');
    clock.advanceDay(); // BDC task surfaced, heat unchanged

    const outcome = followUp.attemptCallback(session.customerId, 0);
    expect(outcome).toBe('success');
  });

  it('probability scales with remaining heat — lower heat reduces success window', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const pool = createCustomerPool({ bus, npcDeps });
    const followUp = createFollowUpPool({ bus, pool, tunables: { initialHeatBase: 5, decayPerNight: 1 } });
    createDepartmentQueue({ bus });

    clock.advanceDay();
    const [session] = pool.getSessions();
    pool.dispatch(session.customerId, 'WALK_CUSTOMER');

    const id = session.customerId;
    const initialHeat = followUp.getFollowUp(id)!.initialHeat;

    // Let heat decay partway
    for (let i = 0; i < Math.floor(initialHeat / 2); i++) clock.advanceDay();
    const entry = followUp.getFollowUp(id)!;
    const threshold = entry.heat / entry.initialHeat;

    // Roll right at the boundary
    expect(followUp.attemptCallback(id, threshold - 0.01)).toBe('success');
  });

  it('throws if customerId has no active follow-up entry', () => {
    const { followUp } = makeSetup();
    expect(() => followUp.attemptCallback('nonexistent', 0.5)).toThrow();
  });
});

// ── Success path — pool drain and re-enqueue ──────────────────────────────────

describe('BDCCallback — success path', () => {
  it('successful callback removes customer from follow-up pool', () => {
    const setup = makeSetup();
    const customerId = walkFirstCustomer(setup);
    setup.clock.advanceDay();

    setup.followUp.attemptCallback(customerId, 0); // guaranteed success
    expect(setup.followUp.getFollowUp(customerId)).toBeUndefined();
    expect(setup.followUp.getFollowUps()).toHaveLength(0);
  });

  it('successful callback adds customer workspace item to Sales queue', () => {
    const setup = makeSetup();
    const customerId = walkFirstCustomer(setup);
    setup.clock.advanceDay();

    // Customer's original arrival also added a workspace item, so count before callback
    const countBefore = setup.queue.getQueue('sales').filter(i => i.customerId === customerId).length;
    setup.followUp.attemptCallback(customerId, 0);
    const salesItems = setup.queue.getQueue('sales').filter(i => i.customerId === customerId);
    expect(salesItems).toHaveLength(countBefore + 1);
    const newItem = salesItems[salesItems.length - 1];
    expect(newItem.type).toBe('workspace');
    expect(newItem.dept).toBe('sales');
  });

  it('successful callback resets customer session to UNGREETED', () => {
    const setup = makeSetup();
    const customerId = walkFirstCustomer(setup);
    setup.clock.advanceDay();

    const sessionBefore = setup.pool.getSession(customerId)!;
    expect(sessionBefore.stage).toBe('WALK');

    setup.followUp.attemptCallback(customerId, 0);
    const sessionAfter = setup.pool.getSession(customerId)!;
    expect(sessionAfter.stage).toBe('UNGREETED');
  });

  it('publishes bdc:callback_succeeded event on success', () => {
    const setup = makeSetup();
    const customerId = walkFirstCustomer(setup);
    setup.clock.advanceDay();

    const events: Array<{ customerId: string; day: number }> = [];
    setup.bus.subscribe('bdc:callback_succeeded', e => events.push(e));

    setup.followUp.attemptCallback(customerId, 0);
    expect(events).toHaveLength(1);
    expect(events[0].customerId).toBe(customerId);
  });

  it('customer can progress through Sales workflow after successful callback', () => {
    const setup = makeSetup();
    const customerId = walkFirstCustomer(setup);
    setup.clock.advanceDay();

    setup.followUp.attemptCallback(customerId, 0);
    expect(() => setup.pool.dispatch(customerId, 'GREET')).not.toThrow();
    expect(setup.pool.getSession(customerId)!.stage).toBe('GREETED');
  });
});

// ── Failure path ──────────────────────────────────────────────────────────────

describe('BDCCallback — failure path', () => {
  it('failed callback leaves customer in follow-up pool', () => {
    const setup = makeSetup();
    const customerId = walkFirstCustomer(setup);
    setup.clock.advanceDay();

    setup.followUp.attemptCallback(customerId, 1); // guaranteed failure
    expect(setup.followUp.getFollowUp(customerId)).toBeDefined();
  });

  it('failed callback does not add Sales workspace item', () => {
    const setup = makeSetup();
    const customerId = walkFirstCustomer(setup);
    setup.clock.advanceDay();

    const salesCountBefore = setup.queue.getBadgeCount('sales');
    setup.followUp.attemptCallback(customerId, 1);
    expect(setup.queue.getBadgeCount('sales')).toBe(salesCountBefore);
  });

  it('callbackFailurePenalty decays heat on failure', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const pool = createCustomerPool({ bus, npcDeps });
    const followUp = createFollowUpPool({
      bus, pool,
      tunables: { initialHeatBase: 5, decayPerNight: 0, callbackFailurePenalty: 2 },
    });
    createDepartmentQueue({ bus });

    clock.advanceDay();
    const [session] = pool.getSessions();
    pool.dispatch(session.customerId, 'WALK_CUSTOMER');
    clock.advanceDay();

    const id = session.customerId;
    const heatBefore = followUp.getFollowUp(id)!.heat;
    followUp.attemptCallback(id, 1); // guaranteed failure
    expect(followUp.getFollowUp(id)!.heat).toBe(heatBefore - 2);
  });

  it('callbackFailurePenalty draining heat to zero archives the customer', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const pool = createCustomerPool({ bus, npcDeps });
    const followUp = createFollowUpPool({
      bus, pool,
      tunables: { initialHeatBase: 1, decayPerNight: 0, callbackFailurePenalty: 5 },
    });
    createDepartmentQueue({ bus });

    clock.advanceDay();
    const [session] = pool.getSessions();
    pool.dispatch(session.customerId, 'WALK_CUSTOMER');
    clock.advanceDay();

    const id = session.customerId;
    followUp.attemptCallback(id, 1); // fails, penalty drains heat to 0 → archived
    expect(followUp.getFollowUp(id)).toBeUndefined();
    expect(followUp.getArchived()).toHaveLength(1);
  });
});

// ── Pool drain over time ──────────────────────────────────────────────────────

describe('BDCCallback — pool drain over time', () => {
  it('BDC task no longer appears after customer is successfully called back', () => {
    const setup = makeSetup();
    walkFirstCustomer(setup);
    setup.clock.advanceDay(); // BDC task appears

    const customerId = setup.queue.getQueue('bdc')[0].customerId!;
    setup.followUp.attemptCallback(customerId, 0); // success

    setup.clock.advanceDay(); // next morning — pool now empty
    // Only the one task from the previous morning; no new one
    const bdcItems = setup.queue.getQueue('bdc').filter(i => i.customerId === customerId);
    expect(bdcItems).toHaveLength(1); // the one from day-2 morning, already resolved or sitting there
    // Active pool is empty so no new task was added
    expect(setup.followUp.getFollowUps()).toHaveLength(0);
  });

  it('BDC task no longer appears after customer heat decays to zero', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const pool = createCustomerPool({ bus, npcDeps });
    const followUp = createFollowUpPool({ bus, pool, tunables: { initialHeatBase: 2, decayPerNight: 1 } });
    const queue = createDepartmentQueue({ bus });

    clock.advanceDay(); // day 1: customer arrives
    const [session] = pool.getSessions();
    pool.dispatch(session.customerId, 'WALK_CUSTOMER');

    // initialHeat=2 (approx, based on patience). Day 2 morning: BDC task fires (heat=1 after overnight decay)
    clock.advanceDay();
    const bdcDay2 = queue.getQueue('bdc').filter(i => i.customerId === session.customerId).length;
    expect(bdcDay2).toBe(1); // task surfaced on day 2

    // Day 3 morning: heat decays to 0 overnight (day 2→3), customer archived, no new BDC task
    clock.advanceDay();
    expect(followUp.getFollowUps()).toHaveLength(0); // archived
    const bdcDay3 = queue.getQueue('bdc').filter(i => i.customerId === session.customerId).length;
    expect(bdcDay3).toBe(1); // still just the one from day-2, none added on day-3
  });
});
