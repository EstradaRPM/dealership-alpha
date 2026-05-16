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

const TUNABLES = { decayPerNight: 0.2 };

function makeSetup(initialDay = 0) {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay });
  const pool = createCustomerPool({ bus, npcDeps });
  const followUp = createFollowUpPool({ bus, pool, tunables: TUNABLES });
  return { bus, clock, pool, followUp };
}

/**
 * Roll a real customer into the pool (so FollowUpPool's session lookup
 * resolves), then publish a representative extended customer:resolved with a
 * chosen computed `heat`. Mirrors the #91 emit boundary: FollowUpPool consumes
 * the scalar, it does not re-derive it.
 */
function resolveWalk(
  setup: ReturnType<typeof makeSetup>,
  heat: number,
  overrides: Partial<{ outcome: 'closed' | 'walk' }> = {},
) {
  const { clock, pool, bus } = setup;
  clock.advanceDay();
  const session = pool.getSessions().find(s => !setup.followUp.getFollowUp(s.customerId))!;
  bus.publish('customer:resolved', {
    customerId: session.customerId,
    outcome: overrides.outcome ?? 'walk',
    receptivity: 0,
    satisfaction: 0,
    retentionSeed: 0,
    heat,
    agreedPrice: 0,
    frontGross: 0,
  });
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
    const id = resolveWalk(setup, 0.6);
    expect(setup.followUp.getFollowUps()).toHaveLength(1);
    expect(setup.followUp.getFollowUp(id)).toBeDefined();
  });

  it('does not add entry for closed customers', () => {
    const setup = makeSetup();
    resolveWalk(setup, 0, { outcome: 'closed' });
    expect(setup.followUp.getFollowUps()).toHaveLength(0);
  });

  it('does not enqueue a zero-heat (stone cold) walk', () => {
    const setup = makeSetup();
    resolveWalk(setup, 0);
    expect(setup.followUp.getFollowUps()).toHaveLength(0);
  });

  it('initial heat equals the computed heat scalar from the payload', () => {
    const setup = makeSetup();
    const id = resolveWalk(setup, 0.73);
    const entry = setup.followUp.getFollowUp(id)!;
    expect(entry.heat).toBeCloseTo(0.73);
    expect(entry.heat).toBe(entry.initialHeat);
  });

  it('high-trust non-close leaves a warm lead; cold walk leaves a low one', () => {
    // Independent setups so each entry is read on its walk day (no decay).
    const warmSetup = makeSetup();
    const warmId = resolveWalk(warmSetup, 0.85);
    const coldSetup = makeSetup();
    const coldId = resolveWalk(coldSetup, 0.15);
    const warm = warmSetup.followUp.getFollowUp(warmId)!;
    const cold = coldSetup.followUp.getFollowUp(coldId)!;
    expect(warm.heat).toBeGreaterThan(cold.heat);
    expect(warm.heat).toBeCloseTo(0.85);
    expect(cold.heat).toBeCloseTo(0.15);
  });
});

// ── Heat decay ────────────────────────────────────────────────────────────────

describe('FollowUpPool — heat decay', () => {
  it('heat decreases by decayPerNight on each overnight', () => {
    const setup = makeSetup();
    const id = resolveWalk(setup, 0.9);

    setup.clock.advanceDay();
    expect(setup.followUp.getFollowUp(id)!.heat).toBeCloseTo(0.7);

    setup.clock.advanceDay();
    expect(setup.followUp.getFollowUp(id)!.heat).toBeCloseTo(0.5);
  });

  it('uses a custom decayPerNight from tunables', () => {
    const bus = createEventBus();
    const clock = createGameClock({ bus });
    const pool = createCustomerPool({ bus, npcDeps });
    const followUp = createFollowUpPool({ bus, pool, tunables: { decayPerNight: 0.5 } });
    const setup = { bus, clock, pool, followUp };

    const id = resolveWalk(setup, 0.9);
    clock.advanceDay();
    expect(followUp.getFollowUp(id)!.heat).toBeCloseTo(0.4);
  });
});

// ── Archival ──────────────────────────────────────────────────────────────────

describe('FollowUpPool — archival when heat reaches zero', () => {
  it('customer is archived when heat decays to zero', () => {
    const setup = makeSetup();
    const id = resolveWalk(setup, 0.2); // one night at decayPerNight 0.2 → 0

    expect(setup.followUp.getFollowUps()).toHaveLength(1);
    expect(setup.followUp.getArchived()).toHaveLength(0);

    setup.clock.advanceDay();
    expect(setup.followUp.getFollowUps()).toHaveLength(0);
    expect(setup.followUp.getArchived()).toHaveLength(1);
    expect(setup.followUp.getFollowUp(id)).toBeUndefined();
  });

  it('archived entry is queryable and preserves walked day', () => {
    const setup = makeSetup();
    const id = resolveWalk(setup, 0.2);
    const walkedDay = setup.followUp.getFollowUp(id)!.walkedDay;

    setup.clock.advanceDay();
    const [archivedEntry] = setup.followUp.getArchived();
    expect(archivedEntry.customerId).toBe(id);
    expect(archivedEntry.walkedDay).toBe(walkedDay);
  });

  it('publishes followup:customer_archived event when heat hits zero', () => {
    const setup = makeSetup();
    const id = resolveWalk(setup, 0.2);

    const events: Array<{ customerId: string; day: number }> = [];
    setup.bus.subscribe('followup:customer_archived', (e) => events.push(e));

    setup.clock.advanceDay();
    expect(events).toHaveLength(1);
    expect(events[0].customerId).toBe(id);
  });

  it('a warmer lead survives longer than a cold one', () => {
    const coldSetup = makeSetup();
    const coldId = resolveWalk(coldSetup, 0.2);
    const warmSetup = makeSetup();
    const warmId = resolveWalk(warmSetup, 0.9);

    coldSetup.clock.advanceDay(); // cold 0.2 → 0 (archived)
    warmSetup.clock.advanceDay(); // warm 0.9 → 0.7 (still active)
    expect(coldSetup.followUp.getFollowUp(coldId)).toBeUndefined();
    expect(warmSetup.followUp.getFollowUp(warmId)).toBeDefined();
  });
});

// ── Multiple customers ────────────────────────────────────────────────────────

describe('FollowUpPool — multiple customers decay independently', () => {
  it('each walked customer has its own entry', () => {
    const setup = makeSetup();
    const a = resolveWalk(setup, 0.8);
    const b = resolveWalk(setup, 0.5);
    expect(setup.followUp.getFollowUp(a)).toBeDefined();
    expect(setup.followUp.getFollowUp(b)).toBeDefined();
    expect(a).not.toBe(b);
  });
});
