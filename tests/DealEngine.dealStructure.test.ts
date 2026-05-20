import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createInventory, loadVehicleData } from '../src/game/Inventory';
import { createCustomerPool } from '../src/game/CustomerPool';
import { createDealEngine, loadCreditTiers } from '../src/game/DealEngine';
import {
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
} from '../src/game/NPC';
import { makeSalespersonProfile } from '../src/game/SalesProcess';
import type { EventMap } from '../src/game/EventBus';

// PERFECT_SKILL guarantees SalesProcess resolves 'closed' so the CustomerPool
// real-close path (#146) actually routes through DealEngine.closeDeal.
const PERFECT_SKILL = makeSalespersonProfile({}, { effectiveness: 1, trustworthiness: 1 });

const MASTER_SEED = 42;
const vehicleData = loadVehicleData();

function makeWired(opts: { skill?: ReturnType<typeof makeSalespersonProfile> } = {}) {
  const bus = createEventBus();
  const clock = createGameClock({ bus, initialDay: 0 });
  const economy = createEconomy({ bus, startingCash: 100_000 });
  const inventory = createInventory({ bus, masterSeed: MASTER_SEED, economy, vehicleData });
  const dealEngine = createDealEngine({ bus, inventory, economy });
  const creditTiers = loadCreditTiers();
  const pool = createCustomerPool({
    bus,
    npcDeps: {
      masterSeed: MASTER_SEED,
      personArchetypes: loadPersonArchetypes(),
      visitArchetypes: loadVisitArchetypes(),
      traits: loadTraitTaxonomy(),
    },
    skill: opts.skill ?? PERFECT_SKILL,
    dealEngine,
    inventory,
    creditTiers,
  });
  return { bus, clock, economy, inventory, dealEngine, pool, creditTiers };
}

function spawnAndDrive(
  pool: ReturnType<typeof makeWired>['pool'],
  personId: string,
  visitId: string,
  label: string,
): string {
  const id = pool.spawnCustomer(personId, visitId, label);
  pool.dispatch(id, 'GREET');
  pool.dispatch(id, 'QUALIFY');
  pool.dispatch(id, 'DEMO');
  pool.dispatch(id, 'NEGOTIATE');
  return id;
}

function capture(bus: ReturnType<typeof createEventBus>) {
  const events: EventMap['deal:closed'][] = [];
  bus.subscribe('deal:closed', (e) => events.push(e));
  return events;
}

describe('deal:closed — payload completeness (#146)', () => {
  it('cash close: paymentMethod=cash, downPayment=agreedPrice, loanAmount=term=apr=0', () => {
    const { bus, clock, inventory, pool } = makeWired();
    clock.advanceDay();
    // Make sure there's at least one vehicle on the lot for the close path.
    const [listing] = inventory.getAuctionListings();
    inventory.buyFromAuction(listing.id);

    // spawnCustomer rolls a paymentMethod via the CustomerFactory seeded RNG;
    // try archetypes until we observe a cash customer. Production callers
    // always see both methods at the population level; this test just needs
    // one of each to assert payload shape.
    const events = capture(bus);

    // Iterate spawns until we have at least one cash close.
    let cashFound = false;
    for (let i = 0; i < 50 && !cashFound; i++) {
      const id = spawnAndDrive(pool, 'retiree', 'retirement_upgrade', 'Retiree');
      const session = pool.getSession(id);
      if (!session) continue;
      const visit = session.bundle.visit;
      if (visit.kind !== 'sales') continue;
      if (visit.paymentMethod !== 'cash') continue;

      // Need a vehicle on the lot for closeDeal to succeed.
      if (inventory.getLotVehicles().length === 0) {
        const [l] = inventory.getAuctionListings();
        if (l) inventory.buyFromAuction(l.id);
      }
      pool.dispatch(id, 'CLOSE');
      const cash = events.find(e => e.paymentMethod === 'cash');
      if (cash) {
        expect(cash.paymentMethod).toBe('cash');
        expect(cash.downPayment).toBe(cash.agreedPrice);
        expect(cash.loanAmount).toBe(0);
        expect(cash.term).toBe(0);
        expect(cash.apr).toBe(0);
        cashFound = true;
      }
    }
    expect(cashFound).toBe(true);
  });

  it('finance close: paymentMethod=finance, term/apr from tier, downPayment from behavior', () => {
    const { bus, clock, inventory, pool, dealEngine, creditTiers } = makeWired();
    clock.advanceDay();
    const events = capture(bus);

    let financeFound = false;
    for (let i = 0; i < 50 && !financeFound; i++) {
      const id = spawnAndDrive(pool, 'young_family', 'family_vehicle_search', 'Young Family');
      const session = pool.getSession(id);
      if (!session) continue;
      const visit = session.bundle.visit;
      if (visit.kind !== 'sales') continue;
      if (visit.paymentMethod !== 'finance') continue;

      if (inventory.getLotVehicles().length === 0) {
        const [l] = inventory.getAuctionListings();
        if (l) inventory.buyFromAuction(l.id);
      }
      pool.dispatch(id, 'CLOSE');
      const fin = events.find(e => e.customerId === id && e.paymentMethod === 'finance');
      if (fin) {
        const tier = dealEngine.classifyCredit(session.bundle.person.credit);
        const policy = creditTiers.tiers[tier];
        expect(fin.paymentMethod).toBe('finance');
        expect(fin.apr).toBe(policy.apr);
        expect(fin.term).toBe(policy.maxTerm);
        const expectedDown = fin.agreedPrice * (visit.downPaymentBehavior ?? 0);
        expect(fin.downPayment).toBeCloseTo(expectedDown, 5);
        expect(fin.loanAmount).toBeCloseTo(fin.agreedPrice - expectedDown, 5);
        financeFound = true;
      }
    }
    expect(financeFound).toBe(true);
  });
});
