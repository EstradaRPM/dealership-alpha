import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  OwnershipLevers,
  type OwnershipLeversProps,
} from '../src/ui/OwnershipLevers';

const BASE: OwnershipLeversProps = {
  enabled: true,
  vehicles: [
    {
      id: 'v1',
      year: 2019,
      make: 'Toyota',
      model: 'Camry',
      trim: 'LE',
      suggestedRetail: 15000,
      askingPrice: 15000,
    },
  ],
  onSetAskingPrice: jest.fn(),
  onOpenAuction: jest.fn(),
  onOpenHiring: jest.fn(),
  rosterCount: 2,
  hoursOptions: [
    { id: 'short', label: '8 hrs', ticksPerDay: 120 },
    { id: 'standard', label: '10 hrs', ticksPerDay: 180 },
  ],
  hoursOfOpId: 'standard',
  onSelectHours: jest.fn(),
};

describe('OwnershipLevers smoke tests', () => {
  it('renders all four levers without crashing', () => {
    expect(() => render(<OwnershipLevers {...BASE} />)).not.toThrow();
  });

  it('renders greyed (no vehicles) when disabled', () => {
    expect(() =>
      render(
        <OwnershipLevers {...BASE} enabled={false} vehicles={[]} />,
      ),
    ).not.toThrow();
  });

  it('Stock/Auction + Hiring buttons dispatch when enabled', () => {
    const onOpenAuction = jest.fn();
    const onOpenHiring = jest.fn();
    const { getByText } = render(
      <OwnershipLevers
        {...BASE}
        onOpenAuction={onOpenAuction}
        onOpenHiring={onOpenHiring}
      />,
    );
    fireEvent.press(getByText('Visit Auction →'));
    fireEvent.press(getByText('Hire Staff →'));
    expect(onOpenAuction).toHaveBeenCalledTimes(1);
    expect(onOpenHiring).toHaveBeenCalledTimes(1);
  });

  it('selecting an hours option dispatches its id', () => {
    const onSelectHours = jest.fn();
    const { getByText } = render(
      <OwnershipLevers {...BASE} onSelectHours={onSelectHours} />,
    );
    fireEvent.press(getByText('8 hrs'));
    expect(onSelectHours).toHaveBeenCalledWith('short');
  });
});
