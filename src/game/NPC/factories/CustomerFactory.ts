import { createRng, deriveSeed, type SeedContext } from '../../Rng';
import { resolveEffects } from '../Trait';
import type { TraitSet, EffectKey, EffectVector } from '../schemas/trait';
import type { PersonArchetypeCatalog } from '../schemas/person-archetype';
import type { VisitArchetypeCatalog } from '../schemas/visit-archetype';
import type { Person, Visit, SPACEDVector, PSQTCVector } from '../schemas/customer';
import { PersonSchema, VisitSchema } from '../schemas/customer';
import type {
  CustomerCurrentVehicleConfig,
  CurrentVehicle,
} from '../schemas/customer-current-vehicle';
import { rollCurrentVehicle } from './CurrentVehicleFactory';
import type { TradeIncidenceConfig } from '../schemas/trade-incidence';
import { rollHasTrade } from './TradeIncidenceFactory';

export const CUSTOMER_FACTORY_NAMESPACE = 'npc.customer.factory';

export interface CreateCustomerContext extends SeedContext {
  personArchetypeId: string;
  visitArchetypeId: string;
  day: number;
  slot: number;
}

export interface CreateCustomerDeps {
  masterSeed: number;
  personArchetypes: PersonArchetypeCatalog;
  visitArchetypes: VisitArchetypeCatalog;
  traits: TraitSet;
  /**
   * Floor price of the cheapest unit on the lot. Used by the cash-affordability
   * gate: customers whose `wealth × cashSpendFraction` falls below this floor
   * are forced to `paymentMethod: 'finance'`, closing the silent-fail bug where
   * a broke customer "pays cash" for nothing on the lot. Omit (or pass 0) to
   * disable the gate.
   */
  cheapestLotPriceFloor?: number;
  /**
   * Returns the lender-policy minimum down-payment fraction for a given credit
   * score (i.e. `tier.minDownPct`). Used as the lower bound of the clamp when
   * rolling `downPaymentBehavior` for finance customers. Omit to default to 0
   * (no floor) — useful when callers don't need the credit-tier coupling.
   */
  minDownPctForCredit?: (credit: number) => number;
  /**
   * `data/customer-current-vehicle.json` (#165). Omit to skip currentVehicle
   * generation entirely — the rolled Person comes back without the field
   * (legacy/test path). Wired in production via the composition root.
   */
  currentVehicleConfig?: CustomerCurrentVehicleConfig;
  /**
   * `data/trade-incidence.json` (#166). Omit to skip hasTrade generation —
   * the rolled sales Visit comes back without the field (legacy/test path).
   * Wired in production via the composition root. Like `currentVehicleConfig`,
   * the credit-tier seam (`classifyCreditTier`) must also be supplied.
   */
  tradeIncidenceConfig?: TradeIncidenceConfig;
  /**
   * Maps a rolled credit score to the credit tier key used by the
   * currentVehicle payoff distribution and the trade-incidence matrix.
   * Required when either `currentVehicleConfig` or `tradeIncidenceConfig` is
   * supplied; omitted otherwise. The caller injects this seam (typically
   * `(credit) => classifyCredit(credit, creditTiers)`) so NPC stays free of
   * a DealEngine dep.
   */
  classifyCreditTier?: (credit: number) => 'A' | 'B' | 'C' | 'D';
  /**
   * Trade-allowance-ask seam (#167). Given the customer's `currentVehicle` and
   * a deterministic seed, returns the dollar ask they want for their trade.
   * The composition root composes this from DealEngine's `generateTradeAsk`
   * bound to the live book-value provider + noise config, so NPC stays free of
   * a DealEngine dep. Invoked only for sales visits where `hasTrade` is true
   * and a `currentVehicle` was rolled; omit to skip allowanceAsk entirely.
   */
  tradeAskFn?: (currentVehicle: CurrentVehicle, seed: number) => number;
  /**
   * Honest wholesale book seam (#282). Threaded into `rollCurrentVehicle` so a
   * financed owner's `loanPayoff` is derived relative to the trade's current
   * book value (controlled LTV × loan-age × depreciation distribution) instead
   * of a value-blind dollar draw. Composed at the root from the live
   * MarketEconomy `bookValueFn` (the same one backing `tradeAskFn`). Omit and a
   * financed owner's `currentVehicle.loanPayoff` comes back `null`.
   */
  bookValueFn?: (currentVehicle: CurrentVehicle) => number;
}

export interface CustomerBundle {
  person: Person;
  visit: Visit;
}

// EffectKey → SPACED preference field (sales visits only)
const SPACED_EFFECT_MAP: Partial<Record<EffectKey, keyof SPACEDVector>> = {
  'spaced_weight.economy': 'economy',
  'spaced_weight.luxury': 'appearance',
  'spaced_weight.truck': 'dependability',
};

// EffectKey → PSQTC preference field (service/body visits only)
const PSQTC_EFFECT_MAP: Partial<Record<EffectKey, keyof PSQTCVector>> = {
  price_sensitivity: 'price',
};

// Payment leaning is drawn on its own stream, not out of `trait_pool` (#153).
// Each declared trait is an independent Bernoulli at its archetype's rate, so
// adding a payment axis never costs a customer a personality slot — and never
// re-routes a personality draw the sales calibration is measured against.
function pickPaymentTraits(
  rng: () => number,
  rates: Readonly<Record<string, number>> | undefined,
): string[] {
  if (!rates) return [];
  const chosen: string[] = [];
  // Sorted so the stream is bound to the ids, not to the file's key order.
  for (const id of Object.keys(rates).sort()) {
    if (rng() < rates[id]) chosen.push(id);
  }
  return chosen;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function gaussian(rng: () => number, mu: number, sigma: number): number {
  let u1 = rng();
  while (u1 === 0) u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + sigma * z;
}

function pickTraits(
  rng: () => number,
  pool: readonly string[],
  min: number,
  max: number,
): string[] {
  const count = min + Math.floor(rng() * (max - min + 1));
  const available = [...pool];
  const chosen: string[] = [];
  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(rng() * available.length);
    chosen.push(available[idx]);
    available.splice(idx, 1);
  }
  return chosen;
}

// Accumulate all trait deltas first (order-independent addition), then apply in one pass.
function applyEffectsToVisit(
  base: Visit,
  effects: EffectVector,
  agreeableness: number,
): Visit {
  const res = {
    // Agreeableness linearly modifies starting trust: higher agreeableness → higher trust.
    trust: base.resources.trust + (agreeableness / 100) * 0.1,
    patience: base.resources.patience + (effects['patience'] ?? 0),
  };
  res.trust += effects['trust_build_rate'] ?? 0;

  if (base.kind === 'sales') {
    const pref = { ...base.preferences } as SPACEDVector;
    for (const [ek, sk] of Object.entries(SPACED_EFFECT_MAP) as [EffectKey, keyof SPACEDVector][]) {
      const d = effects[ek] ?? 0;
      if (d !== 0) pref[sk] += d;
    }
    return {
      kind: 'sales',
      person_id: base.person_id,
      preferences: pref,
      resources: res,
      paymentMethod: base.paymentMethod,
      ...(base.downPaymentBehavior !== undefined
        ? { downPaymentBehavior: base.downPaymentBehavior }
        : {}),
      ...(base.hasTrade !== undefined ? { hasTrade: base.hasTrade } : {}),
      ...(base.allowanceAsk !== undefined
        ? { allowanceAsk: base.allowanceAsk }
        : {}),
    };
  } else {
    const pref = { ...base.preferences } as PSQTCVector;
    for (const [ek, pk] of Object.entries(PSQTC_EFFECT_MAP) as [EffectKey, keyof PSQTCVector][]) {
      const d = effects[ek] ?? 0;
      if (d !== 0) pref[pk] += d;
    }
    return { kind: base.kind, person_id: base.person_id, preferences: pref, resources: res };
  }
}

export function createCustomer(ctx: CreateCustomerContext, deps: CreateCustomerDeps): CustomerBundle {
  const { masterSeed, personArchetypes, visitArchetypes, traits } = deps;

  const personArchetype = personArchetypes[ctx.personArchetypeId];
  if (!personArchetype) throw new Error(`Unknown person archetype "${ctx.personArchetypeId}"`);

  const visitArchetype = visitArchetypes[ctx.visitArchetypeId];
  if (!visitArchetype) throw new Error(`Unknown visit archetype "${ctx.visitArchetypeId}"`);

  const seedFor = (sub: string): number =>
    deriveSeed(masterSeed, `${CUSTOMER_FACTORY_NAMESPACE}.${sub}`, ctx);

  // -- Roll traits --
  const rngTraits = createRng(seedFor('traits'));
  const traitIds = [
    ...pickTraits(
      rngTraits,
      personArchetype.trait_pool,
      personArchetype.trait_count.min,
      personArchetype.trait_count.max,
    ),
    ...pickPaymentTraits(
      createRng(seedFor('traits.payment')),
      personArchetype.payment_traits,
    ),
  ];

  const resolvedTraits = traitIds.map((id) => {
    const t = traits[id];
    if (!t) throw new Error(`Unknown trait "${id}"`);
    return t;
  });

  // -- Accumulate trait effects (order-independent addition) once, up front --
  // Resolved before the rolls because the payment traits (#153) modify the
  // archetype's base cash leaning rather than a value derived from it; the
  // preference/resource deltas below still land in one pass at the end.
  const effectVector = resolveEffects(resolvedTraits, {}, 'customer');

  // -- Roll person stats --
  const rollStat = (sub: string, mu: number, sigma: number): number =>
    gaussian(createRng(seedFor(sub)), mu, sigma);

  const agreeableness = rollStat('agreeableness', personArchetype.agreeableness.mu, personArchetype.agreeableness.sigma);

  const credit = rollStat('credit', personArchetype.credit.mu, personArchetype.credit.sigma);

  // currentVehicle (#165) — only generated when both the config and the
  // credit-tier classifier seam are wired; legacy callers get a Person
  // without the field.
  let currentVehicle;
  if (deps.currentVehicleConfig && deps.classifyCreditTier) {
    currentVehicle = rollCurrentVehicle(
      {
        personArchetypeId: ctx.personArchetypeId,
        day: ctx.day,
        slot: ctx.slot,
      },
      {
        masterSeed,
        config: deps.currentVehicleConfig,
        creditTier: deps.classifyCreditTier(credit),
        bookValueFn: deps.bookValueFn,
      },
    );
  }

  const person = PersonSchema.parse({
    id: `customer:${ctx.personArchetypeId}:${ctx.day}:${ctx.slot}`,
    trait_ids: traitIds,
    wealth: rollStat('wealth', personArchetype.wealth.mu, personArchetype.wealth.sigma),
    credit,
    annualIncome: Math.max(1, rollStat('annualIncome', personArchetype.annualIncome.mu, personArchetype.annualIncome.sigma)),
    int: rollStat('int', personArchetype.int.mu, personArchetype.int.sigma),
    agreeableness,
    brand_affinity: {},
    counters: { prior_visits: 0, prior_deals: 0, days_since_last_visit: 0 },
    ...(currentVehicle !== undefined ? { currentVehicle } : {}),
  });

  // -- Roll visit base values from archetype distributions --
  const rollField = (sub: string, mu: number, sigma: number): number =>
    gaussian(createRng(seedFor(sub)), mu, sigma);

  let baseVisit: Visit;

  if (visitArchetype.kind === 'sales') {
    const p = visitArchetype.preferences;
    const r = visitArchetype.resources;
    const pay = visitArchetype.payment;

    // Cash/finance roll: Bernoulli on cashProbability, then gate against
    // affordability. cashSpendFraction is gaussian per archetype.
    const cashRoll = createRng(seedFor('payment.method'))();
    const cashSpendFraction = gaussian(
      createRng(seedFor('payment.cashSpendFraction')),
      pay.cashSpendFraction.mu,
      pay.cashSpendFraction.sigma,
    );
    // Payment traits (#153) stack on the archetype base, never replace it:
    // `cash-buyer` shifts the leaning, `must-finance` is categorical. Someone
    // rebuilding credit wants the tradeline, so they finance regardless of what
    // the roll said or what they could have written a cheque for — which is
    // also why the affordability gate below needs no exemption for them: it
    // only ever pushes a customer toward finance, never away from it.
    const mustFinance = (effectVector['payment.must_finance'] ?? 0) > 0;
    const cashProbability = clamp01(
      pay.cashProbability + (effectVector['payment.cash_probability'] ?? 0),
    );
    const wantsCash = !mustFinance && cashRoll < cashProbability;
    const floor = deps.cheapestLotPriceFloor ?? 0;
    const canAffordCash = person.wealth * cashSpendFraction >= floor;
    const paymentMethod: 'cash' | 'finance' =
      wantsCash && canAffordCash ? 'cash' : 'finance';

    // Finance customers carry a behavioral down-payment fraction, clamped to
    // [tier.minDownPct, 0.5]. Cash customers omit the field.
    let downPaymentBehavior: number | undefined;
    if (paymentMethod === 'finance') {
      const downRoll = gaussian(
        createRng(seedFor('payment.downPaymentBehavior')),
        pay.downPaymentBehavior.mu,
        pay.downPaymentBehavior.sigma,
      );
      const floor = deps.minDownPctForCredit?.(person.credit) ?? 0;
      downPaymentBehavior = Math.min(0.5, Math.max(floor, downRoll));
    }

    // hasTrade (#166) — only stamped when both the config and the credit-tier
    // classifier seam are wired; legacy callers get a sales Visit without
    // the field.
    let hasTrade: boolean | undefined;
    if (deps.tradeIncidenceConfig && deps.classifyCreditTier) {
      hasTrade = rollHasTrade(
        {
          personArchetypeId: ctx.personArchetypeId,
          day: ctx.day,
          slot: ctx.slot,
        },
        {
          masterSeed,
          config: deps.tradeIncidenceConfig,
          paymentMethod,
          creditTier: deps.classifyCreditTier(person.credit),
        },
      );
    }

    // allowanceAsk (#167) — the dollar number a trading customer wants for
    // their car. Only rolled when the visit carries a trade, a currentVehicle
    // was generated, and the trade-ask seam is wired (production path). NPC
    // derives the seed; the seam owns the book-value read + noise draw.
    let allowanceAsk: number | undefined;
    if (hasTrade && currentVehicle && deps.tradeAskFn) {
      allowanceAsk = deps.tradeAskFn(currentVehicle, seedFor('tradeAsk'));
    }

    baseVisit = VisitSchema.parse({
      kind: 'sales',
      person_id: person.id,
      preferences: {
        safety: rollField('pref.safety', p.safety.mu, p.safety.sigma),
        performance: rollField('pref.performance', p.performance.mu, p.performance.sigma),
        appearance: rollField('pref.appearance', p.appearance.mu, p.appearance.sigma),
        comfort: rollField('pref.comfort', p.comfort.mu, p.comfort.sigma),
        economy: rollField('pref.economy', p.economy.mu, p.economy.sigma),
        dependability: rollField('pref.dependability', p.dependability.mu, p.dependability.sigma),
      },
      resources: {
        trust: rollField('res.trust', r.trust.mu, r.trust.sigma),
        patience: rollField('res.patience', r.patience.mu, r.patience.sigma),
      },
      paymentMethod,
      ...(downPaymentBehavior !== undefined ? { downPaymentBehavior } : {}),
      ...(hasTrade !== undefined ? { hasTrade } : {}),
      ...(allowanceAsk !== undefined ? { allowanceAsk } : {}),
    });
  } else {
    const p = visitArchetype.preferences;
    const r = visitArchetype.resources;
    baseVisit = VisitSchema.parse({
      kind: visitArchetype.kind,
      person_id: person.id,
      preferences: {
        price: rollField('pref.price', p.price.mu, p.price.sigma),
        speed: rollField('pref.speed', p.speed.mu, p.speed.sigma),
        quality: rollField('pref.quality', p.quality.mu, p.quality.sigma),
        trust_in_shop: rollField('pref.trust_in_shop', p.trust_in_shop.mu, p.trust_in_shop.sigma),
        convenience: rollField('pref.convenience', p.convenience.mu, p.convenience.sigma),
      },
      resources: {
        trust: rollField('res.trust', r.trust.mu, r.trust.sigma),
        patience: rollField('res.patience', r.patience.mu, r.patience.sigma),
      },
    });
  }

  // -- Apply the accumulated trait effects to the visit in one pass --
  const visit = VisitSchema.parse(applyEffectsToVisit(baseVisit, effectVector, agreeableness));

  return { person, visit };
}
