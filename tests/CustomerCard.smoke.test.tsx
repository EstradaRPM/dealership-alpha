import React from 'react';
import { render } from '@testing-library/react-native';
import { CustomerCard } from '../src/ui/CustomerCard';

const financedVehicle = {
  templateId: 'vanda_sedan',
  brand: 'vanda',
  make: 'Honda',
  model: 'Civic',
  year: 2018,
  mileage: 72_400,
  condition: 'average' as const,
  category: 'sedan' as const,
  loanPayoff: 12_500,
};

describe('CustomerCard smoke', () => {
  it('renders the archetype label, current vehicle line, and payoff', () => {
    const { getByText } = render(
      <CustomerCard
        model={{
          customerId: 'customer:young_family:1:0',
          archetypeLabel: 'Young Family',
          currentVehicle: financedVehicle,
        }}
      />,
    );
    expect(getByText('Young Family')).toBeTruthy();
    expect(getByText('2018 Honda Civic')).toBeTruthy();
    expect(getByText('72,400 mi · Average')).toBeTruthy();
    expect(getByText('Loan payoff: $12,500')).toBeTruthy();
  });

  it('renders "Owned outright" when loanPayoff is null', () => {
    const { getByText } = render(
      <CustomerCard
        model={{
          customerId: 'customer:retiree:1:0',
          archetypeLabel: 'Retiree',
          currentVehicle: { ...financedVehicle, loanPayoff: null },
        }}
      />,
    );
    expect(getByText('Owned outright')).toBeTruthy();
  });

  it('renders "Unknown" when no currentVehicle is present (legacy session)', () => {
    const { getByText } = render(
      <CustomerCard
        model={{
          customerId: 'customer:retiree:1:0',
          archetypeLabel: 'Retiree',
        }}
      />,
    );
    expect(getByText('Unknown')).toBeTruthy();
  });
});
