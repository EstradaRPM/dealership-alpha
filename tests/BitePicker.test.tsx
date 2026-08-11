import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BitePicker } from '../src/ui/HomeTab';
import { availableBites } from '../src/game/ClockBite';

// #381 — the picker. A locked bite states its door in plain language; it is
// never hidden and never a silently greyed control.
describe('BitePicker (#381)', () => {
  it('a locked bite states the door, not a disabled control', () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <BitePicker options={availableBites([])} onRun={() => {}} />,
    );
    // Both bites above the day are locked at a cold store — and both are drawn.
    expect(getByTestId('bite-locked-week')).toBeTruthy();
    expect(getByTestId('bite-locked-month')).toBeTruthy();
    expect(queryByTestId('bite-run-week')).toBeNull();
    // The door is stated verbatim, off the catalog.
    expect(
      getByText(/Run the Week: .*desk a discount.*approve a trade/),
    ).toBeTruthy();
    expect(getByText(/Run the Month: .*general manager/)).toBeTruthy();
  });

  it('a covered desk gives the week a real control that runs it', () => {
    const ran: string[] = [];
    const { getByTestId, queryByTestId } = render(
      <BitePicker
        options={availableBites(['discount_desking', 'trade_approval'])}
        onRun={(id) => ran.push(id)}
      />,
    );
    expect(queryByTestId('bite-locked-week')).toBeNull();
    fireEvent.press(getByTestId('bite-run-week'));
    expect(ran).toEqual(['week']);
    // The month is still shut, and still says why.
    expect(getByTestId('bite-locked-month')).toBeTruthy();
  });

  it('never draws the day — the day is the live floor and keeps the hero CTA', () => {
    const { queryByTestId } = render(
      <BitePicker
        options={availableBites(['discount_desking', 'trade_approval', 'general_manager'])}
        onRun={() => {}}
      />,
    );
    expect(queryByTestId('bite-run-day')).toBeNull();
    expect(queryByTestId('bite-locked-day')).toBeNull();
    expect(queryByTestId('bite-run-week')).toBeTruthy();
    expect(queryByTestId('bite-run-month')).toBeTruthy();
  });

  // #383 — the bite is a bet, so the picker states what is being wagered before
  // the player commits. A bet you cannot read before placing is not a decision.
  it('the picker names the stakes of a bigger bite', () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <BitePicker
        options={availableBites(['discount_desking', 'trade_approval'])}
        onRun={() => {}}
      />,
    );
    // Stated verbatim off the catalog, under the control that places the bet.
    expect(getByTestId('bite-stakes-week')).toBeTruthy();
    expect(getByText(/Seven days run without you unless something needs you/)).toBeTruthy();
    // A locked bite states its door instead — the stakes of a bet you cannot
    // place yet are not what the player needs to read.
    expect(queryByTestId('bite-stakes-month')).toBeNull();
    expect(getByTestId('bite-locked-month')).toBeTruthy();
  });

  it('renders without crashing when every bite is open', () => {
    expect(() =>
      render(
        <BitePicker
          options={availableBites([
            'discount_desking',
            'trade_approval',
            'general_manager',
          ])}
          onRun={() => {}}
          disabled
        />,
      ),
    ).not.toThrow();
  });
});
