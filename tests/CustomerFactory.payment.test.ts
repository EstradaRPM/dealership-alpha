import {
  createCustomer,
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
} from '../src/game/NPC';

/**
 * #153 — the two payment traits. `cash-buyer` shifts the visit archetype's base
 * cash leaning; `must-finance` is categorical. Both resolve through the ordinary
 * `resolveEffects` machinery (I5), so these assertions drive the public factory
 * and never reach into the trait layer.
 */

const personArchetypes = loadPersonArchetypes();
const visitArchetypes = loadVisitArchetypes();
const traits = loadTraitTaxonomy();

const baseDeps = { masterSeed: 4242, personArchetypes, visitArchetypes, traits };

/**
 * A person archetype that always draws exactly the payment traits given (rate
 * 1.0) and never draws a personality trait — so a measured cash share reflects
 * the payment axis alone.
 */
function forcing(paymentTraitIds: readonly string[], overrides: Record<string, unknown> = {}) {
  const base = personArchetypes['young_family']!;
  return {
    ...baseDeps,
    personArchetypes: {
      ...personArchetypes,
      probe: {
        ...base,
        ...overrides,
        trait_pool: [],
        trait_count: { min: 0, max: 0 },
        payment_traits: Object.fromEntries(paymentTraitIds.map((id) => [id, 1])),
      },
    },
  };
}

/** Cash share over N slots of the given visit archetype. */
function cashShare(
  deps: ReturnType<typeof forcing>,
  visitArchetypeId: string,
  n: number,
): number {
  let cash = 0;
  for (let slot = 0; slot < n; slot++) {
    const { visit } = createCustomer(
      { personArchetypeId: 'probe', visitArchetypeId, day: 21, slot },
      deps,
    );
    if (visit.kind !== 'sales') throw new Error('expected sales');
    if (visit.paymentMethod === 'cash') cash++;
  }
  return cash / n;
}

const N = 2000;

describe('CustomerFactory — payment traits', () => {
  const familyBase = (() => {
    const a = visitArchetypes['family_vehicle_search']!;
    if (a.kind !== 'sales') throw new Error('unreachable');
    return a.payment.cashProbability; // 0.05
  })();

  const retirementBase = (() => {
    const a = visitArchetypes['retirement_upgrade']!;
    if (a.kind !== 'sales') throw new Error('unreachable');
    return a.payment.cashProbability; // 0.45
  })();

  const boost = traits['cash-buyer']!.effects['payment.cash_probability']!;

  it('cash-buyer customers pay cash at the boosted rate', () => {
    const observed = cashShare(forcing(['cash-buyer']), 'family_vehicle_search', N);
    // ±0.04 absolute, matching the tolerance the archetype-base suite uses.
    expect(Math.abs(observed - (familyBase + boost))).toBeLessThan(0.04);
    // And it is a real shift, not noise around the untouched base.
    expect(observed).toBeGreaterThan(familyBase + boost / 2);
  });

  it('must-finance overrides a high cash probability', () => {
    // retirement_upgrade is the highest cash-leaning archetype in the game.
    expect(retirementBase).toBeGreaterThan(0.4);
    expect(cashShare(forcing(['must-finance']), 'retirement_upgrade', N)).toBe(0);
  });

  it('a wealthy must-finance customer still finances', () => {
    // Wealth far above any lot floor, and the gate switched on — the customer
    // could plainly write the cheque and still takes the tradeline.
    const rich = forcing(['must-finance'], {
      wealth: { mu: 5_000_000, sigma: 100_000 },
    });
    const gated = { ...rich, cheapestLotPriceFloor: 10_000 };
    for (let slot = 0; slot < 300; slot++) {
      const { person, visit } = createCustomer(
        { personArchetypeId: 'probe', visitArchetypeId: 'retirement_upgrade', day: 23, slot },
        gated,
      );
      if (visit.kind !== 'sales') throw new Error('expected sales');
      expect(person.wealth).toBeGreaterThan(10_000);
      expect(visit.paymentMethod).toBe('finance');
    }
  });

  it("an untraited customer's roll is untouched", () => {
    // No payment trait at all, so the archetype's base Bernoulli must stand.
    const observed = cashShare(forcing([]), 'retirement_upgrade', N);
    expect(Math.abs(observed - retirementBase)).toBeLessThan(0.04);
  });

  it('a payment trait costs the customer no personality slot', () => {
    // The two axes are drawn on separate streams: turning the payment rate from
    // 0 to 1 must not change which personality traits the customer carries.
    const arch = personArchetypes['tradesperson']!;
    const withNone = { ...baseDeps, personArchetypes: { ...personArchetypes, probe: { ...arch, payment_traits: {} } } };
    const withBoth = {
      ...baseDeps,
      personArchetypes: {
        ...personArchetypes,
        probe: { ...arch, payment_traits: { 'cash-buyer': 1, 'must-finance': 1 } },
      },
    };
    for (let slot = 0; slot < 100; slot++) {
      const ctx = { personArchetypeId: 'probe', visitArchetypeId: 'work_truck_purchase', day: 37, slot };
      const a = createCustomer(ctx, withNone);
      const b = createCustomer(ctx, withBoth);
      const personality = (ids: readonly string[]) =>
        ids.filter((id) => !['cash-buyer', 'must-finance'].includes(id));
      expect(personality(b.person.trait_ids)).toEqual(a.person.trait_ids);
      // …and the personality traits' own effects land identically.
      expect(a.visit.resources.patience).toBeCloseTo(b.visit.resources.patience);
      expect(a.visit.resources.trust).toBeCloseTo(b.visit.resources.trust);
    }
  });

  it('must-finance wins when a customer carries both payment traits', () => {
    // Categorical beats leaning — the precedence rule stated once, at the roll.
    const both = forcing(['cash-buyer', 'must-finance']);
    expect(cashShare(both, 'retirement_upgrade', 500)).toBe(0);
  });

  it('the traits leave the payment method deterministic in the seed', () => {
    for (const traitIds of [['cash-buyer'], ['must-finance'], []]) {
      const deps = forcing(traitIds);
      const ctx = { personArchetypeId: 'probe', visitArchetypeId: 'work_truck_purchase', day: 29, slot: 7 };
      const a = createCustomer(ctx, deps);
      const b = createCustomer(ctx, deps);
      if (a.visit.kind !== 'sales' || b.visit.kind !== 'sales') throw new Error('expected sales');
      expect(a.visit.paymentMethod).toBe(b.visit.paymentMethod);
    }
  });

  it('a must-finance customer still carries a down-payment behavior', () => {
    // Forced onto finance, they must arrive with the same finance-side fields
    // any other financed customer has — otherwise the override quietly produces
    // a half-built deal downstream.
    const deps = forcing(['must-finance']);
    for (let slot = 0; slot < 50; slot++) {
      const { visit } = createCustomer(
        { personArchetypeId: 'probe', visitArchetypeId: 'retirement_upgrade', day: 31, slot },
        deps,
      );
      if (visit.kind !== 'sales') throw new Error('expected sales');
      expect(visit.downPaymentBehavior).toBeGreaterThanOrEqual(0);
      expect(visit.downPaymentBehavior).toBeLessThanOrEqual(0.5);
    }
  });
});

describe('CustomerFactory — payment traits reach the shipped crowd', () => {
  // The shipped archetype pools must actually deal these traits out, or the
  // mechanic is built and dark (the #363 failure mode).
  it('both payment traits occur across a day of walk-ins', () => {
    const seen = new Set<string>();
    for (const personArchetypeId of Object.keys(personArchetypes)) {
      for (let slot = 0; slot < 200; slot++) {
        const { person } = createCustomer(
          { personArchetypeId, visitArchetypeId: 'commuter_replacement', day: 41, slot },
          baseDeps,
        );
        for (const id of person.trait_ids) seen.add(id);
      }
    }
    expect(seen.has('cash-buyer')).toBe(true);
    expect(seen.has('must-finance')).toBe(true);
  });

  it('a must-finance walk-in is financed in the shipped pools', () => {
    let checked = 0;
    for (let slot = 0; slot < 600; slot++) {
      const { person, visit } = createCustomer(
        { personArchetypeId: 'tradesperson', visitArchetypeId: 'work_truck_purchase', day: 43, slot },
        baseDeps,
      );
      if (visit.kind !== 'sales') throw new Error('expected sales');
      if (!person.trait_ids.includes('must-finance')) continue;
      checked++;
      expect(visit.paymentMethod).toBe('finance');
    }
    expect(checked).toBeGreaterThan(0);
  });
});
