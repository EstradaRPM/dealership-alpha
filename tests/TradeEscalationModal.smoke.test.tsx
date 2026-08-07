import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  TradeEscalationModal,
  type TradeReview,
} from '../src/ui/TradeEscalationModal';

const REVIEW: TradeReview = {
  customerId: 'cust:42',
  vehicle: {
    id: 'veh:1',
    make: 'Toyota',
    model: 'Camry',
    year: 2018,
    mileage: 62_000,
    category: 'sedan',
  },
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

  it('surfaces the negative-equity gap when the lien exceeds book', () => {
    const screen = render(
      <TradeEscalationModal
        visible
        review={{ ...REVIEW, book: 6_000, payoff: 9_000 }}
        onDecide={jest.fn()}
      />,
    );
    expect(screen.getByText('Underwater by')).toBeTruthy();
    expect(screen.getByText('$3,000')).toBeTruthy();
  });

  it('hides the negative-equity gap for a free-and-clear / above-water trade', () => {
    const screen = render(
      <TradeEscalationModal visible review={REVIEW} onDecide={jest.fn()} />,
    );
    expect(screen.queryByText('Underwater by')).toBeNull();
  });

  it('shows a booked recap + Done button on a resolved trade', () => {
    const onDismiss = jest.fn();
    const screen = render(
      <TradeEscalationModal
        visible
        review={REVIEW}
        onDecide={jest.fn()}
        outcome={{ kind: 'booked', agreedAllowance: 5_500 }}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText(/Trade booked at \$5,500/)).toBeTruthy();
    fireEvent.press(screen.getByText('Done'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows a walked recap on a declined trade', () => {
    const screen = render(
      <TradeEscalationModal
        visible
        review={REVIEW}
        onDecide={jest.fn()}
        outcome={{ kind: 'walked' }}
        onDismiss={jest.fn()}
      />,
    );
    expect(screen.getByText(/Customer walked/)).toBeTruthy();
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
