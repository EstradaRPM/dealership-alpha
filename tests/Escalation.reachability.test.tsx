import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { DealershipApp } from '../App';
import { createInMemoryDriverFactory } from '../src/game/SaveStore';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

/**
 * Anti-orphan guard for the sold-out-from-under-them prompt (#364).
 *
 * Two customers can be held on the same car. The player resolves one, the unit
 * leaves the lot, and the other prompt is left offering an Accept that cannot
 * complete — it used to throw out of the resolution. The engine now walks that
 * customer; this file pins the other half, that the LIVE app's prompt says so
 * in plain language and stops offering the buttons.
 */

const CONTESTED_UNIT = {
  id: 'veh:contested',
  make: 'Toyota',
  model: 'Camry',
  year: 2018,
  mileage: 62_000,
  category: 'sedan',
};

/** The unit leaving the lot to the customer the player resolved first. */
const soldPayload = {
  day: 1,
  vehicleId: CONTESTED_UNIT.id,
  salePrice: 14_000,
  templateId: 'base_sedan',
  brand: 'vanda',
  make: CONTESTED_UNIT.make,
  year: CONTESTED_UNIT.year,
  mileage: CONTESTED_UNIT.mileage,
  condition: 'clean' as const,
  category: CONTESTED_UNIT.category,
  purchasePrice: 10_000,
  reconCost: 800,
  powertrain: 'ice' as const,
};

type Services = Parameters<
  NonNullable<React.ComponentProps<typeof DealershipApp>['onServicesReady']>
>[0];

async function mountApp() {
  let services: Services | null = null;
  const screen = render(
    <DealershipApp
      driverFactory={createInMemoryDriverFactory()}
      onServicesReady={(s) => {
        services = s;
      }}
    />,
  );
  await waitFor(() => expect(services).not.toBeNull());
  return { screen, services: services as unknown as Services };
}

describe('a pending escalation whose car sold to another customer (#364)', () => {
  it('the discount prompt says so and offers no accept action', async () => {
    const { screen, services } = await mountApp();

    act(() => {
      services.bus.publish('discount:escalated', {
        customerId: 'cust:second',
        day: 1,
        vehicle: CONTESTED_UNIT,
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

    // While the car is still on the lot, the negotiation is live.
    expect(screen.getByText(/Meet their target/)).toBeTruthy();

    act(() => {
      services.bus.publish('inventory:vehicle_sold', soldPayload);
    });

    expect(screen.getByText(/Another customer bought it/)).toBeTruthy();
    expect(screen.getByText(/2018 Toyota Camry/)).toBeTruthy();
    expect(screen.queryByText(/Meet their target/)).toBeNull();
    expect(screen.queryByText(/Re-pitch/)).toBeNull();
    expect(screen.queryByText('Propose')).toBeNull();
  });

  it('the trade prompt says so and offers no accept action', async () => {
    const { screen, services } = await mountApp();

    act(() => {
      services.bus.publish('trade:escalated', {
        customerId: 'cust:second',
        day: 1,
        vehicle: CONTESTED_UNIT,
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
        recommendedCounter: 7_000,
        staffConfidence: 0,
      });
    });

    expect(screen.getByText(/Accept ask/)).toBeTruthy();

    act(() => {
      services.bus.publish('inventory:vehicle_sold', soldPayload);
    });

    expect(screen.getByText(/Another customer bought it/)).toBeTruthy();
    expect(screen.getByText(/2018 Toyota Camry/)).toBeTruthy();
    expect(screen.queryByText(/Accept ask/)).toBeNull();
    expect(screen.queryByText(/Accept staff counter/)).toBeNull();
    expect(screen.queryByText('Propose')).toBeNull();
  });

  it('leaves a prompt on a different car alone', async () => {
    const { screen, services } = await mountApp();

    act(() => {
      services.bus.publish('discount:escalated', {
        customerId: 'cust:other-car',
        day: 1,
        vehicle: { ...CONTESTED_UNIT, id: 'veh:untouched' },
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
      services.bus.publish('inventory:vehicle_sold', soldPayload);
    });

    expect(screen.getByText(/Meet their target/)).toBeTruthy();
    expect(screen.queryByText(/Another customer bought it/)).toBeNull();
  });
});
