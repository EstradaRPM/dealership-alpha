import { createEventBus, type EventBus } from '../src/game/EventBus';
import { createWorld, type World } from '../src/createWorld';
import { createDefaultFacilitySnapshot } from '../src/game/Facility';
import {
  snapshotWorld,
  restoreWorld,
  type WorldSnapshot,
} from '../src/worldSnapshot';
import type { CharacterProfile } from '../src/game/CareerProgression';
import type { PartCategory } from '../src/game/PartsInventory';

// #317 (parent #297) — the capstone cross-department persistence + replay-
// determinism verification. The per-module snapshot/restore wiring landed across
// #298–#315 (InstalledBase, PartsInventory, both queues, both insights windows,
// both posture scalars); this slice is the end-to-end proof that the FULL
// Service + Body Shop state round-trips through save/load and replays identically
// (#122) once both profit centers are live at Tier 3.
//
// The everCompleted cold-start flag inside DayLoopController is intentionally NOT
// persisted (a reloaded world re-enters at MANAGERIAL = night-before its restored
// day), so an in-memory-continued world and a freshly-restored one cannot be
// driven day-for-day in lockstep. The verification is therefore built from two
// pillars that together are stronger than a single continued-vs-restored compare:
//   1. At-rest round-trip equality — `snapshotWorld(restored)` deep-equals the
//      saved blob. Because the envelope is exhaustive, a missing or mis-restored
//      department key would surface here as a diff against the accrued original.
//   2. Forward replay determinism — two independent restorations of the same blob,
//      run forward across both departments, produce identical department state AND
//      the same Service/Body-Shop event stream. Combined with (1)'s completeness
//      proof, this is the #122 guarantee for the restored departments.
//
// NB: the forward compare is over **department** state (InstalledBase /
// PartsInventory / both insights windows / both queue gates / both postures) and
// the Service/Body-Shop ticket streams — NOT the whole world snapshot. The sales
// FloorSim is not byte-reproducible across two independent same-seed runs (its
// #122 guarantee is delivered via DayLoopController checkpoint/resume, not a plain
// re-run), so the sales-lane queue ids would spuriously diverge. The collision +
// service streams are seeded purely off masterSeed+day (+ per-owner returns), so
// they ARE reproducible; with no salesperson hired no floor deal closes, so the
// installed base never picks up the floor's nondeterminism.

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

const SERVICE_PARTS: PartCategory[] = [
  'oil_filters',
  'tires_brakes',
  'drivetrain',
  'electronics',
];
const BODY_PARTS: PartCategory[] = [
  'windows_glass',
  'doors_panels',
  'interior_trim',
  'paint',
];
const ALL_PARTS: readonly PartCategory[] = [...SERVICE_PARTS, ...BODY_PARTS];

function build(masterSeed: number): { bus: EventBus; world: World } {
  const bus = createEventBus();
  const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
  return { bus, world };
}

/** Promote a fresh world to Tier 3 so BOTH the Service (Tier 2+) and Body Shop
 *  (Tier 3) lanes arm and their drains get bays. The tier read arms the gates;
 *  #358 the BAYS are built capacity, so a store that reached Tier 3 also has to
 *  have built out — which is what a Tier-3 save carries and what the migration
 *  materializes. */
function armTier3(bus: EventBus, world: World): void {
  world.tierManager.restoreState({
    currentTier: 3,
    businessName: 'Estrada Collision',
    accentColor: '#38bdf8',
    fontId: 'prestige',
    customersServed: 0,
  });
  bus.publish('career:tier_up', { fromTier: 1, toTier: 3, day: 0 });
  world.facility.restore(createDefaultFacilitySnapshot(3));
}

function hireAdvisor(world: World, roleId: string): void {
  const candidate = world.staffOrg.getCandidates(roleId)[0];
  if (!candidate) throw new Error(`no candidate for ${roleId}`);
  world.staffOrg.hire(candidate.candidateId);
}

/** Drive one full deterministic day across every wired department (sales floor +
 *  the Service + Body-Shop drains live behind floorSeams). */
function runDay(world: World): void {
  const floor = world.dayLoop.nextDay();
  floor.runDay();
}

/** Register one installed-base owner by publishing the three accrual signals of a
 *  sale (the join InstalledBase listens for). The customerId carries no live
 *  CustomerPool session, so CustomerPool's deal:closed handler no-ops — no
 *  duplicate customer:resolved. */
function injectSale(
  bus: EventBus,
  customerId: string,
  vehicleId: string,
  day: number,
  powertrain: 'ice' | 'hybrid' | 'ev',
): void {
  bus.publish('inventory:vehicle_sold', {
    day,
    vehicleId,
    salePrice: 20_000,
    templateId: 'tmpl-1',
    brand: 'brand-1',
    make: 'make-1',
    year: 2020,
    mileage: 32_000,
    condition: 'clean',
    category: 'sedan',
    purchasePrice: 15_000,
    reconCost: 500,
    powertrain,
  });
  bus.publish('deal:closed', {
    customerId,
    vehicleId,
    agreedPrice: 20_000,
    frontGross: 1_500,
    backGross: 800,
    productGross: 800,
    reserveGross: 0,
    daysInInventory: 10,
    paymentMethod: 'finance',
    downPayment: 4_000,
    loanAmount: 16_000,
    term: 60,
    apr: 0.07,
  });
  bus.publish('customer:resolved', {
    customerId,
    outcome: 'closed',
    receptivity: 0.6,
    satisfaction: 1,
    retentionSeed: 0.85,
    heat: 0,
    agreedPrice: 20_000,
    frontGross: 1_500,
  });
}

/** Build a Tier-3 world carrying meaningful cross-department state: an installed
 *  base, stocked + partly-consumed parts (both profit centers), off-default
 *  postures, and filled insights windows. Returns at MANAGERIAL after `days`. */
function buildAccruedTier3World(
  masterSeed: number,
  days: number,
): { bus: EventBus; world: World } {
  const { bus, world } = build(masterSeed);
  armTier3(bus, world);
  hireAdvisor(world, 'service-advisor');
  hireAdvisor(world, 'body-shop-advisor');

  // Stock every active category so resolved jobs close + consume rather than
  // miss on an empty shelf (both profit centers draw down their own four).
  for (const cat of ALL_PARTS) world.partsInventory.addStock(cat, 40, 100);

  // Off-default postures so the persisted scalars are non-trivial.
  world.setServicePricingPosture(0.7);
  world.setBodyShopChannelPosture(0.8);

  // Seed an installed base across powertrains so the morning return sweep feeds
  // the Service lane over the run.
  injectSale(bus, 'cust-ice-1', 'veh-ice-1', 1, 'ice');
  injectSale(bus, 'cust-ice-2', 'veh-ice-2', 1, 'ice');
  injectSale(bus, 'cust-hybrid-1', 'veh-hybrid-1', 1, 'hybrid');
  injectSale(bus, 'cust-ev-1', 'veh-ev-1', 1, 'ev');

  for (let d = 0; d < days; d++) runDay(world);
  return { bus, world };
}

/** The department-owned state that must round-trip + replay identically — the
 *  capstone surface (#317). Deliberately excludes the sales FloorSim, which is not
 *  byte-reproducible across independent same-seed runs (see the header note). */
function deptState(world: World) {
  return {
    owners: world.installedBase.getOwners(),
    parts: Object.fromEntries(
      ALL_PARTS.map((c) => [c, world.partsInventory.getStock(c)]),
    ),
    serviceInsights: world.serviceInsights.snapshot(),
    bodyShopInsights: world.bodyShopInsights.snapshot(),
    serviceQueueTier: world.serviceQueue.snapshot().currentTier,
    bodyShopQueueTier: world.bodyShopQueue.snapshot().currentTier,
    servicePosture: world.getServicePricingPosture(),
    bodyShopPosture: world.getBodyShopChannelPosture(),
  };
}

/** Subscribe to the closed-ticket streams of both departments and collect the
 *  revenue sequence — the observable "did the departments behave identically"
 *  signal for the forward-replay compare. */
function recordDeptTickets(bus: EventBus): {
  service: Array<{ id: string; revenue: number }>;
  bodyshop: Array<{ id: string; revenue: number }>;
} {
  const service: Array<{ id: string; revenue: number }> = [];
  const bodyshop: Array<{ id: string; revenue: number }> = [];
  bus.subscribe('service:ticket_closed', (e) =>
    service.push({ id: e.serviceItemId, revenue: e.revenue }),
  );
  bus.subscribe('bodyshop:ticket_closed', (e) =>
    bodyshop.push({ id: e.bodyShopItemId, revenue: e.revenue }),
  );
  return { service, bodyshop };
}

const SEED = 73_117;
const ACCRUE_DAYS = 14;
const FORWARD_DAYS = 10;

describe('Cross-department save/load + replay determinism (#317)', () => {
  it('accrues meaningful Tier-3 state in both departments (the test is honest)', () => {
    const { world } = buildAccruedTier3World(SEED, ACCRUE_DAYS);

    // InstalledBase carries owners (the four injected at minimum, plus any sales
    // closed on the live floor over the run).
    expect(world.installedBase.getOwners().length).toBeGreaterThanOrEqual(4);

    // Both profit centers drew down parts: the stocked-40 shelf is below 40 for
    // at least one Service AND one Body-Shop category (jobs closed + consumed).
    const someServiceConsumed = SERVICE_PARTS.some(
      (c) => world.partsInventory.getStock(c) < 40,
    );
    const someBodyConsumed = BODY_PARTS.some(
      (c) => world.partsInventory.getStock(c) < 40,
    );
    expect(someServiceConsumed).toBe(true);
    expect(someBodyConsumed).toBe(true);

    // Both insights windows filled from their (tier-gated) live streams.
    expect(world.serviceInsights.snapshot().demandWindow.length).toBeGreaterThan(0);
    expect(world.bodyShopInsights.snapshot().intakeWindow.length).toBeGreaterThan(0);
  });

  it('round-trips the full cross-department world onto a fresh same-seed world', () => {
    const { world: original } = buildAccruedTier3World(SEED, ACCRUE_DAYS);

    const snap = snapshotWorld(original);
    // SaveStore persists plain data — the blob must survive a JSON round-trip.
    const persisted = JSON.parse(JSON.stringify(snap)) as WorldSnapshot;
    expect(persisted).toEqual(snap);

    // A brand-new same-seed world boots cold — empty base, full shelves, neutral
    // postures — so the equality below is a real restore, not a coincidence.
    const { world: rebuilt } = build(SEED);
    expect(rebuilt.installedBase.getOwners()).toEqual([]);
    expect(rebuilt.getServicePricingPosture()).toBe(0.5);
    expect(rebuilt.getBodyShopChannelPosture()).toBe(0.5);

    restoreWorld(persisted, rebuilt);

    // The whole envelope re-snapshots identically — every department key
    // (InstalledBase, PartsInventory, both queues, both insights, both postures)
    // rehydrated. A missing key would diverge here against the accrued original.
    expect(snapshotWorld(rebuilt)).toEqual(snap);

    // Spot-check the load-bearing department reads directly.
    expect(rebuilt.installedBase.getOwners()).toEqual(
      original.installedBase.getOwners(),
    );
    for (const cat of ALL_PARTS) {
      expect(rebuilt.partsInventory.getStock(cat)).toBe(
        original.partsInventory.getStock(cat),
      );
    }
    expect(rebuilt.getServicePricingPosture()).toBe(0.7);
    expect(rebuilt.getBodyShopChannelPosture()).toBe(0.8);
    expect(rebuilt.serviceInsights.snapshot()).toEqual(
      original.serviceInsights.snapshot(),
    );
    expect(rebuilt.bodyShopInsights.snapshot()).toEqual(
      original.bodyShopInsights.snapshot(),
    );
  });

  it('reproduces subsequent Service + Body Shop behavior identically after restore', () => {
    const { world: original } = buildAccruedTier3World(SEED, ACCRUE_DAYS);
    const snap = JSON.parse(
      JSON.stringify(snapshotWorld(original)),
    ) as WorldSnapshot;

    // Two independent restorations of the same blob, each driven forward across
    // both departments. With the snapshot complete (proven above), identical
    // forward state + event streams is the #122 replay guarantee.
    const { bus: busA, world: worldA } = build(SEED);
    restoreWorld(snap, worldA);
    const ticketsA = recordDeptTickets(busA);

    const { bus: busB, world: worldB } = build(SEED);
    restoreWorld(snap, worldB);
    const ticketsB = recordDeptTickets(busB);

    for (let d = 0; d < FORWARD_DAYS; d++) {
      runDay(worldA);
      runDay(worldB);
    }

    // The departments closed the same tickets for the same revenue, in order.
    expect(ticketsA.service).toEqual(ticketsB.service);
    expect(ticketsA.bodyshop).toEqual(ticketsB.bodyshop);
    // ...and the forward run actually exercised both lanes (not a vacuous match).
    expect(ticketsA.service.length).toBeGreaterThan(0);
    expect(ticketsA.bodyshop.length).toBeGreaterThan(0);

    // The post-forward department state (installed base, parts draw-down, both
    // insights windows, both gates, both postures) agrees exactly.
    expect(deptState(worldA)).toEqual(deptState(worldB));
  });

  it('regenerates daily intake deterministically from the seed (not persisted)', () => {
    const { world: original } = buildAccruedTier3World(SEED, ACCRUE_DAYS);
    const snap = JSON.parse(
      JSON.stringify(snapshotWorld(original)),
    ) as WorldSnapshot;

    // The day's collision + service intake is carried state in NEITHER queue
    // snapshot — only the tier gate is persisted; the lane regenerates each
    // morning from masterSeed + day + the live providers.
    expect(snap.modules.bodyShopQueue).toEqual({
      schemaVersion: 1,
      currentTier: 3,
    });
    expect(snap.modules.serviceQueue).toEqual({
      schemaVersion: 1,
      currentTier: 3,
    });

    // Two restorations regenerate the SAME forward intake — collision and service
    // streams alike — proving the intake is reproduced from masterSeed + day + the
    // live providers, not read back from the save.
    function forwardIntake(b: EventBus, w: World, days: number) {
      const service: unknown[][] = [];
      const bodyshop: unknown[][] = [];
      b.subscribe('service:intake_ready', (e) => service.push([...e.items]));
      b.subscribe('bodyshop:intake_ready', (e) => bodyshop.push([...e.items]));
      for (let d = 0; d < days; d++) runDay(w);
      return { service, bodyshop };
    }

    const { bus: busA, world: worldA } = build(SEED);
    restoreWorld(snap, worldA);
    const intakeA = forwardIntake(busA, worldA, FORWARD_DAYS);

    const { bus: busB, world: worldB } = build(SEED);
    restoreWorld(snap, worldB);
    const intakeB = forwardIntake(busB, worldB, FORWARD_DAYS);

    expect(intakeA.service).toEqual(intakeB.service);
    expect(intakeA.bodyshop).toEqual(intakeB.bodyshop);
    // Non-vacuous: the seeded streams actually produced intake to compare over the
    // window (collisions are stochastic per-day; returns flow as owners come due).
    const anyService = intakeA.service.some((items) => items.length > 0);
    const anyBody = intakeA.bodyshop.some((items) => items.length > 0);
    expect(anyService).toBe(true);
    expect(anyBody).toBe(true);
  });
});
