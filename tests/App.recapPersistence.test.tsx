import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { DealershipApp } from '../App';
import { createInMemoryDriverFactory } from '../src/game/SaveStore';
import type { DayRecapModel } from '../src/ui/DayRecap';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

// Drives the whole app and runs a floor day to completion; the default 5s is
// tight under CI contention (suite runs on push and pull_request).
jest.setTimeout(20_000);

/**
 * #253 — the day-close recap is a modal that pops on day close, reopenable via
 * a Today-region chip, with the recap persisted so the chip stays truthful
 * across a reload (no "Night before Day 1" stamped onto a played save).
 */
describe('App day-recap modal + persistence (#253)', () => {
  it('pops the recap on day close, reopens from the chip, and survives a reload', async () => {
    let services: Parameters<
      NonNullable<React.ComponentProps<typeof DealershipApp>['onServicesReady']>
    >[0] | null = null;
    const screen = render(
      <DealershipApp
        driverFactory={createInMemoryDriverFactory()}
        onServicesReady={(s) => {
          services = s;
        }}
      />,
    );

    await waitFor(() => expect(screen.getByText('DEALERSHIP')).toBeTruthy());
    fireEvent.press(screen.getByText('New Game'));
    fireEvent.changeText(screen.getByPlaceholderText('Name this save'), 'Recap Save');
    fireEvent.press(screen.getByText('Create & Continue'));

    await waitFor(() => expect(screen.getByText('Who are you?')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Ray Estrada');
    fireEvent.press(screen.getByText('Ex-Mechanic'));
    fireEvent.press(screen.getByText('Begin'));

    await waitFor(() => expect(screen.getByTestId('home-dashboard')).toBeTruthy());
    // Pre-Day-1: honest copy, never a recap chip nor a buried recap card.
    expect(screen.getByText(/Your first day hasn.t opened yet/)).toBeTruthy();
    expect(screen.queryByLabelText('Open Day 1 recap')).toBeNull();

    // Open the floor, then burn the day to close in one jump.
    fireEvent.press(screen.getByText('Open Floor →'));
    await waitFor(() => expect(screen.getByText('FLOOR')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Skip to close'));

    // Day close pops the recap modal over Home (the funnel rows are unique to
    // the recap card, so they prove the modal — not just the chip — is up).
    await waitFor(() => expect(screen.getByText('Drove by')).toBeTruthy());

    // Persisted immediately at the day boundary.
    await waitFor(async () => {
      const state = await services?.saveStore.load();
      const recap = state?.lastRecap as DayRecapModel | undefined;
      expect(recap?.day).toBe(1);
    });

    // Dismiss → recap card gone, Today-region chip reopens it.
    fireEvent.press(screen.getByText('Done'));
    await waitFor(() => expect(screen.queryByText('Drove by')).toBeNull());
    const chip = screen.getByLabelText('Open Day 1 recap');
    expect(chip).toBeTruthy();
    // The pre-Day-1 lie is gone now that a day has closed.
    expect(screen.queryByText(/Your first day hasn.t opened yet/)).toBeNull();

    fireEvent.press(chip);
    await waitFor(() => expect(screen.getByText('Drove by')).toBeTruthy());
    fireEvent.press(screen.getByText('Done'));
    await waitFor(() => expect(screen.queryByText('Drove by')).toBeNull());

    // Save → main menu → cold-continue from the slot.
    fireEvent.press(screen.getByLabelText('Open game menu'));
    await waitFor(() => expect(screen.getByText('Game Menu')).toBeTruthy());
    fireEvent.press(screen.getByText('Save & Main Menu'));

    await waitFor(() => expect(screen.getByText('DEALERSHIP')).toBeTruthy());
    fireEvent.press(screen.getByText('Continue'));

    // The chip is restored from the persisted recap; the modal does NOT
    // auto-pop on load, and "Night before Day 1"/pre-Day-1 copy never shows.
    await waitFor(() =>
      expect(screen.getByLabelText('Open Day 1 recap')).toBeTruthy(),
    );
    expect(screen.queryByText('Drove by')).toBeNull();
    expect(screen.queryByText(/Your first day hasn.t opened yet/)).toBeNull();
  });
});
