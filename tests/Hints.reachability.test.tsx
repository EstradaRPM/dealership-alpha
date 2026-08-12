import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { DealershipApp } from '../App';
import { createInMemoryDriverFactory } from '../src/game/SaveStore';
import { loadHints } from '../src/app/hints';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

// Renders the whole app to reach the levers; the default 5s is too tight under
// CI contention (this repo runs the suite on both push and pull_request).
jest.setTimeout(20_000);

// #386 anti-orphan. The teaching cell is per-slot and lives outside the world
// snapshot, so the ONLY proof the mechanism is wired is the running app: the
// hint drawing under a real control, the real handler retiring it, and the real
// `teaching:<id>` cell holding the mark afterwards. A harness cannot see the
// composition root's `onControlUsed` seam or the InGameMenu route.

describe('#386 consequence hints reach the live app and the slot cell', () => {
  it('a hint draws, the control retires it, and the menu re-arms it', async () => {
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
    fireEvent.changeText(
      screen.getByPlaceholderText('Name this save'),
      'Hints Save',
    );
    fireEvent.press(screen.getByText('Create & Continue'));

    await waitFor(() => expect(screen.getByText('Who are you?')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Ray Estrada');
    fireEvent.press(screen.getByText('Ex-Mechanic'));
    fireEvent.press(screen.getByText('Begin'));

    await waitFor(() => expect(screen.getByTestId('home-dashboard')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Operations'));
    await waitFor(() =>
      expect(screen.getByTestId('prep-fni-posture')).toBeTruthy(),
    );

    // The hint is mounted under the real dial, carrying the catalog's copy.
    const catalog = loadHints();
    await waitFor(() =>
      expect(screen.getByTestId('hint-fni-posture')).toBeTruthy(),
    );
    expect(screen.getByTestId('hint-fni-posture').props.children).toBe(
      catalog.hints.find((h) => h.id === 'fni_posture')!.text,
    );

    // Using the dial retires it, and the mark lands in this slot's cell.
    fireEvent.press(screen.getByText('More per deal'));
    expect(screen.queryByTestId('hint-fni-posture')).toBeNull();
    await waitFor(async () => {
      const teaching = await services?.teachingStoreForActiveSlot();
      expect(await teaching?.listTaught()).toEqual(['fni_posture']);
    });

    // The InGameMenu switch re-arms it without a reload.
    fireEvent.press(screen.getByLabelText('Open game menu'));
    await waitFor(() => expect(screen.getByText('Show hints again')).toBeTruthy());
    fireEvent.press(screen.getByText('Show hints again'));
    await waitFor(async () => {
      const teaching = await services?.teachingStoreForActiveSlot();
      expect(await teaching?.listTaught()).toEqual([]);
    });

    fireEvent.press(screen.getByText('Resume'));
    await waitFor(() =>
      expect(screen.getByTestId('hint-fni-posture')).toBeTruthy(),
    );
  });

  it('the Lot room carries the pricing-strategy hint', async () => {
    const screen = render(
      <DealershipApp driverFactory={createInMemoryDriverFactory()} />,
    );

    await waitFor(() => expect(screen.getByText('DEALERSHIP')).toBeTruthy());
    fireEvent.press(screen.getByText('New Game'));
    fireEvent.changeText(
      screen.getByPlaceholderText('Name this save'),
      'Lot Hint Save',
    );
    fireEvent.press(screen.getByText('Create & Continue'));

    await waitFor(() => expect(screen.getByText('Who are you?')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Ray Estrada');
    fireEvent.press(screen.getByText('Ex-Mechanic'));
    fireEvent.press(screen.getByText('Begin'));

    await waitFor(() => expect(screen.getByTestId('home-dashboard')).toBeTruthy());
    // The Lot is a room inside Operations (locked IA §4), reached off the dock.
    fireEvent.press(screen.getByLabelText('Operations'));
    await waitFor(() =>
      expect(screen.getByTestId('department-dock')).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId('dept-tile-lot'));
    await waitFor(() =>
      expect(screen.getByTestId('lot-pricing-strategy')).toBeTruthy(),
    );
    expect(screen.getByTestId('hint-pricing-strategy')).toBeTruthy();
  });
});
