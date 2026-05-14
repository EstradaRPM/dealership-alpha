import React from 'react';
import { render } from '@testing-library/react-native';
import { SalesWorkspace } from '../src/ui/SalesWorkspace';
import type { CustomerSession } from '../src/game/CustomerPool';
import { createDealEngine } from '../src/game/DealEngine';

const mockSession: CustomerSession = {
  customerId: 'test-customer',
  day: 1,
  archetypeLabel: 'Commuter',
  stage: 'UNGREETED',
  bundle: {
    person: {
      id: 'test-customer',
      trait_ids: [],
      wealth: 50000,
      credit: 680,
      int: 60,
      agreeableness: 65,
      brand_affinity: {},
      counters: { prior_visits: 0, prior_deals: 0, days_since_last_visit: 0 },
    },
    visit: {
      kind: 'sales',
      person_id: 'test-customer',
      preferences: { safety: 0.5, performance: 0.3, appearance: 0.3, comfort: 0.4, economy: 0.7, dependability: 0.7 },
      resources: { trust: 0.4, patience: 0.6 },
    },
  },
};

const mockDealEngine = createDealEngine();

describe('SalesWorkspace — smoke', () => {
  it('renders without crashing', () => {
    expect(() =>
      render(
        <SalesWorkspace
          session={mockSession}
          onDispatch={jest.fn()}
          onClose={jest.fn()}
          dealEngine={mockDealEngine}
        />,
      ),
    ).not.toThrow();
  });

  it('renders four tabs: Show Vehicle, Negotiate, Structure, Walk', () => {
    const { getAllByText, getByText } = render(
      <SalesWorkspace
        session={mockSession}
        onDispatch={jest.fn()}
        onClose={jest.fn()}
        dealEngine={mockDealEngine}
      />,
    );
    // "Show Vehicle" appears in both the tab bar and the action button
    expect(getAllByText('Show Vehicle').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Negotiate')).toBeTruthy();
    expect(getByText('Structure')).toBeTruthy();
    expect(getByText('Walk')).toBeTruthy();
  });

  it('shows Greet Customer button when UNGREETED', () => {
    const { getByText } = render(
      <SalesWorkspace
        session={mockSession}
        onDispatch={jest.fn()}
        onClose={jest.fn()}
        dealEngine={mockDealEngine}
      />,
    );
    expect(getByText('Greet Customer')).toBeTruthy();
  });

  it('shows stage label in header', () => {
    const { getByText } = render(
      <SalesWorkspace
        session={mockSession}
        onDispatch={jest.fn()}
        onClose={jest.fn()}
        dealEngine={mockDealEngine}
      />,
    );
    expect(getByText('UNGREETED')).toBeTruthy();
  });
});
