import { createEventBus } from '../src/game/EventBus';
import { createEconomy } from '../src/game/Economy';
import { createDealEngine } from '../src/game/DealEngine';
import { createRegulatoryMeter } from '../src/game/Reputation';
import { createIndictmentMonitor } from '../src/game/CareerProgression';
import type { TierManager } from '../src/game/CareerProgression';
import type { LotVehicle } from '../src/game/Inventory';

// #327 — end-to-end: the two newly-wired producers (RegulatoryMeter's
// audit_failure, DealEngine's fraud_flag) plus the existing lemon-law producer
// accumulate IndictmentMonitor pressure across a shared bus until, combined,
// they cross the real indictment threshold and fire the tier-appropriate
// outcome. Uses the real data-driven configs (no hand-tuned literals) so this
// also guards the live composition wiring, not just the module logic.

function makeTierManager(tier: number): TierManager {
  let current = tier;
  return {
    get currentTier() { return current; },
    get businessName() { return ''; },
    get accentColor() { return ''; },
    get fontId() { return ''; },
    get customersServed() { return 0; },
    get monthStreak() { return 0; },
    get requiredStreak() { return current; },
    get dossierReady() { return false; },
    applyTierUp: jest.fn(),
    applyContraction: jest.fn((to: number) => { current = to; }),
    getSerializableState: jest.fn(),
    restoreState: jest.fn(),
    snapshot: jest.fn(),
    restore: jest.fn(),
  } as unknown as TierManager;
}

function makeVehicle(overrides: Partial<LotVehicle> = {}): LotVehicle {
  return {
    id: 'v1',
    templateId: 't1',
    brand: 'brand-x',
    year: 2020,
    make: 'Make',
    model: 'Model',
    trim: '',
    mileage: 50_000,
    condition: 'average',
    conditionReport: '',
    purchasePrice: 5_000,
    reconCost: 0,
    category: 'sedan',
    arrivalDay: 1,
    frontlineDay: 1,
    daysInInventory: 0,
    carryingCostToDate: 0,
    dailyCarryingCost: 0,
    aged: false,
    suggestedRetail: 6_000,
    askingPrice: 6_000,
    reconStatus: 'complete',
    reconEstimate: 0,
    reconRealizedCost: 0,
    reconDaysRemaining: 0,
    reconDaysTotal: 0,
    reconBucket: 'within',
    ...overrides,
  };
}

it('audit_failure + fraud_flag + lemon-law from the real producers cross the indictment threshold', () => {
  const bus = createEventBus();
  const economy = createEconomy({
    bus,
    startingCash: 100_000,
    config: { weeklyRent: 0 },
  });
  const tierManager = makeTierManager(1); // Tier 1 → terminal indictment.

  let currentVehicle = makeVehicle();
  const inventory = {
    getLotVehicle: () => currentVehicle,
    sellVehicle: jest.fn(() => currentVehicle),
  };
  const dealEngine = createDealEngine({
    bus,
    inventory,
    economy,
    getCurrentDay: () => 1,
  });

  // Both failure monitors listen on the shared bus with their real configs.
  createRegulatoryMeter({ bus, economy, tierManager });
  const indictment = createIndictmentMonitor({ bus, economy, tierManager });

  const terminal = jest.fn();
  bus.subscribe('career:indictment_terminal', terminal);

  // (1) Payment-packing fraud on a financed deal → deal:fraud_flag (+25).
  currentVehicle = makeVehicle();
  dealEngine.closeDeal({
    customerId: 'cust-1',
    vehicleId: 'v1',
    agreedPrice: 6_000,
    fniProducts: [
      { productId: 'vsc', price: 1495 },
      { productId: 'gap', price: 695 },
      { productId: 'tireWheel', price: 795 },
    ],
    paymentMethod: 'finance',
    downPayment: 500,
    loanAmount: 5_500,
    term: 60,
    apr: 0.09,
  });
  expect(indictment.pressure).toBeGreaterThan(0);

  // (2) Drive regulatory pressure into the audit band, then an overnight tick
  // fails the audit → regulatory:audit_failure (+20).
  for (let i = 0; i < 30; i++) {
    bus.publish('followup:customer_archived', { customerId: `a${i}`, day: 1 });
  }
  bus.publish('clock:overnight_payroll', { day: 1 });

  // (3) Retail an un-reconditioned major lemon → regulatory:lemon_law_incident
  // (+15). Combined pressure now clears the indictment threshold.
  currentVehicle = makeVehicle({ reconStatus: 'in_progress', reconBucket: 'major' });
  dealEngine.closeDeal({ customerId: 'cust-2', vehicleId: 'v1', agreedPrice: 6_000 });

  expect(terminal).toHaveBeenCalledTimes(1);
  expect(indictment.isTerminal).toBe(true);
});
