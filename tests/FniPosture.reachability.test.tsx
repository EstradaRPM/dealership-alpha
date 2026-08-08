import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { DealershipApp } from '../App';
import { createInMemoryDriverFactory } from '../src/game/SaveStore';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

// Renders the whole app to reach the lever; the default 5s is too tight under
// CI contention (this repo runs the suite on both push and pull_request).
jest.setTimeout(20_000);

// #366 anti-orphan. The posture dial is a per-slot lever (grill I7): nothing
// about it lives in the world snapshot, so the ONLY proof it persists is the
// save state the running app writes. A module test cannot see this seam.

describe('#366 the F&I posture reaches the live app and the save slot', () => {
  it('the chosen posture round-trips through the slot', async () => {
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
    fireEvent.changeText(screen.getByPlaceholderText('Name this save'), 'Posture Save');
    fireEvent.press(screen.getByText('Create & Continue'));

    await waitFor(() => expect(screen.getByText('Who are you?')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Ray Estrada');
    fireEvent.press(screen.getByText('Ex-Mechanic'));
    fireEvent.press(screen.getByText('Begin'));

    await waitFor(() => expect(screen.getByTestId('home-dashboard')).toBeTruthy());
    // The dial sits beside the other pre-open desk levers in Operations → Prep
    // (grill Q6 — parallel to Trade Policy, not on a store-wide screen).
    fireEvent.press(screen.getByLabelText('Operations'));
    await waitFor(() => expect(screen.getByTestId('prep-fni-posture')).toBeTruthy());

    // A green store has no F&I manager, so the surface must say the posture is
    // not in effect yet rather than implying it is.
    expect(screen.getByText(/No finance manager on staff/i)).toBeTruthy();

    // #370 anti-orphan: the peak meter is mounted beside the dial in the live
    // app, not merely built. A brand-new store has financed nothing, so it must
    // be reading its empty state off the real `getFinancedBook()` — which is
    // also proof the composition root wired the book and the desk skill, since
    // an unwired meter would throw rather than render this.
    expect(screen.getByTestId('fni-peak-meter')).toBeTruthy();
    expect(screen.getByTestId('fni-peak-empty')).toBeTruthy();

    fireEvent.press(screen.getByText('More per deal'));

    await waitFor(async () => {
      const state = await services?.saveStore.load();
      expect(state?.fniPosture).toBe('more-per-deal');
    });
  });
});
