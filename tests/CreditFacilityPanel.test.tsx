import React from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld, type World } from '../src/createWorld';
import { FinanceTabContainer } from '../src/app/screens/FinanceTabContainer';
import { groupExpenses } from '../src/ui/FinanceTab';
import { CREDIT_INTEREST_LABEL } from '../src/game/CreditFacility';
import type { CharacterProfile } from '../src/game/CareerProgression';
import type { LedgerEntry } from '../src/game/Economy';
import type { TabStacks } from '../src/ui/Navigator';
import type { ShellTabKey } from '../src/ui/AppShell';
import { stubHints } from './helpers/hints';

/**
 * #393 — the borrowing facility on the Finance statement.
 *
 * Driven through the CONTAINER on a real `createWorld`, not against the
 * presentational panel with a hand-built model: the point of the slice is that
 * an owner can reach the line #392 built, and a panel that renders beautifully
 * off a fixture nobody composes is exactly the orphan the reachability rule
 * exists to catch.
 */

const LINE = 50_000;

function profile(startingCreditLine: number): CharacterProfile {
  return {
    name: 'Ray Estrada',
    backstoryId: 'ex-banker',
    day1Modifier: {
      backstoryId: 'ex-banker',
      reconJudgmentBonus: 0,
      startingCreditLine,
      startingCapitalBonus: 0,
      grudgesFlag: false,
    },
  };
}

function freshWorld(startingCreditLine = LINE, masterSeed = 393): World {
  return createWorld({
    bus: createEventBus(),
    masterSeed,
    characterProfile: profile(startingCreditLine),
  });
}

function stubTabs(): TabStacks<ShellTabKey> {
  return {
    navigate: () => {},
    back: () => {},
  } as unknown as TabStacks<ShellTabKey>;
}

function renderRoom(world: World, hints = stubHints()) {
  return render(
    <FinanceTabContainer
      world={world}
      tabs={stubTabs()}
      hints={hints}
      bump={() => {}}
      setCash={() => {}}
    />,
  );
}

/** The chip for an exact dollar amount, inside the declared control group. */
function pickAmount(screen: ReturnType<typeof renderRoom>, label: string) {
  const controls = screen.getByTestId('finance-credit-controls');
  fireEvent.press(within(controls).getByText(label));
}

describe('#393 the credit line is on the Finance statement', () => {
  it('states the three figures', () => {
    const screen = renderRoom(freshWorld());

    // Limit, drawn, headroom — the three numbers a borrowing decision is made
    // against, each off the module's one `getFacility()` read.
    expect(within(screen.getByTestId('finance-credit-limit')).getByText('$50,000')).toBeTruthy();
    expect(within(screen.getByTestId('finance-credit-drawn')).getByText('$0')).toBeTruthy();
    expect(
      within(screen.getByTestId('finance-credit-available')).getByText('$50,000'),
    ).toBeTruthy();
  });

  it('a draw amount is stated to the dollar', () => {
    const world = freshWorld();
    const screen = renderRoom(world);

    // #387: every figure the player commits against renders through `money`.
    // A compacted "$12.5k" on a button that borrows money would round a number
    // being signed for.
    pickAmount(screen, '$12,500');
    fireEvent.press(screen.getByTestId('finance-credit-controls-draw'));

    expect(world.creditFacility.getFacility().drawn).toBe(12_500);
    expect(screen.queryByTestId('finance-credit-notice')).toBeNull();
  });

  it('a store with no line draws no panel', () => {
    const screen = renderRoom(freshWorld(0));

    // Locked IA rule 3: a mechanic the store does not have renders NOTHING —
    // not a block of zeros with two dead buttons, and not an empty state.
    expect(screen.queryByTestId('finance-region-credit')).toBeNull();
    expect(screen.queryByTestId('finance-credit-controls')).toBeNull();
    // The rest of the room is untouched by its absence.
    expect(screen.getByTestId('finance-region-expenses')).toBeTruthy();
  });

  it('an over-draw is refused with the reason', () => {
    const world = freshWorld();
    const screen = renderRoom(world);

    pickAmount(screen, '$37,500');
    fireEvent.press(screen.getByTestId('finance-credit-controls-draw'));
    expect(world.creditFacility.getFacility().drawn).toBe(37_500);

    // $37.5k is standing and $12.5k is left, so asking for another $25k is more
    // than the line has. **Refused whole, never clamped** (#392) — the notice
    // states the headroom instead of quietly handing over less than was asked.
    pickAmount(screen, '$25,000');
    fireEvent.press(screen.getByTestId('finance-credit-controls-draw'));

    expect(world.creditFacility.getFacility().drawn).toBe(37_500);
    expect(screen.getByTestId('finance-credit-notice')).toHaveTextContent(/\$12,500/);
  });

  it('a repayment the store cannot afford is refused with what it can pay', () => {
    const world = freshWorld();
    const screen = renderRoom(world);

    pickAmount(screen, '$50,000');
    fireEvent.press(screen.getByTestId('finance-credit-controls-draw'));
    // Spend the borrowed money, so the balance outlives the cash that came with
    // it — the state a repayment refusal is actually about.
    world.economy.forceDebit(world.economy.cash - 1_000, 'Test drain');

    fireEvent.press(screen.getByTestId('finance-credit-controls-repay'));

    expect(world.creditFacility.getFacility().drawn).toBe(50_000);
    expect(screen.getByTestId('finance-credit-notice')).toHaveTextContent(/\$1,000/);
  });

  it('the hint retires when the control is used', () => {
    const used: string[] = [];
    const world = freshWorld();
    const screen = renderRoom(
      world,
      stubHints({ hintFor: () => 'What borrowing does.', markUsed: (id) => used.push(id) }),
    );

    expect(screen.getByTestId('hint-credit-line')).toBeTruthy();
    pickAmount(screen, '$12,500');
    fireEvent.press(screen.getByTestId('finance-credit-controls-draw'));
    expect(used).toEqual(['credit_line']);
  });
});

describe('#393 interest is its own expense line', () => {
  const entry = (label: string, amount: number): LedgerEntry => ({
    day: 1,
    type: 'expense',
    label,
    amount,
  });

  it('the smallest cost on the books survives the fold', () => {
    // Six labels against five bars, and the interest is the smallest of them —
    // exactly the shape real play produces, since a day of interest on a
    // $50,000 line is a few dollars against a payroll of hundreds. Without the
    // pin it would vanish into "Other" in every window that mattered.
    const grouped = groupExpenses([
      entry('Payroll', 4_000),
      entry('Marketing', 900),
      entry('Floorplan carrying cost', 600),
      entry('Recon', 400),
      entry('Wire subscription: retail-pulse', 120),
      entry(CREDIT_INTEREST_LABEL, 19),
    ]);

    expect(grouped.map((g) => g.label)).toContain(CREDIT_INTEREST_LABEL);
    expect(grouped.find((g) => g.label === CREDIT_INTEREST_LABEL)?.amount).toBe(19);
    // It took a slot from the tail, not from the budget: the chart still names
    // five costs plus the fold.
    expect(grouped).toHaveLength(6);
    expect(grouped[grouped.length - 1].label).toBe('Other');
  });

  it('the fold is unchanged for every other cost', () => {
    const grouped = groupExpenses([
      entry('Payroll', 4_000),
      entry('Marketing', 900),
      entry('Floorplan carrying cost', 600),
      entry('Recon', 400),
      entry('Parts order (rush): 2× panel', 300),
      entry('Hiring — sales_rep', 200),
      entry('Wire subscription: retail-pulse', 120),
    ]);

    // No pinned label present ⇒ the #351 rule verbatim: the five biggest, and
    // the rest in one bar.
    expect(grouped.map((g) => g.label)).toEqual([
      'Payroll',
      'Marketing',
      'Floorplan carrying cost',
      'Recon',
      'Parts order (rush): 2× panel',
      'Other',
    ]);
    expect(grouped[5].amount).toBe(320);
  });

  it('the charge reaches the panel through the live ledger', () => {
    const world = freshWorld();
    world.creditFacility.draw(LINE);
    const charge = world.creditFacility.getFacility().dailyInterest;
    world.clock.advanceDay();

    // The morning charge posts uncategorized (#392), so unlike the draw itself
    // it is a real cost and lands in the P&L window the expenses panel reads.
    const pnl = world.economy.getPnL(1, world.clock.currentDay);
    const interest = groupExpenses(pnl.entries).find(
      (g) => g.label === CREDIT_INTEREST_LABEL,
    );
    expect(interest?.amount).toBe(charge);
  });
});
