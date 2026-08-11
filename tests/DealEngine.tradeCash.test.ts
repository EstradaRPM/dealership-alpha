import { createEventBus } from '../src/game/EventBus';
import { createEconomy } from '../src/game/Economy';
import { createDealEngine } from '../src/game/DealEngine';
import type { LotVehicle } from '../src/game/Inventory';

/**
 * #379 — a trade-in was being paid for twice.
 *
 * `closeDeal` banked the whole selling price while `Inventory.acquireFromTrade`
 * materialized the customer's car onto the lot for free, so on a trade deal the
 * store kept money it was never handed AND got a car for nothing. At a 42% trade
 * rate that is a standing cash faucet, and every bankruptcy and tier gate in the
 * game branches on `economy.cash`.
 *
 * The correction is on the CASH side only. Revenue is the selling price and
 * stays the selling price — netting it would wreck front gross, PVR and every
 * reading built on what the car sold for.
 */

const STARTING_CASH = 100_000;
const NO_OVERHEAD = { weeklyRent: 0 };

const AGREED_PRICE = 20_000;
const ALLOWANCE = 8_000;
const PAYOFF = 3_000;
/** What the customer keeps as credit against the purchase. */
const EQUITY = ALLOWANCE - PAYOFF;

/** A plain, clean unit: no lemon flag, no recon, nothing but the money under test. */
function makeVehicle(): LotVehicle {
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
    purchasePrice: 14_000,
    reconCost: 0,
    category: 'sedan',
    arrivalDay: 1,
    frontlineDay: 1,
    daysInInventory: 0,
    carryingCostToDate: 0,
    dailyCarryingCost: 0,
    aged: false,
    suggestedRetail: 20_000,
    askingPrice: 20_000,
    reconStatus: 'complete',
    reconEstimate: 0,
    reconRealizedCost: 0,
    reconDaysRemaining: 0,
    reconDaysTotal: 0,
    reconBucket: 'within',
  };
}

function setup() {
  const bus = createEventBus();
  const economy = createEconomy({ bus, startingCash: STARTING_CASH, config: NO_OVERHEAD });
  const vehicle = makeVehicle();
  const inventory = {
    getLotVehicle: () => vehicle,
    sellVehicle: jest.fn(() => vehicle),
  };
  const dealEngine = createDealEngine({ bus, inventory, economy });
  return { bus, economy, dealEngine };
}

/**
 * A financed close structured exactly as StaffDispatch structures one: the trade
 * equity is credit, so it shrinks the note rather than arriving as money.
 */
function closeWithTrade(
  s: ReturnType<typeof setup>,
  { allowance, equity }: { allowance: number; equity: number },
) {
  const downPayment = 2_000;
  return s.dealEngine.closeDeal({
    customerId: 'cust-1',
    vehicleId: 'v1',
    agreedPrice: AGREED_PRICE,
    paymentMethod: 'finance',
    downPayment,
    loanAmount: Math.max(0, AGREED_PRICE - downPayment - equity),
    term: 60,
    apr: 0.09,
    tradeAllowance: allowance,
  });
}

describe('DealEngine.closeDeal — a trade is paid for once (#379)', () => {
  it('a trade is not paid for twice', () => {
    const s = setup();
    const before = s.economy.cash;

    // No lien on this one, so the whole allowance IS the customer's equity —
    // money they never hand over because it is credit against the purchase.
    closeWithTrade(s, { allowance: EQUITY, equity: EQUITY });

    expect(s.economy.cash).toBe(before + AGREED_PRICE - EQUITY);
    // The pre-#379 reading, stated so a regression names itself.
    expect(s.economy.cash).not.toBe(before + AGREED_PRICE);
  });

  it('revenue is still the selling price', () => {
    const s = setup();

    const result = closeWithTrade(s, { allowance: ALLOWANCE, equity: EQUITY });

    const sale = s.economy
      .getPnL(1, 99)
      .entries.filter((e) => e.type === 'revenue' && e.label.startsWith('Vehicle sale'));
    expect(sale).toHaveLength(1);
    expect(sale[0].amount).toBe(AGREED_PRICE);
    // Front gross is the selling price against the unit's own cost — the trade
    // is a separate car and has no business inside this deal's gross.
    expect(result.frontGross).toBe(AGREED_PRICE - 14_000);
  });

  it('the lien is actually paid off', () => {
    const s = setup();
    const before = s.economy.cash;

    closeWithTrade(s, { allowance: ALLOWANCE, equity: EQUITY });

    // Both directions the allowance settles in: the equity the customer never
    // paid, and the payoff wired to their lienholder. Their sum is the
    // allowance, which is why one debit covers both.
    expect(s.economy.cash).toBe(before + AGREED_PRICE - EQUITY - PAYOFF);
    expect(s.economy.cash).toBe(before + AGREED_PRICE - ALLOWANCE);
  });

  it('a cash deal with no trade is unchanged', () => {
    const s = setup();
    const before = s.economy.cash;

    s.dealEngine.closeDeal({
      customerId: 'cust-2',
      vehicleId: 'v1',
      agreedPrice: AGREED_PRICE,
      paymentMethod: 'cash',
    });

    expect(s.economy.cash).toBe(before + AGREED_PRICE);
    expect(s.economy.getPnL(1, 99).entries.some((e) => e.type === 'expense')).toBe(false);
  });

  it('the allowance is stock spend, not operating spend', () => {
    const s = setup();

    closeWithTrade(s, { allowance: ALLOWANCE, equity: EQUITY });

    // Same category an auction buy carries (#255): cash converted into a car.
    // It is what keeps the allowance off the accrual P&L and inside the Home
    // cash-delta's "into stock" column.
    expect(s.economy.inventoryAcquisitionSpend).toBe(ALLOWANCE);
  });
});
