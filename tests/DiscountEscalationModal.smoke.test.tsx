import React from 'react';
import { render } from '@testing-library/react-native';
import {
  DiscountEscalationModal,
  type DiscountReview,
} from '../src/ui/DiscountEscalationModal';

const REVIEW: DiscountReview = {
  customerId: 'cust:42',
  vehicle: {
    id: 'veh:42',
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
};

describe('DiscountEscalationModal smoke tests', () => {
  it('renders closed without crashing', () => {
    expect(() =>
      render(
        <DiscountEscalationModal
          visible={false}
          review={null}
          onDecide={jest.fn()}
        />,
      ),
    ).not.toThrow();
  });

  it('renders the escalated discount with the opening acceptance read', () => {
    const screen = render(
      <DiscountEscalationModal visible review={REVIEW} onDecide={jest.fn()} />,
    );
    // Opening headline is the salesperson's failed-counter prob (58%); the raw
    // "N offers left" countdown is gone.
    expect(screen.getByText('58%')).toBeTruthy();
    expect(screen.queryByText(/offers left/)).toBeNull();
  });

  it('slams the headline to the just-rejected offer prob on a committed counter', () => {
    const screen = render(
      <DiscountEscalationModal
        visible
        review={REVIEW}
        onDecide={jest.fn()}
        counterResult={{
          amount: 13_000,
          accepted: false,
          attemptsRemaining: 2,
          acceptProb: 0.24,
        }}
      />,
    );
    expect(screen.getByText('24%')).toBeTruthy();
    expect(screen.queryByText(/offers left/)).toBeNull();
  });

  it('renders the sold buy/walk recap with a Done action', () => {
    const screen = render(
      <DiscountEscalationModal
        visible
        review={REVIEW}
        onDecide={jest.fn()}
        outcome={{ kind: 'sold', soldPrice: 13_000, frontGross: 1_200 }}
        onDismiss={jest.fn()}
      />,
    );
    expect(screen.getByText(/SOLD at/)).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
  });
});
