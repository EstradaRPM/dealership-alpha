import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { DealershipApp } from '../App';
import { createInMemoryDriverFactory } from '../src/game/SaveStore';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

describe('App trade escalation reachability', () => {
  it('opens TradeEscalationModal from the live App event subscription', async () => {
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

    await waitFor(() => expect(services).not.toBeNull());

    act(() => {
      // Underwater lien (payoff 9_000 > book 6_000): the modal must surface the
      // $3,000 negative-equity gap so the high ask reads as logical (#283).
      services!.bus.publish('trade:escalated', {
        customerId: 'cust:trade-review',
        day: 1,
        vehicle: {
          id: 'veh:trade-deal',
          make: 'Toyota',
          model: 'Camry',
          year: 2018,
          mileage: 62_000,
          category: 'sedan',
        },
        currentVehicle: {
          templateId: 'cv:civic',
          brand: 'vanda',
          make: 'Honda',
          model: 'Civic',
          year: 2016,
          mileage: 80_000,
          condition: 'average',
          category: 'sedan',
          loanPayoff: 9_000,
        },
        book: 6_000,
        allowanceAsk: 12_000,
        payoff: 9_000,
        target: 5_100,
        recommendedCounter: 5_500,
        staffConfidence: 0,
      });
    });

    expect(screen.getByText(/MANAGER ATTENTION/)).toBeTruthy();
    expect(screen.getByText('cust:trade-review')).toBeTruthy();
    expect(screen.getByText('Customer asks')).toBeTruthy();
    // The honest negative-equity readout is reachable from the live event.
    expect(screen.getByText('Underwater by')).toBeTruthy();
    expect(screen.getByText('$3,000')).toBeTruthy();
  });
});
