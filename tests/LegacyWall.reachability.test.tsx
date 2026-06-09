import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { DealershipApp } from '../App';
import {
  createInMemoryDriverFactory,
  type LegacyEntry,
} from '../src/game/SaveStore';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

const COMPLETED_CAREER: LegacyEntry = {
  playerName: 'Alice Ruiz',
  backstoryId: 'mechanic',
  careerYear: 3,
  tierReached: 2,
  reason: 'retire',
  flavorText: 'Rode off into the sunset.',
  completedAt: '2026-01-01T00:00:00.000Z',
};

type LegacyWallServices = {
  legacyStore: {
    appendLegacy(entry: LegacyEntry): Promise<void>;
  };
};

function requireServices(services: LegacyWallServices | null): LegacyWallServices {
  if (services === null) {
    throw new Error('App services were not captured');
  }
  return services;
}

describe('#203 Legacy Wall reachability', () => {
  it('opens from the live MainMenu and renders completed careers from LegacyStore', async () => {
    let services: LegacyWallServices | null = null;
    const screen = render(
      <DealershipApp
        driverFactory={createInMemoryDriverFactory()}
        onServicesReady={(s) => {
          services = s;
        }}
      />,
    );

    await waitFor(() => expect(screen.getByText('DEALERSHIP')).toBeTruthy());
    await waitFor(() => expect(services).not.toBeNull());
    await requireServices(services).legacyStore.appendLegacy(COMPLETED_CAREER);

    fireEvent.press(screen.getByText('Legacy Wall'));

    await waitFor(() => expect(screen.getByText('WALL OF LEGACIES')).toBeTruthy());
    expect(screen.getByText('Alice Ruiz')).toBeTruthy();
    expect(screen.getByText('Retired')).toBeTruthy();
    expect(screen.getByText(/Yr 3/)).toBeTruthy();
  });
});
