import { createEventBus, type EventBus } from '../src/game/EventBus';
import { createEconomy, type Economy } from '../src/game/Economy';
import {
  createCreditFacility,
  createDefaultCreditFacilitySnapshot,
  dailyInterestOn,
  loadCreditFacilityData,
  CREDIT_DRAW_LABEL,
  CREDIT_INTEREST_LABEL,
  CREDIT_REPAYMENT_LABEL,
  type CreditFacility,
} from '../src/game/CreditFacility';

/**
 * CreditFacility isolation tests (#392, F2-R1). Driven entirely through the
 * barrel, against a REAL Economy — the module's whole job is to move somebody
 * else's cash, so a spy ledger would be asserting on the calls it makes rather
 * than on the money that moved. The clock is stood in for by publishing
 * `clock:day_started`, which is the only signal the module consumes.
 */

const DATA = loadCreditFacilityData();
const LIMIT = 50_000;
const START_CASH = 20_000;

function build(limit = LIMIT, startingCash = START_CASH): {
  bus: EventBus;
  economy: Economy;
  credit: CreditFacility;
  morning: (day: number) => void;
} {
  const bus = createEventBus();
  let day = 1;
  const economy = createEconomy({
    bus,
    startingCash,
    getCurrentDay: () => day,
  });
  const credit = createCreditFacility({
    bus,
    economy,
    limit,
    getCurrentDay: () => day,
  });
  return {
    bus,
    economy,
    credit,
    morning: (d: number) => {
      day = d;
      bus.publish('clock:day_started', { day: d });
    },
  };
}

describe('CreditFacility — drawing (#392)', () => {
  it('a draw lands as cash and as debt', () => {
    const { economy, credit } = build();
    const result = credit.draw(30_000);

    expect(result).toEqual({ ok: true, amount: 30_000 });
    expect(economy.cash).toBe(START_CASH + 30_000);
    expect(credit.getFacility().drawn).toBe(30_000);
    expect(credit.getFacility().available).toBe(LIMIT - 30_000);
  });

  it('publishes credit:drawn with the balance AFTER the move', () => {
    const { bus, credit, morning } = build();
    const seen: { day: number; amount: number; drawn: number; limit: number }[] = [];
    bus.subscribe('credit:drawn', (p) => seen.push(p));

    morning(4);
    credit.draw(10_000);
    credit.draw(5_000);

    expect(seen).toEqual([
      { day: 4, amount: 10_000, drawn: 10_000, limit: LIMIT },
      { day: 4, amount: 5_000, drawn: 15_000, limit: LIMIT },
    ]);
  });

  it('a draw past the limit is refused whole', () => {
    const { economy, credit } = build();
    credit.draw(40_000);
    const cashBefore = economy.cash;

    // 11k over the remaining 10k of headroom: refused, NOT clamped to 10k.
    const result = credit.draw(11_000);

    expect(result).toEqual({ ok: false, reason: 'over-limit' });
    expect(economy.cash).toBe(cashBefore);
    expect(credit.getFacility().drawn).toBe(40_000);
    // Exactly the headroom still goes through — the refusal is about the
    // ceiling, not about being near it.
    expect(credit.draw(10_000)).toEqual({ ok: true, amount: 10_000 });
    expect(credit.getFacility().available).toBe(0);
  });

  it('a draw of nothing is not a draw', () => {
    const { economy, credit } = build();
    for (const bad of [0, -5_000, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(credit.draw(bad)).toEqual({ ok: false, reason: 'invalid-amount' });
    }
    expect(economy.cash).toBe(START_CASH);
    expect(credit.getFacility().drawn).toBe(0);
  });

  it('a draw is not income — it moves cash and leaves net income alone', () => {
    const { economy, credit } = build();
    credit.draw(30_000);

    const pnl = economy.getPnL(1, 1);
    expect(economy.cash).toBe(START_CASH + 30_000);
    expect(pnl.totalRevenue).toBe(0);
    expect(pnl.netIncome).toBe(0);
    // Dropped from the breakdown too, not merely netted out of the totals.
    expect(pnl.entries.some((e) => e.label === CREDIT_DRAW_LABEL)).toBe(false);
    // …but it IS on the ledger. The statement is a read of the record.
    expect(
      economy.snapshot().ledger?.some((e) => e.label === CREDIT_DRAW_LABEL),
    ).toBe(true);
  });
});

describe('CreditFacility — interest (#392)', () => {
  it('a standing balance costs money every day', () => {
    const { economy, credit, morning } = build();
    credit.draw(36_500);
    const perDay = dailyInterestOn(36_500, DATA);
    expect(perDay).toBeGreaterThan(0);
    expect(credit.getFacility().dailyInterest).toBe(perDay);

    const cashAfterDraw = economy.cash;
    morning(2);
    morning(3);
    morning(4);

    expect(economy.cash).toBe(cashAfterDraw - perDay * 3);
    expect(credit.getFacility().interestPaidToDate).toBe(perDay * 3);
    // The balance itself never moves — interest is a cost, not a repayment.
    expect(credit.getFacility().drawn).toBe(36_500);
  });

  it('posts the interest as a cash operating expense on the store profit center', () => {
    const { economy, credit, morning } = build();
    credit.draw(36_500);
    const perDay = dailyInterestOn(36_500, DATA);

    morning(2);

    const dept = economy.getDepartmentPnL(2, 2);
    // It reaches the P&L (unlike the draw) and it lands as overhead, not as any
    // department's cost of sale.
    expect(dept.overhead).toBe(perDay);
    expect(dept.netIncome).toBe(-perDay);
    for (const d of dept.departments) expect(d.active).toBe(false);

    const entry = economy
      .getPnL(2, 2)
      .entries.find((e) => e.label === CREDIT_INTEREST_LABEL);
    expect(entry).toMatchObject({ type: 'expense', profitCenter: 'store' });
    expect(entry?.nonCash).toBeUndefined();
    expect(entry?.category).toBeUndefined();
  });

  it('an undrawn facility costs nothing and posts nothing', () => {
    const { economy, credit, morning } = build();
    for (let d = 2; d <= 30; d++) morning(d);

    expect(economy.cash).toBe(START_CASH);
    expect(credit.getFacility().interestPaidToDate).toBe(0);
    expect(economy.snapshot().ledger).toEqual([]);
  });

  it('the balance stops costing the morning after it is repaid', () => {
    const { economy, credit, morning } = build();
    credit.draw(36_500);
    const perDay = dailyInterestOn(36_500, DATA);

    morning(2);
    expect(credit.getFacility().interestPaidToDate).toBe(perDay);

    credit.repay(36_500);
    morning(3);
    morning(4);

    // Charged exactly once — for the one morning the balance stood.
    expect(credit.getFacility().interestPaidToDate).toBe(perDay);
    expect(economy.cash).toBe(START_CASH - perDay);
  });

  it('interest is charged even when the store cannot pay it', () => {
    // The facility never calls the balance, so a store that cannot cover the
    // interest goes negative — which is what the bankruptcy machinery reads.
    const { economy, credit, morning } = build(50_000, 5);
    credit.draw(50_000);
    const perDay = dailyInterestOn(50_000, DATA);

    // Spend the drawn cash back out, leaving less than a day's interest.
    economy.postExpense(50_000, 'Auction purchase', {
      category: 'inventoryAcquisition',
    });
    expect(economy.cash).toBe(5);

    morning(2);

    expect(economy.cash).toBe(5 - perDay);
    expect(economy.cash).toBeLessThan(0);
    expect(credit.getFacility().interestPaidToDate).toBe(perDay);
  });
});

describe('CreditFacility — repaying (#392)', () => {
  it('a repayment clears debt, not interest already paid', () => {
    const { economy, credit, morning } = build();
    credit.draw(36_500);
    const perDay = dailyInterestOn(36_500, DATA);
    morning(2);

    const cashBefore = economy.cash;
    expect(credit.repay(10_000)).toEqual({ ok: true, amount: 10_000 });

    expect(economy.cash).toBe(cashBefore - 10_000);
    expect(credit.getFacility().drawn).toBe(26_500);
    expect(credit.getFacility().available).toBe(LIMIT - 26_500);
    // Interest already paid is spent money; paying the principal down does not
    // return any of it.
    expect(credit.getFacility().interestPaidToDate).toBe(perDay);
  });

  it('publishes credit:repaid with the balance AFTER the move', () => {
    const { bus, credit, morning } = build();
    const seen: { day: number; amount: number; drawn: number; limit: number }[] = [];
    bus.subscribe('credit:repaid', (p) => seen.push(p));

    credit.draw(20_000);
    morning(9);
    credit.repay(8_000);

    expect(seen).toEqual([
      { day: 9, amount: 8_000, drawn: 12_000, limit: LIMIT },
    ]);
  });

  it('a repayment the store cannot fund is refused', () => {
    // Draw 40k on top of 20k, then bury the cash in stock so the balance
    // outruns the bank account.
    const { economy, credit } = build();
    credit.draw(40_000);
    economy.postExpense(55_000, 'Auction purchase', {
      category: 'inventoryAcquisition',
    });
    expect(economy.cash).toBe(5_000);

    const result = credit.repay(40_000);

    expect(result).toEqual({ ok: false, reason: 'cannot-afford' });
    expect(economy.cash).toBe(5_000);
    expect(credit.getFacility().drawn).toBe(40_000);
    // `maxRepayment` is what the surface reads instead of re-deriving the rule,
    // and it is exactly the largest repayment that would not be refused.
    expect(credit.getFacility().maxRepayment).toBe(5_000);
    expect(credit.repay(5_000)).toEqual({ ok: true, amount: 5_000 });
  });

  it('a repayment larger than the balance is refused whole', () => {
    const { economy, credit } = build();
    credit.draw(10_000);
    const cashBefore = economy.cash;

    expect(credit.repay(10_001)).toEqual({ ok: false, reason: 'over-balance' });
    expect(economy.cash).toBe(cashBefore);
    expect(credit.getFacility().drawn).toBe(10_000);

    for (const bad of [0, -1_000, Number.NaN]) {
      expect(credit.repay(bad)).toEqual({ ok: false, reason: 'invalid-amount' });
    }
    expect(credit.getFacility().drawn).toBe(10_000);
  });

  it('a repayment is not an expense — it moves cash and leaves net income alone', () => {
    const { economy, credit } = build();
    credit.draw(10_000);
    credit.repay(4_000);

    const pnl = economy.getPnL(1, 1);
    expect(pnl.totalExpenses).toBe(0);
    expect(pnl.netIncome).toBe(0);
    expect(pnl.entries.some((e) => e.label === CREDIT_REPAYMENT_LABEL)).toBe(false);
    expect(economy.cash).toBe(START_CASH + 10_000 - 4_000);
  });
});

describe('CreditFacility — a limit of zero (#392)', () => {
  it('a zero-limit store still has a facility', () => {
    const { economy, credit, morning } = build(0);

    const state = credit.getFacility();
    expect(state).toEqual({
      limit: 0,
      drawn: 0,
      available: 0,
      maxRepayment: 0,
      interestPaidToDate: 0,
      dailyInterest: 0,
      apr: DATA.apr,
    });

    // Every door is shut by the SAME rule that governs a banker's facility —
    // there is no "no facility" branch to take.
    expect(credit.draw(1)).toEqual({ ok: false, reason: 'over-limit' });
    expect(credit.repay(1)).toEqual({ ok: false, reason: 'over-balance' });
    for (let d = 2; d <= 10; d++) morning(d);
    expect(economy.cash).toBe(START_CASH);

    // And it snapshots and restores like any other facility.
    expect(credit.snapshot()).toEqual({
      schemaVersion: 1,
      limit: 0,
      drawn: 0,
      interestPaidToDate: 0,
    });
  });
});

describe('CreditFacility — persistence (#392)', () => {
  it('round-trips the limit, the balance and the interest paid', () => {
    const a = build();
    a.credit.draw(25_000);
    a.morning(2);
    a.morning(3);
    a.credit.repay(5_000);
    const snap = a.credit.snapshot();

    const b = build();
    b.credit.restore(JSON.parse(JSON.stringify(snap)));

    expect(b.credit.getFacility()).toEqual(a.credit.getFacility());
    expect(b.credit.snapshot()).toEqual(snap);
  });

  it('a blob with no limit keeps the one the world was built with', () => {
    // The v21→v22 migration case: a career that predates the module never
    // borrowed, and its ceiling comes from the character profile the world was
    // just constructed from — not from the envelope.
    const { credit } = build(50_000);
    credit.restore(createDefaultCreditFacilitySnapshot());

    expect(credit.getFacility().limit).toBe(50_000);
    expect(credit.getFacility().drawn).toBe(0);
    expect(credit.getFacility().interestPaidToDate).toBe(0);
    expect(credit.draw(50_000)).toEqual({ ok: true, amount: 50_000 });
  });
});

describe('CreditFacility — the cost rule (#392)', () => {
  it('is one rule, stated once, and the previewed charge is the posted one', () => {
    const { economy, credit, morning } = build();
    credit.draw(50_000);

    const previewed = credit.getFacility().dailyInterest;
    const cashBefore = economy.cash;
    morning(2);

    expect(economy.cash).toBe(cashBefore - previewed);
    expect(previewed).toBe(Math.round((50_000 * DATA.apr) / DATA.daysPerYear));
  });

  it('a balance too small to cost a whole dollar posts nothing at all', () => {
    // A $0 ledger line is noise, not a charge.
    const tiny = 1;
    expect(dailyInterestOn(tiny, DATA)).toBe(0);
    const { economy, credit, morning } = build();
    credit.draw(tiny);
    const cashAfterDraw = economy.cash;
    morning(2);
    expect(economy.cash).toBe(cashAfterDraw);
    expect(
      economy.snapshot().ledger?.some((e) => e.label === CREDIT_INTEREST_LABEL),
    ).toBe(false);
  });
});
