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
  customerAskPrice: 12_600,
  salespersonFloorPrice: 13_200,
  recommendedCounter: 12_900,
  minimumAcceptablePrice: 11_800,
  frontGrossAtFloor: 1_400,
  canAcceptAsk: true,
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

  it('renders the escalated discount with decisions without crashing', () => {
    expect(() =>
      render(
        <DiscountEscalationModal
          visible
          review={REVIEW}
          onDecide={jest.fn()}
        />,
      ),
    ).not.toThrow();
  });

  it('renders a rejected counter result without crashing', () => {
    expect(() =>
      render(
        <DiscountEscalationModal
          visible
          review={REVIEW}
          onDecide={jest.fn()}
          counterResult={{ amount: 13_000, accepted: false }}
        />,
      ),
    ).not.toThrow();
  });
});
