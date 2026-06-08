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
      daysInInventory: 12,
      carryingCostToDate: 240,
      dailyCarryingCost: 20,
      aged: false,
    },
  ],
  onSetAskingPrice: jest.fn(),
  onOpenPricing: jest.fn(),
  pricingStrategyOptions: [
    { id: 'aggressive', label: 'Aggressive', blurb: 'List above market.' },
    { id: 'market', label: 'Market', blurb: 'List at market.' },
    { id: 'value', label: 'Value', blurb: 'List below market.' },
  ],
  pricingStrategyId: 'market',
  onSelectPricingStrategy: jest.fn(),
  onOpenAuction: jest.fn(),
  onOpenHiring: jest.fn(),
  rosterCount: 2,
  hoursOptions: [
    { id: 'short', label: '8 hrs', ticksPerDay: 120 },
    { id: 'standard', label: '10 hrs', ticksPerDay: 180 },
  ],
  hoursOfOpId: 'standard',
  onSelectHours: jest.fn(),
  tradePolicyOptions: [
    { id: 'aggressive', label: 'Aggressive', blurb: 'Pay over book to win trades.' },
    { id: 'market', label: 'Market', blurb: 'Appraise at honest book.' },
    { id: 'conservative', label: 'Conservative', blurb: 'Target under book to protect gross.' },
  ],
  tradePolicyId: 'market',
  onSelectTradePolicy: jest.fn(),
  advertisingOptions: [
    { id: 'none', label: 'No campaign', blurb: 'No paid advertising push.' },
    { id: 'local-radio', label: 'Local radio', blurb: 'Aim at practical shoppers.' },
  ],
  advertisingCampaignId: 'none',
  onSelectAdvertisingCampaign: jest.fn(),
};

describe('OwnershipLevers smoke tests', () => {
  it('renders all levers without crashing', () => {
    expect(() => render(<OwnershipLevers {...BASE} />)).not.toThrow();
  });

  it('shows the selected trade policy blurb and dispatches a policy change', () => {
    const onSelectTradePolicy = jest.fn();
    const { getByText, getAllByText } = render(
      <OwnershipLevers {...BASE} onSelectTradePolicy={onSelectTradePolicy} />,
    );
    // The market blurb is visible for the current selection.
    expect(getByText('Appraise at honest book.')).toBeTruthy();
    // Both the Pricing and Trade-Policy cards have an "Aggressive" chip; the
    // Trade-Policy card renders last, so it is the second match.
    fireEvent.press(getAllByText('Aggressive')[1]);
    expect(onSelectTradePolicy).toHaveBeenCalledWith('aggressive');
  });

  it('shows the pricing strategy blurb and dispatches a strategy change', () => {
    const onSelectPricingStrategy = jest.fn();
    const { getByText, getAllByText } = render(
      <OwnershipLevers
        {...BASE}
        onSelectPricingStrategy={onSelectPricingStrategy}
      />,
    );
    expect(getByText('List at market.')).toBeTruthy();
    // Pricing card renders first → its "Aggressive" chip is the first match.
    fireEvent.press(getAllByText('Aggressive')[0]);
    expect(onSelectPricingStrategy).toHaveBeenCalledWith('aggressive');
  });

  it('tapping a vehicle row opens the pricing screen', () => {
    const onOpenPricing = jest.fn();
    const { getByLabelText } = render(
      <OwnershipLevers {...BASE} onOpenPricing={onOpenPricing} />,
    );
    fireEvent.press(getByLabelText('Open pricing for 2019 Toyota Camry'));
    expect(onOpenPricing).toHaveBeenCalledWith('v1');
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

  it('selecting an advertising campaign dispatches its id', () => {
    const onSelectAdvertisingCampaign = jest.fn();
    const { getByText } = render(
      <OwnershipLevers
        {...BASE}
        onSelectAdvertisingCampaign={onSelectAdvertisingCampaign}
      />,
    );
    expect(getByText('No paid advertising push.')).toBeTruthy();
    fireEvent.press(getByText('Local radio'));
    expect(onSelectAdvertisingCampaign).toHaveBeenCalledWith('local-radio');
  });
});
