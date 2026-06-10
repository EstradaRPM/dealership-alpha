import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { DealershipApp } from '../App';
import { createInMemoryDriverFactory } from '../src/game/SaveStore';
import type { WorldSnapshot } from '../src/worldSnapshot';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

// These flows render the whole app and run a floor day end-to-end; the default
// 5s is too tight under CI contention (this repo runs the suite on both push and
// pull_request, so two runners compete). They complete in <1s locally.
jest.setTimeout(20_000);

describe('App save/load flow', () => {
  it('saves the current floor state, returns to main menu, and continues from that save', async () => {
    const screen = render(
      <DealershipApp driverFactory={createInMemoryDriverFactory()} />,
    );

    await waitFor(() => expect(screen.getByText('DEALERSHIP')).toBeTruthy());
    fireEvent.press(screen.getByText('New Game'));
    fireEvent.changeText(screen.getByPlaceholderText('Name this save'), 'Flow Save');
    fireEvent.press(screen.getByText('Create & Continue'));

    await waitFor(() => expect(screen.getByText('Who are you?')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Ray Estrada');
    fireEvent.press(screen.getByText('Ex-Mechanic'));
    fireEvent.press(screen.getByText('Begin'));

    await waitFor(() => expect(screen.getByText('Manager Desk')).toBeTruthy());
    // START DAY enters the floor MODE from the pinned shell action (#215).
    fireEvent.press(screen.getByText('Open Floor →'));
    await waitFor(() => expect(screen.getByText('FLOOR')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Open game menu'));
    await waitFor(() => expect(screen.getByText('Game Menu')).toBeTruthy());
    fireEvent.press(screen.getByText('Save & Main Menu'));

    await waitFor(() => expect(screen.getByText('DEALERSHIP')).toBeTruthy());
    fireEvent.press(screen.getByText('Continue'));

    await waitFor(() => expect(screen.getByText('FLOOR')).toBeTruthy());
    expect(screen.queryByLabelText('Open Floor')).toBeNull();
  });

  it('persists bought inventory into the active save slot immediately', async () => {
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
    fireEvent.changeText(screen.getByPlaceholderText('Name this save'), 'Inventory Save');
    fireEvent.press(screen.getByText('Create & Continue'));

    await waitFor(() => expect(screen.getByText('Who are you?')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Ray Estrada');
    fireEvent.press(screen.getByText('Ex-Mechanic'));
    fireEvent.press(screen.getByText('Begin'));

    await waitFor(() => expect(screen.getByText('Manager Desk')).toBeTruthy());
    // The auction lever lives under Operations in the rebranded IA (#215).
    fireEvent.press(screen.getByLabelText('Operations'));
    fireEvent.press(screen.getByText('Visit Auction →'));
    await waitFor(() => expect(screen.getByText('Auction Lane')).toBeTruthy());

    fireEvent.press(screen.getAllByText(/^\d{4} /)[0]);
    await waitFor(() => expect(screen.getByText(/^Buy for/)).toBeTruthy());
    fireEvent.press(screen.getByText(/^Buy for/));

    await waitFor(async () => {
      const state = await services?.saveStore.load();
      const savedWorld = state?.world as WorldSnapshot | undefined;
      expect(savedWorld?.modules.inventory.lotVehicles.length).toBeGreaterThan(0);
    });
  });

  it('continues from a true save with lot inventory and asking prices restored', async () => {
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
    fireEvent.changeText(screen.getByPlaceholderText('Name this save'), 'Loaded Lot');
    fireEvent.press(screen.getByText('Create & Continue'));

    await waitFor(() => expect(screen.getByText('Who are you?')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Ray Estrada');
    fireEvent.press(screen.getByText('Ex-Mechanic'));
    fireEvent.press(screen.getByText('Begin'));

    await waitFor(() => expect(screen.getByText('Manager Desk')).toBeTruthy());
    // Auction + pricing levers live under Operations in the rebranded IA (#215).
    fireEvent.press(screen.getByLabelText('Operations'));
    fireEvent.press(screen.getByText('Visit Auction →'));
    await waitFor(() => expect(screen.getByText('Auction Lane')).toBeTruthy());

    fireEvent.press(screen.getAllByText(/^\d{4} /)[0]);
    await waitFor(() => expect(screen.getByText(/^Buy for/)).toBeTruthy());
    fireEvent.press(screen.getByText(/^Buy for/));

    let savedVehicle: WorldSnapshot['modules']['inventory']['lotVehicles'][number] | undefined;
    await waitFor(async () => {
      const state = await services?.saveStore.load();
      const savedWorld = state?.world as WorldSnapshot | undefined;
      savedVehicle = savedWorld?.modules.inventory.lotVehicles[0];
      expect(savedVehicle).toBeDefined();
    });
    const vehicle = savedVehicle!;

    fireEvent.press(screen.getByText(/Back/));
    await waitFor(() => expect(screen.getByText('Manager Desk')).toBeTruthy());
    // Returning from a screen lands on Home; the pricing lever is on Operations.
    fireEvent.press(screen.getByLabelText('Operations'));
    const askingPriceInput = screen.getByLabelText(`Asking price for ${vehicle.id}`);
    const loadedAskingPrice = vehicle.askingPrice + 1234;
    fireEvent.changeText(askingPriceInput, String(loadedAskingPrice));
    fireEvent(askingPriceInput, 'blur');

    await waitFor(async () => {
      const state = await services?.saveStore.load();
      const savedWorld = state?.world as WorldSnapshot | undefined;
      expect(savedWorld?.modules.inventory.lotVehicles[0]?.askingPrice).toBe(
        loadedAskingPrice,
      );
    });

    fireEvent.press(screen.getByLabelText('Open game menu'));
    await waitFor(() => expect(screen.getByText('Game Menu')).toBeTruthy());
    fireEvent.press(screen.getByText('Save & Main Menu'));

    await waitFor(() => expect(screen.getByText('DEALERSHIP')).toBeTruthy());
    fireEvent.press(screen.getByText('Continue'));

    await waitFor(() => expect(screen.getByText('Manager Desk')).toBeTruthy());
    // Pricing levers are reached via Operations after a continue/load (#215).
    fireEvent.press(screen.getByLabelText('Operations'));
    expect(
      screen.getByLabelText(
        `Open pricing for ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText(`Asking price for ${vehicle.id}`).props.value).toBe(
      String(loadedAskingPrice),
    );
  });
});
