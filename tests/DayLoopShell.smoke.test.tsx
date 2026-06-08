import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { DayLoopShell } from '../src/ui/DayLoopShell';
import type { CharacterProfile } from '../src/game/CareerProgression';
import type { DayLoopState } from '../src/game/DayLoopController';
import type { DayRecapModel } from '../src/ui/DayRecap';
import type { DemandReadoutModel } from '../src/ui/DemandReadout';
import type { OwnershipLeversProps } from '../src/ui/OwnershipLevers';

const PROFILE: CharacterProfile = {
  name: 'Ray Estrada',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0.15,
    startingCreditLine: 0,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

const MANAGERIAL_AFTER_CLOSE: DayLoopState = {
  phase: 'MANAGERIAL',
  day: 1,
  ownershipUnlocked: true,
  hasRecap: true,
};

const RECAP: DayRecapModel = {
  day: 1,
  potentialTraffic: 18,
  walkedIn: 12,
  staffEngaged: 8,
  sold: 3,
  gross: 7_650,
  leakCause: 'closing',
  strongMatches: 2,
  matchedSales: 3,
};

const DEMAND_READOUT: DemandReadoutModel = {
  totalObserved: 7,
  entries: [
    {
      persona: 'young_family',
      label: 'Young Family',
      share: 0.57,
      count: 4,
      trend: 'rising',
    },
    {
      persona: 'tradesperson',
      label: 'Tradesperson',
      share: 0.43,
      count: 3,
      trend: 'steady',
    },
  ],
  targetingLevers: [
    {
      id: 'advertising',
      label: 'Advertising: Local radio',
      lean: [{ persona: 'young_family', label: 'Young Family', weight: 0.12 }],
    },
  ],
  coverageGap: {
    category: 'suv',
    label: 'SUVs',
    wantedCount: 4,
    stockCount: 0,
  },
};

function buildLeverProps(
  overrides: Partial<OwnershipLeversProps> = {},
): OwnershipLeversProps {
  return {
    enabled: true,
    vehicles: [
      {
        id: 'v1',
        year: 2019,
        make: 'Toyota',
        model: 'Camry',
        trim: 'LE',
        suggestedRetail: 15_000,
        askingPrice: 15_000,
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
      {
        id: 'aggressive',
        label: 'Aggressive',
        blurb: 'Pay over book to win trades.',
      },
      { id: 'market', label: 'Market', blurb: 'Appraise at honest book.' },
      {
        id: 'conservative',
        label: 'Conservative',
        blurb: 'Target under book to protect gross.',
      },
    ],
    tradePolicyId: 'market',
    onSelectTradePolicy: jest.fn(),
    advertisingOptions: [
      { id: 'none', label: 'No campaign', blurb: 'No paid advertising push.' },
      {
        id: 'local-radio',
        label: 'Local radio',
        blurb: 'Aim at practical shoppers.',
      },
    ],
    advertisingCampaignId: 'none',
    onSelectAdvertisingCampaign: jest.fn(),
    ...overrides,
  };
}

describe('DayLoopShell Manager Desk smoke', () => {
  it('renders recap content in Today and keeps the primary day action reachable', () => {
    const onNextDay = jest.fn();
    const { getByTestId, getByText } = render(
      <DayLoopShell
        profile={PROFILE}
        state={MANAGERIAL_AFTER_CLOSE}
        onNextDay={onNextDay}
        recap={RECAP}
      />,
    );

    expect(getByText('Manager Desk')).toBeTruthy();
    expect(
      within(getByTestId('manager-desk-region-today')).getByText('Day 1 Recap'),
    ).toBeTruthy();
    expect(getByTestId('manager-desk-region-market')).toBeTruthy();
    expect(getByTestId('manager-desk-region-prep')).toBeTruthy();
    expect(getByTestId('manager-desk-region-alerts')).toBeTruthy();

    fireEvent.press(getByText('Next Day →'));
    expect(onNextDay).toHaveBeenCalledTimes(1);
  });

  it('renders demand content inside Market while keeping the day action reachable', () => {
    const onNextDay = jest.fn();
    const { getByTestId, getByText } = render(
      <DayLoopShell
        profile={PROFILE}
        state={MANAGERIAL_AFTER_CLOSE}
        onNextDay={onNextDay}
        recap={RECAP}
        demandReadout={DEMAND_READOUT}
      />,
    );

    const market = within(getByTestId('manager-desk-region-market'));
    expect(market.getByText("Who's Been Walking In")).toBeTruthy();
    expect(market.getByText('Young Family')).toBeTruthy();
    expect(market.getByText("Who You're Targeting")).toBeTruthy();
    expect(
      market.getByText(/recent buyers wanted SUVs; you\s*stock 0/i),
    ).toBeTruthy();

    fireEvent.press(getByText('Next Day →'));
    expect(onNextDay).toHaveBeenCalledTimes(1);
  });

  it('renders composed ownership levers inside Prep and preserves callbacks', () => {
    const onOpenPricing = jest.fn();
    const onSelectPricingStrategy = jest.fn();
    const onOpenAuction = jest.fn();
    const onOpenHiring = jest.fn();
    const onSelectHours = jest.fn();
    const onSelectAdvertisingCampaign = jest.fn();
    const onSelectTradePolicy = jest.fn();
    const leverProps = buildLeverProps({
      onOpenPricing,
      onSelectPricingStrategy,
      onOpenAuction,
      onOpenHiring,
      onSelectHours,
      onSelectAdvertisingCampaign,
      onSelectTradePolicy,
    });
    const { getByTestId } = render(
      <DayLoopShell
        profile={PROFILE}
        state={MANAGERIAL_AFTER_CLOSE}
        onNextDay={() => {}}
        recap={RECAP}
        leverProps={leverProps}
      />,
    );

    const prep = within(getByTestId('manager-desk-region-prep'));
    expect(prep.getByTestId('ownership-levers')).toBeTruthy();
    expect(prep.getByText('Next-Day Prep')).toBeTruthy();

    fireEvent.press(prep.getByLabelText('Open pricing for 2019 Toyota Camry'));
    fireEvent.press(prep.getAllByText('Aggressive')[0]);
    fireEvent.press(prep.getByText('Visit Auction →'));
    fireEvent.press(prep.getByText('Hire Staff →'));
    fireEvent.press(prep.getByText('8 hrs'));
    fireEvent.press(prep.getByText('Local radio'));
    fireEvent.press(prep.getAllByText('Aggressive')[1]);

    expect(onOpenPricing).toHaveBeenCalledWith('v1');
    expect(onSelectPricingStrategy).toHaveBeenCalledWith('aggressive');
    expect(onOpenAuction).toHaveBeenCalledTimes(1);
    expect(onOpenHiring).toHaveBeenCalledTimes(1);
    expect(onSelectHours).toHaveBeenCalledWith('short');
    expect(onSelectAdvertisingCampaign).toHaveBeenCalledWith('local-radio');
    expect(onSelectTradePolicy).toHaveBeenCalledWith('aggressive');
  });

  it('uses Open Floor for the cold-start managerial action', () => {
    const { getByText } = render(
      <DayLoopShell
        profile={PROFILE}
        state={{ ...MANAGERIAL_AFTER_CLOSE, hasRecap: false }}
        onNextDay={() => {}}
      />,
    );

    expect(getByText('Open Floor →')).toBeTruthy();
  });
});
