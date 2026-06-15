import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { DealershipApp } from '../App';
import { createInMemoryDriverFactory } from '../src/game/SaveStore';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

describe('App discount escalation reachability', () => {
  it('opens DiscountEscalationModal from the live App event subscription', async () => {
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
      services!.bus.publish('discount:escalated', {
        customerId: 'cust:discount-review',
        day: 1,
        vehicle: {
          id: 'veh:discount',
          make: 'Toyota',
          model: 'Camry',
          year: 2018,
          mileage: 62_000,
          category: 'sedan',
        },
        marketPrice: 15_000,
        askingPrice: 15_500,
        customerTargetPrice: 12_600,
        salespersonCounter: 14_100,
        minimumAcceptablePrice: 11_800,
        frontGrossAtAsk: 3_700,
        canAcceptAsk: true,
        counterAttempts: 3,
        priorMisses: 0,
        salespersonCounterAcceptProb: 0.58,
        priceSensitivity: 0.5,
        missPenalty: 0.15,
      });
    });

    expect(screen.getByText(/MANAGER ATTENTION - DISCOUNT/)).toBeTruthy();
    expect(screen.getByText('cust:discount-review')).toBeTruthy();
    // The reframed readout (#287): a reactive acceptance % + patience meter,
    // not the old static "Customer target" row.
    expect(screen.getByText('58%')).toBeTruthy();
    expect(screen.getByText('Patience')).toBeTruthy();
  });
});
