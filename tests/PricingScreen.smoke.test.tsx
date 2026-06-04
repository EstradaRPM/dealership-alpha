import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  PricingScreen,
  type PricingScreenProps,
} from '../src/ui/PricingScreen';

const BASE: PricingScreenProps = {
  vehicle: {
    id: 'v1',
    year: 2019,
    make: 'Toyota',
    model: 'Camry',
    trim: 'LE',
    bookValue: 18000,
    marketPrice: 22000,
    vehicleCost: 17000,
    initialAskingPrice: 22000,
    daysInInventory: 12,
    carryingCostToDate: 240,
    dailyCarryingCost: 20,
    aged: false,
    agedThresholdDays: 45,
  },
  comps: [
    { id: 'a', name: 'Budget Bros', pricePoint: 'budget', price: 20500 },
    { id: 'b', name: 'Fair Deal', pricePoint: 'standard', price: 22000 },
  ],
  suggestion: {
    price: 22000,
    source: 'ucm',
    pricingSkill: 72,
    strategyLabel: 'Market',
  },
  predictDays: () => ({ expectedDays: 30, confidence: 0.6 }),
  classifyPosition: () => 'at-market',
  enabled: true,
  onCommit: jest.fn(),
  onClose: jest.fn(),
};

describe('PricingScreen smoke tests', () => {
  it('renders all panels without crashing', () => {
    const { getByText, getByTestId } = render(<PricingScreen {...BASE} />);
    expect(getByTestId('pricing-screen')).toBeTruthy();
    expect(getByText('At market')).toBeTruthy();
    expect(getByText('Predicted days to sell')).toBeTruthy();
    expect(getByText('Used-Car Manager')).toBeTruthy();
    expect(getByText(/Budget Bros/)).toBeTruthy();
  });

  it('applying the staff suggestion commits the suggested price', () => {
    const onCommit = jest.fn();
    const { getByText } = render(
      <PricingScreen {...BASE} onCommit={onCommit} />,
    );
    fireEvent.press(getByText('Apply'));
    expect(onCommit).toHaveBeenCalledWith(22000);
  });

  it('the stepper commits a stepped-down price', () => {
    const onCommit = jest.fn();
    const { getByLabelText } = render(
      <PricingScreen {...BASE} onCommit={onCommit} />,
    );
    fireEvent.press(getByLabelText('Lower asking price'));
    expect(onCommit).toHaveBeenCalledWith(21950);
  });

  it('renders the aging warning for an aged unit', () => {
    const aged = {
      ...BASE,
      vehicle: { ...BASE.vehicle, aged: true, daysInInventory: 60 },
    };
    const { getByText } = render(<PricingScreen {...aged} />);
    expect(getByText(/Aged — 60d on lot/)).toBeTruthy();
  });

  it('shows the heuristic rationale when no UCM is on staff', () => {
    const noUcm = {
      ...BASE,
      suggestion: { ...BASE.suggestion, source: 'heuristic' as const, pricingSkill: undefined },
    };
    const { getByText } = render(<PricingScreen {...noUcm} />);
    expect(getByText(/Hire a Used-Car Manager/)).toBeTruthy();
  });

  it('is read-only when disabled (apply does nothing)', () => {
    const onCommit = jest.fn();
    const { getByText } = render(
      <PricingScreen {...BASE} enabled={false} onCommit={onCommit} />,
    );
    fireEvent.press(getByText('Apply'));
    expect(onCommit).not.toHaveBeenCalled();
  });
});
