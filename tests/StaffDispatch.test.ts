import {
  loadStaffDispatchConfig,
  discountAcceptProbability,
  isDiscountDeskingUnlocked,
} from '../src/game/StaffDispatch';
import type { SalesVisit } from '../src/game/NPC';
import type { TradeApprover } from '../src/game/DealEngine';
// The wiring these tests drive lives in one place (`tests/helpers`), shared with
// the escalation suite (#364) rather than copied into it.
import {
  BASE_CONFIG,
  DISCOUNT_EXCEPTION_CONFIG,
  TRADE_BOOK,
  admit,
  makeCashVisit,
  makeFinanceVisit,
  makeLotVehicle,
  makeSession,
  makeStaff,
  makeTradeVehicle,
  setup,
  withTrade,
  type Wired,
} from './helpers/staffDispatchHarness';

// ── No staff ─────────────────────────────────────────────────────────────────

describe('StaffDispatch — no staff', () => {
  it('no staff on roster ⇒ no auto_resolved, item stays in queue', () => {
    const { bus, events } = setup([]);
    admit(bus, 'cust:1');
    expect(events).toHaveLength(0);
  });
});

// ── No customer session ──────────────────────────────────────────────────────

describe('StaffDispatch — graceful no-session', () => {
  it('emits no_sale with reason=no_session when bundle lookup misses', () => {
    const { bus, events } = setup([makeStaff(0.8)]);
    admit(bus, 'cust:ghost');
    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe('no_sale');
    expect(events[0].reason).toBe('no_session');
  });
});

// ── Real-close path ─────────────────────────────────────────────────────────

describe('StaffDispatch — real close path (#147)', () => {
  it('finance customer + matching vehicle ⇒ deal:closed fires with non-zero frontGross + lot decrements', () => {
    const { bus, sessions, events, closedDeals, inventorySold, inventory, economy } = setup([
      makeStaff(0.9),
    ]);
    sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    const cashBefore = economy.cash;

    admit(bus, 'cust:1');

    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe('closed');
    expect(events[0].grossImpact).toBeGreaterThan(0);
    expect(closedDeals).toHaveLength(1);
    const ev = closedDeals[0] as { frontGross: number; paymentMethod: string };
    expect(ev.frontGross).toBeGreaterThan(0);
    expect(ev.paymentMethod).toBe('finance');
    expect(inventorySold).toEqual(['veh:1']);
    expect(inventory.getLotVehicles()).toHaveLength(0);
    // Cash delta tracks the real DealEngine posting, not a synthetic poke.
    expect(economy.cash - cashBefore).toBeGreaterThan(0);
  });

  it('a closed deal carries the inventory-buyer match quality on staff:auto_resolved (#199)', () => {
    const { bus, sessions, events } = setup([makeStaff(0.9)]);
    sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    admit(bus, 'cust:1');
    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe('closed');
    // The want-axis fit of the matched unit rides the close event so the loop's
    // match-payoff beat can threshold it without reaching into SalesProcess.
    expect(typeof events[0].matchQuality).toBe('number');
    expect(events[0].matchQuality).toBeGreaterThanOrEqual(0);
    expect(events[0].matchQuality).toBeLessThanOrEqual(1);
  });

  it('#295 frontline-hold: an acquired unit is held off the walk-in pool until its frontlineDay', () => {
    // A unit acquired on day 1 with the default 2-day hold has frontlineDay 3:
    // absent from the match pool on days 1 and 2, present on day 3. The lot
    // carries only this held unit, so before frontlineDay the customer no-fits.
    const { bus, sessions, events } = setup([makeStaff(0.9)], BASE_CONFIG, {
      lot: [makeLotVehicle('veh:held', { arrivalDay: 1, frontlineDay: 3 })],
    });
    sessions.set('cust:d1', makeSession('cust:d1', makeFinanceVisit('cust:d1')));
    sessions.set('cust:d2', makeSession('cust:d2', makeFinanceVisit('cust:d2')));
    sessions.set('cust:d3', makeSession('cust:d3', makeFinanceVisit('cust:d3')));

    admit(bus, 'cust:d1', 1);
    expect(events[0].outcome).toBe('no_sale');
    expect(events[0].reason).toBe('no_fit');

    admit(bus, 'cust:d2', 2);
    expect(events[1].outcome).toBe('no_sale');
    expect(events[1].reason).toBe('no_fit');

    admit(bus, 'cust:d3', 3);
    expect(events[2].outcome).toBe('closed');
  });

  it('a no_sale carries no match quality (#199)', () => {
    const { bus, sessions, events } = setup([makeStaff(0.9)], BASE_CONFIG, {
      lot: [],
    });
    sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    admit(bus, 'cust:1');
    expect(events[0].outcome).toBe('no_sale');
    expect(events[0].matchQuality).toBeUndefined();
  });

  it('a closed deal carries the matched vehicle category + customer archetype label (#320)', () => {
    const { bus, sessions, events } = setup([makeStaff(0.9)], BASE_CONFIG, {
      lot: [makeLotVehicle('veh:1', { category: 'truck' })],
    });
    sessions.set(
      'cust:1',
      makeSession('cust:1', makeFinanceVisit('cust:1'), {}, 'Tradesperson'),
    );
    admit(bus, 'cust:1');
    expect(events[0].outcome).toBe('closed');
    expect(events[0].vehicleCategory).toBe('truck');
    expect(events[0].archetypeLabel).toBe('Tradesperson');
  });

  it('a no_sale carries no matched vehicle category (#320) — nothing was ever picked', () => {
    const { bus, sessions, events } = setup([makeStaff(0.9)], BASE_CONFIG, {
      lot: [],
    });
    sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    admit(bus, 'cust:1');
    expect(events[0].outcome).toBe('no_sale');
    expect(events[0].vehicleCategory).toBeUndefined();
  });

  it('a no_sale with an established session carries the archetype label + wanted category (#321)', () => {
    const { bus, sessions, events } = setup([makeStaff(0.9)], BASE_CONFIG, {
      lot: [],
    });
    sessions.set(
      'cust:1',
      makeSession('cust:1', makeFinanceVisit('cust:1'), {}, 'Tradesperson'),
    );
    admit(bus, 'cust:1');
    expect(events[0].outcome).toBe('no_sale');
    expect(events[0].reason).toBe('no_fit');
    expect(events[0].archetypeLabel).toBe('Tradesperson');
    expect(['sedan', 'truck', 'suv']).toContain(events[0].wantedCategory);
  });

  it('a no_sale with no established session (no_session) carries neither label nor category (#321)', () => {
    const { bus, events } = setup([makeStaff(0.9)]);
    admit(bus, 'cust:1');
    expect(events[0].outcome).toBe('no_sale');
    expect(events[0].reason).toBe('no_session');
    expect(events[0].archetypeLabel).toBeUndefined();
    expect(events[0].wantedCategory).toBeUndefined();
  });

  it('season demand lean (#231 S2): wantVectorBias runs on the resolution want-vector', () => {
    const seen: Array<{ spaced: Record<string, number>; day: number }> = [];
    const { bus, sessions, events } = setup([makeStaff(0.9)], BASE_CONFIG, {
      // Identity bias that records the call: proves the seam is live in the
      // auto-resolve match path (the createWorld test asserts it's wired to
      // Weather.leanWantVector; the Weather test asserts the lean transform).
      wantVectorBias: (spaced, day) => {
        seen.push({ spaced: { ...spaced }, day });
        return spaced;
      },
    });
    sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    admit(bus, 'cust:1', 1);
    expect(events[0].outcome).toBe('closed');
    expect(seen).toHaveLength(1);
    expect(seen[0].day).toBe(1);
    // The biased vector is the visit's own preference want-vector.
    expect(seen[0].spaced).toEqual({
      safety: 0.2,
      performance: 0.2,
      appearance: 0.2,
      comfort: 0.2,
      economy: 0.2,
      dependability: 0.2,
    });
  });

  it('attribute lean (#231 S4): attributeLeanForDay runs for the resolution day', () => {
    const seenDays: number[] = [];
    const { bus, sessions, events } = setup([makeStaff(0.9)], BASE_CONFIG, {
      // Records the call: proves the attribute-lean seam is live in the
      // auto-resolve match path (the createWorld test asserts it's wired to
      // Weather.attributeLeanForDay; the match-tilt test asserts the effect).
      attributeLeanForDay: (day) => {
        seenDays.push(day);
        return { winterCapability: 0.3 };
      },
    });
    sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    admit(bus, 'cust:1', 1);
    expect(events[0].outcome).toBe('closed');
    expect(seenDays).toEqual([1]);
  });

  it('per-tick drain: N customers + < N inventory closes exactly inventory.length', () => {
    const lot = [makeLotVehicle('veh:1'), makeLotVehicle('veh:2')];
    const { bus, sessions, events, inventorySold } = setup(
      [makeStaff(0.95)],
      BASE_CONFIG,
      { lot },
    );
    for (let i = 0; i < 5; i++) {
      const id = `cust:${i}`;
      sessions.set(id, makeSession(id, makeFinanceVisit(id)));
      admit(bus, id, 1);
    }
    const closed = events.filter(e => e.outcome === 'closed');
    const noFit = events.filter(e => e.outcome === 'no_sale' && e.reason === 'no_fit');
    expect(closed).toHaveLength(2);
    expect(inventorySold).toHaveLength(2);
    expect(noFit).toHaveLength(3);
  });

  it('empty lot ⇒ no_sale reason=no_fit', () => {
    const { bus, sessions, events } = setup([makeStaff(0.9)], BASE_CONFIG, { lot: [] });
    sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    admit(bus, 'cust:1');
    expect(events[0].outcome).toBe('no_sale');
    expect(events[0].reason).toBe('no_fit');
  });

  it('SalesProcess patience-drain walk ⇒ no_sale reason=patience_drain', () => {
    const { bus, sessions, events } = setup([makeStaff(0.05)]); // very weak skill → patience drains fast
    const visit = makeFinanceVisit('cust:1');
    // Bottom out starting patience so the first weak gate trips the floor.
    const lowPatience: SalesVisit = { ...visit, resources: { ...visit.resources, patience: 0.05 } };
    sessions.set('cust:1', makeSession('cust:1', lowPatience));
    admit(bus, 'cust:1');
    expect(events[0].outcome).toBe('no_sale');
    expect(['patience_drain', 'trust_collapse', 'demo_nonnegotiable_miss']).toContain(events[0].reason);
  });
});

describe('StaffDispatch — discount escalation (#222)', () => {
  const discountDeps = {
    config: DISCOUNT_EXCEPTION_CONFIG,
    bookValueFn: () => 20_000,
  };

  it('no sales manager ⇒ discount:escalated fires with payload and held close', () => {
    const w = setup([makeStaff(0.9)], BASE_CONFIG, {
      salesProcessDeps: discountDeps,
    });
    w.sessions.set(
      'cust:discount',
      makeSession('cust:discount', makeFinanceVisit('cust:discount'), {
        wealth: 15_000,
        agreeableness: 100,
      }),
    );

    admit(w.bus, 'cust:discount');

    expect(w.discountEscalations).toHaveLength(1);
    expect(w.heldDiscountReviews).toHaveLength(1);
    expect(w.closedDeals).toHaveLength(0);
    expect(w.events).toHaveLength(0);
    expect(w.discountEscalations[0]).toMatchObject({
      customerId: 'cust:discount',
      day: 1,
      canAcceptAsk: true,
    });
    // Spine framing (#281): list (ask) ≥ salesperson's failed counter ≥ target,
    // the counter positioned by salesperson skill.
    const review = w.discountEscalations[0];
    expect(review.askingPrice).toBeGreaterThanOrEqual(review.salespersonCounter);
    expect(review.salespersonCounter).toBeGreaterThanOrEqual(
      review.customerTargetPrice,
    );

    const result = w.heldDiscountReviews[0].decide({ kind: 'accept_ask' });

    expect(result.status).toBe('closed');
    expect(w.closedDeals).toHaveLength(1);
    expect(w.events).toHaveLength(1);
    expect(w.events[0]).toMatchObject({
      customerId: 'cust:discount',
      outcome: 'closed',
    });
    // accept_ask meets the customer at their target — a guaranteed close.
    expect(w.closedDeals[0].agreedPrice).toBe(review.customerTargetPrice);
  });

  // Channel-desk M3 (#290): the UCM desks below-floor discounts only when its
  // `t_o_closing` skill clears the gate (resolved at the composition root and
  // passed in as `getDiscountDeskingUnlocked`). The cliff: unlocked ⇒ auto-desk;
  // below the gate ⇒ the understaffed path (escalate/walk), even with a UCM on
  // staff. The roster→skill distillation is exercised at the createWorld level;
  // here we drive the gate getter directly to assert both sides of the cliff.
  it('desking unlocked ⇒ UCM auto-resolves the discount exception', () => {
    const w = setup(
      [
        makeStaff(0.9, 'staff:sales'),
        makeStaff(1.0, 'staff:used-car-manager', 'used-car-manager', {
          t_o_closing: 75,
        }),
      ],
      BASE_CONFIG,
      { salesProcessDeps: discountDeps, getDiscountDeskingUnlocked: () => true },
    );
    w.sessions.set(
      'cust:manager-discount',
      makeSession(
        'cust:manager-discount',
        makeFinanceVisit('cust:manager-discount'),
        { wealth: 15_000, agreeableness: 100 },
      ),
    );

    admit(w.bus, 'cust:manager-discount');

    expect(w.discountEscalations).toHaveLength(0);
    expect(w.heldDiscountReviews).toHaveLength(0);
    expect(w.closedDeals).toHaveLength(1);
    expect(w.events).toHaveLength(1);
    expect(w.events[0]).toMatchObject({
      customerId: 'cust:manager-discount',
      outcome: 'closed',
    });
  });

  it('UCM below the desking gate ⇒ understaffed path (escalates, not auto-desked)', () => {
    // A green UCM is on staff but its `t_o_closing` is under the threshold, so
    // the desk can't yet act — the deal falls through to the understaffed
    // escalation (escalationRate is 1 in DISCOUNT_EXCEPTION_CONFIG).
    const w = setup(
      [
        makeStaff(0.9, 'staff:sales'),
        makeStaff(1.0, 'staff:used-car-manager', 'used-car-manager', {
          t_o_closing: 40,
        }),
      ],
      BASE_CONFIG,
      { salesProcessDeps: discountDeps, getDiscountDeskingUnlocked: () => false },
    );
    w.sessions.set(
      'cust:green-ucm-discount',
      makeSession(
        'cust:green-ucm-discount',
        makeFinanceVisit('cust:green-ucm-discount'),
        { wealth: 15_000, agreeableness: 100 },
      ),
    );

    admit(w.bus, 'cust:green-ucm-discount');

    // Below the gate the deal is held for the player, not auto-desked.
    expect(w.discountEscalations).toHaveLength(1);
    expect(w.heldDiscountReviews).toHaveLength(1);
    expect(w.closedDeals).toHaveLength(0);
  });

  // Channel-desk M5 (#292): once the desk acts, the UCM's `t_o_closing` skill
  // governs how far its counter drifts off the salesperson's hold toward the
  // customer's target (a weaker counter → thinner gross, always toward worse).
  it('desking drift weakens a green UCM counter below the salesperson hold', () => {
    const driftConfig = { maxDriftFraction: 0.4, skillReference: 90 };
    const makeDeskWorld = (getDeskingDrift?: () => { ucmClosingSkill: number; config: typeof driftConfig } | null) =>
      setup(
        [
          makeStaff(0.9, 'staff:sales'),
          makeStaff(1.0, 'staff:used-car-manager', 'used-car-manager', {
            t_o_closing: 75,
          }),
        ],
        BASE_CONFIG,
        {
          salesProcessDeps: discountDeps,
          getDiscountDeskingUnlocked: () => true,
          getDeskingDrift,
        },
      );

    // No drift: the desk holds exactly at the salesperson's counter (clamped).
    const wHold = makeDeskWorld(undefined);
    wHold.sessions.set(
      'cust:desk-hold',
      makeSession('cust:desk-hold', makeFinanceVisit('cust:desk-hold'), {
        wealth: 15_000,
        agreeableness: 100,
      }),
    );
    admit(wHold.bus, 'cust:desk-hold');
    expect(wHold.closedDeals).toHaveLength(1);
    const holdPrice = wHold.closedDeals[0].agreedPrice;

    // Green UCM with drift: the realized desk counter sits BELOW the hold (worse).
    const wDrift = makeDeskWorld(() => ({ ucmClosingSkill: 0, config: driftConfig }));
    wDrift.sessions.set(
      'cust:desk-hold',
      makeSession('cust:desk-hold', makeFinanceVisit('cust:desk-hold'), {
        wealth: 15_000,
        agreeableness: 100,
      }),
    );
    admit(wDrift.bus, 'cust:desk-hold');
    expect(wDrift.closedDeals).toHaveLength(1);
    expect(wDrift.closedDeals[0].agreedPrice).toBeLessThan(holdPrice);
  });

  it('player decline records discount_player_declined, distinct from no_close', () => {
    const w = setup([makeStaff(0.9)], BASE_CONFIG, {
      salesProcessDeps: discountDeps,
    });
    w.sessions.set(
      'cust:decline-discount',
      makeSession(
        'cust:decline-discount',
        makeFinanceVisit('cust:decline-discount'),
        { wealth: 15_000, agreeableness: 100 },
      ),
    );
    admit(w.bus, 'cust:decline-discount');

    const result = w.heldDiscountReviews[0].decide({ kind: 'decline' });

    expect(result).toEqual({ status: 'abandoned' });
    expect(w.closedDeals).toHaveLength(0);
    expect(w.events).toHaveLength(1);
    expect(w.events[0]).toMatchObject({
      customerId: 'cust:decline-discount',
      outcome: 'no_sale',
      reason: 'discount_player_declined',
    });
  });

  it('frequency gate (rate 0) suppresses the event — the up just walks', () => {
    const w = setup(
      [makeStaff(0.9)],
      { ...BASE_CONFIG, discountEvent: { ...BASE_CONFIG.discountEvent, escalationRate: 0 } },
      { salesProcessDeps: discountDeps },
    );
    w.sessions.set(
      'cust:no-escalate',
      makeSession('cust:no-escalate', makeFinanceVisit('cust:no-escalate'), {
        wealth: 15_000,
        agreeableness: 100,
      }),
    );

    admit(w.bus, 'cust:no-escalate');

    // No interactive event, no held review — the below-floor up simply no-sales.
    expect(w.discountEscalations).toHaveLength(0);
    expect(w.heldDiscountReviews).toHaveLength(0);
    expect(w.closedDeals).toHaveLength(0);
    expect(w.events).toHaveLength(1);
    expect(w.events[0]).toMatchObject({
      customerId: 'cust:no-escalate',
      outcome: 'no_sale',
      reason: 'no_close',
    });
  });

  it('a rejected counter burns an attempt; exhausting them walks the customer', () => {
    // One attempt allowed: a single swing-and-a-miss ends it.
    const w = setup(
      [makeStaff(0.9)],
      {
        ...BASE_CONFIG,
        discountEvent: {
          ...BASE_CONFIG.discountEvent,
          minCounterAttempts: 1,
          maxCounterAttempts: 1,
        },
      },
      { salesProcessDeps: discountDeps },
    );
    w.sessions.set(
      'cust:exhaust',
      makeSession('cust:exhaust', makeFinanceVisit('cust:exhaust'), {
        wealth: 15_000,
        agreeableness: 100,
      }),
    );
    admit(w.bus, 'cust:exhaust');

    const review = w.discountEscalations[0];
    // A price far above their target is a sure rejection.
    const result = w.heldDiscountReviews[0].decide({
      kind: 'propose_counter',
      amount: review.askingPrice + 50_000,
    });

    expect(result).toEqual({ status: 'abandoned' });
    expect(w.closedDeals).toHaveLength(0);
    expect(w.events).toHaveLength(1);
    expect(w.events[0]).toMatchObject({
      customerId: 'cust:exhaust',
      outcome: 'no_sale',
      reason: 'discount_haggle_exhausted',
    });
  });

  it('with attempts to spare, a rejected counter keeps the review open', () => {
    const w = setup(
      [makeStaff(0.9)],
      {
        ...BASE_CONFIG,
        discountEvent: {
          ...BASE_CONFIG.discountEvent,
          minCounterAttempts: 3,
          maxCounterAttempts: 3,
        },
      },
      { salesProcessDeps: discountDeps },
    );
    w.sessions.set(
      'cust:haggle',
      makeSession('cust:haggle', makeFinanceVisit('cust:haggle'), {
        wealth: 15_000,
        agreeableness: 100,
      }),
    );
    admit(w.bus, 'cust:haggle');

    const review = w.discountEscalations[0];
    const result = w.heldDiscountReviews[0].decide({
      kind: 'propose_counter',
      amount: review.askingPrice + 50_000,
    });

    expect(result.status).toBe('counter_rejected');
    if (result.status === 'counter_rejected') {
      expect(result.attemptsRemaining).toBe(2);
      // The just-rejected wild over-ask reads as a near-zero acceptance prob —
      // the headline number the modal surfaces (#287).
      expect(result.acceptProb).toBeGreaterThanOrEqual(0);
      expect(result.acceptProb).toBeLessThan(0.05);
    }
    // Review stays open — no terminal event yet.
    expect(w.events).toHaveLength(0);
    expect(w.closedDeals).toHaveLength(0);
  });
});

// ── Acceptance-heat pure helper (#287) ───────────────────────────────────────

describe('discountAcceptProbability — pure acceptance-heat read', () => {
  it('is a certainty at or below the customer target', () => {
    expect(discountAcceptProbability(20_000, 20_000, 0.5, 0, 0.15)).toBe(1);
    expect(discountAcceptProbability(20_000, 18_000, 0.5, 0, 0.15)).toBe(1);
  });

  it('falls off as the counter climbs above the target', () => {
    const near = discountAcceptProbability(20_000, 20_500, 0.5, 0, 0.15);
    const far = discountAcceptProbability(20_000, 23_000, 0.5, 0, 0.15);
    expect(near).toBeGreaterThan(far);
    expect(near).toBeLessThan(1);
    expect(far).toBeGreaterThanOrEqual(0);
  });

  it('steepens with price-sensitivity and cools with prior misses', () => {
    const base = discountAcceptProbability(20_000, 21_000, 0.2, 0, 0.15);
    const sensitive = discountAcceptProbability(20_000, 21_000, 0.9, 0, 0.15);
    const cooled = discountAcceptProbability(20_000, 21_000, 0.2, 2, 0.15);
    expect(sensitive).toBeLessThan(base);
    expect(cooled).toBeLessThan(base);
  });

  it('clamps to the unit interval', () => {
    const p = discountAcceptProbability(20_000, 60_000, 0.9, 5, 0.15);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });
});

// ── Hold-floor: staffed up always worked ────────────────────────────────────

describe('StaffDispatch — hold-floor (#134) preserved', () => {
  it('a staffed, non-exception up is always worked (queue drained), regardless of skill', () => {
    const { bus, events } = setup([makeStaff(0.01)]);
    admit(bus, 'cust:1');
    // No session ⇒ no_sale w/ no_session, but the up was *worked* (resolver fired).
    expect(events).toHaveLength(1);
  });
});

// ── Config ──────────────────────────────────────────────────────────────────

describe('StaffDispatch — config', () => {
  it('loadStaffDispatchConfig returns valid tunables (no dead fields)', () => {
    const config = loadStaffDispatchConfig();
    expect(config.minDrainPerTick).toBeGreaterThanOrEqual(0);
    expect(config.maxDrainPerTick).toBeGreaterThan(0);
    // Dead fields are gone.
    expect('baseAutoGross' in config).toBe(false);
    expect('minCloseRate' in config).toBe(false);
    expect('maxCloseRate' in config).toBe(false);
    expect('minGrossModifier' in config).toBe(false);
    // Dramatic-case exception flags removed with the dead HandPlay path (#275).
    expect('exceptionFlagRates' in config).toBe(false);
    expect('gmExceptionFlagRates' in config).toBe(false);
  });
});

// ── Trade resolution (#169) ──────────────────────────────────────────────────

// Channel-desk margin (#291/M4): the default null condition read ⇒ confidence
// 0 ⇒ generosity factor 1 + 0.15 = 1.15 ⇒ target = TRADE_BOOK × 1.15 = 6_900
// (the generous no-UCM floor; a sharp UCM tightens it down toward book).
const TRADE_TARGET = 6_900;

describe('StaffDispatch — routine trade resolution (#169)', () => {
  it('routine accept: trade:resolved fires before deal:closed; allowance nets into the note', () => {
    // Baseline: same customer/seed, no trade.
    const base = setup([makeStaff(0.9)]);
    base.sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    admit(base.bus, 'cust:1');
    expect(base.closedDeals).toHaveLength(1);
    const baseDeal = base.closedDeals[0];

    // Same customer/seed, now with an in-band trade (ask ≤ target ⇒ accept).
    const w = setup([makeStaff(0.9)]);
    w.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeFinanceVisit('cust:1'), 5_000), {
        currentVehicle: makeTradeVehicle(null),
      }),
    );
    admit(w.bus, 'cust:1');

    // Deal still closes.
    expect(w.events.filter(e => e.outcome === 'closed')).toHaveLength(1);
    expect(w.closedDeals).toHaveLength(1);

    // trade:resolved fired with the accepted ask, no counter.
    expect(w.trades).toHaveLength(1);
    expect(w.trades[0].action).toBe('accept');
    expect(w.trades[0].hadCounter).toBe(false);
    expect(w.trades[0].agreedAllowance).toBe(5_000);

    // Price/down are unchanged by the trade (resolution runs after close); the
    // net equity (5_000, no payoff) comes straight off the financed amount.
    const deal = w.closedDeals[0];
    expect(deal.agreedPrice).toBe(baseDeal.agreedPrice);
    expect(deal.downPayment).toBeCloseTo(baseDeal.downPayment, 5);
    expect(deal.loanAmount).toBeCloseTo(baseDeal.loanAmount - 5_000, 5);
  });

  it('routine counter: customer takes a held counter below their ask', () => {
    const w = setup([makeStaff(0.9)]);
    // ask 7_500: above target (6_900) but inside the routine gap (≤ 25% ⇒ 8_625).
    w.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeFinanceVisit('cust:1'), 7_500), {
        currentVehicle: makeTradeVehicle(null),
      }),
    );
    admit(w.bus, 'cust:1');

    expect(w.trades).toHaveLength(1);
    expect(w.trades[0].action).toBe('counter');
    expect(w.trades[0].hadCounter).toBe(true);
    expect(w.trades[0].agreedAllowance).toBeLessThan(7_500);
    expect(w.trades[0].agreedAllowance).toBeGreaterThanOrEqual(TRADE_TARGET);
    expect(w.events.filter(e => e.outcome === 'closed')).toHaveLength(1);
  });

  it('cash deal: net equity reduces the cash brought to close', () => {
    const base = setup([makeStaff(0.9)]);
    base.sessions.set('cust:1', makeSession('cust:1', makeCashVisit('cust:1')));
    admit(base.bus, 'cust:1');
    const baseDeal = base.closedDeals[0];
    expect(baseDeal.paymentMethod).toBe('cash');

    const w = setup([makeStaff(0.9)]);
    w.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeCashVisit('cust:1'), 5_000), {
        currentVehicle: makeTradeVehicle(null),
      }),
    );
    admit(w.bus, 'cust:1');
    const deal = w.closedDeals[0];
    expect(deal.loanAmount).toBe(0);
    expect(deal.downPayment).toBeCloseTo(baseDeal.downPayment - 5_000, 5);
  });

  it('negative equity (allowance < payoff, small overhang) ⇒ no_sale reason=trade_negative_equity, no deal', () => {
    const w = setup([makeStaff(0.9)]);
    // ask 5_000 ≤ target ⇒ routine accept; payoff 5_500 is within the escalation
    // margin (target×1.1 = 7_590) so it stays routine, but the buyer is underwater.
    w.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeFinanceVisit('cust:1'), 5_000), {
        currentVehicle: makeTradeVehicle(5_500),
      }),
    );
    admit(w.bus, 'cust:1');
    expect(w.trades).toHaveLength(0);
    expect(w.escalations).toHaveLength(0);
    expect(w.closedDeals).toHaveLength(0);
    expect(w.events[0].outcome).toBe('no_sale');
    expect(w.events[0].reason).toBe('trade_negative_equity');
  });

  it('a UCM condition read tightens the target (higher confidence ⇒ better margin, #291/M4)', () => {
    // High-confidence read ⇒ generosity factor 1 ⇒ target = TRADE_BOOK (6_000),
    // tighter than the generous no-UCM floor (6_900). An ask of 6_500 that the
    // no-UCM desk would accept (≤ 6_900) now draws a counter under the ask.
    const w = setup([makeStaff(0.9)], BASE_CONFIG, {
      tradeConditionRead: () => ({ confidence: 1.0 }),
    });
    w.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeFinanceVisit('cust:1'), 6_500), {
        currentVehicle: makeTradeVehicle(null),
      }),
    );
    admit(w.bus, 'cust:1');
    expect(w.trades).toHaveLength(1);
    expect(w.trades[0].action).toBe('counter');
    expect(w.trades[0].agreedAllowance).toBeLessThan(6_500);
    expect(w.trades[0].agreedAllowance).toBeGreaterThanOrEqual(TRADE_BOOK);

    // Contrast: the same ask on the generous no-UCM floor accepts outright.
    const noUcm = setup([makeStaff(0.9)]);
    noUcm.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeFinanceVisit('cust:1'), 6_500), {
        currentVehicle: makeTradeVehicle(null),
      }),
    );
    admit(noUcm.bus, 'cust:1');
    expect(noUcm.trades[0].action).toBe('accept');
    expect(noUcm.trades[0].agreedAllowance).toBe(6_500);
  });
});

// ── Manager-attention escalation (#170) ──────────────────────────────────────

describe('StaffDispatch — trade escalation (#170)', () => {
  // ask 9_000: above target 6_900 and beyond the routine gap (≤ 8_625) ⇒ unusual.
  const unusualAsk = (w: Wired) =>
    w.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeFinanceVisit('cust:1'), 9_000), {
        currentVehicle: makeTradeVehicle(null),
      }),
    );

  it('no manager on staff ⇒ trade:escalated fires with the overlay payload, deal held', () => {
    const w = setup([makeStaff(0.9)]);
    unusualAsk(w);
    admit(w.bus, 'cust:1');
    // Deal is held for the player — no close, no trade:resolved, no no_sale.
    expect(w.closedDeals).toHaveLength(0);
    expect(w.trades).toHaveLength(0);
    expect(w.events).toHaveLength(0);
    // The overlay gets everything it needs.
    expect(w.escalations).toHaveLength(1);
    const e = w.escalations[0];
    expect(e.customerId).toBe('cust:1');
    expect(e.allowanceAsk).toBe(9_000);
    expect(e.book).toBe(TRADE_BOOK);
    expect(e.target).toBe(TRADE_TARGET);
    expect(e.recommendedCounter).toBeGreaterThanOrEqual(TRADE_TARGET);
    expect(e.recommendedCounter).toBeLessThanOrEqual(9_000);
  });

  it('player accepting the staff counter completes the held close through the trade path', () => {
    const w = setup([makeStaff(0.9)]);
    unusualAsk(w);
    admit(w.bus, 'cust:1');

    expect(w.heldTradeReviews).toHaveLength(1);
    const result = w.heldTradeReviews[0].decide({ kind: 'accept_counter' });

    expect(result).toEqual({
      status: 'closed',
      agreedAllowance: w.trades[0].agreedAllowance,
    });
    expect(w.trades).toHaveLength(1);
    expect(w.trades[0]).toMatchObject({
      customerId: 'cust:1',
      action: 'counter',
      hadCounter: true,
    });
    expect(w.closedDeals).toHaveLength(1);
    expect(w.events).toHaveLength(1);
    expect(w.events[0]).toMatchObject({
      customerId: 'cust:1',
      outcome: 'closed',
    });
  });

  it('a GM resolves the escalated trade silently ⇒ deal closes, trade:resolved, no escalation', () => {
    const gm: () => TradeApprover = () => ({ role: 'gm', skill: { effectiveness: 0.6, trustworthiness: 0.5 } });
    const w = setup([makeStaff(0.9)], BASE_CONFIG, { tradeApprover: gm });
    unusualAsk(w);
    admit(w.bus, 'cust:1');
    expect(w.escalations).toHaveLength(0);
    expect(w.trades).toHaveLength(1);
    expect(w.trades[0].action).toBe('counter');
    expect(w.closedDeals).toHaveLength(1);
  });

  it('a UCM approver also resolves silently when no GM is present', () => {
    const ucm: () => TradeApprover = () => ({ role: 'ucm', skill: { effectiveness: 0.6, trustworthiness: 0.5 } });
    const w = setup([makeStaff(0.9)], BASE_CONFIG, { tradeApprover: ucm });
    unusualAsk(w);
    admit(w.bus, 'cust:1');
    expect(w.escalations).toHaveLength(0);
    expect(w.trades).toHaveLength(1);
    expect(w.closedDeals).toHaveLength(1);
  });

  it('per-slot override forces player review even with a GM on staff', () => {
    const gm: () => TradeApprover = () => ({ role: 'gm', skill: { effectiveness: 0.6, trustworthiness: 0.5 } });
    const w = setup([makeStaff(0.9)], BASE_CONFIG, {
      tradeApprover: gm,
      tradeEscalationOverride: () => 8_000, // ask 9_000 > 8_000 ⇒ escalate to player
    });
    unusualAsk(w);
    admit(w.bus, 'cust:1');
    expect(w.escalations).toHaveLength(1);
    expect(w.trades).toHaveLength(0);
    expect(w.closedDeals).toHaveLength(0);
  });

  it('a manager who declines beyond the extended window ⇒ no_sale reason=trade_manager_declined', () => {
    const gm: () => TradeApprover = () => ({ role: 'gm', skill: { effectiveness: 0.1, trustworthiness: 0.5 } });
    const w = setup([makeStaff(0.9)], BASE_CONFIG, { tradeApprover: gm });
    // ask 13_000 = target 6_900 × 1.88 — beyond the manager window (×1.6 ⇒
    // 11_040) + weak closer ⇒ even the manager declines.
    w.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeFinanceVisit('cust:1'), 13_000), {
        currentVehicle: makeTradeVehicle(null),
      }),
    );
    admit(w.bus, 'cust:1');
    expect(w.escalations).toHaveLength(0);
    expect(w.trades).toHaveLength(0);
    expect(w.closedDeals).toHaveLength(0);
    expect(w.events[0].outcome).toBe('no_sale');
    expect(w.events[0].reason).toBe('trade_manager_declined');
  });
});

// ── Trade-acquisition policy multiplier (#172) ────────────────────────────────

describe('StaffDispatch — trade-policy multiplier wiring (#172)', () => {
  // Default null read ⇒ generosity factor 1.15, so target = TRADE_BOOK × policy ×
  // 1.15. Market (1.0) ⇒ 6_900; aggressive (1.1) ⇒ 7_590; conservative (0.92)
  // ⇒ 6_348. The getter must reach resolveTradeIn, shifting the accept/counter/
  // escalation boundary.
  const tradeAsk = (w: Wired, ask: number) =>
    w.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeFinanceVisit('cust:1'), ask), {
        currentVehicle: makeTradeVehicle(null),
      }),
    );

  it('aggressive policy lifts the target so a market-counter ask is accepted at the ask', () => {
    // ask 7_200: above market target (6_900 → counter) but below the aggressive
    // target (7_590 → accept).
    const market = setup([makeStaff(0.9)]);
    tradeAsk(market, 7_200);
    admit(market.bus, 'cust:1');
    expect(market.trades[0].action).toBe('counter');
    expect(market.trades[0].hadCounter).toBe(true);
    expect(market.trades[0].agreedAllowance).toBeLessThan(7_200);

    const aggressive = setup([makeStaff(0.9)], BASE_CONFIG, {
      tradePolicyMultiplier: () => 1.1,
    });
    tradeAsk(aggressive, 7_200);
    admit(aggressive.bus, 'cust:1');
    expect(aggressive.trades[0].action).toBe('accept');
    expect(aggressive.trades[0].hadCounter).toBe(false);
    expect(aggressive.trades[0].agreedAllowance).toBe(7_200);
  });

  it('conservative policy lowers the target so a market-routine ask escalates instead', () => {
    // ask 8_200: inside the market routine band (≤ 6_900 × 1.25 = 8_625) but
    // beyond the conservative band (≤ 6_348 × 1.25 = 7_935). No approver ⇒ the
    // conservative trade routes to the player overlay.
    const market = setup([makeStaff(0.9)]);
    tradeAsk(market, 8_200);
    admit(market.bus, 'cust:1');
    expect(market.trades).toHaveLength(1);
    expect(market.escalations).toHaveLength(0);

    const conservative = setup([makeStaff(0.9)], BASE_CONFIG, {
      tradePolicyMultiplier: () => 0.92,
    });
    tradeAsk(conservative, 8_200);
    admit(conservative.bus, 'cust:1');
    expect(conservative.trades).toHaveLength(0);
    expect(conservative.escalations).toHaveLength(1);
  });
});

describe('isDiscountDeskingUnlocked (#290 channel-desk M3)', () => {
  it('is locked with no UCM (null skill), regardless of threshold', () => {
    expect(isDiscountDeskingUnlocked(null, 60)).toBe(false);
    expect(isDiscountDeskingUnlocked(null, 0)).toBe(false);
  });

  it('gates hard at the threshold — the earned-stripes cliff', () => {
    expect(isDiscountDeskingUnlocked(59, 60)).toBe(false);
    expect(isDiscountDeskingUnlocked(60, 60)).toBe(true);
    expect(isDiscountDeskingUnlocked(75, 60)).toBe(true);
  });
});
