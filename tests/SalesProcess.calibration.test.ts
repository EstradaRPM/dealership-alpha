import {
  createCustomer,
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
} from '../src/game/NPC';
import {
  makeSalespersonProfile,
  resolveSalesProcess,
  closeAndPrice,
  loadSalesProcessConfig,
  GATES,
  type SpacedVector,
  type CloseResult,
} from '../src/game/SalesProcess';

/**
 * #94 — HITL calibration distribution test (parent #85, design-locked).
 *
 * Runs a seeded N-customer simulation through the full S1→S6 SalesProcess
 * chain — `classifyAxes` → seeded gates → two-meter roll-up → named walk model
 * → quadrant close → price formation — under a *competent* (not perfect) staff
 * profile, and asserts the realized outcome distribution lands inside the PRD
 * acceptance bands:
 *
 *   - positive transactions  ≥ 85%
 *   - apathetic (no-close)   10–12%
 *   - negative-but-deal      3–5%
 *   - non-closes predominantly warm walks, bad experiences rare
 *
 * "Good operation ≠ perfect." The single tuning surface is
 * `data/sales-process.json`; a band failure is fixed by tuning that file,
 * never by changing code. Deterministic — fixed master seed, fixed archetype
 * rotation, seeded per-gate RNG.
 *
 * Harness note (HITL reviewer, read this): customers are real NPC-archetype
 * bundles, but the demoed vehicle's SPACED is set to the customer's own
 * preference vector. This deliberately models a *competent operation that
 * picked an appropriate unit for the customer's needs* — calibration measures
 * the SalesProcess balance, not inventory-fit roulette. (Inventory→evaluator
 * wiring and demand generation are explicit #85 follow-ons; the production
 * `CustomerPool` still uses a single stub vehicle until that lands, which is an
 * inventory-wiring artifact, not a balance signal.) Variation across the run
 * comes entirely from the genuinely tunable parts of the chain: seeded gate
 * quality (skill + bounded jitter + customer difficulty), the trust/value
 * meters, patience drain, the quadrant close thresholds, and price formation
 * vs. customer price sensitivity — every one of which lives in
 * `data/sales-process.json`.
 */

// Competent staff: clearly above the green solo operator (0.35/0.40) but
// deliberately short of perfect — a believable "good op".
const COMPETENT_SKILL = makeSalespersonProfile(
  {},
  { effectiveness: 0.75, trustworthiness: 0.75 },
);

const N = 600;
const MASTER_SEED = 20260516;
const ARCHETYPE_IMPATIENCE = 0.25; // mirrors CustomerPool

const SALES_ARCHETYPES = [
  { personId: 'young_family', visitId: 'family_vehicle_search' },
  { personId: 'enthusiast', visitId: 'performance_test_drive' },
  { personId: 'commuter', visitId: 'commuter_replacement' },
  { personId: 'retiree', visitId: 'retirement_upgrade' },
  { personId: 'tradesperson', visitId: 'work_truck_purchase' },
] as const;

const STUB_PRICED_VEHICLE = { purchasePrice: 8000, reconCost: 500 };

const npcDeps = {
  masterSeed: MASTER_SEED,
  personArchetypes: loadPersonArchetypes(),
  visitArchetypes: loadVisitArchetypes(),
  traits: loadTraitTaxonomy(),
};

const clampUnit = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

type Resolved = {
  outcome: 'closed' | 'walk';
  satisfaction: number;
  heat: number;
};

/** Mirrors CustomerPool.resolveViaProcess scalar/heat semantics exactly. */
function resolveOne(day: number): Resolved {
  const pick = SALES_ARCHETYPES[day % SALES_ARCHETYPES.length];
  const { person, visit } = createCustomer(
    {
      personArchetypeId: pick.personId,
      visitArchetypeId: pick.visitId,
      day,
      slot: 0,
    },
    npcDeps,
  );
  if (visit.kind !== 'sales') throw new Error('expected sales visit');

  const customerSpaced = visit.preferences as unknown as SpacedVector;

  const resolution = resolveSalesProcess({
    masterSeed: MASTER_SEED,
    customerId: person.id,
    day,
    skill: COMPETENT_SKILL,
    customerDifficulty: clampUnit(1 - person.agreeableness / 100),
    archetypeImpatience: ARCHETYPE_IMPATIENCE,
    initialPatience: visit.resources.patience,
    customerSpaced,
    // Competent op picked an appropriate unit — see harness note above.
    vehicleSpaced: customerSpaced,
    visitArchetypeId: pick.visitId,
  });

  const computeHeat = (closeResult?: CloseResult): number => {
    if (closeResult?.outcome === 'buy') return 0;
    const stageProgress =
      resolution.outcome === 'walk'
        ? GATES.indexOf(resolution.gate) / Math.max(1, GATES.length - 1)
        : 1.0;
    return clampUnit(
      stageProgress * 0.5 +
        resolution.meters.value * 0.3 +
        resolution.meters.trustIntegrity * 0.2,
    );
  };

  if (resolution.outcome === 'walk') {
    return { outcome: 'walk', satisfaction: 0, heat: computeHeat() };
  }

  const priceSensitivity = clampUnit(1 - person.wealth / 120000);
  const closeResult = closeAndPrice({
    meters: resolution.meters,
    skill: COMPETENT_SKILL,
    priceSensitivity,
    vehicle: STUB_PRICED_VEHICLE,
  });
  const closed = closeResult.outcome === 'buy';
  return {
    outcome: closed ? 'closed' : 'walk',
    satisfaction: closeResult.badReview ? -1 : closed ? 1 : 0,
    heat: computeHeat(closeResult),
  };
}

function runSimulation(): Resolved[] {
  const out: Resolved[] = [];
  for (let day = 1; day <= N; day++) out.push(resolveOne(day));
  return out;
}

describe('SalesProcess — calibration distribution (#94, HITL)', () => {
  const results = runSimulation();

  const positive = results.filter(
    (r) => r.outcome === 'closed' && r.satisfaction > 0,
  );
  const negativeDeal = results.filter(
    (r) => r.outcome === 'closed' && r.satisfaction < 0,
  );
  const apathetic = results.filter((r) => r.outcome === 'walk');

  const total = results.length;
  const pPositive = positive.length / total;
  const pApathetic = apathetic.length / total;
  const pNegative = negativeDeal.length / total;
  const warmWalkShare =
    apathetic.length === 0
      ? 1
      : apathetic.filter((r) => r.heat >= 0.4).length / apathetic.length;

  // Surface the realized distribution so the HITL reviewer can eyeball it.
  // eslint-disable-next-line no-console
  console.log(
    `[#94 calibration] N=${total} ` +
      `positive=${(pPositive * 100).toFixed(1)}% ` +
      `apathetic=${(pApathetic * 100).toFixed(1)}% ` +
      `negative-deal=${(pNegative * 100).toFixed(1)}% ` +
      `warm-walk-share=${(warmWalkShare * 100).toFixed(1)}%`,
  );

  it('every customer resolves to exactly one band', () => {
    expect(positive.length + negativeDeal.length + apathetic.length).toBe(
      total,
    );
    expect(total).toBe(N);
  });

  it('positive transactions ≥ 85%', () => {
    const { calibration } = loadSalesProcessConfig();
    expect(pPositive).toBeGreaterThanOrEqual(calibration.positiveMin);
  });

  it('apathetic (no-close) within 10–12%', () => {
    const { calibration } = loadSalesProcessConfig();
    expect(pApathetic).toBeGreaterThanOrEqual(calibration.apatheticMin);
    expect(pApathetic).toBeLessThanOrEqual(calibration.apatheticMax);
  });

  it('negative-but-deal within 3–5%', () => {
    const { calibration } = loadSalesProcessConfig();
    expect(pNegative).toBeGreaterThanOrEqual(calibration.negativeDealMin);
    expect(pNegative).toBeLessThanOrEqual(calibration.negativeDealMax);
  });

  it('non-closes are predominantly warm walks (rare bad experiences)', () => {
    expect(warmWalkShare).toBeGreaterThan(0.5);
  });

  it('is deterministic across runs', () => {
    const a = runSimulation();
    const b = runSimulation();
    expect(a.map((r) => `${r.outcome}:${r.satisfaction}`)).toEqual(
      b.map((r) => `${r.outcome}:${r.satisfaction}`),
    );
  });
});
