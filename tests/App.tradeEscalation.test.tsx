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
      services!.bus.publish('trade:escalated', {
        customerId: 'cust:trade-review',
        day: 1,
        currentVehicle: {
          templateId: 'cv:civic',
          brand: 'vanda',
          make: 'Honda',
          model: 'Civic',
          year: 2016,
          mileage: 80_000,
          condition: 'average',
          category: 'sedan',
          loanPayoff: 4_000,
        },
        book: 6_000,
        allowanceAsk: 9_000,
        payoff: 4_000,
        target: 5_100,
        recommendedCounter: 5_500,
        staffConfidence: 0,
      });
    });

    expect(screen.getByText(/MANAGER ATTENTION/)).toBeTruthy();
    expect(screen.getByText('cust:trade-review')).toBeTruthy();
    expect(screen.getByText('Customer asks')).toBeTruthy();
  });
});
