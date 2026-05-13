import {
  hotButtons,
  loadPersonArchetypes,
  loadVisitArchetypes,
} from '../src/game/NPC';
import type { SalesVisit, ServiceVisit, BodyVisit } from '../src/game/NPC';
import { VisitSchema } from '../src/game/NPC/schemas/customer';

// ── hotButtons ────────────────────────────────────────────────────────────────

describe('hotButtons', () => {
  const resources = { trust: 0.5, patience: 0.6 };

  it('returns top-N SPACED keys for a sales visit, sorted descending', () => {
    const visit: SalesVisit = {
      kind: 'sales',
      person_id: 'p1',
      preferences: {
        safety: 0.3,
        performance: 0.8,
        appearance: 0.5,
        comfort: 0.2,
        economy: 0.9,
        dependability: 0.4,
      },
      resources,
    };
    const top2 = hotButtons(visit, 2);
    expect(top2).toEqual(['economy', 'performance']);
  });

  it('returns top-N PSQTC keys for a service visit, sorted descending', () => {
    const visit: ServiceVisit = {
      kind: 'service',
      person_id: 'p1',
      preferences: {
        price: 0.4,
        speed: 0.9,
        quality: 0.7,
        trust_in_shop: 0.6,
        convenience: 0.3,
      },
      resources,
    };
    const top2 = hotButtons(visit, 2);
    expect(top2).toEqual(['speed', 'quality']);
  });

  it('returns top-N PSQTC keys for a body visit', () => {
    const visit: BodyVisit = {
      kind: 'body',
      person_id: 'p1',
      preferences: {
        price: 0.2,
        speed: 0.5,
        quality: 0.8,
        trust_in_shop: 0.3,
        convenience: 0.9,
      },
      resources,
    };
    const top1 = hotButtons(visit, 1);
    expect(top1).toEqual(['convenience']);
  });

  it('returns all keys when topN >= vector length', () => {
    const visit: SalesVisit = {
      kind: 'sales',
      person_id: 'p1',
      preferences: {
        safety: 0.1,
        performance: 0.2,
        appearance: 0.3,
        comfort: 0.4,
        economy: 0.5,
        dependability: 0.6,
      },
      resources,
    };
    expect(hotButtons(visit, 10)).toHaveLength(6);
  });
});

// ── VisitSchema discriminated union ───────────────────────────────────────────

describe('VisitSchema', () => {
  const resources = { trust: 0.5, patience: 0.6 };

  it('accepts a valid sales visit', () => {
    const result = VisitSchema.safeParse({
      kind: 'sales',
      person_id: 'p1',
      preferences: {
        safety: 0.3, performance: 0.5, appearance: 0.4,
        comfort: 0.6, economy: 0.7, dependability: 0.5,
      },
      resources,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid service visit', () => {
    const result = VisitSchema.safeParse({
      kind: 'service',
      person_id: 'p1',
      preferences: {
        price: 0.5, speed: 0.7, quality: 0.6,
        trust_in_shop: 0.4, convenience: 0.3,
      },
      resources,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid body visit', () => {
    const result = VisitSchema.safeParse({
      kind: 'body',
      person_id: 'p1',
      preferences: {
        price: 0.3, speed: 0.6, quality: 0.8,
        trust_in_shop: 0.5, convenience: 0.7,
      },
      resources,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a sales visit with PSQTC fields instead of SPACED', () => {
    const result = VisitSchema.safeParse({
      kind: 'sales',
      person_id: 'p1',
      preferences: {
        price: 0.5, speed: 0.7, quality: 0.6,
        trust_in_shop: 0.4, convenience: 0.3,
      },
      resources,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a service visit with SPACED fields instead of PSQTC', () => {
    const result = VisitSchema.safeParse({
      kind: 'service',
      person_id: 'p1',
      preferences: {
        safety: 0.3, performance: 0.5, appearance: 0.4,
        comfort: 0.6, economy: 0.7, dependability: 0.5,
      },
      resources,
    });
    expect(result.success).toBe(false);
  });
});

// ── Archetype loaders ─────────────────────────────────────────────────────────

describe('loadPersonArchetypes', () => {
  it('loads and validates the stub file', () => {
    const catalog = loadPersonArchetypes();
    expect(Object.keys(catalog).length).toBeGreaterThan(0);
    expect(catalog['budget_buyer']).toBeDefined();
    expect(catalog['budget_buyer'].wealth).toMatchObject({ mu: expect.any(Number), sigma: expect.any(Number) });
  });
});

describe('loadVisitArchetypes', () => {
  it('loads and validates the stub file', () => {
    const catalog = loadVisitArchetypes();
    expect(Object.keys(catalog).length).toBeGreaterThan(0);
    expect(catalog['price_led_sales']?.kind).toBe('sales');
    expect(catalog['routine_service']?.kind).toBe('service');
    expect(catalog['insurance_body_claim']?.kind).toBe('body');
  });

  it('all archetypes have correct kind-matched preference vector shape', () => {
    const catalog = loadVisitArchetypes();
    for (const [, archetype] of Object.entries(catalog)) {
      if (archetype.kind === 'sales') {
        expect(archetype.preferences).toHaveProperty('safety');
        expect(archetype.preferences).toHaveProperty('economy');
      } else {
        expect(archetype.preferences).toHaveProperty('price');
        expect(archetype.preferences).toHaveProperty('trust_in_shop');
      }
    }
  });
});
