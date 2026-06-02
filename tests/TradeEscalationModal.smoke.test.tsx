import React from 'react';
import { render } from '@testing-library/react-native';
import {
  TradeEscalationModal,
  type TradeReview,
} from '../src/ui/TradeEscalationModal';

const REVIEW: TradeReview = {
  customerId: 'cust:42',
  currentVehicle: {
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
  staffConfidence: 0.7,
};

describe('TradeEscalationModal smoke tests', () => {
  it('renders closed (not visible) without crashing', () => {
    expect(() =>
      render(
        <TradeEscalationModal visible={false} review={null} onDecide={jest.fn()} />,
      ),
    ).not.toThrow();
  });

  it('renders the escalated trade with all four decisions without crashing', () => {
    expect(() =>
      render(
        <TradeEscalationModal visible review={REVIEW} onDecide={jest.fn()} />,
      ),
    ).not.toThrow();
  });

  it('renders a free-and-clear trade (no lien) without crashing', () => {
    expect(() =>
      render(
        <TradeEscalationModal
          visible
          review={{
            ...REVIEW,
            payoff: 0,
            currentVehicle: { ...REVIEW.currentVehicle, loanPayoff: null },
          }}
          onDecide={jest.fn()}
        />,
      ),
    ).not.toThrow();
  });

  it('renders a resolved counter result (accepted / rejected) without crashing', () => {
    expect(() =>
      render(
        <TradeEscalationModal
          visible
          review={REVIEW}
          onDecide={jest.fn()}
          counterResult={{ amount: 6_500, accepted: true }}
        />,
      ),
    ).not.toThrow();
    expect(() =>
      render(
        <TradeEscalationModal
          visible
          review={REVIEW}
          onDecide={jest.fn()}
          counterResult={{ amount: 6_500, accepted: false }}
        />,
      ),
    ).not.toThrow();
  });
});
